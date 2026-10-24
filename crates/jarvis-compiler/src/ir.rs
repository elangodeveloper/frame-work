//! Intermediate Representation (IR) for fine-grained reactive template rendering.

use crate::ast::*;
use crate::expr::{ExprAst, ExpressionParser};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IrInstruction {
    /// Instantiate a DOM element: `const el = renderer.createElement(tag)`
    CreateElement { id: usize, tag: String, is_component: bool },
    /// Instantiate a static DOM text node: `const txt = renderer.createText(content)`
    CreateText { id: usize, content: String },
    /// Attach child to parent DOM node: `renderer.appendChild(parent, child)`
    AppendChild { parent_id: usize, child_id: usize },
    /// Set a static attribute: `renderer.setAttribute(el, name, value)`
    SetAttribute { id: usize, name: String, value: String },
    /// Fine-grained reactive text binding: `renderer.bindText(txt, () => expr)`
    BindText { id: usize, expression: ExprAst },
    /// Fine-grained reactive property binding: `renderer.bindProperty(el, prop, () => expr)`
    BindProperty { id: usize, property: String, expression: ExprAst },
    /// Event listener binding: `renderer.listen(el, event, ($event) => handler($event))`
    BindEvent { id: usize, event: String, handler: ExprAst, raw_handler: String },
    /// Control flow conditional block: `@if (cond)`
    IfBlock {
        id: usize,
        condition: ExprAst,
        then_ir: TemplateIr,
        else_ir: Option<TemplateIr>,
    },
    /// Control flow list block: `@for (item of items; track item.id)`
    ForBlock {
        id: usize,
        item_var: String,
        items_expr: ExprAst,
        track_expr: ExprAst,
        body_ir: TemplateIr,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TemplateIr {
    pub instructions: Vec<IrInstruction>,
    pub root_ids: Vec<usize>,
}

pub struct IrLowerer {
    instructions: Vec<IrInstruction>,
    next_id: usize,
}

impl Default for IrLowerer {
    fn default() -> Self {
        Self::new()
    }
}

impl IrLowerer {
    pub fn new() -> Self {
        Self {
            instructions: Vec::new(),
            next_id: 0,
        }
    }

    fn alloc_id(&mut self) -> usize {
        let id = self.next_id;
        self.next_id += 1;
        id
    }

    pub fn lower(&mut self, ast: &TemplateAst) -> TemplateIr {
        let mut root_ids = Vec::new();

        for node in &ast.nodes {
            if let Some(id) = self.lower_node(node, None) {
                root_ids.push(id);
            }
        }

        TemplateIr {
            instructions: std::mem::take(&mut self.instructions),
            root_ids,
        }
    }

    fn lower_node(&mut self, node: &TemplateNode, parent_id: Option<usize>) -> Option<usize> {
        match node {
            TemplateNode::Element(elem) => {
                let elem_id = self.alloc_id();
                self.instructions.push(IrInstruction::CreateElement {
                    id: elem_id,
                    tag: elem.tag.clone(),
                    is_component: elem.is_component,
                });

                if let Some(pid) = parent_id {
                    self.instructions.push(IrInstruction::AppendChild {
                        parent_id: pid,
                        child_id: elem_id,
                    });
                }

                // Attributes & bindings
                for attr in &elem.attributes {
                    match attr.kind {
                        AttributeKind::Static => {
                            self.instructions.push(IrInstruction::SetAttribute {
                                id: elem_id,
                                name: attr.name.clone(),
                                value: attr.value.clone().unwrap_or_default(),
                            });
                        }
                        AttributeKind::PropertyBinding => {
                            // Strip brackets: `[disabled]` -> `disabled`
                            let prop_name = attr.name.trim_matches(&['[', ']'][..]).to_string();
                            let raw_expr = attr.value.clone().unwrap_or_default();
                            let span = attr.span;
                            let expr_ast = attr.expr.clone().unwrap_or_else(|| {
                                ExpressionParser::parse_expression(&raw_expr, span)
                                    .unwrap_or(ExprAst::Identifier(raw_expr, span))
                            });

                            self.instructions.push(IrInstruction::BindProperty {
                                id: elem_id,
                                property: prop_name,
                                expression: expr_ast,
                            });
                        }
                        AttributeKind::EventBinding => {
                            // Strip parens: `(click)` -> `click`
                            let event_name = attr.name.trim_matches(&['(', ')'][..]).to_string();
                            let raw_handler = attr.value.clone().unwrap_or_default();
                            let span = attr.span;
                            let handler_ast = attr.expr.clone().unwrap_or_else(|| {
                                ExpressionParser::parse_expression(&raw_handler, span)
                                    .unwrap_or(ExprAst::Identifier(raw_handler.clone(), span))
                            });

                            self.instructions.push(IrInstruction::BindEvent {
                                id: elem_id,
                                event: event_name,
                                handler: handler_ast,
                                raw_handler,
                            });
                        }
                        AttributeKind::TwoWayBinding => {
                            // Strip `[()]`: `[(value)]` -> `value`
                            let prop = attr.name.replace(['[', ']', '(', ')'], "");
                            let raw_expr = attr.value.clone().unwrap_or_default();
                            let span = attr.span;
                            let expr_ast = attr.expr.clone().unwrap_or_else(|| {
                                ExpressionParser::parse_expression(&raw_expr, span)
                                    .unwrap_or(ExprAst::Identifier(raw_expr.clone(), span))
                            });

                            self.instructions.push(IrInstruction::BindProperty {
                                id: elem_id,
                                property: prop.clone(),
                                expression: expr_ast,
                            });

                            let event_name = if elem.tag.eq_ignore_ascii_case("input") && prop == "value" {
                                "input".to_string()
                            } else {
                                format!("{}Change", prop)
                            };

                            let handler_str = format!("{}.set($event)", raw_expr);
                            let handler_ast = ExpressionParser::parse_expression(&handler_str, span)
                                .unwrap_or_else(|_| ExprAst::Identifier(handler_str.clone(), span));

                            self.instructions.push(IrInstruction::BindEvent {
                                id: elem_id,
                                event: event_name,
                                handler: handler_ast,
                                raw_handler: handler_str,
                            });
                        }
                    }
                }

                // Children (if not a void tag)
                if !elem.is_void {
                    for child in &elem.children {
                        self.lower_node(child, Some(elem_id));
                    }
                }

                Some(elem_id)
            }
            TemplateNode::Text(txt) => {
                let txt_id = self.alloc_id();
                self.instructions.push(IrInstruction::CreateText {
                    id: txt_id,
                    content: txt.content.clone(),
                });
                if let Some(pid) = parent_id {
                    self.instructions.push(IrInstruction::AppendChild {
                        parent_id: pid,
                        child_id: txt_id,
                    });
                }
                Some(txt_id)
            }
            TemplateNode::Interpolation(interp) => {
                let txt_id = self.alloc_id();
                self.instructions.push(IrInstruction::CreateText {
                    id: txt_id,
                    content: String::new(),
                });
                self.instructions.push(IrInstruction::BindText {
                    id: txt_id,
                    expression: interp.expression.clone(),
                });
                if let Some(pid) = parent_id {
                    self.instructions.push(IrInstruction::AppendChild {
                        parent_id: pid,
                        child_id: txt_id,
                    });
                }
                Some(txt_id)
            }
            TemplateNode::Comment(_) => None,
            TemplateNode::If(if_node) => {
                let anchor_id = self.alloc_id();
                self.instructions.push(IrInstruction::CreateText {
                    id: anchor_id,
                    content: String::new(),
                });
                if let Some(pid) = parent_id {
                    self.instructions.push(IrInstruction::AppendChild {
                        parent_id: pid,
                        child_id: anchor_id,
                    });
                }

                let mut then_lowerer = IrLowerer {
                    instructions: Vec::new(),
                    next_id: self.next_id,
                };
                let mut then_roots = Vec::new();
                for node in &if_node.then_branch {
                    if let Some(id) = then_lowerer.lower_node(node, None) {
                        then_roots.push(id);
                    }
                }
                self.next_id = then_lowerer.next_id;
                let then_ir = TemplateIr {
                    instructions: then_lowerer.instructions,
                    root_ids: then_roots,
                };

                let else_ir = if let Some(ref else_nodes) = if_node.else_branch {
                    let mut else_lowerer = IrLowerer {
                        instructions: Vec::new(),
                        next_id: self.next_id,
                    };
                    let mut else_roots = Vec::new();
                    for node in else_nodes {
                        if let Some(id) = else_lowerer.lower_node(node, None) {
                            else_roots.push(id);
                        }
                    }
                    self.next_id = else_lowerer.next_id;
                    Some(TemplateIr {
                        instructions: else_lowerer.instructions,
                        root_ids: else_roots,
                    })
                } else {
                    None
                };

                self.instructions.push(IrInstruction::IfBlock {
                    id: anchor_id,
                    condition: if_node.condition.clone(),
                    then_ir,
                    else_ir,
                });

                Some(anchor_id)
            }
            TemplateNode::For(for_node) => {
                let anchor_id = self.alloc_id();
                self.instructions.push(IrInstruction::CreateText {
                    id: anchor_id,
                    content: String::new(),
                });
                if let Some(pid) = parent_id {
                    self.instructions.push(IrInstruction::AppendChild {
                        parent_id: pid,
                        child_id: anchor_id,
                    });
                }

                let mut body_lowerer = IrLowerer {
                    instructions: Vec::new(),
                    next_id: self.next_id,
                };
                let mut body_roots = Vec::new();
                for node in &for_node.body {
                    if let Some(id) = body_lowerer.lower_node(node, None) {
                        body_roots.push(id);
                    }
                }
                self.next_id = body_lowerer.next_id;
                let body_ir = TemplateIr {
                    instructions: body_lowerer.instructions,
                    root_ids: body_roots,
                };

                self.instructions.push(IrInstruction::ForBlock {
                    id: anchor_id,
                    item_var: for_node.item_var.clone(),
                    items_expr: for_node.items_expr.clone(),
                    track_expr: for_node.track_expr.clone(),
                    body_ir,
                });

                Some(anchor_id)
            }
        }
    }
}
