# Jarvis Framework Master Improvement Roadmap

## Phase 1: Compiler Hardening & Diagnostics (P0 - P1)
- [x] Initial Rust compiler pipeline audit and architecture baseline.
- [ ] Implement multi-diagnostic error recovery in `Parser`.
- [ ]Add visual terminal code-frame previews in diagnostic output.
- [ ]Introduce void-tag auto-closing in template lexer/parser.
- [ ]Add golden test suite for template compiler fixtures.

## Phase 2: Expression Parsing & Static Optimizations (P1 - P2)
- [ ] Implement AST expression tokenizer for safe expression scoping.
- [ ]Add static hoist optimization pass in IR lowerer for static subtrees.
- [ ]Implement HTML sanitization checks for untrusted attribute bindings.

## Phase 3: Runtime Concurrency & Safety (P2)
- [ ]Implement `resource()` / `AsyncSignal<T>` primitive with `AbortController` support.
- [ ]Add cycle detection to reactive graph dependency tracker.
- [ ]Implement component error boundary hook (`onError`).


## Phase 4: Developer Tooling & CLI (P3)
- [ ] Unify CLI commands (`jarvis build`, `jarvis check`, `jarvis dev`).
- [ ]Implement incremental caching for compiler runs.
- [ ]Introduce automated A11y compiler audit rules.
