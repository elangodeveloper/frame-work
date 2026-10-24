import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { getComponentDef } from '../../core/src/index.ts';

function getCompilerDir(): string {
  const directPath = path.resolve(process.cwd(), 'compiler', 'jarvis-compiler');
  if (fs.existsSync(directPath)) {
    return directPath;
  }
  const astraNested = path.resolve(process.cwd(), 'astra', 'compiler', 'jarvis-compiler');
  if (fs.existsSync(astraNested)) {
    return astraNested;
  }
  return directPath;
}

function getCompilerExeName(): string {
  return process.platform === 'win32' ? 'jarvis-compiler.exe' : 'jarvis-compiler';
}

/**
 * Ensures the Rust jarvis-compiler binary is compiled.
 */
export function ensureRustCompiler(): string {
  const compilerDir = getCompilerDir();
  const exePath = path.resolve(compilerDir, 'target', 'debug', getCompilerExeName());

  if (fs.existsSync(exePath)) {
    return exePath;
  }

  const manifestPath = path.resolve(compilerDir, 'Cargo.toml');
  execFileSync('cargo', ['build', '--manifest-path', manifestPath], {
    stdio: 'inherit',
  });

  return exePath;
}

/**
 * Compiles a raw template string using the Rust jarvis-compiler.
 */
export function compileTemplateSource(source: string): (renderer: any, ctx: any) => { root: any } {
  const binary = ensureRustCompiler();

  const output = execFileSync(binary, ['--json', source], {
    encoding: 'utf8',
  });

  const parsed = JSON.parse(output.trim());
  if (!parsed.success) {
    throw new Error('[Jarvis Compiler Error] [' + parsed.code + '] ' + parsed.error);
  }

  // Create function from emitted code: export function template(renderer, ctx) { ... }
  const functionBody = parsed.code
    .replace('export function template(renderer, ctx) {', '')
    .replace(/}\s*$/, '');

  const fn = new Function('renderer', 'ctx', functionBody);
  return fn as (renderer: any, ctx: any) => { root: any };
}

/**
 * Prepares a Component class by compiling its template (inline or external) with the Rust compiler.
 * Supports resolving 	emplateUrl and styleUrl relative to component directory or cwd.
 */
export function compileComponent<T>(
  ComponentClass: new (...args: any[]) => T,
  baseDir?: string
): new (...args: any[]) => T {
  const def = getComponentDef(ComponentClass);
  if (!def) {
    throw new Error('Component missing @Component decorator: ' + ComponentClass.name);
  }

  // 1. Resolve template content: either inline 	emplate or external 	emplateUrl
  if (!def.template && def.templateUrl) {
    const searchDirs = [
      baseDir,
      process.cwd(),
      path.resolve(process.cwd(), 'examples', 'user-card'),
      path.resolve(process.cwd(), 'examples', '04-login-storage'),
    ].filter((d): d is string => typeof d === 'string');

    let resolvedPath: string | null = null;
    for (const dir of searchDirs) {
      const candidate = path.resolve(dir, def.templateUrl);
      if (fs.existsSync(candidate)) {
        resolvedPath = candidate;
        break;
      }
    }

    if (resolvedPath) {
      def.template = fs.readFileSync(resolvedPath, 'utf8');
    } else {
      throw new Error(
        '[JARVIS Compiler] Could not find template file: ' + def.templateUrl + ' for component: ' + ComponentClass.name
      );
    }
  }

  // 2. Resolve style files: styleUrl or styleUrls
  const stylePaths: string[] = [];
  if (def.styleUrl) {
    stylePaths.push(def.styleUrl);
  }
  if (def.styleUrls && Array.isArray(def.styleUrls)) {
    stylePaths.push(...def.styleUrls);
  }

  if (stylePaths.length > 0) {
    def.styles = def.styles || [];
    const searchDirs = [
      baseDir,
      process.cwd(),
      path.resolve(process.cwd(), 'examples', 'user-card'),
      path.resolve(process.cwd(), 'examples', '04-login-storage'),
    ].filter((d): d is string => typeof d === 'string');

    for (const styleFile of stylePaths) {
      let resolvedPath: string | null = null;
      for (const dir of searchDirs) {
        const candidate = path.resolve(dir, styleFile);
        if (fs.existsSync(candidate)) {
          resolvedPath = candidate;
          break;
        }
      }
      if (resolvedPath) {
        def.styles.push(fs.readFileSync(resolvedPath, 'utf8'));
      }
    }
  }

  // 3. Compile template into executable view factory
  if (def.template && !def.templateFn) {
    const rawFn = compileTemplateSource(def.template);
    def.templateFn = (renderer: any, ctx: any) => {
      // Inject scoped/component styles if document is available and not already injected
      if (def.styles && def.styles.length > 0 && typeof document !== 'undefined') {
        const styleId = 'jarvis-style-' + (def.selector || ComponentClass.name).replace(/[^a-zA-Z0-9_-]/g, '-');
        if (!document.getElementById(styleId)) {
          const styleEl = document.createElement('style');
          styleEl.id = styleId;
          styleEl.textContent = def.styles.join('\n');
          document.head?.appendChild(styleEl);
        }
      }
      return rawFn(renderer, ctx);
    };
  }

  return ComponentClass;
}
