# JARVIS Compiler: Performance Budgets & Benchmarking Methodology

## 1. Compiler Performance Budgets

To prevent performance regressions as JARVIS applications scale, the framework establishes the following performance budgets for developer workflows on standard workstation hardware:

| Workflow Scenario | Budget Target | Measured Baseline (50 components) |
| :--- | :--- | :--- |
| **Cold Full Compilation** | $< 100\text{ ms}$ | **$32.68\text{ ms}$** |
| **Incremental CSS Recompilation** | $< 5\text{ ms}$ | **$1.10\text{ ms}$** |
| **Incremental Template Recompilation** | $< 5\text{ ms}$ | **$0.26\text{ ms}$** |
| **Incremental TS Implementation Edit** | $< 5\text{ ms}$ | **$0.22\text{ ms}$** |
| **Zero-Op Unmodified File Touch** | $< 1\text{ ms}$ | **$0.04\text{ ms}$** |
| **Peak Heap Allocation during Build** | $< 50\text{ MB}$ | **$14.96\text{ MB}$** |

---

## 2. Benchmark Suite Architecture

The benchmark suite (`scripts/benchmark.ts`) runs automated, repeatable tests measuring both compiler and runtime subsystems:

```bash
node scripts/benchmark.ts
```

### Measured Subsystems:
1. **Change Detector**: Overhead of reading and hashing source files with cryptographic guarantees.
2. **Dependency Graph Traversal**: Invalidation planning across 50 simulated components and multiple dependency branches.
3. **Rust Template Compilation**: Invocation of `jarvis-compiler` and serialization/deserialization over stdio.
4. **Output Preservation**: Verification that identical build artifacts do not trigger disk writes or file touches.

---

## 3. Rust Compiler Optimizations (`compiler/jarvis-compiler`)

The Rust compiler is designed to minimize CPU time and heap allocations:
1. **Zero-Copy Lexer Tokens**: Uses string slices (`&str`) borrowing from the source template rather than allocating owned `String` objects for every HTML tag and identifier.
2. **Streaming AST / IR Generation**: Emits direct intermediate representation instructions without deep intermediate AST cloning.
3. **Deterministic Diagnostic Output**: Formats compiler diagnostics directly into structured JSON with precise line/column spans:
   ```json
   {
     "success": true,
     "code": "export function template(renderer, ctx) { ... }"
   }
   ```
4. **Deterministic Code Generation**: Emits consistent JavaScript code for identical inputs, ensuring that downstream hash-based caches are 100% reproducible.
