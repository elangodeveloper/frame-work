# Content Projection and Slot Outlets in JARVIS

## 1. Native Projection Semantics

JARVIS does not rely on browser Web Component `<slot>` elements to emulate application-level component projection. Instead, the framework implements a native **Content Slot & Projection Subsystem** (`ContentSlot` and `SlotOutlet`) built on top of the JARVIS reactive engine.

A layout declares insertion points:
```html
<main class="jarvis-layout__content">
  <slot name="content"></slot>
</main>
```

At runtime, this is managed by a `SlotOutlet`:
```typescript
import { SlotOutlet } from '@jarvis/layout';

export class MainLayoutComponent {
  private contentOutlet: SlotOutlet | null = null;

  render(r: Renderer) {
    // ...
    this.contentOutlet = new SlotOutlet(r, 'content');
    r.appendChild(mainContentElement, this.contentOutlet.getElement());
  }

  getContentOutlet(): SlotOutlet | null {
    return this.contentOutlet;
  }
}
```

---

## 2. Dynamic Component Projection

Screens are projected into the outlet programmatically or via the router:

```typescript
const outlet = layout.getContentOutlet();

// Projects a screen component into the layout's content outlet
const screenRef = outlet.project(EmployeeListPage, {
  activatedRoute: this.router.activatedRoute,
  router: this.router,
});
```

### Identity Preservation
If `outlet.project(ComponentClass, inputs)` is called with the **same** component class that is already mounted (for example, during route parameter updates like `/employees/EMP001` -> `/employees/EMP002`):
- The existing instance is **preserved**.
- Its input signals are updated in place via `setInput`.
- The DOM sub-tree is **not** recreated.

### Clean Teardown on Screen Switch
When navigating to a different component class (e.g. from `DashboardPage` to `EmployeeListPage`):
1. `onDestroy()` is executed on the previous screen instance.
2. Reactive effects and event listeners bound to the screen are unregistered.
3. DOM nodes belonging to the old screen are detached.
4. The new screen is instantiated, mounted, and attached to the outlet.

---

## 3. Named Slot Coordination via `SlotContext`

Screens can provide content for multiple slots in the layout (e.g. `header-actions`, `toolbar`, `sidebar-footer`) without directly importing the layout or header:

```typescript
import { SlotContext } from '@jarvis/layout';

export class EmployeeListPage {
  constructor(slotContext: SlotContext) {
    // Publish a button directly into the layout's header actions slot
    slotContext.setSlotRender('header-actions', (r) => {
      const btn = r.createElement('button');
      btn.textContent = 'Export CSV';
      return btn;
    });
  }
}
```
When the screen is destroyed, calling `slotContext.clearAll()` removes the actions without leaving orphaned buttons in the layout.
