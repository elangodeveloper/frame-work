# Testing Strategy for the JARVIS Layout System

## 1. Headless Testing with `TestRenderer`

All layouts, screens, slots, and outlets in JARVIS can be tested in Node.js without requiring a heavy browser DOM or headless Chrome instance:

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TestRenderer } from '@jarvis/renderer';
import { mountComponent, unmountComponent } from '@jarvis/layout';
import { MainLayoutComponent } from '@jarvis/layout';

describe('Layout Unit Testing', () => {
  it('should render header, sidebar, and content outlet', () => {
    const renderer = new TestRenderer();
    const container = renderer.createElement('div');

    const layoutRef = mountComponent(renderer, MainLayoutComponent, container);
    const html = container.toHtml();

    assert.ok(html.includes('jarvis-layout-shell'));
    assert.ok(html.includes('jarvis-header'));
    assert.ok(html.includes('jarvis-sidebar'));

    unmountComponent(layoutRef);
  });
});
```

---

## 2. Testing Layout State Preservation Across Route Transitions

Verify that navigating between two routes sharing the same layout preserves the layout instance and its internal state:

```typescript
it('should preserve layout instance when navigating between routes sharing layout', async () => {
  const renderer = new TestRenderer();
  const router = provideRouter(routes, { initialUrl: '/dashboard' });
  const outlet = new LayoutRouterOutlet(renderer, router);

  await router.navigate(['dashboard']);
  const layout1 = outlet.getCurrentLayout();

  // Mutate layout state
  layout1.toggleSidebar();
  assert.equal(layout1.sidebarOpen(), false);

  // Navigate to second route with same layout:
  await router.navigate(['employees']);
  const layout2 = outlet.getCurrentLayout();

  // Assert layout identity and state preservation
  assert.strictEqual(layout1, layout2);
  assert.equal(layout2.sidebarOpen(), false);

  outlet.destroy();
});
```

---

## 3. Testing Incremental Compilation for Layouts

Verify that CSS changes in a layout or sidebar do not trigger recompilation of screen templates:

```typescript
it('modifying sidebar CSS should invalidate only style stage', () => {
  const graph = new DependencyGraph();
  // Register layout, sidebar, and screen nodes...

  const plan = graph.computeInvalidationPlan('src/components/sidebar.component.css', '.sidebar { width: 280px; }');

  assert.equal(plan.changeKind, 'css-only');
  assert.equal(plan.requiresFullRebuild, false);

  // Style stage of sidebar is invalidated
  assert.ok(plan.recompilationStages.get('src/components/sidebar.component.css')?.has('style'));

  // Screen templates remain untouched
  assert.equal(plan.recompilationStages.has('src/features/dashboard/dashboard.page.html'), false);
});
```

---

## 4. How to Create and Test a New Layout

1. **Define the Layout Component**:
   Extend or implement the layout contract. Ensure it provides `getContentOutlet(): SlotOutlet`.
2. **Register in `defaultLayoutRegistry`**:
   `defaultLayoutRegistry.register('my-layout', MyLayoutComponent, { ... })`.
3. **Declare on Routes**:
   `{ path: '/my-feature', component: MyPage, data: { layout: 'my-layout' } }`.
4. **Write Unit Test**:
   Mount with `TestRenderer` and verify structural elements and content projection.
