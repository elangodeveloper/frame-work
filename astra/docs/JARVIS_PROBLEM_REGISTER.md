# Jarvis Master Problem Register

### JARVIS-COMPILER-001
* **Severity**: P1 (High)
* **Category**: Compiler / Diagnostics
* **Problem**: Single-error compiler bailout.
* **Current Behavior**: Compiler returns on the first syntax error, preventing batch diagnostics.
* **Expected Behavior**: Parser error recovery allows reporting multiple independent syntax errors in one run.
* **Root Cause**: `parse()` uses early-return `?` on error.
* **Impact**: Developer must fix errors one by one.
* **Proposed Solution**: Introduce `DiagnosticsAccumulator` and synchronization tokens in `Parser`.
* **Rust Modules Affected**: `src/parser.rs`, `src/diagnostics.rs`, `src/lib.rs`.
* **Tests Required**: Multiple syntax errors test suite.
* **Performance Impact**: Negligible (< 1% overhead).
* **Compatibility Impact**: Non-breaking.

---

### JARVIS-COMPILER-002
* **Severity**: P2 (Medium)
* **Category**: Compiler / Expression Safety
* **Problem**: Naive expression rewriting prepends `ctx.` indiscriminately.
* **Current Behavior**: Rewriting produces `ctx.Math.round(x)` for globals.
* **Expected Behavior**: Expression parser distinguishes global objects, identifiers, and literals.
* **Root Cause**: Simple string prefix heuristic in `codegen.rs`.
* **Impact**: Complex template expressions fail at runtime.
* **Proposed Solution**: Lightweight JS expression tokenizer in Rust.
* **Rust Modules Affected**: `src/codegen.rs`.
* **Tests Required**: Complex expression codegen test.
* **Performance Impact**: Minimal.
* **Compatibility Impact**: Non-breaking.

---

### JARVIS-RUNTIME-001
* **Severity**: P2 (Medium)
* **Category**: Runtime / Async Safety
* **Problem**: Asynchronous race conditions in rapid user interactions.
* **Current Behavior**: Responses can resolve out-of-order, overwriting newer state with stale data.
* **Expected Behavior**: Framework provides built-in cancellation or revision tracking for async tasks.
* **Root Cause**: Lack of dedicated `resource()` primitive.
* **Impact**: UI can display outdated results.
* **Proposed Solution**: Implement `resource<T>()` in `@jarvis/reactive`.
* **Tests Required**: Asynchronous race condition unit tests.
* **Performance Impact**: Zero overhead on synchronous signals.
* **Compatibility Impact**: Additive.
