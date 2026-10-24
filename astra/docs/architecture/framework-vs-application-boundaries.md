# JARVIS: Framework vs. Application Architectural Boundaries

## 1. The Boundary Principle

A fundamental rule of the JARVIS ecosystem is the strict boundary between the **Framework Monorepo** and **Applications Built with JARVIS**.

Framework internals must never bleed into application code, and application patterns must not contaminate the framework core.

---

## 2. Architectural Comparison

| Dimension | JARVIS Framework Repository | Applications Created with JARVIS |
| :--- | :--- | :--- |
| **Directory Scope** | `packages/*`, `compiler/*`, `adapters/*`, `cli/*` | `src/app/`, `src/features/*`, `src/shared/*` |
| **Primary Organization**| Package-based (Monorepo) | Feature-based (Domain Driven) |
| **Language & Tooling** | Rust (`Cargo.toml`) + TypeScript ESM | TypeScript + CSS + HTML |
| **Reactivity** | Defines `signal()`, `computed()`, `effect()` | Consumes signals for state and UI |
| **Renderer** | Defines `Renderer`, `DOMRenderer`, reconciler | Emits templates parsed into `Renderer` calls |
| **Adapters** | Implements bridges (`adapters/primeng`, Tailwind)| Configures presets (`providePrimeNG()`) |
| **Target Audience** | Framework and compiler engineers | Application and enterprise developers |

---

## 3. Boundary Rules & Prohibitions

1. **Zero Framework Source Files in Application Projects**:
   - Applications import strictly via package scopes (`@jarvis/core`, `@jarvis/reactive`, `@jarvis/router`, `@jarvis/styles`).
   - Applications never use relative path imports pointing into `../../packages/*`.
2. **Zero RxJS Anywhere**:
   - Applications must not rely on RxJS Observables to communicate with JARVIS core components. Synchronous, fine-grained `Signal` and `JarvisEvent` are the sole primitives.
3. **No Direct Compiler Runtime Invocation in Browser**:
   - `compiler-runtime` (executing the Rust binary via child process) is used exclusively during Ahead-of-Time build (`jarvis build`) and development server mode (`jarvis dev`).
   - Browser production bundles contain only pre-compiled JavaScript view factories.
