# Jarvis Runtime Architecture & Safety Analysis

## 1. Runtime Overview
The JARVIS runtime consists of:
* `jarvis-reactive`: Push-pull reactive graph with microtask scheduling.
* `(jarvis-renderer`: DOM and Mock renderers implementing the polymorphic `Renderer` strategy.
* `jarvis-core`: Decorators and event dispatchers.
* `jarvis-runtime`: View lifecycle and bootstrap.
* `jarvis-router`: Client-side route matching and history management.

## 2. Safety Audit
1. **Lifecycle Consistency**:
   - `bootstrap` executes `onInit`, mounts view, executes `afterRender`.
   - `destroy` executes `onDestroy`, unmounts DOM node, and invokes `view.destroy`.
   - *Identified Gap*: If `onInit` throws an exception, partial allocations are not automatically cleaned up.
2. **Resource Ownership & Leaks**:
   - Effects registered within component scopes are stored on the view and disposed on `destroy`.
   - Event listeners bound via `renderer.listen` return cleanup callbacks stored in `ComponentView.cleanups`.
3. **Null & Undefined Safety**:
   - Signals initialize with a value and enforce non-null access unless typed `Signal<T | null>`.
   - `DOMRenderer` guards against missing DOM nodes during removals.
