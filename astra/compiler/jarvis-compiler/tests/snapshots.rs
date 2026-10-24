use insta::assert_snapshot;
use jarvis_compiler::{compile_template, IrLowerer, Lexer, Parser};

#[test]
fn test_snapshot_simple_template_codegen() {
    let template = "<div class=\"user-card\"><h1>{{ title }}</h1><p>{{ subtitle }}</p></div>";
    let js = compile_template(template).unwrap();
    assert_snapshot!("simple_template_codegen", js);
}

#[test]
fn test_snapshot_bindings_codegen() {
    let template = "<input [disabled]=\"isLoading\" (click)=\"handleClick($event)\" [(value)]=\"username\" />";
    let js = compile_template(template).unwrap();
    assert_snapshot!("bindings_codegen", js);
}

#[test]
fn test_snapshot_control_flow_if_codegen() {
    let template = "@if (isLoggedIn) { <span>Welcome</span> } @else { <button>Login</button> }";
    let js = compile_template(template).unwrap();
    assert_snapshot!("control_flow_if_codegen", js);
}

#[test]
fn test_snapshot_control_flow_for_codegen() {
    let template = "@for (item of items; track item.id) { <div class=\"item\">{{ item.name }}</div> }";
    let js = compile_template(template).unwrap();
    assert_snapshot!("control_flow_for_codegen", js);
}

#[test]
fn test_snapshot_ir_output() {
    let template = "<section><h1>{{ title }}</h1><button (click)=\"save()\">Save</button></section>";
    let mut lexer = Lexer::new(template);
    let tokens = lexer.tokenize();
    let mut parser = Parser::new(tokens);
    let ast = parser.parse_all();
    let mut lowerer = IrLowerer::new();
    let ir = lowerer.lower(&ast);

    let ir_debug = format!("{:#?}", ir);
    assert_snapshot!("simple_template_ir", ir_debug);
}
