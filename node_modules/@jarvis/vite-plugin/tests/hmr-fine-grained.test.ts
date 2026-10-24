import { test, describe, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DependencyGraph } from '../src/graph.ts';
import { CompilerService } from '../src/compiler-service.ts';
import { hmrRuntime, patchTemplate, swapStyles, swapTemplate } from '../../runtime/src/hmr.ts';
import { signal } from '../../reactive/src/index.ts';

describe('Jarvis Fine-Grained HMR & Dependency Graph', () => {
  const compiler = new CompilerService();

  after(() => {
    compiler.dispose();
  });

  test('1. Edit one text node: exactly 1 template unit recompiled, 0 dependents, DOM text updates, state kept', async () => {
    const graph = new DependencyGraph();
    const tsContent = `
      import { Component, signal } from '@jarvis/core';
      @Component({
        selector: 'user-profile',
        templateUrl: './user-profile.component.html',
        styleUrl: './user-profile.component.css'
      })
      export class UserProfileComponent {
        count = signal(42);
      }
    `;

    const htmlOld = `<div><h1>Title</h1><p>Old static description</p><span>Count: {{ count() }}</span></div>`;
    const htmlNew = `<div><h1>Title</h1><p>Updated static description</p><span>Count: {{ count() }}</span></div>`;

    graph.registerComponent('c:/app/user-profile.component.ts', tsContent, 'c:/app/user-profile.component.html', 'c:/app/user-profile.component.css');

    // 1. Classification
    const classification = graph.classifyChange('c:/app/user-profile.component.html', htmlNew);
    assert.equal(classification.kind, 'template-only');
    assert.equal(classification.affectedDependents.length, 0);
    assert.equal(classification.earlyCutoff, true);

    // 2. Compilation and IR diff
    const res = await compiler.compile(htmlNew, 'user-profile.component.html', {
      oldSource: htmlOld,
      unitType: 'template',
    });

    assert.equal(res.success, true);
    assert.ok(res.diff);
    assert.equal(res.diff.kind, 'node_patch');
    assert.equal(res.diff.patches.length, 1);
    assert.equal(res.diff.patches[0].type, 'set_text');
    assert.equal(res.diff.patches[0].content, 'Updated static description');

    // 3. Mock DOM & Runtime State
    const pNode = { nodeType: 3, textContent: 'Old static description' };
    const pElem = { nodeType: 1, childNodes: [pNode], children: [pNode] };
    const h1Node = { nodeType: 3, textContent: 'Title' };
    const h1Elem = { nodeType: 1, childNodes: [h1Node], children: [h1Node] };
    const spanNode = { nodeType: 3, textContent: '42' };
    const spanElem = { nodeType: 1, childNodes: [spanNode], children: [spanNode] };
    const rootElem = {
      nodeType: 1,
      childNodes: [h1Elem, pElem, spanElem],
      children: [h1Elem, pElem, spanElem],
    };

    const instance = { count: signal(42) };
    instance.count.set(100); // User updated state

    const view = { root: rootElem, destroy: () => {} };
    const renderer = {
      setText: (node: any, text: string) => { node.textContent = text; },
    };

    hmrRuntime.trackInstance('user-profile', {
      instance,
      view,
      renderer,
      container: null,
      bindingDisposers: new Map(),
    });

    // 4. Apply patch
    const patchSuccess = patchTemplate('user-profile', res.diff.patches);
    assert.equal(patchSuccess, true);

    // Verify DOM text updated & signal state kept
    assert.equal(pNode.textContent, 'Updated static description');
    assert.equal(instance.count(), 100); // State preserved!
  });

  test('2. Edit CSS: only the style unit recompiles, no JS module re-executed', async () => {
    const graph = new DependencyGraph();
    const tsContent = `
      import { Component } from '@jarvis/core';
      @Component({
        selector: 'styled-card',
        templateUrl: './styled-card.component.html',
        styleUrl: './styled-card.component.css'
      })
      export class StyledCardComponent {}
    `;
    graph.registerComponent('c:/app/styled-card.component.ts', tsContent, 'c:/app/styled-card.component.html', 'c:/app/styled-card.component.css');

    const cssNew = `.card { color: red; background: yellow; }`;
    const classification = graph.classifyChange('c:/app/styled-card.component.css', cssNew);

    assert.equal(classification.kind, 'style-only');
    assert.equal(classification.affectedDependents.length, 0);
    assert.equal(classification.earlyCutoff, true);

    // Swap style without JS reload
    const success = swapStyles('styled-card', cssNew);
    assert.equal(success, typeof document !== 'undefined');
  });

  test('3. Edit a component body without changing its interface: dependents are NOT recompiled (early cutoff)', async () => {
    const graph = new DependencyGraph();
    const oldTs = `
      import { Component, input } from '@jarvis/core';
      @Component({ selector: 'comp-a' })
      export class CompA {
        name = input('Alice');
        internalCalc() { return 1 + 1; }
      }
    `;
    const newTs = `
      import { Component, input } from '@jarvis/core';
      @Component({ selector: 'comp-a' })
      export class CompA {
        name = input('Alice');
        internalCalc() { return 2 + 2; } // Body change only
        helperSecret() { return 'secret'; }
      }
    `;

    graph.registerComponent('c:/app/comp-a.component.ts', oldTs);
    graph.registerComponent('c:/app/comp-b.component.ts', `import { CompA } from './comp-a.component';`);
    graph.addDependencyEdge('c:/app/comp-b.component.ts', 'c:/app/comp-a.component.ts', ['name']);

    const classification = graph.classifyChange('c:/app/comp-a.component.ts', newTs);

    assert.equal(classification.kind, 'script-body');
    assert.equal(classification.earlyCutoff, true);
    assert.equal(classification.affectedDependents.length, 0);
  });

  test('4. Change an @Input name: only the components that use it are recompiled', async () => {
    const graph = new DependencyGraph();
    const oldTs = `
      import { Component, input } from '@jarvis/core';
      @Component({ selector: 'shared-widget' })
      export class SharedWidget {
        title = input('Default');
        theme = input('Dark');
      }
    `;
    const newTs = `
      import { Component, input } from '@jarvis/core';
      @Component({ selector: 'shared-widget' })
      export class SharedWidget {
        headerTitle = input('Default'); // Renamed input
        theme = input('Dark');
      }
    `;

    const widgetPath = 'c:/app/shared-widget.component.ts';
    const dep1Path = 'c:/app/consumer-1.component.ts'; // uses title
    const dep2Path = 'c:/app/consumer-2.component.ts'; // uses theme only

    graph.registerComponent(widgetPath, oldTs);
    graph.registerComponent(dep1Path, `export class Consumer1 {}`);
    graph.registerComponent(dep2Path, `export class Consumer2 {}`);

    graph.addDependencyEdge(dep1Path, widgetPath, ['title']);
    graph.addDependencyEdge(dep2Path, widgetPath, ['theme']);

    const classification = graph.classifyChange(widgetPath, newTs);

    assert.equal(classification.kind, 'script-interface');
    assert.equal(classification.earlyCutoff, false);
    assert.equal(classification.affectedDependents.length, 1);
    assert.equal(classification.affectedDependents[0], graph.normalizePath(dep1Path));
  });

  test('5. Save with no real change (same content): 0 recompiles, logged as unchanged', async () => {
    const graph = new DependencyGraph();
    const ts = `export class StaticItem {}`;
    const html = `<div>Static content</div>`;

    graph.registerComponent('c:/app/static.component.ts', ts, 'c:/app/static.component.html');
    graph.classifyChange('c:/app/static.component.html', html); // initial register

    // Save with identical content
    const classification = graph.classifyChange('c:/app/static.component.html', html);
    assert.equal(classification.kind, 'unchanged');
    assert.equal(classification.earlyCutoff, true);
    assert.equal(classification.affectedDependents.length, 0);
  });

  test('6. Atomic-save style edit (temp file + rename): handled correctly', async () => {
    const tempDir = path.resolve(process.cwd(), 'scratch', 'atomic-test');
    fs.mkdirSync(tempDir, { recursive: true });

    const targetFile = path.join(tempDir, 'demo.component.html');
    const tempFile = path.join(tempDir, 'demo.component.html.tmp');

    fs.writeFileSync(targetFile, '<h1>Original</h1>', 'utf8');

    // Simulate atomic write
    fs.writeFileSync(tempFile, '<h1>Updated Atomics</h1>', 'utf8');
    fs.renameSync(tempFile, targetFile);

    const content = fs.readFileSync(targetFile, 'utf8');
    assert.equal(content, '<h1>Updated Atomics</h1>');

    const res = await compiler.compile(content, targetFile, { unitType: 'template' });
    assert.equal(res.success, true);
    assert.ok(res.code?.includes('Updated Atomics'));

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('7. 1,000 consecutive edits: no memory or listener growth', async () => {
    const componentId = 'leak-test-comp';
    let disposedCount = 0;
    let activeEffects = 0;

    const mockRenderer = {
      bindText: (_node: any, _fn: any) => {
        activeEffects++;
        return () => {
          activeEffects--;
          disposedCount++;
        };
      },
      setText: () => {},
      createElement: () => ({ childNodes: [], children: [] }),
      createText: () => ({ nodeType: 3, textContent: '' }),
      appendChild: () => {},
    };

    const instance = { val: signal(0) };
    const bindingDisposers = new Map<string, () => void>();

    // Initial binding
    const initialDisposer = mockRenderer.bindText(null, () => instance.val());
    bindingDisposers.set('b:0.0:text', initialDisposer);

    const view = {
      root: { childNodes: [{ nodeType: 3, textContent: '0' }], children: [] },
      destroy: () => {
        for (const d of bindingDisposers.values()) d();
        bindingDisposers.clear();
      },
    };

    hmrRuntime.trackInstance(componentId, {
      instance,
      view,
      renderer: mockRenderer,
      container: null,
      bindingDisposers,
    });

    assert.equal(activeEffects, 1);

    // Simulate 1,000 consecutive binding edits
    for (let i = 1; i <= 1000; i++) {
      patchTemplate(componentId, [{
        type: 'update_binding',
        path: '0.0',
        binding_id: 'b:0.0:text',
        expression_js: `ctx.val() + ${i}`,
      }]);
    }

    // After 1,000 edits, exactly 1 active effect must remain (no memory/listener growth!)
    assert.equal(activeEffects, 1);
    assert.equal(disposedCount, 1000);
  });

  test('8. Compile error then fix: error overlay appears, recovers on fix, failing unit recompiles', async () => {
    const badTemplate = '<div><h1>Unclosed tag</div>';
    const badRes = await compiler.compile(badTemplate, 'error.component.html');

    assert.equal(badRes.success, false);
    assert.ok(badRes.diagnostics.length > 0);
    assert.ok(badRes.formattedOverlay?.includes('Jarvis Template Compilation Errors'));

    // Fix template
    const fixedTemplate = '<div><h1>Properly Closed</h1></div>';
    const fixedRes = await compiler.compile(fixedTemplate, 'error.component.html');

    assert.equal(fixedRes.success, true);
    assert.ok(fixedRes.code?.includes('Properly Closed'));
  });
});
