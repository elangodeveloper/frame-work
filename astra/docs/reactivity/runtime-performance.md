# JARVIS Reactivity: Runtime Performance & Zero-VDOM Architecture

## 1. Why Zero Virtual DOM?

Traditional virtual DOM frameworks (React, Vue) re-render virtual tree branches on state updates, followed by tree reconciliation (diffing) to determine which browser DOM nodes need changes. Even with memoization (`useMemo`, `React.memo`), the reconciliation process introduces:
- Frequent garbage collection of short-lived virtual node descriptors (`VNode`).
- $O(N)$ tree traversal over virtual components.
- Stale closure and hook ordering constraints.

JARVIS eliminates the Virtual DOM entirely:
1. **Templates compile directly to DOM factories**: The Rust compiler generates instructions that create native elements once (`renderer.createElement('h1')`).
2. **Dynamic expressions become fine-grained reactive subscriptions**: Dynamic text nodes and attributes connect directly to signals via `effect()`.
3. **Targeted updates**: When a signal changes, **only the single DOM Text node or attribute property bound to that signal is mutated**. The rest of the component tree is never traversed or inspected.

---

## 2. Memory Footprint and Disposal Lifecycle

A common failure mode in reactive frameworks is **memory leaks caused by lingering subscriptions** when components or views are destroyed.

In JARVIS:
- Every `effect()` returns an idempotent disposer function `() => void`.
- When an `EffectNode` runs, its existing dependencies are detached before executing the callback (`cleanupConsumer()`).
- When an `EffectNode` is disposed, it:
  1. Executes any registered user cleanup callback.
  2. Unsubscribes from all producer dependency sets:
     ```typescript
     export function cleanupConsumer(consumer: Consumer): void {
       for (const producer of consumer.dependencies) {
         producer.subscribers.delete(consumer);
       }
       consumer.dependencies.clear();
     }
     ```
  3. Releases the closure from active microtask scheduler queues.
- When components or router views are deactivated, all child effects are disposed immediately, allowing the garbage collector to reclaim all nodes.

---

## 3. Strict Absence of RxJS

JARVIS does not import or use RxJS anywhere in its core, compiler, adapters, or router:
- State is managed via synchronous, fine-grained **Signals** (`signal()`, `computed()`, `effect()`).
- Async streams and resource management use **Resources** (`resource()`), standard Promises, and `AbortSignal`.
- Component events use synchronous, unbuffered `JarvisEvent<T>`.

This reduces runtime bundle size by **over 30 KB (minified)** and completely eliminates subscription leak vulnerabilities common in manual `.subscribe()` patterns.
