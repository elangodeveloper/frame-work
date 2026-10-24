# Responsive Layout Engine in JARVIS

## 1. CSS-First Responsive Design

JARVIS follows the architectural principle that responsive layout adjustments should be driven by **semantic HTML, CSS Grid, Flexbox, and Media Queries** rather than expensive JavaScript resize listeners or window calculation loops.

JavaScript is used solely to toggle reactive state (e.g. `mobileDrawerOpen = signal(false)`), while CSS handles all animations, transforms, and fluid grid rearrangements.

---

## 2. Desktop vs. Mobile Behavior

| Feature | Desktop (`> 768px`) | Mobile (`<= 768px`) |
| :--- | :--- | :--- |
| **Sidebar Display** | Persistent in layout grid/flex flow. | Off-canvas drawer fixed to the viewport (`left: 0`). |
| **Sidebar Collapse** | Mini mode (width transitions from `260px` to `72px`). | Drawer slides off-screen via `transform: translateX(-100%)`. |
| **Drawer Backdrop** | Inactive (`display: none`). | Visible frosted overlay (`rgba(15, 23, 42, 0.4)`). |
| **Backdrop Tap** | N/A | Closes drawer and resets `mobileDrawerOpen`. |
| **Content Padding** | Large spacing (`var(--jarvis-space-6)`). | Compact spacing (`var(--jarvis-space-4)`). |

---

## 3. Reusable Layout Primitives

The `@jarvis/layout` package exports lightweight structural primitives:

### `ContainerComponent` (`jarvis-container`)
Constrains maximum content width:
- `'narrow'`: `640px` (login, form screens, text articles)
- `'normal'`: `1024px` (standard settings, profile pages)
- `'wide'`: `1280px` (dashboards, data tables)
- `'full'`: `100%` (kiosks, maps, canvas editors)

### `StackComponent` (`jarvis-stack`)
Flexbox alignment with declarative gap:
```typescript
const stack = new StackComponent();
stack.direction.set('horizontal');
stack.align.set('center');
stack.justify.set('between');
```

### `GridComponent` (`jarvis-grid`)
Responsive column grid with automatic stacking on mobile:
```typescript
const grid = new GridComponent();
grid.cols.set(3);
grid.responsive.set(true); // Automatically collapses to 1 column on mobile!
```

---

## 4. Accessibility & Motion Guidelines

1. **ARIA Landmark Roles**:
   - `<header role="banner">`
   - `<aside role="navigation" aria-label="Sidebar Navigation">`
   - `<main role="main">`
   - `<footer role="contentinfo">`
2. **Keyboard Focus Outlines**:
   `:focus-visible` outlines use `--jarvis-color-primary` with offset to support keyboard navigation.
3. **Reduced Motion**:
   Under `@media (prefers-reduced-motion: reduce)`, all transitions on sidebars, drawers, and navigation links are disabled.
