# JARVIS Framework: Layout Architecture

## 1. Architectural Overview & Responsibilities

The JARVIS layout system enforces a clean separation of concerns across the application runtime. Rather than hard-coding monolithic layouts or mixing layout logic with route handlers and feature business components, JARVIS decouples the architecture into distinct, highly cohesive subsystems:

```
                  JARVIS APPLICATION
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
       APPLICATION ROUTER        LAYOUT SYSTEM
             │                         │
             ▼                         ▼
        ROUTE RESOLUTION       LAYOUT COMPOSITION
             │                         │
             └────────────┬────────────┘
                          │
                          ▼
                    SCREEN CONTENT
                          │
                          ▼
                   JARVIS RENDERER
                          │
                          ▼
                         DOM
```

### Subsystem Boundaries & Responsibilities

| Subsystem | Sole Responsibility | Forbidden Concerns |
| :--- | :--- | :--- |
| **Application Router** (`@jarvis/router`) | Resolves URL segments, checks guards, executes resolvers, manages URL history. | Must **not** know how sidebars, headers, or drawers are implemented. |
| **Layout System** (`@jarvis/layout`) | Manages application structural shells (Header, Sidebar, Navigation, Content Outlet, Footer), responsive breakpoints, and mobile drawer transitions. | Must **not** own screen business logic or data fetching. |
| **Screen Content** (`features/*`) | Implements feature-specific presentation, user interactions, and view models. | Must **not** manipulate sibling or parent layout elements directly. |
| **Reactive Runtime** (`@jarvis/reactive`) | Fine-grained dependency tracking, derivation updates, and batch scheduler with zero RxJS. | Pure reactive primitives only; no DOM or routing coupling. |
| **Renderer Abstraction** (`@jarvis/renderer`) | Decouples DOM operations (`DOMRenderer`) from headless testing (`TestRenderer`). | Must **not** contain application-specific layout logic. |

---

## 2. Permitted Dependency Matrix

To uphold the Dependency Inversion Principle (DIP) and maintain high cohesion:

1. **Screens do NOT import Layouts**: Screens only implement their own view logic and register with the route configuration.
2. **Layouts do NOT import Screens**: Layouts provide content outlets (`SlotOutlet` / `<slot name="content">`) into which the active screen is projected.
3. **Routers do NOT hardcode Layout classes**: Routes specify declarative metadata (`data: { layout: 'main' }`), which is resolved through the decoupled `LayoutRegistry`.
4. **Headers and Sidebars do NOT directly invoke each other**: The Header emits a `menuToggle` output event; the parent Layout updates its internal `sidebarOpen` signal, which reactively updates the Sidebar component via its `collapsed` and `mobileOpen` inputs.

---

## 3. Layout Hierarchy

```
Application
  │
  ▼
LayoutRouterOutlet (Resolves layout from route metadata)
  │
  ├─► AppHeaderComponent (Emits menuToggle, hosts header-actions slot)
  │
  ├─► AppSidebarComponent (Renders NavItems, handles collapse/mobile drawer)
  │      ├─► sidebar-header slot (User card / branding)
  │      └─► sidebar-footer slot (Session status / sign out)
  │
  ├─► ContentSlotOutlet ('content')
  │      └─► Active Feature Screen (Dashboard, EmployeeList, Settings)
  │
  └─► AppFooterComponent (Copyright, corporate links)
```

This ensures that any screen can run in any compatible layout without modifying either the screen or the layout.
