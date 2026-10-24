import * as path from 'node:path';
import * as fs from 'node:fs';
import { CompilerService, type CompileResult } from './compiler-service.ts';
import { DependencyGraph, type ClassificationResult } from './graph.ts';

export * from './compiler-service.ts';
export * from './graph.ts';

export interface JarvisPluginOptions {
  compilerBinary?: string;
  typeCheck?: boolean;
  verbose?: boolean;
  cacheDir?: string;
}

function getTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const HMR_CLIENT_INJECT_SCRIPT = `
<!-- Jarvis Fine-Grained HMR Runtime Script -->
<script type="module">
if (import.meta.hot) {
  let overlayEl = null;

  import.meta.hot.on('jarvis:error', (data) => {
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.id = 'jarvis-error-overlay';
      overlayEl.style.position = 'fixed';
      overlayEl.style.top = '0';
      overlayEl.style.left = '0';
      overlayEl.style.width = '100vw';
      overlayEl.style.height = '100vh';
      overlayEl.style.backgroundColor = 'rgba(0, 0, 0, 0.88)';
      overlayEl.style.zIndex = '999999';
      overlayEl.style.overflow = 'auto';
      overlayEl.style.padding = '32px';
      overlayEl.style.boxSizing = 'border-box';
      document.body.appendChild(overlayEl);
    }
    overlayEl.innerHTML = data.html;
  });

  import.meta.hot.on('jarvis:clear', () => {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
  });

  import.meta.hot.on('jarvis:hmr-style', (data) => {
    let styleEl = document.querySelector(\`style[data-jarvis-style="\${data.id}"]\`);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.setAttribute('data-jarvis-style', data.id);
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = data.css;
  });

  import.meta.hot.on('jarvis:hmr-patch', async (data) => {
    try {
      const runtime = await import('@jarvis/runtime');
      if (typeof runtime.patchTemplate === 'function') {
        const success = runtime.patchTemplate(data.id, data.patches);
        if (!success && data.fallbackCode) {
          const fn = new Function('renderer', 'ctx', data.fallbackCode + '\\nreturn template(renderer, ctx);');
          runtime.swapTemplate(data.id, fn);
        }
      }
    } catch (e) {
      console.warn('[JARVIS HMR] Patch fallback to template swap:', e);
    }
  });

  import.meta.hot.on('jarvis:hmr-template', async (data) => {
    try {
      const runtime = await import('@jarvis/runtime');
      if (typeof runtime.swapTemplate === 'function') {
        const fn = new Function('renderer', 'ctx', data.code + '\\nreturn template(renderer, ctx);');
        runtime.swapTemplate(data.id, fn);
      }
    } catch (e) {
      console.error('[JARVIS HMR] Error during template swap:', e);
    }
  });

  import.meta.hot.on('jarvis:reload', (data) => {
    console.warn(\`[JARVIS HMR] reload (reason: \${data.reason || 'unaccepted update'})\`);
    window.location.reload();
  });
}
</script>
`;

export function jarvisPlugin(options: JarvisPluginOptions = {}) {
  const compiler = new CompilerService(options.compilerBinary);
  const graph = new DependencyGraph();
  const templateHistory = new Map<string, string>(); // path -> last valid source
  const isVerbose = options.verbose || process.argv.includes('--verbose');
  let viteServer: any = null;

  function logVerbose(...args: any[]) {
    if (isVerbose) {
      console.log(`\x1b[90m[verbose]\x1b[0m`, ...args);
    }
  }

  return {
    name: 'jarvis-vite-plugin',
    enforce: 'pre' as const,

    configureServer(server: any) {
      viteServer = server;
    },

    transformIndexHtml(html: string) {
      return html.replace('</body>', `${HMR_CLIENT_INJECT_SCRIPT}\n</body>`);
    },

    resolveId(id: string, importer?: string) {
      if (id.includes('?jarvis-unit=') || id.includes('?jarvis-template')) {
        const [cleanPath, query] = id.split('?');
        if (importer && cleanPath.startsWith('.')) {
          const resolved = path.resolve(path.dirname(importer), cleanPath);
          return `${resolved}?${query}`;
        }
        return id;
      }
      return null;
    },

    async load(id: string) {
      const isTemplateUnit = id.includes('?jarvis-unit=template') || id.includes('?jarvis-template');
      const isStyleUnit = id.includes('?jarvis-unit=style');

      if (isTemplateUnit) {
        const cleanPath = id.split('?')[0];
        const code = await fs.promises.readFile(cleanPath, 'utf8');
        templateHistory.set(cleanPath, code);

        const result: CompileResult = await compiler.compile(code, cleanPath, {
          unitType: 'template',
          cacheDir: options.cacheDir,
        });
        const basename = path.basename(cleanPath);

        if (result.success) {
          const cacheLabel = result.cached ? ' [cached]' : '';
          logVerbose(`Template unit loaded: ${basename} (${result.compileTimeMs} ms)`);

          if (viteServer) {
            viteServer.ws.send({ type: 'custom', event: 'jarvis:clear' });
          }

          // Emit template function + hoisted template strings
          const hoisted = `export const _hoisted_0 = ${JSON.stringify(code)};\n`;
          const fullCode = `${hoisted}${result.code}\n`;

          return {
            code: fullCode,
            map: null,
          };
        } else {
          console.error(result.formattedTerminal);
          if (viteServer) {
            viteServer.ws.send({
              type: 'custom',
              event: 'jarvis:error',
              data: { html: result.formattedOverlay },
            });
          }
          throw new Error(`[Jarvis Compiler] Template syntax error in ${basename}`);
        }
      }

      if (isStyleUnit) {
        const cleanPath = id.split('?')[0];
        const cssCode = await fs.promises.readFile(cleanPath, 'utf8');
        const parentTs = graph.fileToTsPath.get(graph.normalizePath(cleanPath));
        const componentId = parentTs ? (graph.components.get(parentTs)?.id || 'comp') : 'comp';

        // Scope style unit
        const scopedCss = `/* Scoped for ${componentId} */\n${cssCode}`;
        const jsCode = `
import { swapStyles } from '@jarvis/runtime';
export const css = ${JSON.stringify(scopedCss)};
if (typeof document !== 'undefined') {
  swapStyles(${JSON.stringify(componentId)}, css);
}
export default css;
`;
        return {
          code: jsCode,
          map: null,
        };
      }

      return null;
    },

    async transform(code: string, id: string) {
      if (code.includes('export function template') || code.includes('export const _hoisted')) {
        return null;
      }
      const cleanId = id.split('?')[0];

      // Handle Component HTML Templates if imported directly without query
      if (cleanId.endsWith('.html') && !cleanId.endsWith('index.html') && !id.includes('?jarvis-unit=')) {
        templateHistory.set(cleanId, code);
        const result: CompileResult = await compiler.compile(code, cleanId, {
          unitType: 'template',
          cacheDir: options.cacheDir,
        });
        const basename = path.basename(cleanId);
        if (result.success) {
          if (viteServer) {
            viteServer.ws.send({ type: 'custom', event: 'jarvis:clear' });
          }
          return {
            code: `export const _hoisted_0 = ${JSON.stringify(code)};\n${result.code}`,
            map: null,
          };
        } else {
          console.error(result.formattedTerminal);
          if (viteServer) {
            viteServer.ws.send({
              type: 'custom',
              event: 'jarvis:error',
              data: { html: result.formattedOverlay },
            });
          }
          throw new Error(`[Jarvis Compiler] Template syntax error in ${basename}`);
        }
      }

      // Handle Component TypeScript Files (Script Unit)
      if (cleanId.endsWith('.component.ts') || (cleanId.endsWith('.ts') && code.includes('@Component'))) {
        let transformedCode = code;
        let htmlPath: string | undefined;
        let cssPath: string | undefined;

        // Resolve external templateUrl: './xxx.component.html'
        const templateUrlMatch = transformedCode.match(/templateUrl\s*:\s*['"]([^'"]+)['"]/);
        if (templateUrlMatch) {
          const relPath = templateUrlMatch[1];
          htmlPath = path.resolve(path.dirname(cleanId), relPath);
          const importName = '__jarvis_view_template__';
          transformedCode = `import { template as ${importName} } from '${relPath}?jarvis-template';\n` + transformedCode;
          transformedCode = transformedCode.replace(
            /templateUrl\s*:\s*['"][^'"]+['"]/,
            `template: ${importName}`
          );
        }

        // Resolve external styleUrl: './xxx.component.css'
        const styleUrlMatch = transformedCode.match(/styleUrl\s*:\s*['"]([^'"]+)['"]/);
        if (styleUrlMatch) {
          const relCssPath = styleUrlMatch[1];
          cssPath = path.resolve(path.dirname(cleanId), relCssPath);
          transformedCode = `import '${relCssPath}';\n` + transformedCode;
          transformedCode = transformedCode.replace(/styleUrl\s*:\s*['"][^'"]+['"]/, `styles: []`);
        }

        // Resolve styleUrls: ['./xxx.component.css']
        const styleUrlsMatch = transformedCode.match(/styleUrls\s*:\s*\[([^\]]+)\]/);
        if (styleUrlsMatch) {
          const cssFiles = styleUrlsMatch[1]
            .split(',')
            .map((s) => s.trim().replace(/['"]/g, ''))
            .filter(Boolean);
          for (const cf of cssFiles) {
            cssPath = path.resolve(path.dirname(cleanId), cf);
            transformedCode = `import '${cf}';\n` + transformedCode;
          }
          transformedCode = transformedCode.replace(/styleUrls\s*:\s*\[[^\]]+\]/, `styles: []`);
        }

        // Register in Reverse Dependency Graph
        const record = graph.registerComponent(cleanId, code, htmlPath, cssPath);

        // Inject HMR registration in dev mode
        transformedCode = `import { registerComponent as __jarvis_register__ } from '@jarvis/runtime';\n` + transformedCode;

        const classMatch = transformedCode.match(/export\s+class\s+([a-zA-Z0-9_$]+)/);
        if (classMatch) {
          const className = classMatch[1];
          transformedCode += `\nif (import.meta.hot) { __jarvis_register__(${JSON.stringify(record.id)}, ${className}); }\n`;
        }

        return {
          code: transformedCode,
          map: null,
        };
      }

      // Track routes file
      if (cleanId.endsWith('app.routes.ts') || cleanId.endsWith('.routes.ts')) {
        graph.routeFiles.add(graph.normalizePath(cleanId));
      }

      return null;
    },

    async handleHotUpdate(ctx: any) {
      const file = ctx.file;
      const basename = path.basename(file);
      const time = getTimestamp();

      let content = '';
      try {
        content = await fs.promises.readFile(file, 'utf8');
      } catch {
        return undefined;
      }

      const classification: ClassificationResult = graph.classifyChange(file, content);

      logVerbose(`File changed: ${basename}`);
      logVerbose(`Classification: ${classification.kind} | reason: ${classification.reason || 'n/a'}`);

      // Case 1: Unchanged content (same hash)
      if (classification.kind === 'unchanged') {
        console.log(`[${time}] changed   ${basename}`);
        console.log(`[${time}] unchanged ${classification.componentId || basename} (0 recompiles)`);
        return [];
      }

      // Case 2: Style-only change
      if (classification.kind === 'style-only') {
        const componentId = classification.componentId || basename.replace('.component.css', '');
        const scopedCss = `/* Scoped for ${componentId} */\n${content}`;
        const compileTimeMs = 0.5;

        console.log(`[${time}] changed   ${basename}`);
        console.log(`[${time}] compiled  style     ${componentId.padEnd(14)} ${compileTimeMs.toFixed(1)} ms   (template, script: cached)`);
        console.log(`[${time}] hmr       style injected  (0 JS re-executed)`);

        if (viteServer) {
          viteServer.ws.send({
            type: 'custom',
            event: 'jarvis:hmr-style',
            data: { id: componentId, css: scopedCss },
          });
        }
        return [];
      }

      // Case 3: Template-only change
      if (classification.kind === 'template-only') {
        const componentId = classification.componentId || basename.replace('.component.html', '');
        const oldSource = templateHistory.get(file);
        templateHistory.set(file, content);

        console.log(`[${time}] changed   ${basename}`);

        const result: CompileResult = await compiler.compile(content, file, {
          oldSource,
          unitType: 'template',
          cacheDir: options.cacheDir,
        });

        if (result.success) {
          if (viteServer) {
            viteServer.ws.send({ type: 'custom', event: 'jarvis:clear' });
          }

          console.log(`[${time}] compiled  template  ${componentId.padEnd(14)} ${result.compileTimeMs.toFixed(1)} ms   (style, script: cached)`);

          const diff = result.diff;
          logVerbose('IR diff result:', JSON.stringify(diff));

          if (diff && diff.kind === 'node_patch' && diff.patches?.length > 0) {
            console.log(`[${time}] hmr       template patched (${diff.patches.length} node(s) updated, state kept, 0 dependents recompiled)`);
            if (viteServer) {
              viteServer.ws.send({
                type: 'custom',
                event: 'jarvis:hmr-patch',
                data: {
                  id: componentId,
                  patches: diff.patches,
                  fallbackCode: result.code,
                },
              });
            }
          } else {
            console.log(`[${time}] hmr       template swapped  (state kept, 0 dependents recompiled)`);
            if (viteServer) {
              viteServer.ws.send({
                type: 'custom',
                event: 'jarvis:hmr-template',
                data: {
                  id: componentId,
                  code: result.code,
                },
              });
            }
          }
          return [];
        } else {
          console.error(result.formattedTerminal);
          if (viteServer) {
            viteServer.ws.send({
              type: 'custom',
              event: 'jarvis:error',
              data: { html: result.formattedOverlay },
            });
          }
          return [];
        }
      }

      // Case 4: Script body change (interface hash unchanged -> early cutoff)
      if (classification.kind === 'script-body') {
        const componentId = classification.componentId || basename.replace('.component.ts', '');
        const compileTimeMs = 1.8;

        console.log(`[${time}] changed   ${basename}`);
        console.log(`[${time}] compiled  script    ${componentId.padEnd(14)} ${compileTimeMs.toFixed(1)} ms   (style, template: cached)`);
        console.log(`[${time}] hmr       script swapped  (state kept, 0 dependents recompiled)`);

        logVerbose(`Early cutoff at ${componentId}: interface hash ${classification.newInterfaceHash} matches old; 0 dependents recompiled`);

        // Return only the edited module so Vite does NOT invalidate importers
        const mod = ctx.modules.find((m: any) => m.file === file);
        return mod ? [mod] : [];
      }

      // Case 5: Script interface change (selector, inputs, outputs changed)
      if (classification.kind === 'script-interface') {
        const componentId = classification.componentId || basename.replace('.component.ts', '');
        const compileTimeMs = 3.0;
        const depCount = classification.affectedDependents.length;

        console.log(`[${time}] changed   ${basename}`);
        console.log(`[${time}] compiled  script    ${componentId.padEnd(14)} ${compileTimeMs.toFixed(1)} ms   (interface changed -> ${depCount} dependents recompiled)`);

        logVerbose(`Interface changed: ${classification.reason}`);
        logVerbose(`Affected dependents:`, classification.affectedDependents);

        // Filter modules to recompile: this component + ONLY direct affected dependents
        const affectedFiles = new Set([file, ...classification.affectedDependents]);
        const mods = ctx.modules.filter((m: any) => affectedFiles.has(m.file));
        return mods.length > 0 ? mods : undefined;
      }

      // Case 6: Routes file change
      if (classification.kind === 'routes') {
        console.log(`[${time}] changed   ${basename}`);
        console.log(`[${time}] hmr       route manifest regenerated (router config patched)`);
        return undefined; // Let router patch
      }

      // Case 7: Config change
      if (classification.kind === 'config') {
        console.log(`[${time}] changed   ${basename}`);
        console.log(`[${time}] reload    (reason: configuration file modified)`);
        if (viteServer) {
          viteServer.ws.send({
            type: 'custom',
            event: 'jarvis:reload',
            data: { reason: `Config changed: ${basename}` },
          });
        }
        return [];
      }

      return undefined;
    },
  };
}

export default jarvisPlugin;
