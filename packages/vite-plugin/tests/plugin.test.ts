import { test, describe, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { CompilerService, jarvisPlugin } from '../src/index.ts';

describe('Jarvis Vite Plugin & Compiler Service', () => {
  const compiler = new CompilerService();

  after(() => {
    compiler.dispose();
  });

  test('should compile simple template in under 50 ms via persistent worker', async () => {
    // Warm up worker daemon
    await compiler.compile('<div>init</div>', 'init.html');

    const template = `<div class="card"><h1>Hello {{ title }}</h1></div>`;
    const res = await compiler.compile(template, 'card.component.html');

    assert.equal(res.success, true);
    assert.ok(res.code?.includes("renderer.createElement('div')"));
    assert.ok(res.compileTimeMs < 50, `Expected < 50ms, got ${res.compileTimeMs}ms`);
  });

  test('should return cached compilation when template content is unchanged', async () => {
    const template = `<button (click)="onClick()">Click Me</button>`;
    const first = await compiler.compile(template, 'btn.component.html');
    assert.equal(first.success, true);
    assert.equal(first.cached, false);

    const second = await compiler.compile(template, 'btn.component.html');
    assert.equal(second.success, true);
    assert.equal(second.cached, true);
    assert.ok(second.compileTimeMs < 5);
  });

  test('should collect all syntax errors and produce formatted overlay snippet', async () => {
    const badTemplate = `<div><span>Unclosed Tag`;
    const res = await compiler.compile(badTemplate, 'broken.component.html');

    assert.equal(res.success, false);
    assert.ok(res.diagnostics.length > 0);
    assert.ok(res.formattedTerminal?.includes('[Jarvis Compiler Error]'));
    assert.ok(res.formattedOverlay?.includes('Jarvis Template Compilation Errors'));
  });

  test('should transform component decorator templateUrl and styleUrl', async () => {
    const plugin = jarvisPlugin();
    const sourceTs = `
      import { Component } from '@jarvis/core';
      @Component({
        selector: 'app-home',
        templateUrl: './home.component.html',
        styleUrl: './home.component.css'
      })
      export class HomeComponent {}
    `;

    const res: any = await plugin.transform(sourceTs, 'c:/project/src/app/home/home.component.ts');
    assert.ok(res);
    assert.ok(res.code.includes("import { template as __jarvis_view_template__ } from './home.component.html?jarvis-template';"));
    assert.ok(res.code.includes("import './home.component.css';"));
    assert.ok(res.code.includes('template: __jarvis_view_template__'));
    (plugin as any).buildEnd?.();
  });
});
