# Fine-Grained Reactive Layout Updates in JARVIS

## 1. Zero RxJS Reactive Architecture

The JARVIS layout system is powered 100% by `@jarvis/reactive` signals and derivations. There is **zero RxJS** overhead in the layout engine.

### Reactive Layout Signals:
- `sidebarOpen: Signal<boolean>`: Tracks whether the persistent desktop sidebar is expanded or hidden.
- `sidebarCollapsed: Signal<boolean>`: Tracks whether the sidebar is in mini/compact icon mode.
- `mobileDrawerOpen: Signal<boolean>`: Tracks whether the off-canvas drawer is visible on mobile viewports.
- `isMobile: Signal<boolean>`: Tracks current viewport breakpoint category.
- `activeRoute: Signal<string>`: Highlights the active navigation link.

---

## 2. Targeted DOM Updates & Identity Preservation

When an action occurs (e.g., clicking the header's hamburger toggle button):

```
User clicks Hamburger Toggle
           │
           ▼
AppHeaderComponent.menuToggle.emit()
           │
           ▼
MainLayoutComponent.toggleSidebar()
           │
           ▼
sidebarOpen.update(open => !open)
           │
           ▼
[ Fine-Grained Effect Runs ]
           │
           ├─► Only toggles class on <aside class="jarvis-sidebar">
           ├─► Only toggles class on <div class="jarvis-drawer-backdrop">
           │
           └─► Active Screen DOM is COMPLETELY UNTOUCHED!
```

### Why Identity Preservation Matters:
- In-progress user input in form fields is preserved.
- Scroll position within data tables is preserved.
- Video playback or chart canvas state is never interrupted.
- Zero redundant component re-instantiation or API re-fetching.

---

## 3. Teardown & Memory Leak Prevention

When a layout or screen is disposed:
- Effects registered via `effect(...)` are cancelled via their disposal handles.
- Event listeners added via `renderer.listen(...)` are detached.
- Any active child component references execute their `onDestroy()` hook.
- DOM nodes are detached cleanly from their parent containers.
