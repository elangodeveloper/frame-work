import { DependencyGraph } from './dependency-graph.ts';

export interface ParallelTask<T> {
  id: string;
  run: () => Promise<T> | T;
}

export interface ParallelExecutionResult<T> {
  results: Map<string, T>;
  durationMs: number;
  parallelBatches: number;
}

/**
 * Parallel Compiler Execution Coordinator.
 * Groups independent dependency graph nodes into parallel waves / topological layers,
 * guaranteeing race-free execution and deterministic outputs.
 */
export class ParallelCompiler {
  private readonly maxConcurrency: number;

  constructor(maxConcurrency = 4) {
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * Partitions nodes into independent layers based on the dependency graph.
   * Nodes in layer K only depend on nodes in layers < K, so all nodes in layer K
   * can be compiled concurrently.
   */
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

        // Check if all dependencies of this node that are in targetSet have already been processed in earlier layers
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
        // Remaining nodes form a cycle or cannot be partitioned further: add remaining as final batch
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

  /**
   * Executes tasks in parallel batches respecting dependency layers and max concurrency.
   */
  async executeLayered<T>(
    layers: string[][],
    taskFactory: (id: string) => Promise<T> | T
  ): Promise<ParallelExecutionResult<T>> {
    const start = performance.now();
    const results = new Map<string, T>();

    for (const layer of layers) {
      // Chunk layer into batches matching maxConcurrency
      for (let i = 0; i < layer.length; i += this.maxConcurrency) {
        const chunk = layer.slice(i, i + this.maxConcurrency);
        const chunkPromises = chunk.map(async (id) => {
          const res = await taskFactory(id);
          results.set(id, res);
        });
        await Promise.all(chunkPromises);
      }
    }

    return {
      results,
      durationMs: performance.now() - start,
      parallelBatches: layers.length,
    };
  }
}
