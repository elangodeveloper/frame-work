use napi_derive::napi;

#[napi]
pub fn compile_template(source: String) -> String {
    jarvis_compiler::compile_template(&source).unwrap_or_else(|e| format!("/* compilation error: {} */", e.message))
}
