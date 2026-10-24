# JARVIS Framework Repository: Standardized Project Structure

## 1. Architectural Overview & Design Philosophy

JARVIS is engineered as a high-performance, modular monorepo. It cleanly separates low-level native compilation, core reactive primitives, component reflection, DOM rendering abstractions, UI adapters, and developer tooling into dedicated packages.

```text
jarvis/
├── compiler/
│   └── jarvis-compiler/        # Native Rust AOT Template Compiler
├── packages/
│   ├── core/                    # Component decorator, DI, input/output signals
│   ├── reactive/                # Push-pull reactive graph, batching, scheduler
│   ├── compiler-runtime/        # Incremental dependency graph, caching, HMR
│   ├── renderer/                # DOMRenderer, TestRenderer, keyed reconciler
│   ├── router/                  # Signal-based routing, guards, lazy chunks
│   ├── forms/                   # Reactive forms, FormControl, FormGroup
│   ├── http/                    # HttpClient, request options, interceptors
│   ├── styles/                  # Centralized tokens, CSS variables, theme manager
│   ├── runtime/                 # bootstrap(), ComponentView, view lifecycles
│   └── testing/                 # TestBed, test fixtures
├── adapters/
│   ├── primeng/                 # PrimeNG v20 adapter layer (<jarvis-p-*>)
│   └── tailwind/                # Tailwind CSS preset layer configuration
├── cli/
│   ├── src/                     # CLI binaries, code generators, builder
│   └── templates/               # Reusable schematic templates
├── devtools/                    # DevTools runtime inspector
├── examples/                    # Multi-component applications and integration specs
├── docs/                        # Complete architectural specifications
└── scripts/                     # Benchmarks and release utilities
```

---

## 2. Package Boundaries and Dependency Rules

To prevent coupling and circular dependencies, JARVIS strictly enforces the following unidirectional dependency hierarchy:

```
                  ┌──────────────────────┐
                  │    @jarvis/runtime   │
                  └──────────┬───────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   @jarvis/core  │ │  @jarvis/router │ │  @jarvis/forms  │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             ▼
                  ┌──────────────────────┐
                  │   @jarvis/renderer   │
                  └──────────┬───────────┘
                             ▼
                  ┌──────────────────────┐
                  │   @jarvis/reactive   │  (Zero dependencies)
                  └──────────────────────┘
```

### Dependency Invariants:
1. **`@jarvis/reactive` is a leaf package**: It has zero external dependencies and zero awareness of the DOM, components, or router. It exports raw reactive signals (`signal`, `computed`, `effect`, `resource`, `batch`).
2. **`@jarvis/renderer` depends only on `@jarvis/reactive`**: It exposes the `Renderer` abstraction and DOM binding mechanics without depending on `@jarvis/core`.
3. **`compiler/jarvis-compiler` is completely isolated**: Implemented in Rust, it does not import any TypeScript packages and communicates solely via stdio JSON.
4. **Adapters live outside Core**: Neither PrimeNG nor Tailwind dependencies exist inside `@jarvis/core` or `@jarvis/renderer`. They reside exclusively in `adapters/*`.
5. **CLI is completely decoupled from runtime execution**: The CLI provides code generation, bundling, and local development orchestration.
