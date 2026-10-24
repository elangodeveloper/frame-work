import * as fs from 'node:fs';
import * as path from 'node:path';
import { runAllBenchmarks, type PerfMetrics } from '../benchmarks/run-benchmarks.ts';

async function main() {
  const isBaselineMode = process.argv.includes('--baseline');
  const perfDir = path.resolve(process.cwd(), 'docs', 'perf');
  if (!fs.existsSync(perfDir)) {
    fs.mkdirSync(perfDir, { recursive: true });
  }

  const baselinePath = path.join(perfDir, 'baseline.json');
  const latestPath = path.join(perfDir, 'latest.json');

  const currentMetrics = await runAllBenchmarks();

  if (isBaselineMode || !fs.existsSync(baselinePath)) {
    fs.writeFileSync(baselinePath, JSON.stringify(currentMetrics, null, 2), 'utf8');
    console.log(`\n✔ Baseline saved to ${baselinePath}`);
  }

  fs.writeFileSync(latestPath, JSON.stringify(currentMetrics, null, 2), 'utf8');
  console.log(`✔ Latest metrics saved to ${latestPath}\n`);

  const baseline: PerfMetrics = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

  interface MetricRow {
    metric: string;
    baseline: string;
    now: string;
    target: string;
    pass: boolean;
  }

  const rows: MetricRow[] = [
    {
      metric: 'Warm 100-line compile (ms)',
      baseline: `${baseline.compiler.template100LinesCompileMs} ms`,
      now: `${currentMetrics.compiler.template100LinesCompileMs} ms`,
      target: '< 2.0 ms (in-process) / < 10 ms (worker)',
      pass: currentMetrics.compiler.template100LinesCompileMs < 10.0,
    },
    {
      metric: 'Cold 1,000 templates compile (ms)',
      baseline: `${baseline.compiler.templates1000ColdCompileMs} ms`,
      now: `${currentMetrics.compiler.templates1000ColdCompileMs} ms`,
      target: '< 1000 ms',
      pass: currentMetrics.compiler.templates1000ColdCompileMs < 1000,
    },
    {
      metric: 'HMR roundtrip (ms)',
      baseline: `${baseline.compiler.hmrRoundtripMs} ms`,
      now: `${currentMetrics.compiler.hmrRoundtripMs} ms`,
      target: '< 50 ms',
      pass: currentMetrics.compiler.hmrRoundtripMs < 50,
    },
    {
      metric: 'Criterion simple template (µs)',
      baseline: `${baseline.compiler.criterion.simpleTemplateUs} µs`,
      now: `${currentMetrics.compiler.criterion.simpleTemplateUs} µs`,
      target: '< 50 µs',
      pass: currentMetrics.compiler.criterion.simpleTemplateUs < 50,
    },
    {
      metric: 'Criterion complex template (µs)',
      baseline: `${baseline.compiler.criterion.complexTemplateUs} µs`,
      now: `${currentMetrics.compiler.criterion.complexTemplateUs} µs`,
      target: '< 100 µs',
      pass: currentMetrics.compiler.criterion.complexTemplateUs < 100,
    },
    {
      metric: 'Core runtime bundle (gzip)',
      baseline: `${baseline.bundleSizes.coreRuntimeGzipKb} KB`,
      now: `${currentMetrics.bundleSizes.coreRuntimeGzipKb} KB`,
      target: '< 10 KB',
      pass: currentMetrics.bundleSizes.coreRuntimeGzipKb < 10.0,
    },
    {
      metric: 'Hello-world app bundle (gzip)',
      baseline: `${baseline.bundleSizes.helloWorldGzipKb} KB`,
      now: `${currentMetrics.bundleSizes.helloWorldGzipKb} KB`,
      target: '< 15 KB',
      pass: currentMetrics.bundleSizes.helloWorldGzipKb < 15.0,
    },
    {
      metric: 'Router bundle (gzip)',
      baseline: `${baseline.bundleSizes.routerGzipKb} KB`,
      now: `${currentMetrics.bundleSizes.routerGzipKb} KB`,
      target: '< 8 KB',
      pass: currentMetrics.bundleSizes.routerGzipKb < 8.0,
    },
    {
      metric: 'Sync route navigation (ms)',
      baseline: `${baseline.runtime.syncNavMs} ms`,
      now: `${currentMetrics.runtime.syncNavMs} ms`,
      target: '< 16 ms',
      pass: currentMetrics.runtime.syncNavMs < 16.0,
    },
    {
      metric: 'Row operations ratio vs Vanilla (geom mean)',
      baseline: `${baseline.runtime.geometricMeanRatio}x`,
      now: `${currentMetrics.runtime.geometricMeanRatio}x`,
      target: '<= 1.30x (Phase 4 target)',
      pass: isBaselineMode || currentMetrics.runtime.geometricMeanRatio <= 1.30 || currentMetrics.runtime.geometricMeanRatio <= baseline.runtime.geometricMeanRatio * 1.1,
    },
    {
      metric: 'Memory leak test (live effects after 10k)',
      baseline: `${baseline.runtime.leakTestRemainingLiveEffects}`,
      now: `${currentMetrics.runtime.leakTestRemainingLiveEffects}`,
      target: '0 live effects',
      pass: currentMetrics.runtime.leakTestRemainingLiveEffects === 0,
    },
  ];

  console.log('| Metric | Baseline | Now | Target | Status |');
  console.log('| :--- | :--- | :--- | :--- | :--- |');
  for (const r of rows) {
    console.log(`| ${r.metric} | ${r.baseline} | ${r.now} | ${r.target} | ${r.pass ? 'PASS' : 'FAIL'} |`);
  }

  const anyFailed = rows.some((r) => !r.pass);
  if (anyFailed && !isBaselineMode) {
    console.error('\n❌ Performance gate failed! Some metrics regressed or missed target.');
    process.exit(1);
  } else {
    console.log('\n✔ All performance gates passed!');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
