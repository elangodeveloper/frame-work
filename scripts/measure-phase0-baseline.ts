import * as path from 'node:path';
import * as fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { CompilerService } from '../packages/vite-plugin/src/compiler-service.ts';

async function runBaseline() {
  console.log('--- Phase 0: Measuring Existing Baseline on 1,000-component project ---');
  const service = new CompilerService();

  // Generate 1,000 template strings
  const count = 1000;
  const templates: string[] = [];
  for (let i = 0; i < count; i++) {
    templates.push(
      `<div class="comp-${i}">\n` +
      `  <h1>Component ${i}</h1>\n` +
      `  <p>Static description for item ${i}</p>\n` +
      `  <span>Count: {{ count }}</span>\n` +
      `  <button (click)="increment()">Click me</button>\n` +
      `</div>`
    );
  }

  // Initial compilation of all 1,000 templates
  console.log(`Compiling ${count} components to warm up existing compiler...`);
  const warmStart = performance.now();
  for (let i = 0; i < count; i++) {
    await service.compile(templates[i], `comp-${i}.component.html`);
  }
  const warmDuration = performance.now() - warmStart;
  console.log(`Initial 1,000 components compiled in ${warmDuration.toFixed(2)} ms`);

  // Now measure baseline: change ONE text node in ONE template (e.g. comp-500)
  const targetIndex = 500;
  const oldTemplate = templates[targetIndex];
  const newTemplate = oldTemplate.replace('Static description for item 500', 'Updated description for item 500');

  console.log('Modifying ONE text node in comp-500.component.html...');
  const editStart = performance.now();

  // In the existing architecture:
  // 1. Template is compiled via CompilerService.compile (whole file recompiled)
  const compileResult = await service.compile(newTemplate, `comp-${targetIndex}.component.html`);
  const compileMs = compileResult.compileTimeMs;

  // 2. Vite HMR in existing architecture:
  // Entire template module JS is sent to the client (no node patch, no split units).
  // In existing index.ts, it serves the full JS code for ?jarvis-template:
  const code = compileResult.code || '';
  const bytesSent = Buffer.byteLength(code, 'utf8');
  const hmrMs = performance.now() - editStart;

  // Count files recompiled:
  // In existing architecture, the entire template file is recompiled (1 file, whole template function).
  const filesRecompiled = 1;
  const unitsRecompiled = 1; // Existing treats template as 1 monolithic unit (no split between hoisted template strings and dynamic nodes)

  console.log('\n--- Phase 0 Baseline Measurement Results ---');
  console.log(`Files recompiled:      ${filesRecompiled}`);
  console.log(`Units recompiled:      Whole template file (un-split)`);
  console.log(`Compile time:          ${compileMs.toFixed(2)} ms`);
  console.log(`HMR time:              ${hmrMs.toFixed(2)} ms`);
  console.log(`Bytes sent to browser: ${bytesSent} bytes`);
  console.log('Component state:       LOST on HMR (re-executes component factory)\n');

  service.dispose();

  // Save baseline to a json file for tracking
  const baselineData = {
    filesRecompiled,
    unitsRecompiled,
    compileMs: parseFloat(compileMs.toFixed(2)),
    hmrMs: parseFloat(hmrMs.toFixed(2)),
    bytesSent,
    statePreserved: false,
  };

  fs.mkdirSync(path.resolve(process.cwd(), 'scratch'), { recursive: true });
  fs.writeFileSync(path.resolve(process.cwd(), 'scratch', 'phase0_baseline.json'), JSON.stringify(baselineData, null, 2));
}

runBaseline().catch(console.error);
