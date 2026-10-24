import * as esbuild from 'esbuild';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createServer, build as viteBuild } from 'vite';
import { jarvisPlugin } from '../../vite-plugin/src/index.ts';
import type { AstraBuildOptions, JarvisProjectConfig } from './config.ts';
import { loadJarvisConfig } from './config.ts';
import { astraTemplatePlugin } from './plugin.ts';

export interface BuildArtifactResult {
  success: boolean;
  files: string[];
  chunks: { name: string; size: number }[];
  errors: string[];
  warnings: string[];
}

export interface ServeOptions {
  port?: number;
  open?: boolean;
  cwd?: string;
  typeCheck?: boolean;
}

export interface BuildOptions {
  configuration?: 'production' | 'development' | string;
  watch?: boolean;
  cwd?: string;
  outDir?: string;
  entry?: string;
  minify?: boolean;
  sourceMap?: boolean;
}

function getAliases(cwd: string) {
  const repoRoot = [cwd, path.resolve(cwd, '..'), path.resolve(cwd, '../..')].find((d) =>
    fs.existsSync(path.join(d, 'packages', 'core', 'src', 'index.ts'))
  );
  if (repoRoot) {
    const pkg = (name: string) => path.join(repoRoot, 'packages', name, 'src', 'index.ts');
    return {
      '@jarvis/core': pkg('core'),
      '@jarvis/runtime': pkg('runtime'),
      '@jarvis/renderer': pkg('renderer'),
      '@jarvis/router': pkg('router'),
      '@jarvis/http': pkg('http'),
      '@jarvis/forms': pkg('forms'),
      '@jarvis/reactive': pkg('reactive'),
    };
  }
  return {};
}

export async function serveApp(options: ServeOptions = {}) {
  const cwd = options.cwd || process.cwd();
  const port = options.port || 4200;

  console.log(`[JARVIS DevServer] Starting compiler-mode Vite dev server on port ${port}...`);

  // Start background type-checking process so it NEVER blocks the dev server
  if (options.typeCheck !== false) {
    const tsconfigPath = path.join(cwd, 'tsconfig.app.json');
    if (fs.existsSync(tsconfigPath)) {
      try {
        const tsc = spawn('npx', ['tsc', '--project', tsconfigPath, '--noEmit', '--watch', '--preserveWatchOutput'], {
          cwd,
          stdio: 'pipe',
          shell: true,
        });
        tsc.stdout?.on('data', (data) => {
          const str = data.toString().trim();
          if (str && (str.includes('error TS') || str.includes('Found 0 errors'))) {
            console.log(`[TypeChecker] ${str}`);
          }
        });
        tsc.on('error', () => {});
      } catch {}
    }
  }

  const server = await createServer({
    root: cwd,
    server: {
      port,
      open: options.open || false,
      host: true,
      fs: {
        allow: [cwd, path.resolve(cwd, '..'), path.resolve(cwd, '../..')],
      },
    },
    resolve: {
      alias: getAliases(cwd),
    },
    plugins: [jarvisPlugin()],
  });

  await server.listen();
  server.printUrls();
  return server;
}

export async function buildApp(options: BuildOptions | AstraBuildOptions = {}): Promise<BuildArtifactResult> {
  const cwd = (options as any).cwd || process.cwd();
  const isProd = (options as any).configuration === 'production' || !(options as any).configuration;
  const projectConfig = loadJarvisConfig(cwd);
  const outDir = (options as any).outDir ? path.resolve(cwd, (options as any).outDir) : path.resolve(cwd, projectConfig.outputPath || 'dist');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  try {
    const result: any = await viteBuild({
      root: cwd,
      resolve: {
        alias: getAliases(cwd),
      },
      plugins: [jarvisPlugin()],
      build: {
        outDir,
        emptyOutDir: true,
        minify: isProd ? 'esbuild' : false,
        sourcemap: !isProd,
        watch: (options as any).watch ? {} : null,
        rollupOptions: {
          input: path.resolve(cwd, projectConfig.index || 'src/index.html'),
          output: {
            entryFileNames: isProd ? 'assets/[name]-[hash].js' : 'assets/[name].js',
            chunkFileNames: isProd ? 'assets/chunks/[name]-[hash].js' : 'assets/chunks/[name].js',
            assetFileNames: isProd ? 'assets/[name]-[hash][extname]' : 'assets/[name][extname]',
          },
        },
      },
    });

    const generatedFiles: string[] = [];
    const chunkStats: { name: string; size: number }[] = [];

    if (fs.existsSync(outDir)) {
      const walk = (d: string) => {
        for (const item of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, item.name);
          if (item.isDirectory()) {
            walk(p);
          } else {
            const rel = path.relative(outDir, p).replace(/\\/g, '/');
            generatedFiles.push(rel);
            chunkStats.push({ name: rel, size: fs.statSync(p).size });
          }
        }
      };
      walk(outDir);
      generateRouteManifest(cwd, outDir, generatedFiles);
    }

    return {
      success: true,
      files: generatedFiles,
      chunks: chunkStats,
      errors: [],
      warnings: [],
    };
  } catch (err: any) {
    // If Vite build encounters an issue (e.g., missing index.html in scratch directory), fallback to esbuild
    const entry = (options as any).entry || projectConfig.entry || 'src/main.ts';
    const entryPoint = path.resolve(cwd, entry);
    if (fs.existsSync(entryPoint)) {
      try {
        const buildResult = await esbuild.build({
          entryPoints: [entryPoint],
          bundle: true,
          format: 'esm',
          splitting: true,
          outdir: outDir,
          entryNames: isProd ? '[name]-[hash]' : '[name]',
          chunkNames: isProd ? 'chunk-[name]-[hash]' : 'chunk-[name]',
          assetNames: 'assets/[name]-[hash]',
          minify: isProd,
          sourcemap: !isProd,
          metafile: true,
          plugins: [astraTemplatePlugin()],
        });

        const generatedFiles: string[] = [];
        const chunkStats: { name: string; size: number }[] = [];

        if (buildResult.metafile) {
          for (const [outPath, meta] of Object.entries(buildResult.metafile.outputs)) {
            const fileName = path.basename(outPath);
            generatedFiles.push(fileName);
            chunkStats.push({ name: fileName, size: meta.bytes });
          }
        }

        return { success: true, files: generatedFiles, chunks: chunkStats, errors: [], warnings: [] };
      } catch (e: any) {
        return { success: false, files: [], chunks: [], errors: [e.message || String(e)], warnings: [] };
      }
    }
    return { success: false, files: [], chunks: [], errors: [err.message || String(err)], warnings: [] };
  }
}

export function generateRouteManifest(
  cwd: string,
  outDir: string,
  generatedFiles: string[]
): {
  manifest: Record<string, { chunk?: string; renderMode: string; title?: string }>;
  prerendered: string[];
} {
  const routesFile = [
    path.join(cwd, 'src', 'app', 'app.routes.ts'),
    path.join(cwd, 'src', 'app.routes.ts'),
    path.join(cwd, 'src', 'routes.ts'),
  ].find((f) => fs.existsSync(f));

  const manifest: Record<string, { chunk?: string; renderMode: string; title?: string }> = {};
  const prerendered: string[] = [];

  if (routesFile) {
    const content = fs.readFileSync(routesFile, 'utf8');
    const routeRegex = /path:\s*['"]([^'"]*)['"]/g;
    let match: RegExpExecArray | null;

    while ((match = routeRegex.exec(content)) !== null) {
      const rPath = match[1];
      if (rPath === '**') continue;

      const segment = content.slice(match.index, match.index + 250);
      let renderMode = 'client';
      if (/renderMode:\s*['"]prerender['"]/.test(segment)) {
        renderMode = 'prerender';
      } else if (/renderMode:\s*['"]server['"]/.test(segment)) {
        // TODO: Full server-side SSR hydration pipeline scheduled for next release
        renderMode = 'server';
      }

      const titleMatch = /title:\s*['"]([^'"]*)['"]/.exec(segment);
      const title = titleMatch ? titleMatch[1] : undefined;

      const isLazy = segment.includes('loadComponent') || segment.includes('loadChildren');
      let chunk: string | undefined;
      if (isLazy) {
        chunk = generatedFiles.find((f) => f.includes('chunk') && f.includes(rPath));
      }

      manifest[rPath ? `/${rPath}` : '/'] = {
        chunk,
        renderMode,
        title,
      };

      if (renderMode === 'prerender') {
        const targetHtmlDir = rPath ? path.join(outDir, rPath) : outDir;
        if (!fs.existsSync(targetHtmlDir)) {
          fs.mkdirSync(targetHtmlDir, { recursive: true });
        }
        const indexSrc = path.join(outDir, 'src', 'index.html');
        const rootIndex = path.join(outDir, 'index.html');
        const baseHtml = fs.existsSync(rootIndex)
          ? fs.readFileSync(rootIndex, 'utf8')
          : fs.existsSync(indexSrc)
          ? fs.readFileSync(indexSrc, 'utf8')
          : '<!doctype html><html><head><title>Prerendered</title></head><body><div id="app"></div></body></html>';

        const prerenderHtml = baseHtml.replace(/<title>.*?<\/title>/, `<title>${title || 'Jarvis App'}</title>`);
        fs.writeFileSync(path.join(targetHtmlDir, 'index.html'), prerenderHtml, 'utf8');
        prerendered.push(rPath ? `/${rPath}/index.html` : '/index.html');
      }
    }

    fs.writeFileSync(path.join(outDir, 'route-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  }

  return { manifest, prerendered };
}
