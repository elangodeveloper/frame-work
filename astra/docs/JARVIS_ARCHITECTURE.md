# JARVIS Framework: System Architecture Specification

## 1. Executive Summary & Foundational Model
JARVIS is an enterprise-grade frontend framework engineered with a native Rust compiler (jarvis-compiler) and a fine-grained TypeScript runtime (@jarvis/*).

The framework adheres to strict Object-Oriented Analysis & Design (OOAD) principles, establishing decoupled layers across:
- Compiler Toolchain (Rust)
- Reactive State Engine (TypeScript)
- Renderer Strategy (Polymorphic DOM / SSR / Test)
- Component Lifecycle & View Model
- Declarative Router (Signal-based)
- UI Component Adapters (PrimeNG v20)

### High-Level Architecture Diagram
`	ext
                               +----------------------------+
                               |     JARVIS Source Code     |
                               |  (Templates, TS Classes)   |
                               +----------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                                    RUST COMPILER                                        |
|                                                                                         |
|  Source HTML/Template                                                                   |
|        |                                                                                |
|        v                                                                                |
|  Lexer (Character Cursor -> Structured Tokens with Byte & Line/Col Spans)               |
|        |                                                                                |
|        v                                                                                |
|  Parser (Recursive-descent Parser -> Strongly Typed TemplateAst)                        |
|        |                                                                                |
|        v                                                                                |
|  Semantic / Diagnostic Engine (Tag matching, Span analysis, Structured Diagnostics)     |
|        |                                                                                |
|        v                                                                                |
|  IR Lowerer (Linearized 3AC Instructions: CreateElement, BindText, BindProperty, etc.)  |
|        |                                                                                |
|        v                                                                                |
|  Code Generator (Deterministic JS View Factory emitting Renderer abstraction calls)     |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
                           Compiled JavaScript View Factory
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                                  TYPESCRIPT RUNTIME                                     |
|                                                                                         |
|  +--------------------+   +-----------------------+   +------------------------------+  |
|  |   @jarvis/core     |   |   @jarvis/reactive    |   |      @jarvis/renderer        |  |
|  | - @Component       |   | - Signal<T> (Atomic)  |   | - Renderer Strategy (DOM /   |  |
|  | - JarvisEvent<T>   |   | - Computed<T> (Lazy)  |   |   TestRenderer / SSR)        |  |
|  | - Metadata Registry|   | - Effect (Microtask)  |   | - Fine-grained text/prop     |  |
|  +--------------------+   +-----------------------+   +------------------------------+  |
|                                             |                                           |
|                                             v                                           |
|  +--------------------+   +-----------------------+   +------------------------------+  |
|  |   @jarvis/runtime  |   |    @jarvis/router     |   |       @jarvis/primeng        |  |
|  | - bootstrap()      |   | - Signal Route State  |   | - PrimeNG v20 Adapters       |  |
|  | - Lifecycle Hooks  |   | - Guard Strategy      |   | - Scoped Design Tokens       |  |
|  | - ComponentView    |   | - RouterOutlet View   |   | - Button, Input, Select, etc |  |
|  +--------------------+   +-----------------------+   +------------------------------+  |
+-----------------------------------------------------------------------------------------+
`

## 2. Monorepo Crate & Package Map
1. **compiler/jarvis-compiler**: Native Rust 2021 compiler. Zero external crates. Strict #![deny(clippy::all)]. Emits JS view factories.
2. **@jarvis/core**: Base metadata decorators (@Component), component reflection, and native event dispatcher (JarvisEvent<T>). Strictly zero RxJS.
3. **@jarvis/reactive**: Push-pull reactive graph. Atomic signal(), memoized computed(), batch-scheduled effect().
4. **@jarvis/renderer**: Pluggable rendering strategy (Renderer) with browser DOM implementation (DOMRenderer) and headless mock (TestRenderer).
5. **@jarvis/runtime**: Component lifecycle (onInit, fterRender, onDestroy), view containers (ComponentView), and ootstrap().
6. **@jarvis/compiler-runtime**: Node.js/CLI bridge spawning native jarvis-compiler binary.
7. **@jarvis/router**: Signal-based declarative client router (Route[]), param extraction, canActivate guards, and RouterOutlet.
8. **@jarvis/primeng**: PrimeNG v20 decoupled adapter bridge with scoped tokens and pure signals.

## 3. Strict Boundary Rules
* The **Rust compiler** has zero runtime dependencies and outputs plain, deterministic JavaScript function factories.
* The **Runtime** never invokes the compiler directly in production; templates are precompiled ahead-of-time (AOT).
* The **Renderer** never inspects component business state; it consumes fine-grained update closures.
* The **Reactive Engine** is fully isolated from DOM nodes, preventing memory cycles.
