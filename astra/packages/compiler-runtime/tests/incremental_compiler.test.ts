import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DependencyGraph,
  computeHash,
  extractPublicContract,
} from '../src/dependency-graph.ts';
import { CompilerCache } from '../src/compiler-cache.ts';
import { IncrementalCompiler } from '../src/incremental-compiler.ts';
import { ParallelCompiler } from '../src/parallel-compiler.ts';
import { DevServerCoordinator } from '../src/dev-server.ts';

describe('JARVIS Incremental Compiler & Dependency Graph Architecture', () => {
  it('should construct dependency graph and handle dependency cycles safely', () => {
    const graph = new DependencyGraph();

    graph.addNode('src/main.ts', 'typescript', computeHash('main content'));
    graph.addNode('src/app.component.ts', 'typescript', computeHash('app component'));
    graph.addNode('src/user.component.ts', 'typescript', computeHash('user component'));

    // main -> app -> user -> app (cycle)
    graph.addEdge('src/main.ts', 'src/app.component.ts');
    graph.addEdge('src/app.component.ts', 'src/user.component.ts');
    graph.addEdge('src/user.component.ts', 'src/app.component.ts'); // cycle!

    assert.strictEqual(graph.getNodeCount(), 3);
    assert.strictEqual(graph.getEdgeCount(), 3);

    // Topological sort must break cycle deterministically without infinite loop or crash
    const sorted = graph.topologicalSort();
    assert.strictEqual(sorted.length, 3);
  });

  it('Scenario A: CSS-only modification invalidates only style stage', () => {
    const graph = new DependencyGraph();

    graph.addNode('src/user.component.ts', 'typescript', computeHash('class User {}'));
    graph.addNode('src/user.component.html', 'template', computeHash('<div>user</div>'));
    graph.addNode('src/user.component.css', 'style', computeHash('.btn { color: red; }'));

    graph.addEdge('src/user.component.ts', 'src/user.component.html');
    graph.addEdge('src/user.component.ts', 'src/user.component.css');

    // Change CSS content
    const plan = graph.computeInvalidationPlan('src/user.component.css', '.btn { color: blue; }');

    assert.strictEqual(plan.changeKind, 'css-only');
    assert.strictEqual(plan.requiresFullRebuild, false);

    // CSS file and parent TS component get style stage invalidated
    const cssStages = plan.recompilationStages.get('src/user.component.css');
    assert.ok(cssStages?.has('style'));
    assert.strictEqual(cssStages?.has('template'), false);
    assert.strictEqual(cssStages?.has('typescript'), false);

    const tsStages = plan.recompilationStages.get('src/user.component.ts');
    assert.ok(tsStages?.has('style'));
    assert.strictEqual(tsStages?.has('template'), false);
  });

  it('Scenario B: Template-only modification invalidates only template & codegen stages', () => {
    const graph = new DependencyGraph();

    graph.addNode('src/user.component.ts', 'typescript', computeHash('class User {}'));
    graph.addNode('src/user.component.html', 'template', computeHash('<div>Hello</div>'));
    graph.addNode('src/user.component.css', 'style', computeHash('.user {}'));

    graph.addEdge('src/user.component.ts', 'src/user.component.html');
    graph.addEdge('src/user.component.ts', 'src/user.component.css');

    // Change HTML template
    const plan = graph.computeInvalidationPlan('src/user.component.html', '<div>Hello World!</div>');

    assert.strictEqual(plan.changeKind, 'template-only');
    assert.strictEqual(plan.requiresFullRebuild, false);

    const htmlStages = plan.recompilationStages.get('src/user.component.html');
    assert.ok(htmlStages?.has('template'));
    assert.ok(htmlStages?.has('codegen'));
    assert.strictEqual(htmlStages?.has('style'), false);
  });

  it('Scenario C: TypeScript implementation change stops propagation to consumers', () => {
    const graph = new DependencyGraph();

    const oldService = `
      export class UserService {
        getUser(id: string) {
          return { id, name: 'Alice' };
        }
      }
    `;
    const oldSig = extractPublicContract(oldService);

    graph.addNode('src/user.service.ts', 'typescript', computeHash(oldService), computeHash(oldSig));
    graph.addNode('src/app.component.ts', 'typescript', computeHash('import { UserService } from "./user.service";'));
    graph.addEdge('src/app.component.ts', 'src/user.service.ts');

    // Only internal logic inside method body changed: public signature remains identical
    const newService = `
      export class UserService {
        getUser(id: string) {
          const cached = true;
          return { id, name: 'Alice', cached };
        }
      }
    `;

    const plan = graph.computeInvalidationPlan('src/user.service.ts', newService);

    assert.strictEqual(plan.changeKind, 'ts-impl');
    // Service itself is invalidated, but app.component consumer is NOT invalidated!
    assert.ok(plan.affectedNodes.includes('src/user.service.ts'));
    assert.strictEqual(plan.affectedNodes.includes('src/app.component.ts'), false);
  });

  it('Scenario D: TypeScript public contract change propagates to consumers', () => {
    const graph = new DependencyGraph();

    const oldComp = `
      export class UserCard {
        @Input() userId = '';
      }
    `;
    const oldSig = extractPublicContract(oldComp);

    graph.addNode('src/user-card.component.ts', 'typescript', computeHash(oldComp), computeHash(oldSig));
    graph.addNode('src/dashboard.component.ts', 'typescript', computeHash('class Dashboard {}'));
    graph.addEdge('src/dashboard.component.ts', 'src/user-card.component.ts');

    // Contract changed: added new required @Input
    const newComp = `
      export class UserCard {
        @Input() userId = '';
        @Input() permissions = [];
      }
    `;

    const plan = graph.computeInvalidationPlan('src/user-card.component.ts', newComp);

    assert.strictEqual(plan.changeKind, 'ts-public-contract');
    // Invalidation propagated to dashboard consumer
    assert.ok(plan.affectedNodes.includes('src/user-card.component.ts'));
    assert.ok(plan.affectedNodes.includes('src/dashboard.component.ts'));
  });

  it('Scenario E: Compiler configuration change triggers full rebuild', () => {
    const graph = new DependencyGraph();

    graph.addNode('src/app.ts', 'typescript', computeHash('app'));
    graph.addNode('src/user.ts', 'typescript', computeHash('user'));

    const plan = graph.computeInvalidationPlan('jarvis.config.ts', 'export default { minify: true };');

    assert.strictEqual(plan.changeKind, 'config');
    assert.strictEqual(plan.requiresFullRebuild, true);
    assert.strictEqual(plan.affectedNodes.length, 2);
  });

  it('should preserve output files and prevent redundant disk rewrites', () => {
    const tmpDir = path.resolve(process.cwd(), 'scratch', 'cache-test');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const testFile = path.join(tmpDir, 'preserved-output.js');
    const cache = new CompilerCache();

    // First write
    const write1 = cache.writeIfChanged(testFile, 'console.log("hello");');
    assert.strictEqual(write1, true);

    // Second write with identical content
    const write2 = cache.writeIfChanged(testFile, 'console.log("hello");');
    assert.strictEqual(write2, false, 'Should preserve file and skip write');

    // Third write with new content
    const write3 = cache.writeIfChanged(testFile, 'console.log("world");');
    assert.strictEqual(write3, true, 'Should write changed content');

    const stats = cache.getStats();
    assert.strictEqual(stats.writes, 2);
    assert.strictEqual(stats.preservations, 1);
  });

  it('should classify HMR updates and debounce rapid events in DevServerCoordinator', async () => {
    const compiler = new IncrementalCompiler();
    const server = new DevServerCoordinator(compiler, { debounceMs: 10 });

    const allFiles = new Map<string, string>();
    allFiles.set('src/user.css', '.card { padding: 1rem; }');
    compiler.registerFile('src/user.css', allFiles.get('src/user.css')!);

    const receivedUpdates: string[] = [];
    server.onUpdate((payload) => {
      receivedUpdates.push(payload.type);
    });

    const payload = await server.queueFileChange(
      'src/user.css',
      '.card { padding: 2rem; }',
      allFiles
    );

    assert.ok(payload);
    assert.strictEqual(payload?.type, 'css');
    assert.strictEqual(receivedUpdates[0], 'css');
  });

  it('should partition independent dependency graph nodes into parallel waves', () => {
    const graph = new DependencyGraph();
    const parallel = new ParallelCompiler(2);

    // Two independent branches converging on root
    graph.addNode('src/leaf-a.ts', 'typescript', 'hashA');
    graph.addNode('src/leaf-b.ts', 'typescript', 'hashB');
    graph.addNode('src/root.ts', 'typescript', 'hashRoot');

    graph.addEdge('src/root.ts', 'src/leaf-a.ts');
    graph.addEdge('src/root.ts', 'src/leaf-b.ts');

    const layers = parallel.partitionIntoIndependentLayers(graph, [
      'src/root.ts',
      'src/leaf-a.ts',
      'src/leaf-b.ts',
    ]);

    // Layer 0: leaf-a and leaf-b (independent)
    // Layer 1: root
    assert.strictEqual(layers.length, 2);
    assert.ok(layers[0].includes('src/leaf-a.ts'));
    assert.ok(layers[0].includes('src/leaf-b.ts'));
    assert.deepStrictEqual(layers[1], ['src/root.ts']);
  });
});
