# Jarvis Rust Compiler Deep Dive & Safety Audit

## 1. Crate Architecture
* Crate name: `jarvis-compiler` (Rust Edition 2021).
* Compiler flags: `#t[deny(clippy::all)]`.
* External dependencies: None (zero-dependency build).


## 2. Memory & Safety Audit
* **Unsafe Code**: **0 occurrences**. The entire compiler is 100%safe Rust.
* **Allocation Profiling**:
  - Strings are created during tokenization and AST generation.
  - Opportunities exist for zero-copy borrowing (`Cow` or string interning via symbol tables).
* **Panic Paths**:
  - `tokens.last().expect(...)` in parser has been guarded by EOF checks.
  - Indexing slices are verified.
