# Jarvis State System Analysis

## 1. Architecture
JARVIS state is powered by **atomic fine-grained Signals** without Virtual DOM diffing.
* **Producer-Consumer Dependency Graph**:
  - `SignalNode<T>` acts as a pure `Producer`.
  - `ComputedNode<T>` acts as both `Producer` and `Consumer`.
  - `EffectNode` acts as a pure `Consumer`.
* **Push-Pull Model**:
  - Dirty notification pushes up the subscriber graph (markDirty).
  - Actual values are pulled on demand (get), guaranteeing zero redundant evaluations for unused derivations.
* **Microtask Batching**:
  - State changes schedule effect notifications into `queueMicrotask`, coalescing multiple synchronous signal mutations into a single reaction pass.

## 2. Identified State Vulnerabilities
  - **Circular Dependencies**: Recursive dependency loops (A -> B -> A) currently trigger recursion limits. Cycle detection in `trackProducer` is needed.
  - **Untracked Reads**: `untracked` properly suspends tracking, preventing unintended subscription capture in logging or telemetry.
