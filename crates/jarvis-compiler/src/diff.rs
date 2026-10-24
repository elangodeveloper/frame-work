//! Fine-grained IR diffing and patch generation for hot module replacement.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use crate::ir::{IrInstruction, TemplateIr};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type")]
pub enum PatchOp {
    #[serde(rename = "set_text")]
    SetText {
        path: String,
        content: String,
    },
    #[serde(rename = "set_attribute")]
    SetAttribute {
        path: String,
        name: String,
        value: String,
    },
    #[serde(rename = "update_binding")]
    UpdateBinding {
        path: String,
        binding_id: String,
        property: Option<String>,
        expression_js: String,
    },
    #[serde(rename = "replace_subtree")]
    ReplaceSubtree {
        path: String,
        html: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind")]
pub enum TemplateDiff {
    #[serde(rename = "identical")]
    Identical,
    #[serde(rename = "node_patch")]
    NodePatch {
        patches: Vec<PatchOp>,
    },
    #[serde(rename = "template_swap")]
    TemplateSwap {
        reason: String,
    },
}

#[derive(Debug, Clone)]
enum TreeNodeKind {
    Element { tag: String, is_component: bool },
    Text { content: String },
    IfBlock { condition_js: String },
    ForBlock { item_var: String, items_js: String },
}

#[derive(Debug, Clone)]
struct TreeNode {
    _id: usize,
    path: String,
    kind: TreeNodeKind,
    attributes: Vec<(String, String)>,
    text_bindings: Vec<(String, String)>,          // (binding_id, expr_js)
    prop_bindings: Vec<(String, String, String)>,  // (binding_id, prop, expr_js)
    event_bindings: Vec<(String, String, String)>, // (binding_id, event, expr_js)
    children: Vec<TreeNode>,
}

struct TreeBuilder<'a> {
    instructions: &'a [IrInstruction],
    children_map: HashMap<usize, Vec<usize>>,
    attributes_map: HashMap<usize, Vec<(String, String)>>,
    text_bindings_map: HashMap<usize, Vec<String>>,
    prop_bindings_map: HashMap<usize, Vec<(String, String)>>,
    event_bindings_map: HashMap<usize, Vec<(String, String)>>,
}

impl<'a> TreeBuilder<'a> {
    fn new(instructions: &'a [IrInstruction]) -> Self {
        let mut children_map: HashMap<usize, Vec<usize>> = HashMap::new();
        let mut attributes_map: HashMap<usize, Vec<(String, String)>> = HashMap::new();
        let mut text_bindings_map: HashMap<usize, Vec<String>> = HashMap::new();
        let mut prop_bindings_map: HashMap<usize, Vec<(String, String)>> = HashMap::new();
        let mut event_bindings_map: HashMap<usize, Vec<(String, String)>> = HashMap::new();

        for inst in instructions {
            match inst {
                IrInstruction::AppendChild { parent_id, child_id } => {
                    children_map.entry(*parent_id).or_default().push(*child_id);
                }
                IrInstruction::SetAttribute { id, name, value } => {
                    attributes_map.entry(*id).or_default().push((name.clone(), value.clone()));
                }
                IrInstruction::BindText { id, expression } => {
                    text_bindings_map.entry(*id).or_default().push(expression.to_js());
                }
                IrInstruction::BindProperty { id, property, expression } => {
                    prop_bindings_map.entry(*id).or_default().push((property.clone(), expression.to_js()));
                }
                IrInstruction::BindEvent { id, event, handler, .. } => {
                    event_bindings_map.entry(*id).or_default().push((event.clone(), handler.to_js()));
                }
                _ => {}
            }
        }

        Self {
            instructions,
            children_map,
            attributes_map,
            text_bindings_map,
            prop_bindings_map,
            event_bindings_map,
        }
    }

    fn build_node(&self, id: usize, path: String) -> Option<TreeNode> {
        let inst = self.instructions.iter().find(|i| match i {
            IrInstruction::CreateElement { id: elem_id, .. } => *elem_id == id,
            IrInstruction::CreateText { id: txt_id, .. } => *txt_id == id,
            IrInstruction::IfBlock { id: if_id, .. } => *if_id == id,
            IrInstruction::ForBlock { id: for_id, .. } => *for_id == id,
            _ => false,
        })?;

        let kind = match inst {
            IrInstruction::CreateElement { tag, is_component, .. } => {
                TreeNodeKind::Element { tag: tag.clone(), is_component: *is_component }
            }
            IrInstruction::CreateText { content, .. } => {
                TreeNodeKind::Text { content: content.clone() }
            }
            IrInstruction::IfBlock { condition, .. } => {
                TreeNodeKind::IfBlock { condition_js: condition.to_js() }
            }
            IrInstruction::ForBlock { item_var, items_expr, .. } => {
                TreeNodeKind::ForBlock { item_var: item_var.clone(), items_js: items_expr.to_js() }
            }
            _ => return None,
        };

        let attributes = self.attributes_map.get(&id).cloned().unwrap_or_default();
        let text_bindings = self.text_bindings_map.get(&id).map(|exprs| {
            exprs.iter().map(|expr| {
                let binding_id = format!("b:{}:text", path);
                (binding_id, expr.clone())
            }).collect()
        }).unwrap_or_default();

        let prop_bindings = self.prop_bindings_map.get(&id).map(|props| {
            props.iter().map(|(prop, expr)| {
                let binding_id = format!("b:{}:prop:{}", path, prop);
                (binding_id, prop.clone(), expr.clone())
            }).collect()
        }).unwrap_or_default();

        let event_bindings = self.event_bindings_map.get(&id).map(|events| {
            events.iter().map(|(event, expr)| {
                let binding_id = format!("b:{}:event:{}", path, event);
                (binding_id, event.clone(), expr.clone())
            }).collect()
        }).unwrap_or_default();

        let mut children = Vec::new();
        if let Some(child_ids) = self.children_map.get(&id) {
            for (idx, &cid) in child_ids.iter().enumerate() {
                let child_path = format!("{}.{}", path, idx);
                if let Some(child_node) = self.build_node(cid, child_path) {
                    children.push(child_node);
                }
            }
        }

        Some(TreeNode {
            _id: id,
            path,
            kind,
            attributes,
            text_bindings,
            prop_bindings,
            event_bindings,
            children,
        })
    }
}

/// Computes fine-grained diff between two Template IR trees.
pub fn diff_ir(old_ir: &TemplateIr, new_ir: &TemplateIr) -> TemplateDiff {
    if old_ir == new_ir {
        return TemplateDiff::Identical;
    }

    if old_ir.root_ids.len() != new_ir.root_ids.len() {
        return TemplateDiff::TemplateSwap {
            reason: format!(
                "Root node count mismatch: old had {}, new has {}",
                old_ir.root_ids.len(),
                new_ir.root_ids.len()
            ),
        };
    }

    let old_builder = TreeBuilder::new(&old_ir.instructions);
    let new_builder = TreeBuilder::new(&new_ir.instructions);

    let mut patches = Vec::new();

    for (idx, (&old_root_id, &new_root_id)) in old_ir.root_ids.iter().zip(new_ir.root_ids.iter()).enumerate() {
        let root_path = format!("{}", idx);
        let old_node = match old_builder.build_node(old_root_id, root_path.clone()) {
            Some(n) => n,
            None => return TemplateDiff::TemplateSwap { reason: "Missing old root node".to_string() },
        };
        let new_node = match new_builder.build_node(new_root_id, root_path) {
            Some(n) => n,
            None => return TemplateDiff::TemplateSwap { reason: "Missing new root node".to_string() },
        };

        if let Err(reason) = diff_nodes(&old_node, &new_node, &mut patches) {
            return TemplateDiff::TemplateSwap { reason };
        }
    }

    if patches.is_empty() {
        TemplateDiff::Identical
    } else {
        TemplateDiff::NodePatch { patches }
    }
}

fn diff_nodes(old: &TreeNode, new: &TreeNode, patches: &mut Vec<PatchOp>) -> Result<(), String> {
    match (&old.kind, &new.kind) {
        (
            TreeNodeKind::Element { tag: t1, is_component: c1 },
            TreeNodeKind::Element { tag: t2, is_component: c2 },
        ) => {
            if t1 != t2 || c1 != c2 {
                return Err(format!("Element tag changed from <{}> to <{}> at {}", t1, t2, new.path));
            }

            // Static attributes diff
            let old_attrs: HashMap<&str, &str> = old.attributes.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();
            let new_attrs: HashMap<&str, &str> = new.attributes.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();

            for (k, v) in &new_attrs {
                if old_attrs.get(k) != Some(v) {
                    patches.push(PatchOp::SetAttribute {
                        path: new.path.clone(),
                        name: (*k).to_string(),
                        value: (*v).to_string(),
                    });
                }
            }

            // Text bindings diff
            let old_tb: HashMap<&str, &str> = old.text_bindings.iter().map(|(id, expr)| (id.as_str(), expr.as_str())).collect();
            for (id, expr) in &new.text_bindings {
                if old_tb.get(id.as_str()) != Some(&expr.as_str()) {
                    patches.push(PatchOp::UpdateBinding {
                        path: new.path.clone(),
                        binding_id: id.clone(),
                        property: None,
                        expression_js: expr.clone(),
                    });
                }
            }

            // Property bindings diff
            let old_pb: HashMap<&str, &str> = old.prop_bindings.iter().map(|(id, _, expr)| (id.as_str(), expr.as_str())).collect();
            for (id, prop, expr) in &new.prop_bindings {
                if old_pb.get(id.as_str()) != Some(&expr.as_str()) {
                    patches.push(PatchOp::UpdateBinding {
                        path: new.path.clone(),
                        binding_id: id.clone(),
                        property: Some(prop.clone()),
                        expression_js: expr.clone(),
                    });
                }
            }

            // Event bindings diff
            let old_eb: HashMap<&str, &str> = old.event_bindings.iter().map(|(id, _, expr)| (id.as_str(), expr.as_str())).collect();
            for (id, event, expr) in &new.event_bindings {
                if old_eb.get(id.as_str()) != Some(&expr.as_str()) {
                    patches.push(PatchOp::UpdateBinding {
                        path: new.path.clone(),
                        binding_id: id.clone(),
                        property: Some(format!("event:{}", event)),
                        expression_js: expr.clone(),
                    });
                }
            }

            // Children diff
            if old.children.len() != new.children.len() {
                return Err(format!(
                    "Child count changed at <{}> (path: {}): old had {}, new has {}",
                    t1, new.path, old.children.len(), new.children.len()
                ));
            }

            for (old_c, new_c) in old.children.iter().zip(new.children.iter()) {
                diff_nodes(old_c, new_c, patches)?;
            }
        }
        (TreeNodeKind::Text { content: c1 }, TreeNodeKind::Text { content: c2 }) => {
            if c1 != c2 {
                patches.push(PatchOp::SetText {
                    path: new.path.clone(),
                    content: c2.clone(),
                });
            }

            // Text bindings on text node (interpolation)
            let old_tb: HashMap<&str, &str> = old.text_bindings.iter().map(|(id, expr)| (id.as_str(), expr.as_str())).collect();
            for (id, expr) in &new.text_bindings {
                if old_tb.get(id.as_str()) != Some(&expr.as_str()) {
                    patches.push(PatchOp::UpdateBinding {
                        path: new.path.clone(),
                        binding_id: id.clone(),
                        property: None,
                        expression_js: expr.clone(),
                    });
                }
            }
        }
        (
            TreeNodeKind::IfBlock { condition_js: cond1 },
            TreeNodeKind::IfBlock { condition_js: cond2 },
        ) => {
            if cond1 != cond2 {
                return Err(format!("If-block condition changed at path {}", new.path));
            }
            if old.children.len() != new.children.len() {
                return Err(format!("If-block body count changed at path {}", new.path));
            }
            for (old_c, new_c) in old.children.iter().zip(new.children.iter()) {
                diff_nodes(old_c, new_c, patches)?;
            }
        }
        (
            TreeNodeKind::ForBlock { item_var: v1, items_js: it1 },
            TreeNodeKind::ForBlock { item_var: v2, items_js: it2 },
        ) => {
            if v1 != v2 || it1 != it2 {
                return Err(format!("For-block expression changed at path {}", new.path));
            }
            if old.children.len() != new.children.len() {
                return Err(format!("For-block body count changed at path {}", new.path));
            }
            for (old_c, new_c) in old.children.iter().zip(new.children.iter()) {
                diff_nodes(old_c, new_c, patches)?;
            }
        }
        _ => {
            return Err(format!("Node type mismatch at path {}", new.path));
        }
    }

    Ok(())
}
