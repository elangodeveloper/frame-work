//! Code generation transforming Template IR into fine-grained JavaScript view factory functions.

use crate::diagnostics::Diagnostic;
use crate::ir::{IrInstruction, TemplateIr};

pub struct CodeGenerator;

impl CodeGenerator {
    pub fn generate_js(ir: &TemplateIr) -> Result<String, Diagnostic> {
        let mut js = String::new();
        js.push_str("/**\n * Compiled Jarvis View Factory\n */\n");
        js.push_str("export function template(renderer, ctx) {\n");

        Self::generate_instructions(&ir.instructions, &mut js, "  ")?;

        if let Some(&first_root) = ir.root_ids.first() {
            js.push_str(&format!("  return {{ root: n{} }};\n", first_root));
        } else {
            js.push_str("  return { root: null };\n");
        }

        js.push_str("}\n");
        Ok(js)
    }

    fn generate_instructions(
        instructions: &[IrInstruction],
        js: &mut String,
        indent: &str,
    ) -> Result<(), Diagnostic> {
        for inst in instructions {
            match inst {
                IrInstruction::CreateElement { id, tag, .. } => {
                    js.push_str(&format!("{}const n{} = renderer.createElement('{}');\n", indent, id, tag));
                }
                IrInstruction::CreateText { id, content } => {
                    let escaped = content
                        .replace('\\', "\\\\")
                        .replace('\'', "\\'")
                        .replace('\n', "\\n")
                        .replace('\r', "\\r");
                    js.push_str(&format!("{}const n{} = renderer.createText('{}');\n", indent, id, escaped));
                }
                IrInstruction::AppendChild { parent_id, child_id } => {
                    js.push_str(&format!("{}renderer.appendChild(n{}, n{});\n", indent, parent_id, child_id));
                }
                IrInstruction::SetAttribute { id, name, value } => {
                    let escaped = value.replace('\'', "\\'");
                    js.push_str(&format!(
                        "{}renderer.setAttribute(n{}, '{}', '{}');\n",
                        indent, id, name, escaped
                    ));
                }
                IrInstruction::BindText { id, expression } => {
                    let expr_js = expression.to_js();
                    js.push_str(&format!(
                        "{}renderer.bindText(n{}, () => {});\n",
                        indent, id, expr_js
                    ));
                }
                IrInstruction::BindProperty { id, property, expression } => {
                    let expr_js = expression.to_js();
                    js.push_str(&format!(
                        "{}renderer.bindProperty(n{}, '{}', () => {});\n",
                        indent, id, property, expr_js
                    ));
                }
                IrInstruction::BindEvent { id, event, handler, raw_handler } => {
                    let trimmed = raw_handler.trim();
                    let handler_js = if trimmed.contains('(') {
                        handler.to_js()
                    } else {
                        let base_js = handler.to_js_with_opts(true, false, &std::collections::HashSet::new());
                        format!("{}($event)", base_js)
                    };
                    js.push_str(&format!(
                        "{}renderer.listen(n{}, '{}', ($event) => {});\n",
                        indent, id, event, handler_js
                    ));
                }
                IrInstruction::IfBlock { id, condition, then_ir, else_ir } => {
                    let cond_js = condition.to_js();
                    js.push_str(&format!(
                        "{}// @if ({})\n",
                        indent, cond_js
                    ));
                    js.push_str(&format!(
                        "{}if ({}) {{\n",
                        indent, cond_js
                    ));
                    let next_indent = format!("{}  ", indent);
                    Self::generate_instructions(&then_ir.instructions, js, &next_indent)?;
                    if let Some(ref else_branch) = else_ir {
                        js.push_str(&format!("{}}} else {{\n", indent));
                        Self::generate_instructions(&else_branch.instructions, js, &next_indent)?;
                    }
                    js.push_str(&format!("{}}}\n", indent));
                    let _ = id;
                }
                IrInstruction::ForBlock { id, item_var, items_expr, track_expr, body_ir } => {
                    let items_js = items_expr.to_js();
                    let track_js = track_expr.to_js();
                    js.push_str(&format!(
                        "{}// @for ({} of {}; track {})\n",
                        indent, item_var, items_js, track_js
                    ));
                    js.push_str(&format!(
                        "{}for (const {} of ({} || [])) {{\n",
                        indent, item_var, items_js
                    ));
                    let next_indent = format!("{}  ", indent);
                    Self::generate_instructions(&body_ir.instructions, js, &next_indent)?;
                    js.push_str(&format!("{}}}\n", indent));
                    let _ = id;
                }
            }
        }
        Ok(())
    }
}
