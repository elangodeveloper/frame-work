import * as path from 'node:path';
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';

export interface RustTemplatePluginOptions {
  compilerExePath?: string;
}

const templateCache = new Map<string, string>();

function findRustCompiler(): string {
  const exe = process.platform === 'win32' ? 'jarvis-compiler.exe' : 'jarvis-compiler';
  const candidate1 = path.resolve(process.cwd(), 'compiler', 'jarvis-compiler', 'target', 'debug', exe);
  if (fs.existsSync(candidate1)) return candidate1;
  const candidate2 = path.resolve(process.cwd(), 'astra', 'compiler', 'jarvis-compiler', 'target', 'debug', exe);
  if (fs.existsSync(candidate2)) return candidate2;
  return candidate1;
}

/**
 * esbuild / Vite transform plugin for JARVIS templates.
 * Transforms external .html templates using Rust jarvis-compiler at build time (AOT),
 * utilizing content-hash caching to eliminate redundant invocations.
 */
export function astraTemplatePlugin(options: RustTemplatePluginOptions = {}) {
  const compilerBin = options.compilerExePath || findRustCompiler();

  return {
    name: 'jarvis-template-compiler',
    setup(build: any) {
      // Intercept html files imported in components
      build.onLoad({ filter: /\.(html)$/ }, async (args: any) => {
        const source = fs.readFileSync(args.path, 'utf8');
        const hash = crypto.createHash('sha256').update(source).digest('hex');

        // Check cache
        if (templateCache.has(hash)) {
          return {
            contents: templateCache.get(hash)!,
            loader: 'js',
          };
        }

        try {
          const output = execFileSync(compilerBin, ['--json', source], { encoding: 'utf8' });
          const parsed = JSON.parse(output.trim());
          if (!parsed.success) {
            return {
              errors: [{ text: `[JARVIS Rust Compiler] ${parsed.error || 'Syntax error'}` }],
            };
          }
          templateCache.set(hash, parsed.code);
          return {
            contents: parsed.code,
            loader: 'js',
          };
        } catch (e: any) {
          return {
            errors: [{ text: `Failed to compile template with Rust: ${e.message || String(e)}` }],
          };
        }
      });
    },
  };
}
