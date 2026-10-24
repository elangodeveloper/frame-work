import * as esbuild from 'esbuild';
import * as zlib from 'node:zlib';
import * as path from 'node:path';

async function measure(name, entryCode) {
  const res = await esbuild.build({
    stdin: {
      contents: entryCode,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    minify: true,
    treeShaking: true,
    format: 'esm',
    write: false,
    plugins: [
      {
        name: 'aliases',
        setup(build) {
          build.onResolve({ filter: /^@jarvis\// }, args => {
            const pkg = args.path.replace('@jarvis/', '');
            return { path: path.resolve('packages', pkg, 'src', 'index.ts') };
          });
        }
      }
    ]
  });
  const code = res.outputFiles[0].text;
  const rawSize = Buffer.byteLength(code);
  const gzipSize = zlib.gzipSync(code, { level: 9 }).byteLength;
  console.log(`${name}: raw = ${rawSize} B, gzip = ${gzipSize} B (${(gzipSize / 1024).toFixed(2)} KB)`);
  return { rawSize, gzipSize };
}

async function run() {
  await measure('Core runtime alone', `
    import { signal, computed, effect } from '@jarvis/reactive';
    import { Component, inject } from '@jarvis/core';
    import { DOMRenderer } from '@jarvis/renderer';
    import { bootstrapApplication } from '@jarvis/runtime';
    export { signal, computed, effect, Component, inject, DOMRenderer, bootstrapApplication };
  `);

  await measure('Hello-world app', `
    import { Component } from '@jarvis/core';
    import { bootstrapApplication } from '@jarvis/runtime';
    class App {}
    bootstrapApplication(App);
  `);

  await measure('Router alone', `
    import * as router from '@jarvis/router';
    export default router;
  `);
}

run().catch(console.error);
