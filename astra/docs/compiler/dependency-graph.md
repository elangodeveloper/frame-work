# JARVIS Compiler: Dependency Graph Architecture & Invalidation

## 1. Graph Data Model

The JARVIS compilation engine models the application as a directed multigraph $G = (V, E)$ where:
- $V$ is the set of `DependencyNode` objects (representing TypeScript source files, HTML templates, CSS stylesheets, and configuration files).
- $E$ is the set of directed edges $(u, v)$ where $u$ depends on $v$.
- A reverse edge index `dependents` is maintained on each node: if $u \to v$, then $v$ records $u$ in its `dependents` set.

```typescript
export interface DependencyNode {
  readonly id: string;
  readonly filePath: string;
  type: FileType;                 // 'typescript' | 'template' | 'style' | 'config'
  contentHash: string;            // SHA-256 of raw file content
  publicSignatureHash?: string;   // SHA-256 of public declarations & inputs
  dirty: boolean;
  dirtyStages: Set<StageType>;    // 'typescript' | 'template' | 'style' | 'codegen'
  dependencies: Set<string>;      // Outgoing edges (nodes this node imports)
  dependents: Set<string>;        // Incoming edges (nodes that import this node)
  metadata: Record<string, any>;
}
```

---

## 2. Invalidation Propagation Algorithm

When a file change event is triggered:

1. **Hash Verification**: Compute `newHash = sha256(content)`. If `newHash === existingNode.contentHash`, return immediately with zero invalidation (no-op).
2. **Stage Classification**:
   - `.css` -> `css-only`
   - `.html` -> `template-only`
   - `jarvis.config.ts` -> `config`
   - `.ts` -> Compare `newSignatureHash = sha256(extractPublicContract(content))`. If signature matches, classify as `ts-impl`; otherwise `ts-public-contract`.
3. **Traversal with Cycle Safety**:
   - For `css-only`: Only mark `style` stage on current node and its immediate importing components.
   - For `template-only`: Only mark `template` and `codegen` on current node and its component.
   - For `ts-impl`: Stop propagation! Dependents are not traversed.
   - For `ts-public-contract`: Execute BFS queue traversal through reverse edges `dependents`, using a `visited: Set<string>` to avoid infinite loops when circular dependencies exist.

```typescript
private propagateTransitiveDependents(
  startId: string,
  affected: Set<string>,
  stagesMap: Map<string, Set<StageType>>
): void {
  const queue: string[] = [startId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    affected.add(currentId);
    if (!stagesMap.has(currentId)) {
      stagesMap.set(currentId, new Set<StageType>(['typescript', 'template', 'style', 'codegen']));
    } else {
      const stages = stagesMap.get(currentId)!;
      stages.add('typescript');
      stages.add('codegen');
    }

    const currentNode = this.nodes.get(currentId);
    if (currentNode) {
      for (const depId of currentNode.dependents) {
        if (!visited.has(depId)) {
          queue.push(depId);
        }
      }
    }
  }
}
```

---

## 3. Complexity Analysis

- **Change Detection**: $O(1)$ amortized (SHA-256 computation over file length $L$, $O(L)$).
- **Invalidation Traversal**: $O(V_{aff} + E_{aff})$ where $V_{aff}$ is the number of invalidated nodes and $E_{aff}$ is the number of traversed dependency edges.
  - Worst case (root contract change in fully connected graph): $O(V + E)$.
  - Best case (leaf style or template change): $O(1)$ nodes affected.
- **Cycle Safety**: The `visited` set ensures each node is added to the processing queue at most once, guaranteeing termination in the presence of circular imports ($A \to B \to A$).
- **Topological Order**: Post-order DFS traversal with an `inStack: Set<string>` detects and breaks cycles, returning dependencies strictly before dependents in $O(V + E)$ time.
