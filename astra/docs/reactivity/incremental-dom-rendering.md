# JARVIS Reactivity: Incremental DOM Rendering & Renderer Abstraction

## 1. Renderer Abstraction Interface

To allow JARVIS to execute across browser DOM, SSR (Server-Side Rendering), headless test environments, and native targets without direct coupling to global `window` or `document` APIs, all view generation targets the `Renderer` abstraction:

```typescript
export interface Renderer<TNode = any, TElement extends TNode = any, TText extends TNode = any> {
  createElement(tag: string): TElement;
  createText(content?: string): TText;
  appendChild(parent: TElement, child: TNode): void;
  removeChild(parent: TElement, child: TNode): void;
  setAttribute(element: TElement, name: string, value: string): void;
  setProperty(element: TElement, property: string, value: any): void;
  setText(textNode: TText, content: string): void;

  bindText(textNode: TText, expressionFn: () => any): () => void;
  bindProperty(element: TElement, property: string, expressionFn: () => any): () => void;
  listen(element: TElement, event: string, handler: (event: any) => void): () => void;
}
```

Implementations:
- `DOMRenderer`: Direct browser DOM calls (`document.createElement`, `addEventListener`, fine-grained `effect` subscriptions).
- `TestRenderer`: In-memory DOM emulation for blazing-fast unit and integration testing without JSDOM overhead or browser dependencies.

---

## 2. Direct DOM Bindings vs Tree Reconciliation

When compiling a template like:
```html
<div class="user-card">
  <h2>{{ userName() }}</h2>
  <span [class.active]="isActive()">Status</span>
</div>
```

The JARVIS Rust compiler generates code that executes as follows:
```javascript
export function template(renderer, ctx) {
  const root = renderer.createElement('div');
  renderer.setAttribute(root, 'class', 'user-card');

  const h2 = renderer.createElement('h2');
  const text1 = renderer.createText();
  renderer.appendChild(h2, text1);
  renderer.appendChild(root, h2);

  const span = renderer.createElement('span');
  renderer.setText(renderer.createText('Status'), 'Status');
  renderer.appendChild(root, span);

  // Fine-grained binding connections
  renderer.bindText(text1, () => ctx.userName());
  renderer.bindProperty(span, 'className', () => ctx.isActive() ? 'active' : '');

  return { root };
}
```

### Key Differences:
1. **Creation**: Elements `div`, `h2`, `span` are created **once**.
2. **Updates**: When `userName.set('Alice')` is called, the effect bound to `text1` fires and updates `text1.textContent = 'Alice'`.
3. **Skipped Work**: The `div` element, the `span` element, and the parent container are never re-evaluated or diffed.

---

## 3. Keyed List Reconciliation Mechanics

For dynamic collections (`@for (item of items(); track item.id)`), JARVIS utilizes `reconcileKeyedList`:
- Identifies preserved head items via prefix trimming.
- Identifies preserved tail items via suffix trimming.
- Uses a fast lookup map for displaced middle elements.
- Minimizes DOM `appendChild` and `removeChild` operations while preserving existing element instances and reactive subscriptions.
