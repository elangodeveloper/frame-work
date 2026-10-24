# Comprehensive Audit: Unwanted, Legacy & Redundant Files in Jarvis Framework

This document catalogs all unnecessary, legacy, obsolete, and temporary files found within the repository. For each file or directory group, it explains **what the file does**, **why it is considered unwanted or redundant**, and provides a **recommended action**.

---

## Executive Summary

| Category | Location | File Count / Size | Status | Primary Reason |
|---|---|---|---|---|
| **Stray Temporary Files** | `test.txt`, `scratch/` | 60+ files | Safe to Delete | Leftover ad-hoc tests and mock apps from CLI verification. |
| **Abandoned Compiler Crates** | `crates/lumina-*` (7 crates) | 37 files | Deprecated / Remove | Legacy "Lumina" language compiler; not in workspace `Cargo.toml`. |
| **Legacy Web Test Runner** | `web/` | 7 files | Obsolete | Superseded by `@jarvis/cli serve` and `@jarvis/vite-plugin`. |
| **Superseded TS Compiler** | `packages/compiler-runtime` | 8 files | Obsolete | Replaced by Rust `jarvis-compiler --worker` and Vite plugin. |
| **Legacy Pre-Monorepo Tree** | `astra/` | 5,050 files (~1.08 GB) | Archive / Delete | Historical snapshot before monorepo restructuring; duplicates codebase. |
| **Committed Build Artifacts** | `astra/examples/*/bundle.js*` | 10+ files | Safe to Delete | Generated build output committed into source directories. |

---

## 1. Stray & Temporary Junk Files

These are temporary scratch files and mock test applications created during development and CLI verification runs.

### Files List
- `test.txt`
- `scratch/cache-test/`
- `scratch/cli-test/` (includes all files under `scratch/cli-test/components/`, `directives/`, `guards/`, `models/`, `pages/`, `pipes/`, `repositories/`, `services/`, and `sample-app/`)

### File-by-File Breakdown
| Path | What It Does | Why It Is Unwanted | Recommendation |
|---|---|---|---|
| `test.txt` | Contains the single word `hello`. Created during an ad-hoc write/pipe test. | Junk file at repository root with zero functional purpose. | **Delete** |
| `scratch/cache-test/` | Empty directory used to benchmark caching. | Temporary benchmark artifact. | **Delete** |
| `scratch/cli-test/` | Contains 60+ scaffolded mock files (`user-profile.component.*`, `compact-badge.component.*`, `employee.repository.ts`, `auth.guard.*`, `dashboard.page.*`, `sample-app/*`). | Generated while testing the `jarvis generate` and `jarvis new` CLI commands. They are not part of the framework codebase. | **Delete** |

---

## 2. Abandoned Predecessor Compiler Crates (`crates/lumina-*`)

Before the project was focused on the Angular-like **Jarvis** framework (with `jarvis-compiler` dedicated to HTML template compilation and reactive signal binding), an earlier custom programming language named **"Lumina"** was developed. These 7 crates remain in the `crates/` directory but are **excluded from root `Cargo.toml` members** and have **zero dependencies** across the active Jarvis packages.

```
crates/
├── lumina-ast/
├── lumina-core/
├── lumina-driver/
├── lumina-ir/
├── lumina-lexer/
├── lumina-parser/
└── lumina-pass/
```

### Detailed Breakdown
| Crate / File | What It Does | Why It Is Unwanted | Recommendation |
|---|---|---|---|
| **`crates/lumina-ast/`**<br>• `src/ast.rs`<br>• `src/visitor.rs`<br>• `src/printer.rs`<br>• `src/lib.rs` | Defines Abstract Syntax Tree (AST) nodes for a standalone general-purpose language (statements, expressions, types, functions), along with AST traversal visitors and AST pretty-printers. | The Jarvis framework compiles Angular-like HTML templates and TS component decorators. It uses `crates/jarvis-compiler`, which has its own AST arena. `lumina-ast` is completely unused. | **Delete or Archive** |
| **`crates/lumina-core/`**<br>• `src/diagnostic.rs`<br>• `src/interner.rs`<br>• `src/source.rs`<br>• `src/span.rs`<br>• `src/lib.rs` | Provides string interning via the `lasso` crate, source code span management, source file tracking, and diagnostic reporting for the Lumina language. | `jarvis-compiler` has its own self-contained source span management, diagnostics (`TPL001`–`TPL006`), and content caching. | **Delete or Archive** |
| **`crates/lumina-lexer/`**<br>• `src/lexer.rs`<br>• `src/token.rs`<br>• `src/lib.rs` | Tokenizer for the Lumina language syntax (keywords like `fn`, `let`, `mut`, identifiers, operators). | Jarvis compiles HTML/template syntax (`<tag [attr]="expr" (event)="fn()">{{ val }}</tag>`). The Lumina lexer cannot tokenize HTML templates. | **Delete or Archive** |
| **`crates/lumina-parser/`**<br>• `src/parser.rs`<br>• `src/pratt.rs`<br>• `src/lib.rs` | Recursive descent and Pratt expression parser for the Lumina language grammar. | `jarvis-compiler` contains `src/parser.rs` and `src/expr/` specifically built for Angular-style template interpolation and binding syntax. | **Delete or Archive** |
| **`crates/lumina-ir/`**<br>• `src/ir.rs`<br>• `src/interp.rs`<br>• `src/printer.rs`<br>• `src/lib.rs` | Intermediate Representation (IR), bytecode format, and tree-walk interpreter for executing Lumina programs. | Jarvis emits optimized JavaScript/TypeScript runtime calls (`renderer.createElement()`, `renderer.bindText()`, `renderer.listen()`). It does not run a custom bytecode interpreter. | **Delete or Archive** |
| **`crates/lumina-pass/`**<br>• `src/constant_fold.rs`<br>• `src/lowering.rs`<br>• `src/manager.rs`<br>• `src/pass.rs`<br>• `src/lib.rs` | Optimization passes for the Lumina language: constant folding, AST-to-IR lowering pass manager, and dead code elimination. | Not used by Jarvis. Template optimizations in Jarvis are handled directly in `crates/jarvis-compiler/src/codegen.rs` (static subtree hoisting). | **Delete or Archive** |
| **`crates/lumina-driver/`**<br>• `src/main.rs`<br>• `src/driver.rs`<br>• `tests/*` | CLI binary entrypoint for the Lumina compiler (`lumina compile <file>`). | Replaced by `crates/jarvis-compiler/src/main.rs` (`jarvis-compiler --worker`) and `@jarvis/cli`. | **Delete or Archive** |

---

## 3. Legacy Web Test Runner & Playground (`web/`)

This directory contains a standalone browser test runner and HTTP server designed for the legacy Lumina compiler.

### Files List
```
web/
├── package.json
├── server.ts
├── index.html
├── tsconfig.json
└── src/
    ├── compiler.ts
    ├── test_runner.ts
    └── types.ts
```

### Detailed Breakdown
| File | What It Does | Why It Is Unwanted | Recommendation |
|---|---|---|---|
| `web/package.json` | Declares package `"lumina-compiler-web"`. | Relic from the Lumina compiler experiment; not part of npm workspaces in root `package.json`. | **Delete** |
| `web/server.ts` | Node.js HTTP server listening on port 3000 to serve the `web/index.html` file. | Development server duties are handled by `jarvis serve` (Vite) and `@jarvis/vite-plugin`. | **Delete** |
| `web/index.html` | HTML UI with buttons to execute compiler tests in the browser. | Modern framework tests run headlessly via Vitest and `npm test` (`node --test`). | **Delete** |
| `web/src/compiler.ts` | TypeScript bridge attempting to call the compiler in-browser. | Browser compilation playground is handled via `crates/jarvis-wasm`. | **Delete** |
| `web/src/test_runner.ts` | In-browser test runner printing test results to HTML DOM. | Redundant with `npm test` and Vitest suites. | **Delete** |
| `web/tsconfig.json` | TypeScript configuration for the `web/` folder. | Not part of any active workspace. | **Delete** |

---

## 4. Superseded TypeScript Compiler Runtime (`packages/compiler-runtime`)

Early in framework development, the compiler daemon and incremental build caching were prototyped in TypeScript before being fully rewritten in native Rust.

### Files List
```
packages/compiler-runtime/
├── package.json
└── src/
    ├── compiler-cache.ts
    ├── compile_component.ts
    ├── dependency-graph.ts
    ├── dev-server.ts
    ├── incremental-compiler.ts
    ├── index.ts
    └── parallel-compiler.ts
```

### Detailed Breakdown
| File | What It Does | Why It Is Unwanted | Recommendation |
|---|---|---|---|
| `src/compiler-cache.ts` | SHA-256 in-memory caching of compilation outputs. | Superseded by native caching in `CompilerService` (`@jarvis/vite-plugin`) and `crates/jarvis-compiler`. | **Delete** |
| `src/compile_component.ts` | Regex/AST-based component metadata extraction in JS. | Superseded by `@jarvis/vite-plugin/src/plugin.ts` which transforms `@Component` decorators using AST/regex directly in the Vite pipeline. | **Delete** |
| `src/dependency-graph.ts` | Directed acyclic graph (DAG) tracking which components depend on which templates. | Vite's internal module graph and HMR dependency tracking (`import.meta.hot`) handle this natively with higher performance and lower overhead. | **Delete** |
| `src/dev-server.ts` | Custom development server written from scratch using `node:http`. | The framework standard (Phase 3) strictly mandates Vite (`jarvis serve`). Custom HTTP servers are redundant. | **Delete** |
| `src/incremental-compiler.ts` | File-watching wrapper running incremental compilation passes. | Handled natively by Vite watch mode + `@jarvis/vite-plugin`. | **Delete** |
| `src/parallel-compiler.ts` | Dispatches compilation tasks across Node child processes. | Handled by Rayon in Rust (`crates/jarvis-compiler`) and the persistent worker daemon. | **Delete** |

---

## 5. The Legacy Pre-Monorepo Tree (`astra/`)

The `astra/` directory is an entire backup copy of the framework from before Phase 1 monorepo restructuring. It contains **5,050 files and over 1.08 GB** of duplicated code, dependencies, and build artifacts.

### Key Contents of `astra/`
1. **`astra/node_modules/` (~800 MB):** Duplicate copy of all npm dependencies.
2. **`astra/target/` (~200 MB):** Old Rust debug/release build targets.
3. **`astra/packages/`:** Outdated duplicates of `@jarvis/core`, `@jarvis/renderer`, `@jarvis/reactive`, `@jarvis/router`, `@jarvis/runtime`, etc.
4. **`astra/crates/`:** Outdated duplicates of `jarvis-compiler`, `jarvis-napi`, `jarvis-wasm`.
5. **`astra/examples/`:** Numbered milestone prototypes (`01-hello-world` through `07-employee-portal`). The official Angular-like application standard is now located in [`templates/app/`](file:///c:/Developer/frame-work/templates/app/) and [`examples/demo-app/`](file:///c:/Developer/frame-work/examples/demo-app/).
6. **`astra/scratch/`:** Duplicate scratch folders (`cache-test`, `cli-test`).
7. **`astra/scripts/`:** Older ad-hoc scripts (`serve.js`, `build.js`, `benchmark.ts`).

### Why It Is Unwanted
- Consumes over 1 GB of disk space.
- Creates ambiguity about which entry points and packages are current.
- Can lead to accidental edits or runs against obsolete files (such as the offline CDN issue encountered previously).

### Recommendation
- Either **permanently remove** `astra/` or **move it to a single compressed archive** (e.g. `astra-legacy-backup.zip`) outside the active git workspace.

---

## 6. Pre-Compiled Build Artifacts Committed in Example Directories

In several example showcase folders, production bundles and sourcemaps were committed directly into the source folders:
- `astra/examples/04-login-storage/bundle.js` & `bundle.js.map`
- `astra/examples/06-layout-composition/bundle.js` & `bundle.js.map`
- `astra/examples/07-employee-portal/bundle.js` & `bundle.js.map`

### Why They Are Unwanted
- Build artifacts should never be tracked alongside source code.
- They inflate git repository size and create merge conflicts.
- Jarvis applications build cleanly to `dist/` using `jarvis build`.

---

## Recommended Cleanup Action Plan

To transition the repository to a clean, canonical monorepo:

```powershell
# 1. Remove temporary junk
Remove-Item -Force test.txt
Remove-Item -Recurse -Force scratch

# 2. Remove obsolete web test runner
Remove-Item -Recurse -Force web

# 3. Remove abandoned Lumina compiler crates (not in Cargo.toml)
Remove-Item -Recurse -Force crates/lumina-*

# 4. Remove obsolete TypeScript compiler runtime
Remove-Item -Recurse -Force packages/compiler-runtime

# 5. Clean up or archive legacy 'astra' folder
# (Option A: Archive to zip)
Compress-Archive -Path astra -DestinationPath astra-legacy-backup.zip -Force
Remove-Item -Recurse -Force astra
# (Option B: Delete directly if already committed in git history)
# Remove-Item -Recurse -Force astra
```

After performing this cleanup, the repository will strictly match the target layout specified in Phase 1:
```
jarvis/
├── package.json          (workspace root, packages/*)
├── Cargo.toml            (Rust workspace: crates/jarvis-*)
├── crates/
│   ├── jarvis-compiler/
│   ├── jarvis-napi/
│   └── jarvis-wasm/
├── packages/
│   ├── cli/
│   ├── core/
│   ├── forms/
│   ├── http/
│   ├── renderer/
│   ├── router/
│   ├── runtime/
│   └── vite-plugin/
├── templates/app/
├── examples/demo-app/
└── docs/
```
