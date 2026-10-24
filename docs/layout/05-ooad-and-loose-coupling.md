# Object-Oriented Analysis & Design (OOAD) in the JARVIS Layout System

## 1. SOLID Principles in UI Architecture

The JARVIS layout system is designed around core OOAD and SOLID principles to prevent component entanglement in enterprise applications.

### 1. Single Responsibility Principle (SRP)
Each component in the layout subsystem has one reason to change:
- **`AppHeaderComponent`**: Displays branding, search, user avatar, and emits user interactions (`menuToggle`). It has no knowledge of sidebar DOM.
- **`AppSidebarComponent`**: Renders navigation links and manages its collapsed/mobile drawer state. It has no knowledge of active screen APIs or data fetching.
- **`MainLayoutComponent`**: Arranges the structural grid/flex regions of the shell and connects header events to sidebar signals. It has no business logic.
- **`LayoutRouterOutlet`**: Resolves layout selection from route metadata and mounts screens. It has no CSS or styling code.
- **`Feature Screens`**: Implement feature-specific logic (e.g., employee tables, charts). They do not know what layout wraps them.

### 2. Dependency Inversion Principle (DIP)
High-level modules (layouts, router outlets) depend on abstractions (`LayoutDefinition`, `SlotContent`, `Renderer`), not concrete screen implementations:

```
[ LayoutRouterOutlet ] ──► Depends on ──► [ LayoutRegistry Contract ]
                                                     ▲
                                                     │ Implements
                                          [ Concrete Layout Classes ]
```

Screens do not import layouts, and layouts do not import screens. Both depend on the framework's `@jarvis/layout` contracts.

### 3. Open/Closed Principle (OCP)
The layout system is open for extension but closed for modification. Application developers can add any number of new layouts (e.g. `PrintLayout`, `KioskLayout`, `SettingsLayout`) and register them in `defaultLayoutRegistry.register(...)` without altering the router, compiler, or existing layouts.

### 4. Liskov Substitution Principle (LSP)
Any class implementing the `render(renderer)` method and providing `getContentOutlet(): SlotOutlet` can be substituted into the layout router without breaking router operations.

### 5. Interface Segregation Principle (ISP)
Instead of forcing components to implement massive monolithic interfaces, contracts are granular and focused:
- `LayoutConfig`: Declarative configuration options.
- `NavItem`: Navigation item metadata.
- `RouteLayoutData`: Route data extensions.
- `SlotProjectionDef`: Targeted slot injection.

---

## 2. Encapsulation & Event-Driven Communication

Sibling components in JARVIS never mutate each other's private state.

```
┌──────────────────┐               ┌─────────────────────┐
│ AppHeaderComponent│               │ AppSidebarComponent │
└────────┬─────────┘               └──────────▲──────────┘
         │                                    │
         │ (menuToggle output event)          │ [collapsed] [mobileOpen] inputs
         ▼                                    │
┌─────────────────────────────────────────────┴──────────┐
│                   MainLayoutComponent                  │
│             sidebarOpen.update(open => !open)          │
└────────────────────────────────────────────────────────┘
```

The header emits an event; the layout updates its reactive signal; the sidebar reacts to the updated input. Zero tight coupling.
