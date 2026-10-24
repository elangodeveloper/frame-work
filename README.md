# Lumina Compiler Framework (`lumina-compiler`)

A complete, production-grade Object-Oriented Analysis & Design (OOAD) compiler framework written in idiomatic Rust (2021 edition) with strict `#![deny(clippy::all)]` enforcement, alongside an interactive HTML playground and TypeScript testing harness.

---

## 1. Quick Start: How to Run

### Option A: Running via Rust Cargo CLI

From the workspace root (`c:\Developer\frame-work`):

```powershell
# 1. Run the default end-to-end snippet
cargo run -p lumina-driver

# 2. Print Abstract Syntax Tree (AST)
cargo run -p lumina-driver -- --emit-ast

# 3. Print 3-Address Code IR (optimized)
cargo run -p lumina-driver -- --emit-ir

# 4. Print raw unoptimized IR
cargo run -p lumina-driver -- --emit-ir --no-opt

# 5. Emit machine-readable JSON (used by TypeScript & tooling)
cargo run -p lumina-driver -- --json

# 6. Compile and run a specific source file
cargo run -p lumina-driver -- --emit-ast --emit-ir examples/conditional.lum
```

### Option B: Running the Rust Test Suite

```powershell
cargo test --workspace
```
This runs:
- `test_ast_printer`: AST generation and indented tree formatting.
- `test_constant_folding`: Compile-time arithmetic reduction and condition branch folding.
- `test_end_to_end`: Complete pipeline execution of:
  ```lumina
  let x = 10 + 20 * 2;
  let y = if x > 30 { x + 5 } else { 0 };
  return y;
  ```
  yielding `x = 50`, `y = 55`, and evaluated return `55`.

---

## 2. Testing via TypeScript Harness & HTML Playground

We have provided a TypeScript test harness and a web playground under [`web/`](./web):

### Option C: Running the TypeScript Test Runner

```powershell
cd web
npm test
# (or directly: node src/test_runner.ts)
```
Output:
```text
=================================================
  Lumina Compiler: TypeScript Test Suite Runner
=================================================

Running: Test 1: Operator Precedence & Arithmetic ... PASSED ✅
Running: Test 2: If-Else Conditional Branching (End-to-end snippet) ... PASSED ✅
Running: Test 3: Else Branch Taken ... PASSED ✅
Running: Test 4: Unoptimized IR Retains Dynamic Branches ... PASSED ✅

-------------------------------------------------
Results: 4 Passed, 0 Failed, Total: 4
-------------------------------------------------
```

### Option D: Running the Web Playground Server

```powershell
cd web
npm start
# (or directly: node server.ts)
```
Then open your browser to **`http://localhost:3000`** to interact with the split-pane code editor, toggle optimization passes, inspect AST trees, and view live 3-Address Code IR.

*(You can also open [`web/index.html`](./web/index.html) directly in any browser for an instant offline demo!)*

---

## 3. Architecture & Crates

```text
lumina-compiler/
├── crates/
│   ├── lumina-core/      # Source mapping, Spans, unified Diagnostics, SymbolInterner
│   ├── lumina-ast/       # Expression AST, AstVisitor<R>, AstMutVisitor, AstPrinter
│   ├── lumina-lexer/     # Character scanner, tokens, line/column tracking
│   ├── lumina-parser/    # Recursive descent Pratt / precedence-climbing parser
│   ├── lumina-ir/        # 3-Address Code IR, basic blocks, IrPrinter, IrInterpreter VM
│   ├── lumina-pass/      # PassManager pipeline, AstLoweringPass, ConstantFoldingPass, DCE
│   └── lumina-driver/    # Pipeline façade, CLI entrypoint, JSON emitter, integration tests
├── examples/             # Sample .lum scripts
└── web/                  # HTML UI and TypeScript test runner
```
