import { performance } from 'node:perf_hooks';
import { IncrementalCompiler } from '../packages/compiler-runtime/src/incremental-compiler.ts';
import { signal, computed, effect, batch } from '../packages/reactive/src/index.ts';
import { TestRenderer } from '../packages/renderer/src/test_renderer.ts';
import { reconcileKeyedList } from '../packages/renderer/src/keyed_reconciler.ts';

async function runBenchmarks() {
  console.log('===============================================================');
  console.log('       JARVIS HIGH-PERFORMANCE BENCHMARK SUITE');
  console.log('===============================================================\n');

  // 1. RUNTIME REACTIVITY BENCHMARKS
  console.log('--- 1. RUNTIME REACTIVE ENGINE BENCHMARKS ---');
  const signalIterations = 100_000;
  const s = signal(0);
  const c = computed(() => s() * 2);

  // Measure Signal write/read latency
  const sigStart = performance.now();
  for (let i = 0; i < signalIterations; i++) {
    s.set(i);
    const _ = s();
  }
  const sigEnd = performance.now();
  const sigTime = sigEnd - sigStart;
  const sigOpsPerSec = Math.round((signalIterations / sigTime) * 1000);
  console.log(`[Signal Write + Read] ${signalIterations} iterations: ${sigTime.toFixed(2)} ms (${sigOpsPerSec.toLocaleString()} ops/sec)`);

  // Measure Computed memoization latency
  const compStart = performance.now();
  for (let i = 0; i < signalIterations; i++) {
    const _ = c(); // memoized read without dirty signal
  }
  const compEnd = performance.now();
  const compTime = compEnd - compStart;
  console.log(`[Computed Memoized Read] ${signalIterations} reads: ${compTime.toFixed(2)} ms (${Math.round((signalIterations / compTime) * 1000).toLocaleString()} ops/sec)`);

  // Measure Batch Deduplication
  let effectRuns = 0;
  const batchedSignal = signal(0);
  const disposeEffect = effect(() => {
    batchedSignal();
    effectRuns++;
  });
  effectRuns = 0; // reset initial run

  const batchSize = 10_000;
  const batchStart = performance.now();
  batch(() => {
    for (let i = 0; i < batchSize; i++) {
      batchedSignal.set(i);
    }
  });
  const batchEnd = performance.now();
  disposeEffect();
  console.log(`[Batch Scheduler] ${batchSize} signal mutations in 1 batch -> effect executed exactly ${effectRuns} time(s) (${(batchEnd - batchStart).toFixed(2)} ms)`);

  // 2. KEYED LIST RECONCILIATION BENCHMARKS
  console.log('\n--- 2. KEYED LIST RECONCILIATION BENCHMARKS ---');
  const renderer = new TestRenderer();
  const parent = renderer.createElement('div');
  const listSize = 5_000;

  interface Item {
    id: number;
    text: string;
  }
  const initialItems: Item[] = Array.from({ length: listSize }, (_, i) => ({ id: i, text: `Item #${i}` }));

  // Initial population
  const popStart = performance.now();
  let { nextRecords } = reconcileKeyedList(
    renderer,
    parent,
    [],
    initialItems,
    (it) => it.id,
    (it) => renderer.createElement('span')
  );
  const popEnd = performance.now();
  console.log(`[Keyed List Initial Population] ${listSize} nodes: ${(popEnd - popStart).toFixed(2)} ms`);

  // Reverse list
  const reversedItems = [...initialItems].reverse();
  const revStart = performance.now();
  const revRes = reconcileKeyedList(
    renderer,
    parent,
    nextRecords,
    reversedItems,
    (it) => it.id,
    (it) => renderer.createElement('span')
  );
  const revEnd = performance.now();
  nextRecords = revRes.nextRecords;
  console.log(`[Keyed List Reverse] ${listSize} nodes: ${(revEnd - revStart).toFixed(2)} ms (created: ${revRes.stats.createdCount}, removed: ${revRes.stats.removedCount}, moved: ${revRes.stats.movedCount})`);

  // Prefix/Suffix Partial Replace (middle 100 items replaced)
  const partialItems = [...reversedItems];
  for (let i = 2400; i < 2500; i++) {
    partialItems[i] = { id: 90000 + i, text: `Replaced #${i}` };
  }
  const partStart = performance.now();
  const partRes = reconcileKeyedList(
    renderer,
    parent,
    nextRecords,
    partialItems,
    (it) => it.id,
    (it) => renderer.createElement('span')
  );
  const partEnd = performance.now();
  console.log(`[Keyed List Partial Middle Swap] 100 / ${listSize} items: ${(partEnd - partStart).toFixed(2)} ms (preservedPrefix: ${partRes.stats.preservedPrefixCount}, preservedSuffix: ${partRes.stats.preservedSuffixCount})`);

  // 3. INCREMENTAL COMPILATION BENCHMARKS
  console.log('\n--- 3. INCREMENTAL COMPILER BENCHMARKS ---');
  const compiler = new IncrementalCompiler();
  const projectFiles = new Map<string, string>();

  // Setup simulated 50-component project
  const componentCount = 50;
  for (let i = 1; i <= componentCount; i++) {
    const tsPath = `src/components/comp-${i}.component.ts`;
    const htmlPath = `src/components/comp-${i}.component.html`;
    const cssPath = `src/components/comp-${i}.component.css`;

    projectFiles.set(tsPath, `export class Comp${i} { title = "Comp ${i}"; }`);
    projectFiles.set(htmlPath, `<div><h3>{{title}}</h3></div>`);
    projectFiles.set(cssPath, `.comp-${i} { color: blue; }`);

    compiler.registerFile(tsPath, projectFiles.get(tsPath)!, [htmlPath, cssPath]);
    compiler.registerFile(htmlPath, projectFiles.get(htmlPath)!);
    compiler.registerFile(cssPath, projectFiles.get(cssPath)!);
  }

  // Cold build (first compilation pass)
  const coldStart = performance.now();
  for (let i = 1; i <= componentCount; i++) {
    compiler.compileStage(`src/components/comp-${i}.component.ts`, projectFiles.get(`src/components/comp-${i}.component.ts`)!, 'typescript');
    compiler.compileStage(`src/components/comp-${i}.component.html`, projectFiles.get(`src/components/comp-${i}.component.html`)!, 'template');
    compiler.compileStage(`src/components/comp-${i}.component.css`, projectFiles.get(`src/components/comp-${i}.component.css`)!, 'style');
  }
  const coldEnd = performance.now();
  console.log(`[Cold Compilation] Full 50-component project (150 stages): ${(coldEnd - coldStart).toFixed(2)} ms`);

  // Incremental CSS Edit (1 file changed)
  const cssChangeStart = performance.now();
  const cssRes = compiler.processFileChange(
    'src/components/comp-25.component.css',
    '.comp-25 { color: red; font-size: 16px; }',
    projectFiles
  );
  const cssChangeEnd = performance.now();
  console.log(`[Incremental CSS Edit] 1 CSS file changed: ${(cssChangeEnd - cssChangeStart).toFixed(2)} ms (recompiled: ${cssRes.recompiledCount}, reused: ${cssRes.reusedFromCacheCount})`);

  // Incremental HTML Template Edit (1 file changed)
  const htmlChangeStart = performance.now();
  const htmlRes = compiler.processFileChange(
    'src/components/comp-25.component.html',
    '<div><h3>{{title}}</h3><span>Updated!</span></div>',
    projectFiles
  );
  const htmlChangeEnd = performance.now();
  console.log(`[Incremental Template Edit] 1 Template changed: ${(htmlChangeEnd - htmlChangeStart).toFixed(2)} ms (recompiled: ${htmlRes.recompiledCount}, reused: ${htmlRes.reusedFromCacheCount})`);

  // Incremental TS Implementation Edit (1 internal method changed)
  const tsChangeStart = performance.now();
  const tsRes = compiler.processFileChange(
    'src/components/comp-25.component.ts',
    'export class Comp25 { title = "Comp 25"; private secret = 42; }',
    projectFiles
  );
  const tsChangeEnd = performance.now();
  console.log(`[Incremental TS Impl Edit] 1 Private TS implementation changed: ${(tsChangeEnd - tsChangeStart).toFixed(2)} ms (recompiled: ${tsRes.recompiledCount}, reused: ${tsRes.reusedFromCacheCount})`);

  // Unmodified Touch (zero changes)
  const noopStart = performance.now();
  const noopRes = compiler.processFileChange(
    'src/components/comp-25.component.ts',
    'export class Comp25 { title = "Comp 25"; private secret = 42; }',
    projectFiles
  );
  const noopEnd = performance.now();
  console.log(`[Unmodified Touch] zero-op check: ${(noopEnd - noopStart).toFixed(2)} ms (recompiled: ${noopRes.recompiledCount})`);

  // Peak memory measurement
  const mem = process.memoryUsage();
  console.log(`\n[Peak Memory Usage] Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB, RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log('\n===============================================================');
  console.log('       BENCHMARKS COMPLETED SUCCESSFULLY');
  console.log('===============================================================\n');
}

runBenchmarks().catch(console.error);
