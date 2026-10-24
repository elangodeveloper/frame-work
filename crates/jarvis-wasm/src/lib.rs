use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn compile(source: &str) -> String {
    jarvis_compiler::compile_template(source).unwrap_or_else(|e| format!("/* compilation error: {} */", e.message))
}
