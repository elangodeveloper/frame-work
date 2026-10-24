# PROJECT AUDIT: JARVIS FRONTEND FRAMEWORK
**Date**: October 2026
**Status**: Comprehensive Baseline Audit Completed
**Author**: Principal Software Architect & Compiler Engineer

---

## 1. Executive Summary

JARVIS is an object-oriented, fine-grained reactive frontend framework built with:
- A custom **Rust-based template compiler** (`compiler/jarvis-compiler`)
- A modular **TypeScript runtime and package ecosystem** (`packages/*`)
- Decoupled enterprise *adapters** (`adapters/primeng`, `adapters/tailwind`)
- Developer tooling including a dedicated *CLI** (`cli/`) and **DevTools** (`devtools/`)
- Strictly **Zero RxJS dependencies**, relying on native signals (@jarvis/reactive), standard Promises, and `JarvisEvent<T>`.


---

## 2. Workspace and Subsystem Inventory

```text
jarvis/
└━ packages/
│   ├─ compiler-runtime/   # Node.js bridge to Rust compiler
�
   ├─ core/               # @Component, DI, JarvisEvent
�
   ├─ forms/              # FormControl, FormGroup, validation
│   ├─ http/               # HttpClient, Promises, AbortSignal
│   ├─ reactive/           # Fine-grained push-pull signal graph
�
   ├─ renderer/           # Renderer, DOMRenderer, TestRenderer
│   ├─ router/             # Signal Router, ActivatedRoute, RouterOutlet
�
   ├─ runtime/            # bootstrap(), ComponentView, lifecycles
│   ┥─ testing/            # TestBed, ComponentFixture
└━ compiler/
│   ┥─ jarvis-compiler/    # Rust crate (lexer, parser, ast, ir, codegen)
└─ adapters/
�
   ├─ primeng/            # PrimeNG v20 bridge (<jarvis-p-*>)
�
   └─ tailwind/           # Tailwind CSS layer presets
└─ cli/                    # JARVIS CLI (create, generate, dev, build, test)
└─ devtools/0               # DevTools runtime inspector
└━ examples/                # Multi-file components & showcases
└─ assets/branding/          # Vector SVG favicons & logos
└─ docs/                     # Architectural reports & audits
```

---

## 3. Subsystem Detailed Analysis

### 3.1 Rust Compiler (`compiler/jarvis-compiler`)
- What exists: `lexer.rs`, parser.rs`, `ast.rs`, `ir.rs`, `codegen.rs`, `diagnostics.rs`.
- What works: Multi-stage pipeline tokenizes HTML, parses AST, generates IR, and emits fine-grained JS factory functions using renderer abstraction. Catches tag mismatches with structured spans (`TPL005`). Passes cargo test.
- Weakness: Lacks an Expression AST; expressions are currently rewritten via naive string prepending (`ctx.${expr}`). Needs Expression Parser to prevent unsafe JS execution and support control flow (`@if`, `@for`).

### 3.2 TypeScript Runtime & Component System (@ajarvis/runtime, @ajarvis/core)
- What exists: `@Component`, `onInit`, `afterRender`, `onDestroy`, metadata reflection, `bootstrap()`, `ComponentView`.
- What works: Instantiates components, wires up views, registers disposers, manages lifecycles.
- Weakness: Templates in development are currently compiled via `execFileSync` + `new Function()` in `compiler-runtime`. Build pipeline needs pre-compilation for separate `.tsmap/html/css` components.

### 3.3 Reactive Engine (@jarvis/reactive)
- What works: Push-pull fine-grained signal graph (`signal`, `computed`, `effect`, `batch`) with dynamic dependency cleanup and cycle detection. 100% pass rate across all suites. Strictly Zero RxJS.

### 3.4 Renderer Abstraction (@jarvis/renderer)
- What works: `Renderer` decouples runtime from DOM. `DOMRenderer` provides fine-grained `install bindings (`bindText`, `bindProperty`, `listen`) that mutate only the specific node without re-rendering components.

### 3.5 Dependency Injection (@ajarvis/core)
- What works: `Injector`, `inject()` manages root-scoped instances and token providers (`useClass`, `useValue`, `useFactory`).
- Weakness: Needs hierarchical scoping (parent/child injectors) and circular dependency guards.

### 3.6 Router (@ajarvis/router)
- What works: Declarative routing, params, query params, guards (`canActivate`), navigation events, history popstate, and `RouterOutlet`. Strictly Zero RxJS.
- Weakness: Needs nested outlets and lazy-loading support.

### 3.7 HTTP & Forms (@jarvis/http, @jarvis/forms)
- What works: `HttpClient` (cancellability via `AbortSignal`, json/text parsing), `FormControl`, `FormGroup` (synchronous validation, reactive state signals).
- Weakness: Needs HTTP interceptors, `resource()` primitive, `FormArray`, and async validation.

### 3.8 PrimeNG & Tailwind Adapters
- What works: Decoupled 6-component adapter layer (<jarvis-p-button>, input, select, checkbox, dialog, table) mapping events and Aura tokens without Angular/RxJS.

---

## 4. Template Security & JavaScript Execution Assessment
1. *No Inline Handlers**: Zero `onclick`, onload, or inline event scripts in any HTML file. All events are wired declaratively.
2. *Security Gap**: Template expressions are currently string-rewritten rather than AST-parsed. This is a critical area for hardening to prevent arbitrary JS execution and enforce safe sandboxing.

---

## 5. Prioritized Implementation Plan

|| Priority | Subsystem | Action Required |
| :--- | :--- | :--- |
| **P1** | *Rust Compiler* | Implement basic **Expression AST* and tokenizer to validate template expressions at compile time. |
| **P2** | *Rust Compiler* | Add **Control Flow** (`@if`, `@for`) solutions to the Rust parser and IR. |
| **P3** | *Component Runtime** | Ensure separate `templateUrl` and `styleUrl` loading does not require runtime `new Function()`. |
| **P4** | *Dependency Injection** | Implement hierarchical injectors with circular dependency detection. |
| **P5** | *HTTP & Resources** | Add HTTP interceptors and reactive `resource()` primitive. |
| **P6** | *Forms** | Add `FormArray` and async validators to @ajarvis/forms. |
