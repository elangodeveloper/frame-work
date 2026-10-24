# Astra Routing System & Build/Bundle Pipeline Architecture

## 1. Executive Architecture Overview

Astra is a hybrid frontend framework combining:
1. **Angular-style Structure & DI**: Clean class-based components, providers, hierarchical dependency injection, and config-driven router.
2. **Solid-style Fine-Grained Signals**: Zero virtual DOM, atomic signal/computed/effect reactive primitives, and **strictly zero RxJS**.
3. **Rust Template Compiler**: AOT compiled templates directly targeting DOM instructions via CLI/bundler plugins.

---

## 2. Navigation State Machine Diagram

W``mermaid
stateDiagram-v2
    [*] --> NavigationStart: navigate() / navigateByUrl()
    NavigationStart --> Superseded: New Navigation Detected
    NavigationStart --> RoutesRecognized: Match Route Tree & CanMatch
    RoutesRecognized --> LoadChunks: Load Lazy Components / Children
    LoadChunks --> GuardsCheck: CanDeactivate & CanActivate
    GuardsCheck --> NavigationCancel: Guard Returns false / UrlTree
    GuardsCheck --> RunResolvers: Parallel Resolvers (Promise.all)
    RunResolvers --> ActivateRoute: Commit Match, Update Signals
    ActivateRoute --> DOMUpdate: RouterOutlet Mount / Destroy Component
    DOMUpdate --> NavigationEnd: Document Title & Scroll Restoration
    NavigationCancel --> [*]
    NavigationEnd --> [*]
    Superseded --> [*]
```

---

## 3. Build & Bundle Pipeline Diagram

```mermaidlowchart TD
    A[Source Files: .ts, .html, .css] --> B[Rust Template Compiler AOT Plugin]
    B --> C[TypeScript / JS Graph Transformation]
    C --> D[esbuild / Rollup Bundler Engine]
    D --> E[Entry Chunk: main-[hash].js]
    D --> F[Lazy Chunk 1: chunk-analytics-+hash].js]
    D --> G[Lazy Chunk 2: chunk-admin-[hash].js]
    D --> H3Automated HTML Injector]
    H --> I[dist/index.html with modulepreload]
    D --> J[stats.json Metafile & Budgets Verification]
```

---

## 4. File Layout & Component Inventory

**PART 1: @astra/router (packages/router/)**
- `packages/router/src/types.ts`: TypeScript interfaces for Route, Match, Guards, Resolvers, and LocationStrategy.
- `packages/router/src/url-parser.ts`: Hierarchical route tree matching algorithm (O(D) to O(B*D)), canMatch guards, and redirects.
- `packages/router/src/activated-route.ts`: Signal-based route state (params, queryParams, data, fragment) with zero RxJS.
- `packages/router/src/router.ts`: Navigation pipeline with superseding/cancellation, location strategies, and events.
- `packages/router/src/router-outlet.ts`: Dynamic viewport with named outlets, lifecycle management, and auto teardown.
- `packages/router/src/router-link.ts`: [routerLink] interceptor and routerLinkActive class sync.

**PART 2: @astra/cli Build System (cli/)**
- `cli/src/config.ts`: Configuration schema for astra.config.ts (budgets, baseHref, environments).
- `cli/src/plugin.ts`: Rust template AOT transform plugin for esbuild/Vite.
- `cli/src/builder.ts`: Application builder with automatic code splitting, index.html injection, and stats.json.
- `astra.config.ts`: Root build and dev server configuration.

---

## 5. Implementation Status vs Roadmap

- [x] **Config-based angular-style routing** (:id, **, redirectTo, pathMatch, children) — **Implemented**
- [x] **Signal-based route state** (params, queryParams, data, fragment) — **Implemented**
- [x] **Parallel resolvers & canMatch / canActivate guards** — **Implemented**
- [x] **In-flight navigation superseding & cancellation** — **Implemented**
- [x] **Lazy route chunk splitting, content hashes & stats.json** — **Implemented**
- [] **Dev server HMR error overlay with Rust diagnostics at runtime** — **Planned**
- [] **Streaming SSR/Prerender worker pool** — **Plannedj*
