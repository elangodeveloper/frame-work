#![no_main]

use libfuzzer_sys::fuzz_target;
use jarvis_compiler::{compile_template_with_diagnostics, Lexer, Parser};

fuzz_target!(|data: &[u8]| {
    if let Ok(s) = std::str::from_utf8(data) {
        // Test lexer and parser error recovery against arbitrary fuzzed inputs
        let mut lexer = Lexer::new(s);
        let tokens = lexer.tokenize();
        let mut parser = Parser::with_diagnostics(tokens, lexer.diagnostics);
        let _ = parser.parse_all();

        // Also test compiler pipeline resilience
        let _ = compile_template_with_diagnostics(s);
    }
});
