import * as crypto from 'node:crypto';

export type FileType = 'typescript' | 'template' | 'style' | 'config' | 'asset' | 'unknown';

export type StageType = 'typescript' | 'template' | 'style' | 'codegen';

export type ChangeKind =
  | 'css-only'
  | 'template-only'
  | 'ts-impl'
  | 'ts-public-contract'
  | 'config'
  | 'unmodified'
  | 'new-file'
  | 'deleted-file';

export interface DependencyNode {
  readonly id: string;
  readonly filePath: string;
  type: FileType;
  contentHash: string;
  publicSignatureHash?: string;
  dirty: boolean;
  dirtyStages: Set<StageType>;
  dependencies: Set<string>; // Nodes this node depends on (outgoing edges)
  dependents: Set<string>;   // Nodes that depend on this node (incoming / reverse edges)
  metadata: Record<string, any>;
}

export interface InvalidationPlan {
  changedFile: string;
  changeKind: ChangeKind;
  affectedNodes: string[];
  recompilationStages: Map<string, Set<StageType>>;
  requiresFullRebuild: boolean;
}

/**
 * Computes a SHA-256 hash of a string content.
 */
export function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Extracts a public signature from a TypeScript file content for contract comparison.
 * Extracts: exported interfaces, classes, types, functions, inputs, outputs, public members.
 * Implementation changes inside method bodies do not alter this signature.
 */
export function extractPublicContract(tsContent: string): string {
  const lines = tsContent.split('\n');
  const signatureLines: string[] = [];

  let inComment = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip block comments
    if (line.startsWith('/*')) inComment = true;
    if (inComment) {
      if (line.includes('*/')) inComment = false;
      continue;
    }
    // Skip single line comments
    if (line.startsWith('//')) continue;

    // Track exports and decorators
    if (
      line.startsWith('export ') ||
      line.startsWith('@Component') ||
      line.startsWith('@Input') ||
      line.startsWith('@Output') ||
      line.startsWith('@Injectable')
    ) {
      // Remove function/method implementations: keep only header signature up to '{'
      const sig = line.replace(/\{[\s\S]*$/, '{').trim();
      signatureLines.push(sig);
    }
  }

  return signatureLines.join('\n');
}

/**
 * Directed Dependency Graph representing files, components, and compilation assets.
 * Operates with cycle-safe graph traversals in O(V + E) complexity.
 */
export class DependencyGraph {
  private readonly nodes = new Map<string, DependencyNode>();

  /**
   * Adds or updates a node in the graph.
   */
  addNode(filePath: string, type: FileType, contentHash: string, publicSignatureHash?: string): DependencyNode {
    const normalizedId = this.normalizeId(filePath);
    let node = this.nodes.get(normalizedId);

    if (!node) {
      node = {
        id: normalizedId,
        filePath,
        type,
        contentHash,
        publicSignatureHash,
        dirty: false,
        dirtyStages: new Set<StageType>(),
        dependencies: new Set<string>(),
        dependents: new Set<string>(),
        metadata: {},
      };
      this.nodes.set(normalizedId, node);
    } else {
      node.type = type;
      node.contentHash = contentHash;
      if (publicSignatureHash !== undefined) {
        node.publicSignatureHash = publicSignatureHash;
      }
    }

    return node;
  }

  getNode(filePath: string): DependencyNode | undefined {
    return this.nodes.get(this.normalizeId(filePath));
  }

  hasNode(filePath: string): boolean {
    return this.nodes.has(this.normalizeId(filePath));
  }

  removeNode(filePath: string): void {
    const id = this.normalizeId(filePath);
    const node = this.nodes.get(id);
    if (!node) return;

    // Remove from all dependencies' dependents sets
    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      depNode?.dependents.delete(id);
    }

    // Remove from all dependents' dependencies sets
    for (const depId of node.dependents) {
      const depNode = this.nodes.get(depId);
      depNode?.dependencies.delete(id);
    }

    this.nodes.delete(id);
  }

  /**
   * Adds a directed dependency edge: `fromFilePath` depends on `toFilePath`.
   * e.g., app.component.ts depends on app.component.html
   */
  addEdge(fromFilePath: string, toFilePath: string): void {
    const fromId = this.normalizeId(fromFilePath);
    const toId = this.normalizeId(toFilePath);

    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);

    if (fromNode && toNode) {
      fromNode.dependencies.add(toId);
      toNode.dependents.add(fromId);
    }
  }

  removeEdge(fromFilePath: string, toFilePath: string): void {
    const fromId = this.normalizeId(fromFilePath);
    const toId = this.normalizeId(toFilePath);

    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);

    if (fromNode) fromNode.dependencies.delete(toId);
    if (toNode) toNode.dependents.delete(fromId);
  }

  getAllNodes(): DependencyNode[] {
    return Array.from(this.nodes.values());
  }

  getNodeCount(): number {
    return this.nodes.size;
  }

  getEdgeCount(): number {
    let edges = 0;
    for (const node of this.nodes.values()) {
      edges += node.dependencies.size;
    }
    return edges;
  }

  /**
   * Classifies a file change into its precise compilation stage impact.
   */
  classifyFileChange(filePath: string, newContent: string): {
    kind: ChangeKind;
    newHash: string;
    newSignatureHash?: string;
  } {
    const id = this.normalizeId(filePath);
    const existingNode = this.nodes.get(id);
    const newHash = computeHash(newContent);

    if (filePath.includes('jarvis.config') || filePath.includes('astra.config') || filePath.endsWith('tsconfig.json')) {
      if (existingNode && existingNode.contentHash === newHash) {
        return { kind: 'unmodified', newHash };
      }
      return { kind: 'config', newHash };
    }

    if (!existingNode) {
      return { kind: 'new-file', newHash };
    }

    if (existingNode.contentHash === newHash) {
      return { kind: 'unmodified', newHash };
    }

    if (filePath.endsWith('.css') || filePath.endsWith('.scss')) {
      return { kind: 'css-only', newHash };
    }

    if (filePath.endsWith('.html')) {
      return { kind: 'template-only', newHash };
    }

    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js')) {
      const newSignature = extractPublicContract(newContent);
      const newSignatureHash = computeHash(newSignature);

      if (existingNode.publicSignatureHash && existingNode.publicSignatureHash === newSignatureHash) {
        return { kind: 'ts-impl', newHash, newSignatureHash };
      }
      return { kind: 'ts-public-contract', newHash, newSignatureHash };
    }

    return { kind: 'ts-impl', newHash };
  }

  /**
   * Computes the invalidation plan for a file modification.
   * Handles dependency cycles safely using a visited set in O(V + E) time.
   */
  computeInvalidationPlan(filePath: string, newContent: string): InvalidationPlan {
    const classification = this.classifyFileChange(filePath, newContent);
    const id = this.normalizeId(filePath);
    const node = this.nodes.get(id);

    const stagesMap = new Map<string, Set<StageType>>();
    const affected = new Set<string>();

    if (classification.kind === 'unmodified') {
      return {
        changedFile: filePath,
        changeKind: 'unmodified',
        affectedNodes: [],
        recompilationStages: stagesMap,
        requiresFullRebuild: false,
      };
    }

    if (classification.kind === 'config') {
      // Configuration change requires full rebuild
      for (const n of this.nodes.values()) {
        affected.add(n.id);
        stagesMap.set(n.id, new Set<StageType>(['typescript', 'template', 'style', 'codegen']));
      }
      return {
        changedFile: filePath,
        changeKind: 'config',
        affectedNodes: Array.from(affected),
        recompilationStages: stagesMap,
        requiresFullRebuild: true,
      };
    }

    if (!node) {
      // Newly created node
      affected.add(id);
      stagesMap.set(id, new Set<StageType>(['typescript', 'template', 'style', 'codegen']));
      return {
        changedFile: filePath,
        changeKind: 'new-file',
        affectedNodes: Array.from(affected),
        recompilationStages: stagesMap,
        requiresFullRebuild: false,
      };
    }

    // Process stage-level invalidation
    switch (classification.kind) {
      case 'css-only': {
        // Only invalidate style stage of this node and parent components importing it
        affected.add(id);
        stagesMap.set(id, new Set<StageType>(['style']));

        for (const depId of node.dependents) {
          affected.add(depId);
          if (!stagesMap.has(depId)) stagesMap.set(depId, new Set<StageType>());
          stagesMap.get(depId)!.add('style');
        }
        break;
      }

      case 'template-only': {
        // Only invalidate template & codegen stage of this node and parent components
        affected.add(id);
        stagesMap.set(id, new Set<StageType>(['template', 'codegen']));

        for (const depId of node.dependents) {
          affected.add(depId);
          if (!stagesMap.has(depId)) stagesMap.set(depId, new Set<StageType>());
          stagesMap.get(depId)!.add('template');
          stagesMap.get(depId)!.add('codegen');
        }
        break;
      }

      case 'ts-impl': {
        // Implementation changed without changing public contract:
        // Recompile ONLY this node, DO NOT propagate to consumers!
        affected.add(id);
        stagesMap.set(id, new Set<StageType>(['typescript', 'codegen']));
        break;
      }

      case 'ts-public-contract': {
        // Public API / inputs / types changed:
        // Invalidate this node and propagate transitively to all dependent consumers!
        this.propagateTransitiveDependents(id, affected, stagesMap);
        break;
      }

      default: {
        this.propagateTransitiveDependents(id, affected, stagesMap);
        break;
      }
    }

    return {
      changedFile: filePath,
      changeKind: classification.kind,
      affectedNodes: Array.from(affected),
      recompilationStages: stagesMap,
      requiresFullRebuild: false,
    };
  }

  /**
   * Transitive invalidation propagation with cycle prevention using visited Set.
   * Worst case time complexity: O(V + E).
   */
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

  /**
   * Produces a topological order of the given nodes (dependencies before dependents).
   * Safe for graphs with cycles (breaks cycles deterministically).
   */
  topologicalSort(nodeIds?: string[]): string[] {
    const targetSet = new Set(nodeIds || Array.from(this.nodes.keys()));
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const order: string[] = [];

    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (inStack.has(id)) {
        // Cycle detected - break cycle safely
        return;
      }

      inStack.add(id);
      const node = this.nodes.get(id);
      if (node) {
        for (const depId of node.dependencies) {
          if (targetSet.has(depId)) {
            visit(depId);
          }
        }
      }

      inStack.delete(id);
      visited.add(id);
      order.push(id);
    };

    for (const id of targetSet) {
      if (!visited.has(id)) {
        visit(id);
      }
    }

    return order;
  }

  private normalizeId(filePath: string): string {
    return filePath.replace(/\\/g, '/').toLowerCase();
  }
}
