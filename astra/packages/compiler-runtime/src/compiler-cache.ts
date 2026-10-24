import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface CacheEntry {
  key: string;
  stage: string;
  code: string;
  ast?: any;
  ir?: any;
  diagnostics?: any[];
  timestamp: number;
  contentHash: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  writes: number;
  preservations: number;
}

/**
 * High-performance compiler cache with multi-factor cache keys and output preservation.
 */
export class CompilerCache {
  private readonly memoryStore = new Map<string, CacheEntry>();
  private readonly cacheDir?: string;
  private readonly stats: CacheStats = {
    hits: 0,
    misses: 0,
    writes: 0,
    preservations: 0,
  };

  constructor(cacheDir?: string) {
    if (cacheDir) {
      this.cacheDir = cacheDir;
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
    }
  }

  /**
   * Generates a multi-factor cache key accounting for all relevant inputs.
   */
  generateKey(
    contentHash: string,
    compilerVersion: string,
    configHash: string,
    stage: string,
    depSignatures = ''
  ): string {
    const raw = `${contentHash}:${compilerVersion}:${configHash}:${stage}:${depSignatures}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  has(key: string): boolean {
    if (this.memoryStore.has(key)) return true;
    if (this.cacheDir) {
      const diskPath = path.join(this.cacheDir, `${key}.json`);
      return fs.existsSync(diskPath);
    }
    return false;
  }

  get(key: string): CacheEntry | undefined {
    // 1. Check in-memory store
    const mem = this.memoryStore.get(key);
    if (mem) {
      this.stats.hits++;
      return mem;
    }

    // 2. Check disk store if configured
    if (this.cacheDir) {
      const diskPath = path.join(this.cacheDir, `${key}.json`);
      if (fs.existsSync(diskPath)) {
        try {
          const raw = fs.readFileSync(diskPath, 'utf8');
          const entry = JSON.parse(raw) as CacheEntry;
          this.memoryStore.set(key, entry);
          this.stats.hits++;
          return entry;
        } catch {
          // If disk cache corrupted, treat as miss
        }
      }
    }

    this.stats.misses++;
    return undefined;
  }

  set(key: string, entry: CacheEntry): void {
    this.memoryStore.set(key, entry);

    if (this.cacheDir) {
      const diskPath = path.join(this.cacheDir, `${key}.json`);
      try {
        fs.writeFileSync(diskPath, JSON.stringify(entry), 'utf8');
      } catch {
        // Disk write failure shouldn't abort compilation
      }
    }
  }

  invalidate(key: string): void {
    this.memoryStore.delete(key);
    if (this.cacheDir) {
      const diskPath = path.join(this.cacheDir, `${key}.json`);
      if (fs.existsSync(diskPath)) {
        try {
          fs.unlinkSync(diskPath);
        } catch {}
      }
    }
  }

  clear(): void {
    this.memoryStore.clear();
    if (this.cacheDir && fs.existsSync(this.cacheDir)) {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            fs.unlinkSync(path.join(this.cacheDir, file));
          } catch {}
        }
      }
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Output Preservation Guard:
   * Writes content to destination file ONLY IF it has changed.
   * If destination file exists and contains identical content, the write is SKIPPED.
   *
   * @returns `true` if file was written, `false` if file was preserved unchanged.
   */
  writeIfChanged(targetPath: string, newContent: string): boolean {
    if (fs.existsSync(targetPath)) {
      try {
        const existing = fs.readFileSync(targetPath, 'utf8');
        if (existing === newContent) {
          this.stats.preservations++;
          return false; // Preserved without disk rewrite!
        }
      } catch {
        // Fallback to write
      }
    }

    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(targetPath, newContent, 'utf8');
    this.stats.writes++;
    return true;
  }
}
