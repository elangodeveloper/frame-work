import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';

export interface DiagnosticItem {
  code: string;
  severity: string;
  message: string;
  line: number;
  col: number;
  start: number;
  end: number;
  suggestion?: string;
}

export interface CompileOptions {
  oldSource?: string;
  command?: 'compile' | 'diff';
  unitType?: 'template' | 'style' | 'script';
  configHash?: string;
  cacheDir?: string;
}

export interface CompileResult {
  success: boolean;
  code?: string;
  diagnostics: DiagnosticItem[];
  compileTimeMs: number;
  cached: boolean;
  diff?: any;
  formattedTerminal?: string;
  formattedOverlay?: string;
}

export function findCompilerBinary(): string {
  const exe = process.platform === 'win32' ? 'jarvis-compiler.exe' : 'jarvis-compiler';
  
  // Search upwards from current file or process.cwd()
  let curr = path.resolve(process.cwd());
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(curr, 'target', 'debug', exe);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }

  const fallbackCandidates = [
    path.resolve(process.cwd(), 'target', 'debug', exe),
    path.resolve(process.cwd(), 'crates', 'jarvis-compiler', 'target', 'debug', exe),
    path.resolve(process.cwd(), '..', 'crates', 'jarvis-compiler', 'target', 'debug', exe),
    path.resolve(process.cwd(), '..', '..', 'crates', 'jarvis-compiler', 'target', 'debug', exe),
    path.resolve(process.cwd(), 'astra', 'compiler', 'jarvis-compiler', 'target', 'debug', exe),
  ];

  for (const c of fallbackCandidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return fallbackCandidates[0];
}

export class CompilerService {
  private workerProcess: ChildProcess | null = null;
  private readonly cache = new Map<string, { code: string; diagnostics: DiagnosticItem[] }>();
  private pendingResolvers: Array<(res: { success: boolean; code?: string; diagnostics: DiagnosticItem[]; diff?: any; cached?: boolean }) => void> = [];
  private buffer = '';
  private readonly binaryPath: string;
  private defaultCacheDir: string;

  constructor(binaryPath?: string) {
    this.binaryPath = binaryPath ?? findCompilerBinary();
    this.defaultCacheDir = path.resolve(process.cwd(), 'node_modules', '.cache', 'jarvis');
  }

  private ensureWorker(): void {
    if (this.workerProcess && !this.workerProcess.killed) {
      return;
    }

    this.workerProcess = spawn(this.binaryPath, ['--worker'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.workerProcess.stdout?.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf8');
      let newlineIdx = this.buffer.indexOf('\n');
      while (newlineIdx !== -1) {
        const line = this.buffer.slice(0, newlineIdx).trim();
        this.buffer = this.buffer.slice(newlineIdx + 1);
        if (line && this.pendingResolvers.length > 0) {
          try {
            const parsed = JSON.parse(line);
            const resolve = this.pendingResolvers.shift();
            resolve?.(parsed);
          } catch {
            // Non-JSON line or ping ignored
          }
        }
        newlineIdx = this.buffer.indexOf('\n');
      }
    });

    this.workerProcess.stdin?.on('error', (_err) => {
      // Prevent unhandled EPIPE on Windows
    });

    this.workerProcess.on('error', () => {
      this.workerProcess = null;
    });

    this.workerProcess.on('exit', () => {
      this.workerProcess = null;
    });
  }

  async compile(
    source: string,
    filePath = 'template.html',
    options: CompileOptions = {}
  ): Promise<CompileResult> {
    const startTime = performance.now();
    const configHash = options.configHash || '0.1.0';
    const unitType = options.unitType || 'template';
    const cacheKey = crypto
      .createHash('sha256')
      .update(`${configHash}:${unitType}:${source}`)
      .digest('hex');

    // If no oldSource (not diffing), check memory cache
    if (!options.oldSource && this.cache.has(cacheKey)) {
      const cachedEntry = this.cache.get(cacheKey)!;
      const compileTimeMs = Math.max(0.05, Math.round((performance.now() - startTime) * 100) / 100);
      return {
        success: true,
        code: cachedEntry.code,
        diagnostics: cachedEntry.diagnostics,
        compileTimeMs,
        cached: true,
      };
    }

    this.ensureWorker();

    const cacheDir = options.cacheDir;

    return new Promise((resolve) => {
      this.pendingResolvers.push((res) => {
        const compileTimeMs = Math.max(0.1, Math.round((performance.now() - startTime) * 100) / 100);
        if (res.success && res.code) {
          this.cache.set(cacheKey, { code: res.code, diagnostics: res.diagnostics || [] });
          resolve({
            success: true,
            code: res.code,
            diagnostics: res.diagnostics || [],
            diff: res.diff,
            compileTimeMs,
            cached: Boolean(res.cached),
          });
        } else {
          const diagnostics = res.diagnostics || [];
          const formattedTerminal = this.formatTerminalDiagnostics(filePath, source, diagnostics);
          const formattedOverlay = this.formatOverlayDiagnostics(filePath, source, diagnostics);
          resolve({
            success: false,
            diagnostics,
            diff: res.diff,
            compileTimeMs,
            cached: false,
            formattedTerminal,
            formattedOverlay,
          });
        }
      });

      // Send single line JSON request to worker
      const payload = JSON.stringify({
        command: options.command || (options.oldSource ? 'diff' : 'compile'),
        source,
        old_source: options.oldSource,
        unit_type: unitType,
        config_hash: configHash,
        cache_dir: cacheDir,
      });

      this.workerProcess?.stdin?.write(payload + '\n');
    });
  }

  formatTerminalDiagnostics(filePath: string, source: string, diags: DiagnosticItem[]): string {
    const lines = source.split('\n');
    const out: string[] = [`\x1b[31;1m[Jarvis Compiler Error]\x1b[0m In ${filePath}:`];

    for (const d of diags) {
      out.push(`  \x1b[33m${d.code}\x1b[0m: ${d.message} (${filePath}:${d.line}:${d.col})`);
      const srcLine = lines[d.line - 1] ?? '';
      out.push(`    ${d.line} | ${srcLine}`);
      const pointer = ' '.repeat(Math.max(0, d.col - 1)) + '^'.repeat(Math.max(1, (d.end - d.start) || 1));
      out.push(`      | \x1b[31m${pointer}\x1b[0m`);
      if (d.suggestion) {
        out.push(`      = suggestion: \x1b[32m${d.suggestion}\x1b[0m`);
      }
    }
    return out.join('\n');
  }

  formatOverlayDiagnostics(filePath: string, source: string, diags: DiagnosticItem[]): string {
    const lines = source.split('\n');
    let html = `<div style="font-family:monospace;padding:16px;background:#1e1e1e;color:#fff;border-radius:8px;">`;
    html += `<h2 style="color:#ff5555;margin-top:0;">Jarvis Template Compilation Errors (${diags.length})</h2>`;
    html += `<p style="color:#aaa;">File: <b>${filePath}</b></p>`;

    for (const d of diags) {
      html += `<div style="margin-bottom:16px;border-left:4px solid #ff5555;padding-left:12px;">`;
      html += `<div style="font-weight:bold;color:#f1fa8c;">[${d.code}] ${d.message} <span style="color:#888;">(line ${d.line}, col ${d.col})</span></div>`;
      const srcLine = lines[d.line - 1] ?? '';
      const indent = '&nbsp;'.repeat(Math.max(0, d.col - 1));
      const underline = '^'.repeat(Math.max(1, (d.end - d.start) || 1));
      html += `<pre style="background:#282a36;padding:8px;border-radius:4px;overflow-x:auto;">${srcLine}\n<span style="color:#ff5555;">${indent}${underline}</span></pre>`;
      if (d.suggestion) {
        html += `<div style="color:#50fa7b;">Suggestion: ${d.suggestion}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    return html;
  }

  dispose(): void {
    if (this.workerProcess) {
      this.workerProcess.kill();
      this.workerProcess = null;
    }
  }
}
