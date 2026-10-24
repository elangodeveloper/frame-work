# JARVIS Compiler: Parallel Compilation Architecture

## 1. Concurrency Strategy

In large enterprise applications with hundreds or thousands of components, serial compilation creates an unnecessary bottleneck on modern multicore CPUs.

However, naive parallel compilation causes:
- **Race conditions** when dependent modules attempt to read incomplete declarations from compiling dependencies.
- **Excessive thread contention** and memory spikes when hundreds of processes spawn simultaneously.

JARVIS implements **layered topological wave compilation** in `ParallelCompiler` (`packages/compiler-runtime/src/parallel-compiler.ts`).

---

## 2. Topological Layer Partitioning

Before executing any compilation tasks, the `ParallelCompiler` analyzes the `DependencyGraph` and partitions the dirty nodes into independent execution waves:

$$\text{Wave}_0, \text{Wave}_1, \dots, \text{Wave}_k$$

- **Rule**: A node $u$ is placed in $\text{Wave}_k$ if and only if all of its dependencies are contained in layers $< k$.
- **Result**: Every node in $\text{Wave}_k$ is **strictly independent** of every other node in $\text{Wave}_k$. They can be compiled concurrently without shared mutable state or dependency races.

```typescript
partitionIntoIndependentLayers(graph: DependencyGraph, targetIds: string[]): string[][] {
  const targetSet = new Set(targetIds.map(id => id.replace(/\\/g, '/').toLowerCase()));
  const remaining = new Set(targetSet);
  const layers: string[][] = [];

  while (remaining.size > 0) {
    const currentLayer: string[] = [];

    for (const id of remaining) {
      const node = graph.getNode(id);
      if (!node) {
        currentLayer.push(id);
        continue;
      }

      let allDepsResolved = true;
      for (const depId of node.dependencies) {
        if (remaining.has(depId)) {
          allDepsResolved = false;
          break;
        }
      }

      if (allDepsResolved) {
        currentLayer.push(id);
      }
    }

    if (currentLayer.length === 0) {
      // Break remaining cycle deterministically
      layers.push(Array.from(remaining));
      break;
    }

    for (const id of currentLayer) {
      remaining.delete(id);
    }
    layers.push(currentLayer);
  }

  return layers;
}
```

---

## 3. Worker Concurrency Throttling

Within each layer, tasks are chunked to match the hardware concurrency limit (`maxConcurrency`, defaulting to logical CPU cores):

```typescript
for (const layer of layers) {
  for (let i = 0; i < layer.length; i += this.maxConcurrency) {
    const chunk = layer.slice(i, i + this.maxConcurrency);
    await Promise.all(chunk.map(id => taskFactory(id)));
  }
}
```

This guarantees:
1. Zero thread starvation.
2. Predictable, deterministic compilation outputs.
3. Safe topological completion before downstream layers begin execution.
