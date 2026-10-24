import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DependencyGraph, computeHash } from '../../compiler-runtime/src/dependency-graph.ts';

describe('Milestone 17: Incremental Compilation for Layouts & Screens', () => {
  it('modifying sidebar CSS should invalidate only style stage without recompiling screen templates', () => {
    const graph = new DependencyGraph();

    // 1. Layout nodes & edges
    graph.addNode('src/layouts/main-layout.component.ts', 'typescript', computeHash('export class MainLayoutComponent {}'));
    graph.addNode('src/layouts/main-layout.component.html', 'template', computeHash('<div class="app-shell"><slot name="content"></slot></div>'));
    graph.addNode('src/layouts/main-layout.component.css', 'style', computeHash('.app-shell { display: flex; }'));

    graph.addEdge('src/layouts/main-layout.component.ts', 'src/layouts/main-layout.component.html');
    graph.addEdge('src/layouts/main-layout.component.ts', 'src/layouts/main-layout.component.css');

    // 2. Sidebar component
    graph.addNode('src/components/sidebar.component.ts', 'typescript', computeHash('export class SidebarComponent {}'));
    graph.addNode('src/components/sidebar.component.html', 'template', computeHash('<aside class="sidebar"><nav></nav></aside>'));
    graph.addNode('src/components/sidebar.component.css', 'style', computeHash('.sidebar { width: 260px; }'));

    graph.addEdge('src/components/sidebar.component.ts', 'src/components/sidebar.component.html');
    graph.addEdge('src/components/sidebar.component.ts', 'src/components/sidebar.component.css');
    graph.addEdge('src/layouts/main-layout.component.ts', 'src/components/sidebar.component.ts');

    // 3. Independent Feature Screen (Dashboard)
    graph.addNode('src/features/dashboard/dashboard.page.ts', 'typescript', computeHash('export class DashboardPage {}'));
    graph.addNode('src/features/dashboard/dashboard.page.html', 'template', computeHash('<div class="dashboard"><h1>KPIs</h1></div>'));
    graph.addNode('src/features/dashboard/dashboard.page.css', 'style', computeHash('.dashboard { padding: 1rem; }'));

    graph.addEdge('src/features/dashboard/dashboard.page.ts', 'src/features/dashboard/dashboard.page.html');
    graph.addEdge('src/features/dashboard/dashboard.page.ts', 'src/features/dashboard/dashboard.page.css');

    // Modifying ONLY sidebar CSS:
    const plan = graph.computeInvalidationPlan(
      'src/components/sidebar.component.css',
      '.sidebar { width: 280px; background: #fff; }'
    );

    assert.equal(plan.changeKind, 'css-only');
    assert.equal(plan.requiresFullRebuild, false);

    // CSS file and parent TS component get style stage invalidated
    const cssStages = plan.recompilationStages.get('src/components/sidebar.component.css');
    assert.ok(cssStages?.has('style'));
    assert.equal(cssStages?.has('template'), false);
    assert.equal(cssStages?.has('typescript'), false);
    assert.equal(cssStages?.has('codegen'), false);

    // Dashboard page templates and ts files are completely untouched
    assert.equal(plan.recompilationStages.has('src/features/dashboard/dashboard.page.ts'), false);
    assert.equal(plan.recompilationStages.has('src/features/dashboard/dashboard.page.html'), false);
    assert.equal(plan.recompilationStages.has('src/features/dashboard/dashboard.page.css'), false);
  });
});
