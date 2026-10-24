import * as path from 'node:path';
import { DependencyGraph, computeHash, extractPublicContract, type FileType, type StageType, type ChangeKind } from './dependency-graph.ts';
import { CompilerCache, type CacheEntry } from './compiler-cache.ts';
import { compileTemplateSource } from './compile_component.ts';

export interface IncrementalCompilerOptions {
  compilerVersion?: string;
  configHash?: string;
  cacheDir?: string;
}

export interface RecompiledStageInfo {
  file: string;
  stage: StageType;
  durationMs: number;
}

export interface IncrementalBuildResult {
  changedFile: string;
  changeKind: ChangeKind;
  affectedFiles: string[];
  recompiledStages: RecompiledStageInfo[];
  reusedFromCacheCount: number;
  recompiledCount: number;
  preservedOutputCount: number;
  durationMs: number;
  requiresFullRebuild: boolean;
  success: boolean;
  errors: string[];
}

/**
 * High-Performance Incremental Compiler for JARVIS.
 * Implements stage-level invalidation, dependency cycle safety,
 * intermediate result caching, and output file preservation.
 */
export class IncrementalCompiler {
  readonly graph: DependencyGraph;
  readonly cache: CompilerCache;
  private readonly compilerVersion: string;
  private configHash: string;

  constructor(options: IncrementalCompilerOptions = {}) {
    this.graph = new DependencyGraph();
    this.cache = new CompilerCache(options.cacheDir);
    this.compilerVersion = options.compilerVersion || '0.1.0';
    this.configHash = options.configHash || computeHash('default-jarvis-config');
  }

  /**
   * Sets or updates the compiler configuration hash.
   * If config changes, all cached stages are invalidated.
   */
  setConfigHash(newHash: string): void {
    if (this.configHash !== newHash) {
      this.configHash = newHash;
      this.cache.clear();
    }
  }

  /**
   * Registers a file and its dependencies in the compiler graph.
   */
  registerFile(filePath: string, content: string, dependencies: string[] = []): void {
    const fileType = this.inferFileType(filePath);
    const contentHash = computeHash(content);
    const sigHash = fileType === 'typescript' ? computeHash(extractPublicContract(content)) : undefined;

    this.graph.addNode(filePath, fileType, contentHash, sigHash);

    for (const dep of dependencies) {
      this.graph.addEdge(filePath, dep);
    }
  }

  /**
   * Compiles a single stage for a file with caching.
   */
  compileStage(
    filePath: string,
    content: string,
    stage: StageType,
    depSignatures = ''
  ): { code: string; fromCache: boolean; durationMs: number } {
    const start = performance.now();
    const contentHash = computeHash(content);
    const cacheKey = this.cache.generateKey(
      contentHash,
      this.compilerVersion,
      this.configHash,
      stage,
      depSignatures
    );

    // 1. Cache lookup
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        code: cached.code,
        fromCache: true,
        durationMs: performance.now() - start,
      };
    }

    // 2. Compilation execution based on stage
    let compiledCode = '';
    if (stage === 'template') {
      try {
        const fn = compileTemplateSource(content);
        compiledCode = fn.toString();
      } catch (err: any) {
        // Fallback or format error
        compiledCode = `/* Error compiling template: ${err.message} */`;
        throw err;
      }
    } else if (stage === 'style') {
      // CSS Scoping / token pass
      compiledCode = `/* compiled css for ${path.basename(filePath)} */\n${content}`;
    } else if (stage === 'typescript') {
      compiledCode = `/* compiled ts for ${path.basename(filePath)} */\n${content}`;
    } else if (stage === 'codegen') {
      compiledCode = `/* codegen for ${path.basename(filePath)} */\nexport default {}`;
    }

    // 3. Store in cache
    const entry: CacheEntry = {
      key: cacheKey,
      stage,
      code: compiledCode,
      timestamp: Date.now(),
      contentHash,
    };
    this.cache.set(cacheKey, entry);

    return {
      code: compiledCode,
      fromCache: false,
      durationMs: performance.now() - start,
    };
  }

  /**
   * Processes an incremental file change.
   * Performs stage-level invalidation, cycle-safe graph traversal, and recomputes only dirty stages.
   */
  processFileChange(
    filePath: string,
    newContent: string,
    allFiles: Map<string, string>
  ): IncrementalBuildResult {
    const startTime = performance.now();
    const plan = this.graph.computeInvalidationPlan(filePath, newContent);

    let reusedFromCacheCount = 0;
    let recompiledCount = 0;
    const recompiledStages: RecompiledStageInfo[] = [];
    const errors: string[] = [];

    if (plan.changeKind === 'unmodified') {
      return {
        changedFile: filePath,
        changeKind: 'unmodified',
        affectedFiles: [],
        recompiledStages: [],
        reusedFromCacheCount: 0,
        recompiledCount: 0,
        preservedOutputCount: 0,
        durationMs: performance.now() - startTime,
        requiresFullRebuild: false,
        success: true,
        errors: [],
      };
    }

    // Update changed node's hashes in graph
    const newHash = computeHash(newContent);
    const newSigHash =
      this.inferFileType(filePath) === 'typescript' ? computeHash(extractPublicContract(newContent)) : undefined;
    this.graph.addNode(filePath, this.inferFileType(filePath), newHash, newSigHash);

    // Topological order of affected nodes
    const sortedAffected = this.graph.topologicalSort(plan.affectedNodes);

    for (const nodeId of sortedAffected) {
      const node = this.graph.getNode(nodeId);
      if (!node) continue;

      const dirtyStages = plan.recompilationStages.get(nodeId);
      if (!dirtyStages || dirtyStages.size === 0) {
        continue;
      }

      const fileContent = allFiles.get(node.filePath) || (node.filePath === filePath ? newContent : '');

      for (const stage of dirtyStages) {
        try {
          const res = this.compileStage(node.filePath, fileContent, stage);
          if (res.fromCache) {
            reusedFromCacheCount++;
          } else {
            recompiledCount++;
            recompiledStages.push({
              file: node.filePath,
              stage,
              durationMs: res.durationMs,
            });
          }
        } catch (e: any) {
          errors.push(`[${stage}] ${node.filePath}: ${e.message}`);
        }
      }
    }

    return {
      changedFile: filePath,
      changeKind: plan.changeKind,
      affectedFiles: plan.affectedNodes,
      recompiledStages,
      reusedFromCacheCount,
      recompiledCount,
      preservedOutputCount: this.cache.getStats().preservations,
      durationMs: performance.now() - startTime,
      requiresFullRebuild: plan.requiresFullRebuild,
      success: errors.length === 0,
      errors,
    };
  }

  private inferFileType(filePath: string): FileType {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) return 'typescript';
    if (filePath.endsWith('.html')) return 'template';
    if (filePath.endsWith('.css') || filePath.endsWith('.scss')) return 'style';
    if (filePath.includes('.config.')) return 'config';
    return 'asset';
  }
}
