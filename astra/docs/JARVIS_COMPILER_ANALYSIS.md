# JARVIS Rust Compiler: Comprehensive Audit & Analysis

## 1. Actual Compiler Pipeline
The compiler pipeline located in compiler/jarvis-compiler executes as follows:
`	ext
Source Template (&str)
         |
         v
Lexer (lexer.rs)
  - Character cursor tracking byte offsets, line, column
  - Tokenizes tag boundaries, attributes, text, interpolations
         |
         v
Parser (parser.rs)
  - Recursive-descent parser building TemplateAst
  - Emits diagnostics on tag mismatches or unexpected tokens
         |
         v
IR Lowerer (ir.rs)
  - Lowers AST into flat 3-Address Code (3AC) instructions
  - Assigns unique sequential node IDs (n0, n1, ...)
         |
         v
Code Generator (codegen.rs)
  - Converts TemplateIr into JavaScript view factory function
  - Rewrites identifiers to ctx.<expr>
`

## 2. Audit of Existing Compiler Stages

### 2.1 Lexer (src/lexer.rs)
* **Strengths**: Accurate byte and line/column tracking in Span. Handles self-closing tags and attribute formats.
* **Weaknesses Identified**:
  - Allocates heap String for every token value (String::clone()).
  - Lacks support for HTML comments, character entity decoding, and CDATA.
  - Does not tokenize arbitrary JS expressions inside interpolations; it captures raw strings between {{ and }}.
  - Multi-line attribute values lack specialized escape processing.

### 2.2 Parser (src/parser.rs)
* **Strengths**: Clean recursive-descent structure. Immediate diagnostics for unclosed or mismatched tags.
* **Weaknesses Identified**:
  - **Early Bailout**: Aborts on the first diagnostic error instead of continuing with error recovery tokens.
  - Lacks support for structural directives (e.g. *if, *for, @for, @if).
  - Incomplete void tag handling (e.g. <input>, <img>, <br> can be parsed incorrectly if not self-closed with />).
  - No expression validation: template expressions inside interpolations or property bindings are not parsed into an Expression AST.

### 2.3 AST (src/ast.rs)
* **Strengths**: Strongly typed nodes with Span on every node (ElementNode, TextNode, InterpolationNode).
* **Weaknesses Identified**:
  - No type representation: Nodes carry untyped strings for attribute values and expressions.
  - Direct heap allocations for child vectors; does not use arena allocation.

### 2.4 Intermediate Representation (src/ir.rs)
* **Strengths**: Clean 3AC instructions (CreateElement, CreateText, AppendChild, BindText, BindProperty, BindEvent).
* **Weaknesses Identified**:
  - Linear single-pass lowerer with no optimization passes (no constant folding, no static hoist pass).
  - No Dead Code Elimination (DCE) or static template cloning optimization.

### 2.5 Code Generator (src/codegen.rs)
* **Strengths**: Emits clean, deterministic JavaScript view factories with fine-grained binding closures.
* **Weaknesses Identified**:
  - Naive identifier rewriter prepends ctx. if not starting with 	his. or ctx.. This can break global expressions (e.g. Math.round(), ternary operators, string literals).
  - No source map generation mapping emitted JavaScript back to template source positions.

### 2.6 Diagnostic Engine (src/diagnostics.rs)
* **Strengths**: Structured Diagnostic struct with code, severity, message, span, and suggestion.
* **Weaknesses Identified**:
  - Single-error reporting pipeline (Result<String, Diagnostic> instead of multi-error accumulator).
  - Does not render visual terminal snippets with underlines/carets pointing to source lines.
