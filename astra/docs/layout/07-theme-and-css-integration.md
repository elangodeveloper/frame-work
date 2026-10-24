# Theme & CSS Integration in JARVIS

## 1. Centralized Design Token Integration

All layout shells, headers, sidebars, and primitives consume centralized design tokens from `@jarvis/styles`:

```css
.jarvis-layout-shell {
  background-color: var(--jarvis-color-background, #f8fafc);
  color: var(--jarvis-color-text, #0f172a);
}

.jarvis-header {
  background-color: var(--jarvis-color-surface, #ffffff);
  border-bottom: 1px solid var(--jarvis-color-border, #e2e8f0);
}
```

By referencing CSS custom properties, layouts adapt dynamically when themes change without requiring JavaScript re-renders or component reconstruction.

---

## 2. Dynamic Theme Switching (`ThemeManager`)

The `provideTheme` API from `@jarvis/styles` configures the theme provider:

```typescript
import { provideTheme } from '@jarvis/styles';

const themeManager = provideTheme({ defaultTheme: 'light' });

// Switch theme dynamically:
themeManager.setTheme('dark');
```

When `setTheme('dark')` is called, the attribute `data-jarvis-theme="dark"` is updated on `document.documentElement`. The CSS variables update instantly, switching all layout background and surface colors without touching a single DOM element in the active screen!

---

## 3. Coexistence with PrimeNG and Tailwind CSS

JARVIS cleanly decouples layout structure from component UI libraries:

1. **Tailwind CSS**:
   Tailwind utility classes (e.g. `p-6`, `space-y-4`, `shadow-sm`) can be used inside feature screens and layouts for fine-grained styling.
2. **PrimeNG**:
   PrimeNG components (e.g. `JarvisButton`, `JarvisTable`, `JarvisDialog`, `JarvisInputText`) run inside JARVIS layouts without Angular dependencies:
   - Layouts provide the container grid/flex bounds.
   - PrimeNG adapters render UI controls into the layout's content outlet.
   - Design tokens map cleanly between PrimeNG theme presets (Aura, Lara) and JARVIS tokens (`--jarvis-color-primary`).
