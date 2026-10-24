import * as esbuild from 'esbuild';
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { AstraBuildOptions } from './config.ts';
import { astraTemplatePlugin } from './plugin.ts';

export interface BuildArtifactResult {
  success: boolean;
  files: string[];
  chunks: { name: string; size: number }[];
  errors: string[];
  warnings: string[];
}

export async function buildApp(options: AstraBuildOptions): Promise<BuildArtifactResult> {
  const outDir = options.outDir || path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const entryPoint = path.resolve(process.cwd(), options.entry);
  const isMinify = options.minify ?? true;
  const isSourceMap = options.sourceMap ?? true;

  try {
    const buildResult = await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      format: 'esm',
      splitting: true,
      outdir: outDir,
      entryNames: options.contentHash ? '[name]-[hash]' : '[name]',
      chunkNames: options.contentHash ? 'chunk-[name]-[hash]' : 'chunk-[name]',
      assetNames: 'assets/[name]-[hash]',
      minify: isMinify,
      sourcemap: isSourceMap,
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
      if (options.statsJson) {
        fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify(buildResult.metafile, null, 2), 'utf8');
        generatedFiles.push('stats.json');
      }
    }

    const mainJs = generatedFiles.find(f => f.startsWith('main') && f.endsWith('.js')) || generatedFiles.find(f => f.endsWith('.js'));
    const baseHref = options.baseHref || '/';
    const html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <base href="' + baseHref + '" />\n  <title>Astra Application</title>\n  <style>@layer theme, base, primeng, utilities;</style>\n</head>\n<body>\n  <div id="app"><div id="router-outlet"></div></div>\n' + (mainJs ? '  <script type="module" src="./' + mainJs + '"></script>\n' : '') + '</body>\n</html>';
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
    generatedFiles.push('index.html');


    return { success: true, files: generatedFiles, chunks: chunkStats, errors: [], warnings: [] };
  } catch (e: any) {
    return { success: false, files: [], chunks: [], errors: [e.message || String(e)], warnings: [] };
  }
}
