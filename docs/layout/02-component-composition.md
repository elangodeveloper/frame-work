# Component Composition in JARVIS

## 1. Composition over Inheritance

JARVIS rejects deep class inheritance hierarchies for UI presentation. Instead of creating brittle inheritance trees such as `BaseLayout -> DashboardBaseLayout -> EmployeeDashboardLayout`, JARVIS adopts **explicit component composition**.

A layout or screen is an orchestrator that composes specialized, single-responsibility child components:

```typescript
export class MainLayoutComponent {
  // Composed child references
  private headerRef: ComponentRef<AppHeaderComponent> | null = null;
  private sidebarRef: ComponentRef<AppSidebarComponent> | null = null;
  private contentOutlet: SlotOutlet | null = null;
}
```

---

## 2. The Component Host API (`mountComponent`)

The `@jarvis/layout` package provides `mountComponent` for mounting child components with declarative inputs, outputs, and lifecycle integration:

```typescript
import { mountComponent, unmountComponent } from '@jarvis/layout';

const ref = mountComponent(renderer, AppHeaderComponent, containerElement, {
  inputs: {
    title: 'Executive Portal',
    sidebarOpen: this.sidebarOpen(),
    sticky: true,
  },
  outputs: {
    menuToggle: () => this.toggleSidebar(),
  },
});
```

### Key Guarantees:
1. **Pre-Initialization Inputs**: Inputs are assigned before `onInit()` executes, allowing lifecycle logic to safely inspect initial values.
2. **Reactive Signal Compatibility**: Properties defined with `input<T>()` are updated directly via their reactive signal accessor.
3. **Strictly Zero RxJS Event Subscription**: Component outputs defined with `output<T>()` are subscribed via `JarvisEvent`, and their unsubscription callbacks are tracked and invoked automatically when the component is unmounted.
4. **Lifecycle Hooks Order**:
   - `instance.constructor()`
   - Assign inputs & subscribe outputs
   - `instance.onInit()`
   - Template/OOP view compilation & DOM mounting
   - `instance.afterRender()`
   - On teardown: `instance.onDestroy()`, unsubscribe events, detach DOM nodes.

---

## 3. Dynamic Reactive Updates via `setInput`

When a parent's reactive state changes, child components do **not** need to be torn down and rebuilt:

```typescript
// Updates child's title signal directly, triggering surgical DOM text node update:
ref.setInput('title', 'Updated Dashboard Title');
```
Unrelated DOM nodes, focus states, and input fields retain full identity.
