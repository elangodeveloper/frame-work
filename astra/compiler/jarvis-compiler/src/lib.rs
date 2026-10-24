//! Jarvis Template Compiler Library
//! Transforms HTML-like component templates into fine-grained reactive JavaScript view factories.

#![deny(clippy::all)]

pub mod ast;
pub mod cache;
pub mod codegen;
pub mod diagnostics;
pub mod expr;
pub mod ir;
pub mod lexer;
pub mod parser;

pub use ast::*;
pub use cache::{compile_template_cached, global_cache, hash_template, TemplateCache};
pub use codegen::CodeGenerator;
pub use diagnostics::{Diagnostic, DiagnosticSeverity, Span};
pub use expr::{ExprAst, ExpressionParser};
pub use ir::{IrInstruction, IrLowerer, TemplateIr};
pub use lexer::{Lexer, Token, TokenKind};
pub use parser::{decode_html_entities, Parser};

use rayon::prelude::*;

/// Compiles a Jarvis template string directly to fine-grained JavaScript code.
pub fn compile_template(source: &str) -> Result<String, Diagnostic> {
    let (code_opt, diagnostics) = compile_template_with_diagnostics(source);
    if let Some(first_err) = diagnostics.into_iter().find(|d| d.severity == DiagnosticSeverity::Error) {
        Err(first_err)
    } else {
        code_opt.ok_or_else(|| Diagnostic::error("COMPILE_ERR", "Failed to generate code", Span::dummy()))
    }
}

/// Compiles a template collecting ALL diagnostics in one pass with full error recovery.
pub fn compile_template_with_diagnostics(source: &str) -> (Option<String>, Vec<Diagnostic>) {
    let mut lexer = Lexer::new(source);
    let tokens = lexer.tokenize();
    let lex_diagnostics = lexer.diagnostics;

    let mut parser = Parser::with_diagnostics(tokens, lex_diagnostics);
    let ast = parser.parse_all();
    let all_diagnostics = parser.diagnostics;

    let mut lowerer = IrLowerer::new();
    let ir = lowerer.lower(&ast);

    match CodeGenerator::generate_js(&ir) {
        Ok(js) => (Some(js), all_diagnostics),
        Err(diag) => {
            let mut diags = all_diagnostics;
            diags.push(diag);
            (None, diags)
        }
    }
}

/// Compiles a template returning all diagnostics on failure.
pub fn compile_template_all(source: &str) -> Result<String, Vec<Diagnostic>> {
    let (code_opt, diagnostics) = compile_template_with_diagnostics(source);
    let errors: Vec<Diagnostic> = diagnostics
        .into_iter()
        .filter(|d| d.severity == DiagnosticSeverity::Error)
        .collect();

    if !errors.is_empty() {
        Err(errors)
    } else {
        code_opt.ok_or_else(|| vec![Diagnostic::error("COMPILE_ERR", "Failed to generate code", Span::dummy())])
    }
}

/// Compiles multiple templates in parallel using Rayon.
pub fn compile_templates_parallel(
    sources: &[&str],
) -> Vec<Result<String, Diagnostic>> {
    sources
        .par_iter()
        .map(|src| compile_template(src))
        .collect()
}

/// Compiles multiple template files in parallel using Rayon.
pub fn compile_files_parallel(
    paths: &[std::path::PathBuf],
) -> Vec<(std::path::PathBuf, Result<String, Diagnostic>)> {
    paths
        .par_iter()
        .map(|path| {
            let res = std::fs::read_to_string(path)
                .map_err(|e| Diagnostic::error("IO_ERR", format!("Cannot read file: {}", e), Span::dummy()))
                .and_then(|content| compile_template(&content));
            (path.clone(), res)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hello_world_compilation() {
        let template = "<h1>Hello Jarvis</h1>";
        let js = compile_template(template).expect("compilation should succeed");

        assert!(js.contains("renderer.createElement('h1')"));
        assert!(js.contains("renderer.createText('Hello Jarvis')"));
        assert!(js.contains("renderer.appendChild(n0, n1)"));
        assert!(js.contains("return { root: n0 };"));
    }

    #[test]
    fn test_interpolation_binding() {
        let template = "<h1>{{ count() }}</h1>";
        let js = compile_template(template).expect("compilation should succeed");

        assert!(js.contains("renderer.createElement('h1')"));
        assert!(js.contains("renderer.createText('')"));
        assert!(js.contains("renderer.bindText(n1, () => ctx.count());"));
    }

    #[test]
    fn test_signal_read_automatic_emission() {
        let template = "<h1>{{ title }}</h1>";
        let js = compile_template(template).expect("compilation should succeed");

        assert!(js.contains("renderer.bindText(n1, () => ctx.title());"));
    }

    #[test]
    fn test_tag_mismatch_diagnostic() {
        let template = "<h1>Hello Jarvis</h2>";
        let err = compile_template(template).unwrap_err();

        assert_eq!(err.code, "TPL005");
        assert!(err.message.contains("Mismatched closing tag"));
        assert!(err.suggestion.is_some());
    }

    #[test]
    fn test_dangerous_template_expression_blocked() {
        let template = "<h1>{{ window.alert(1) }}</h1>";
        let err = compile_template(template).unwrap_err();

        assert_eq!(err.code, "EXPR_SEC02");
        assert!(err.message.contains("Access to identifier 'window' is prohibited"));
    }

    #[test]
    fn test_dangerous_property_access_blocked_in_template() {
        let template = "<p [title]=\"user.__proto__\">Test</p>";
        let err = compile_template(template).unwrap_err();

        assert_eq!(err.code, "EXPR_SEC01");
        assert!(err.message.contains("Access to dangerous property '__proto__' is prohibited"));
    }

    // ========================================================================
    // TPL001 to TPL006 Diagnostic Tests with Line and Column Spans
    // ========================================================================

    #[test]
    fn test_diagnostic_tpl001_unterminated_attribute_literal() {
        let template = "<button class=\"btn-primary>Click</button>";
        let (_, diags) = compile_template_with_diagnostics(template);

        let err = diags.iter().find(|d| d.code == "TPL001").expect("should emit TPL001");
        assert_eq!(err.code, "TPL001");
        assert_eq!(err.span.line, 1);
        assert_eq!(err.span.col, 15);
        assert!(err.message.contains("Unterminated attribute string literal"));
    }

    #[test]
    fn test_diagnostic_tpl002_unexpected_char_in_tag() {
        let template = "<div %invalid>Test</div>";
        let (_, diags) = compile_template_with_diagnostics(template);

        let err = diags.iter().find(|d| d.code == "TPL002").expect("should emit TPL002");
        assert_eq!(err.code, "TPL002");
        assert_eq!(err.span.line, 1);
        assert_eq!(err.span.col, 6);
        assert!(err.message.contains("Unexpected character '%'"));
    }

    #[test]
    fn test_diagnostic_tpl003_unterminated_interpolation() {
        let template = "<div>{{ count </div>";
        let (_, diags) = compile_template_with_diagnostics(template);

        let err = diags.iter().find(|d| d.code == "TPL003").expect("should emit TPL003");
        assert_eq!(err.code, "TPL003");
        assert_eq!(err.span.line, 1);
        assert_eq!(err.span.col, 6);
        assert!(err.message.contains("Unterminated interpolation binding"));
    }

    #[test]
    fn test_diagnostic_tpl004_unexpected_closing_tag() {
        let template = "<div>Hello</div></span>";
        let (_, diags) = compile_template_with_diagnostics(template);

        let err = diags.iter().find(|d| d.code == "TPL004").expect("should emit TPL004");
        assert_eq!(err.code, "TPL004");
        assert_eq!(err.span.line, 1);
        assert_eq!(err.span.col, 17);
        assert!(err.message.contains("Unexpected closing tag '</span"));
    }

    #[test]
    fn test_diagnostic_tpl005_mismatched_closing_tag_with_spans() {
        let template = "<div><p>Hello</div>";
        let (_, diags) = compile_template_with_diagnostics(template);

        let err = diags.iter().find(|d| d.code == "TPL005").expect("should emit TPL005");
        assert_eq!(err.code, "TPL005");
        assert_eq!(err.span.line, 1);
        assert_eq!(err.span.col, 14);
        assert!(err.message.contains("Mismatched closing tag: expected '</p>', found '</div>'"));
        assert_eq!(err.suggestion.as_deref(), Some("Change '</div>' to '</p>'"));
    }

    #[test]
    fn test_diagnostic_tpl006_unclosed_element_at_eof() {
        let template = "<section><h1>Title</h1>";
        let (_, diags) = compile_template_with_diagnostics(template);

        let err = diags.iter().find(|d| d.code == "TPL006").expect("should emit TPL006");
        assert_eq!(err.code, "TPL006");
        assert_eq!(err.span.line, 1);
        assert_eq!(err.span.col, 24);
        assert!(err.message.contains("Unclosed element '<section>', expected closing tag '</section>'"));
    }

    #[test]
    fn test_multi_error_recovery_collects_all_diagnostics_in_single_pass() {
        // Contains both TPL002 (% unexpected char) and TPL005 (mismatched tag) and TPL004 (unexpected close)
        let template = "<div %bad><span>Hello</b></div></td>";
        let (_, diags) = compile_template_with_diagnostics(template);

        assert!(diags.len() >= 3);
        assert!(diags.iter().any(|d| d.code == "TPL002"));
        assert!(diags.iter().any(|d| d.code == "TPL005"));
        assert!(diags.iter().any(|d| d.code == "TPL004"));
    }

    // ========================================================================
    // Template Syntax Extension Tests
    // ========================================================================

    #[test]
    fn test_property_event_and_two_way_bindings() {
        let template = "<input [disabled]=\"isLoading\" (click)=\"handleClick($event)\" [(value)]=\"username\" />";
        let js = compile_template(template).expect("compilation should succeed");

        assert!(js.contains("renderer.bindProperty(n0, 'disabled', () => ctx.isLoading());"));
        assert!(js.contains("renderer.listen(n0, 'click', ($event) => ctx.handleClick($event));"));
        assert!(js.contains("renderer.bindProperty(n0, 'value', () => ctx.username());"));
        assert!(js.contains("renderer.listen(n0, 'input', ($event) => ctx.username.set($event));"));
    }

    #[test]
    fn test_control_flow_if_else() {
        let template = "@if (isLoggedIn) { <span>Welcome</span> } @else { <button>Login</button> }";
        let js = compile_template(template).expect("compilation should succeed");

        assert!(js.contains("if (ctx.isLoggedIn()) {"));
        assert!(js.contains("renderer.createElement('span')"));
        assert!(js.contains("renderer.createText('Welcome')"));
        assert!(js.contains("} else {"));
        assert!(js.contains("renderer.createElement('button')"));
        assert!(js.contains("renderer.createText('Login')"));
    }

    #[test]
    fn test_control_flow_for_loop() {
        let template = "@for (item of items; track item.id) { <div class=\"item\">{{ item.name }}</div> }";
        let js = compile_template(template).expect("compilation should succeed");

        assert!(js.contains("for (const item of (ctx.items() || [])) {"));
        assert!(js.contains("renderer.createElement('div')"));
        assert!(js.contains("renderer.setAttribute(n1, 'class', 'item');"));
    }

    #[test]
    fn test_child_component_tag() {
        let template = "<user-card [title]=\"userTitle\" (selected)=\"onSelect($event)\"></user-card>";
        let js = compile_template(template).expect("compilation should succeed");

        assert!(js.contains("renderer.createElement('user-card')"));
        assert!(js.contains("renderer.bindProperty(n0, 'title', () => ctx.userTitle());"));
        assert!(js.contains("renderer.listen(n0, 'selected', ($event) => ctx.onSelect($event));"));
    }

    // ========================================================================
    // HTML Edge Cases Tests
    // ========================================================================

    #[test]
    fn test_void_elements_do_not_require_closing_tags() {
        let template = "<div><img src=\"avatar.png\"><input type=\"text\"><br><hr><p>Done</p></div>";
        let js = compile_template(template).expect("void elements must compile cleanly");

        assert!(js.contains("renderer.createElement('img')"));
        assert!(js.contains("renderer.createElement('input')"));
        assert!(js.contains("renderer.createElement('br')"));
        assert!(js.contains("renderer.createElement('hr')"));
        assert!(js.contains("renderer.createElement('p')"));
    }

    #[test]
    fn test_self_closing_tags() {
        let template = "<div><span class=\"badge\" /><button disabled /></div>";
        let js = compile_template(template).expect("self-closing tags must compile cleanly");

        assert!(js.contains("renderer.createElement('span')"));
        assert!(js.contains("renderer.createElement('button')"));
    }

    #[test]
    fn test_html_comments_are_ignored_in_codegen() {
        let template = "<div><!-- This is an internal comment --><h1>Content</h1></div>";
        let js = compile_template(template).expect("comments must be parsed cleanly");

        assert!(!js.contains("This is an internal comment"));
        assert!(js.contains("renderer.createElement('h1')"));
    }

    #[test]
    fn test_html_entities_decoded_in_text() {
        let template = "<p>Tom &amp; Jerry &lt;3 &quot;Cartoons&quot; &apos;Fun&apos; &nbsp;</p>";
        let js = compile_template(template).expect("entities must be decoded");

        assert!(js.contains("Tom & Jerry <3 \"Cartoons\" \\'Fun\\'"));
    }

    #[test]
    fn test_raw_text_elements_script_and_style() {
        let template = "<style>h1 { color: red; } & < > {{ not_interp }}</style><script>if (a < b) { run(); }</script>";
        let js = compile_template(template).expect("script and style must be raw text");

        assert!(js.contains("h1 { color: red; } & < > {{ not_interp }}"));
        assert!(js.contains("if (a < b) { run(); }"));
    }

    // ========================================================================
    // Performance & Caching Tests
    // ========================================================================

    #[test]
    fn test_template_cache_keyed_by_content_hash() {
        let cache = TemplateCache::new();
        let template = "<h1>Cached Title</h1>";

        let code1 = compile_template_cached(template, &cache).unwrap();
        assert_eq!(cache.len(), 1);

        let code2 = compile_template_cached(template, &cache).unwrap();
        assert_eq!(code1, code2);
        assert_eq!(cache.len(), 1);
    }

    #[test]
    fn test_parallel_compilation_with_rayon() {
        let templates = vec![
            "<h1>Template 1: {{ a }}</h1>",
            "<h2>Template 2: {{ b }}</h2>",
            "<h3>Template 3: {{ c }}</h3>",
            "<p>Template 4: static</p>",
        ];

        let results = compile_templates_parallel(&templates);
        assert_eq!(results.len(), 4);
        for res in results {
            assert!(res.is_ok());
        }
    }

    #[test]
    fn test_bumpalo_arena_ast_allocation() {
        let template = "<div class=\"box\"><p>Hello <span>World</span></p></div>";
        let mut lexer = Lexer::new(template);
        let tokens = lexer.tokenize();
        let mut parser = Parser::new(tokens);
        let ast = parser.parse().unwrap();

        let bump = bumpalo::Bump::new();
        let arena_nodes = ast.to_arena(&bump);
        assert_eq!(arena_nodes.len(), 1);
    }
}
