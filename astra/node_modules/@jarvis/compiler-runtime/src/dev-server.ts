import { IncrementalCompiler, type IncrementalBuildResult } from './incremental-compiler.ts';

export type HmrUpdateType = 'css' | 'template' | 'module' | 'full-reload';

export interface HmrPayload {
  type: HmrUpdateType;
  file: string;
  epoch: number;
  cssContent?: string;
  templateCode?: string;
  affectedFiles: string[];
}

export interface DevServerEventOptions {
  debounceMs?: number;
}

/**
 * Development Server Incremental Hot Update Coordinator.
 * Coordinates debounced filesystem changes, safe build epoch numbering (discarding stale builds),
 * and dispatches fine-grained HMR updates (css vs template vs module vs full-reload).
 */
export class DevServerCoordinator {
  private readonly compiler: IncrementalCompiler;
  private readonly debounceMs: number;
  private currentEpoch = 0;
  private debounceTimer: any = null;
  private pendingChanges = new Map<string, string>();
  private readonly listeners: Array<(payload: HmrPayload) => void> = [];

  constructor(compiler: IncrementalCompiler, options: DevServerEventOptions = {}) {
    this.compiler = compiler;
    this.debounceMs = options.debounceMs ?? 20;
  }

  /**
   * Registers a client listener for hot update events.
   */
  onUpdate(listener: (payload: HmrPayload) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  /**
   * Queues a file change event with debouncing to collapse rapid multi-saves.
   */
  queueFileChange(
    filePath: string,
    newContent: string,
    allFiles: Map<string, string>
  ): Promise<HmrPayload | null> {
    this.pendingChanges.set(filePath, newContent);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    return new Promise((resolve) => {
      this.debounceTimer = setTimeout(async () => {
        this.debounceTimer = null;
        const payload = await this.flushPendingChanges(allFiles);
        resolve(payload);
      }, this.debounceMs);
    });
  }

  /**
   * Flushes and processes pending file changes with safe epoch tracking.
   */
  async flushPendingChanges(allFiles: Map<string, string>): Promise<HmrPayload | null> {
    if (this.pendingChanges.size === 0) return null;

    const epoch = ++this.currentEpoch;
    const entries = Array.from(this.pendingChanges.entries());
    this.pendingChanges.clear();

    let lastPayload: HmrPayload | null = null;

    for (const [filePath, newContent] of entries) {
      allFiles.set(filePath, newContent);
      const buildResult: IncrementalBuildResult = this.compiler.processFileChange(
        filePath,
        newContent,
        allFiles
      );

      // Verify that this build was not superseded by a newer epoch
      if (epoch !== this.currentEpoch) {
        // Discard stale build result
        return null;
      }

      const hmrType = this.classifyHmrUpdate(buildResult);
      lastPayload = {
        type: hmrType,
        file: filePath,
        epoch,
        affectedFiles: buildResult.affectedFiles,
      };

      if (hmrType === 'css') {
        lastPayload.cssContent = newContent;
      }

      for (const listener of this.listeners) {
        listener(lastPayload);
      }
    }

    return lastPayload;
  }

  /**
   * Classifies an incremental build result into the appropriate HMR action.
   */
  classifyHmrUpdate(result: IncrementalBuildResult): HmrUpdateType {
    if (result.requiresFullRebuild || result.changeKind === 'config') {
      return 'full-reload';
    }

    if (result.changeKind === 'css-only') {
      return 'css';
    }

    if (result.changeKind === 'template-only') {
      return 'template';
    }

    if (result.changeKind === 'ts-impl') {
      return 'module';
    }

    if (result.changeKind === 'ts-public-contract') {
      // If contract changed across multiple components, safe fallback is full-reload
      return result.affectedFiles.length > 2 ? 'full-reload' : 'module';
    }

    return 'full-reload';
  }
}
