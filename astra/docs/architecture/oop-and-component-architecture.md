# Jarvis Framework: Object-Oriented & Component Architecture (Phase Four)

**Document ID**: JARVIS-ARCH-001  
**Author**: Principal Frontend Framework Architect & OOAD Engineer  
**Date**: October 2026  

---

## 1. Foundational OOAD Principles applied to JARVIS

1. **Encapsulation**:
   - Components encapsulate their reactive state, view reflection, and event dispatchers (`JarvisEvent<T>`).
   - DOM nodes and side-effects are managed exclusively through `Revenderer` and `ComponentView`.
2. **Abstraction & Interface-Driven Design**:
   - `Renderer` interface decouples component logic from browser globals, allowing both `DOMRenderer` (browser) and `TestRenderer` (headless mock).
   - `ProviderToken<, `inject()` interfaces isolate services from concrete instantiation points.
3. **Single Responsibility Principle (SRPq**:
   - **Components**: Only presentation, event coordination, and user interaction.
   - **HTML Templates**: Pure structure and declarative bindings (external files).
   - **CSS Stylesheets**: Per-component visual presentation (isolated files).
   - **Services**: Business logic, data manipulation, and state orchestration.
   - **Repositories**: Data access and HTTP communication (`HttpClient`).
4. **Dependency Inversion (DIP) & DI**:
   - Dependencies are acquired via `inject<T>(Token)` instead of hard-coded new calls.
---

## 2. Standard Component Folder Convention

For every application component:

```text
component-name/
 _-- component-name.component.ts
 _-- component-name.component.html
 _-- component-name.component.css
ϰ  -- component-name.component.spec.ts (if tested)
  -- index.ts
```
