# JARVIS Reactivity: Algorithms for Fast Reactive Updates

This document formalizes the 12 core reactive update and compilation algorithms implemented in JARVIS.

---

## 1. Signal Dependency Tracking

- **Input**: Invocation of `signal.get()` or `signal()` while an active consumer is running.
- **Output**: Bi-directional edge between `Producer` and `Consumer`.
- **Data Structures**: `Producer.subscribers: Set<Consumer>`, `Consumer.dependencies: Set<Producer>`, `activeConsumer: Consumer | null` context stack.
- **Execution Steps**:
  1. Check if `activeConsumer !== null`. If null, return stored value immediately.
  2. Add `activeConsumer` to `producer.subscribers`.
  3. Add `producer` to `activeConsumer.dependencies`.
- **Correctness Conditions**: Zero duplicate edges; handles nested consumers correctly via call stack restoration.
- **Time Complexity**: $O(1)$ amortized (Set insertion).
- **Space Complexity**: $O(1)$ per edge.
- **Failure Mode**: Global consumer leak if exception thrown without `restoreActiveConsumer()`. Solved via `try ... finally`.

---

## 2. Dependency Invalidation (Dirty Propagation)

- **Input**: Mutation of signal value via `signal.set(newValue)`.
- **Output**: Downstream consumers marked dirty.
- **Execution Steps**:
  1. Check `Object.is(oldValue, newValue)`. If identical, terminate immediately (no-op).
  2. Store `newValue`.
  3. Snapshot `producer.subscribers` array.
  4. Iterate subscribers and invoke `consumer.markDirty()`.
- **Time Complexity**: $O(K)$ where $K$ is the number of direct subscribers.
- **Space Complexity**: $O(K)$ temporary snapshot.

---

## 3. Computed-Value Caching (Lazy Derivation)

- **Input**: `computed.get()`.
- **Output**: Memoized value of type `T`.
- **Data Structures**: `cachedValue: T`, `dirty: boolean`, `computeFn: () => T`.
- **Execution Steps**:
  1. Call `trackProducer(this)` to subscribe calling consumer to this derivation.
  2. If `dirty === false`, return `cachedValue` directly.
  3. If `dirty === true`:
     - Clean up stale dependencies via `cleanupConsumer(this)`.
     - Set `this` as active consumer.
     - Execute `computeFn()`, store in `cachedValue`, set `dirty = false`.
     - Restore previous active consumer in `finally`.
  4. Return `cachedValue`.
- **Time Complexity**: $O(1)$ when clean; $O(\text{Cost of computeFn})$ when dirty.
- **Space Complexity**: $O(1)$ extra storage.

---

## 4. Dynamic Dependency Replacement

- **Input**: Branch switch in conditional expression (`condition() ? a() : b()`).
- **Output**: Automatic unsubscription from inactive branch producers.
- **Execution Steps**:
  1. Before executing `effectFn` or `computeFn`, execute `cleanupConsumer(consumer)`.
  2. For every `producer` in `consumer.dependencies`: delete `consumer` from `producer.subscribers`.
  3. Clear `consumer.dependencies`.
  4. Execute computation: only producers evaluated in the *active* branch are tracked.
- **Correctness Guarantee**: Unused branch signals never trigger re-evaluation of the consumer.
- **Time Complexity**: $O(D)$ where $D$ is the count of existing dependencies.

---

## 5. Batch Scheduling

- **Input**: Microtask scheduling of dirty effects.
- **Output**: Consolidated, asynchronous batch execution.
- **Data Structures**: `pendingJobs: Set<() => void>`, `batchDepth: number`, `queueMicrotask`.
- **Execution Steps**:
  1. `scheduleJob(job)` inserts job into `pendingJobs`.
  2. If `batchDepth === 0` and not already scheduled, calls `queueMicrotask(flushJobs)`.
  3. `flushJobs()` drains `pendingJobs` in a loop until empty.
- **Time Complexity**: $O(J)$ where $J$ is the number of scheduled distinct jobs.

---

## 6. Consumer Deduplication

- **Input**: Multiple synchronous writes to a signal or multiple signals affecting the same effect.
- **Output**: Single execution of the consumer effect.
- **Execution Steps**:
  1. Inside `EffectNode`, `this.scheduled: boolean` tracks pending status.
  2. When `markDirty()` is called, if `this.scheduled === true`, the duplicate notification is **dropped immediately**.
  3. `this.scheduled` is reset to `false` only when `run()` executes.
- **Verified Benchmark**: 10,000 mutations inside `batch()` result in **exactly 1 execution**.

---

## 7. Binding-Level DOM Updates

- **Input**: Dynamic expression bound to a DOM node (`renderer.bindText(node, () => ctx.count())`).
- **Output**: Direct mutation of the targeted `Node.textContent` or element property.
- **Execution Steps**:
  1. Wraps expression in an `effect()`.
  2. On each trigger, computes `val = expressionFn()`.
  3. Sets `textNode.textContent = String(val)`.
  4. **Zero Virtual DOM**: No tree diffing, no parent traversal, no sibling inspection.
- **Time Complexity**: $O(1)$ DOM mutation per update.

---

## 8. Conditional View Creation and Destruction

- **Input**: `@if (condition()) { ... }`.
- **Output**: Mount or unmount of sub-tree.
- **Execution Steps**:
  1. Parent creates a placeholder anchor comment or text node in the DOM.
  2. An effect observes `condition()`.
  3. When condition switches:
     - If true: instantiates component/view factory, appends to anchor, saves child disposers.
     - If false: executes child disposers (cleaning all reactive effects), removes DOM nodes from parent.
- **Time Complexity**: $O(S)$ where $S$ is the size of the mounted sub-tree.

---

## 9. Keyed List Reconciliation

- **Input**: Container element, `oldRecords: KeyedRecord[]`, `newItems: TItem[]`, `keyFn: (item) => Key`.
- **Output**: Updated DOM children and `nextRecords` array.
- **Execution Steps**:
  1. **Fast Path**: If old empty, append all new ($O(N)$). If new empty, remove all old ($O(M)$).
  2. **Prefix Trimming**: Iterate matching keys from start. Advance `start` pointer.
  3. **Suffix Trimming**: Iterate matching keys from end backwards. Decrement `oldEnd` and `newEnd`.
  4. **Exhaustion**:
     - If old exhausted (`start > oldEnd`), append new items.
     - If new exhausted (`start > newEnd`), remove old items.
  5. **Map Lookup**: Populate `Map<Key, Record>` with remaining old items. For each remaining new item:
     - Found in map: reuse existing node, update attributes, displace position.
     - Not found: create new DOM node.
  6. Destroy unreferenced old records.
- **Time Complexity**: $O(N)$ worst case.
- **Space Complexity**: $O(N)$ for key map.
- **Correctness Condition**: Never recreates a DOM node if its key exists in the previous array.

---

## 10. Compiler Dependency Invalidation

- **Input**: Source file path, new file content.
- **Output**: Invalidation plan containing dirty nodes and affected compilation stages.
- **Time Complexity**: $O(V_{aff} + E_{aff})$ cycle-safe BFS traversal.

---

## 11. Incremental Artifact Generation

- **Input**: Topological ordering of dirty nodes and their dirty stages.
- **Output**: Updated JavaScript/CSS outputs; cached intermediate AST/IR.
- **Time Complexity**: Proportional only to changed components ($O(1)$ for single-component edits).

---

## 12. Cache Validation

- **Input**: Candidate cache key.
- **Output**: Cache hit (reuse) or Cache miss (recompute).
- **Execution Steps**: Check L1 memory Map ($O(1)$) $\to$ Check L2 disk `.jarvis/cache/<hash>.json`.
