import { describe, it, after } from 'node:test';
import * as assert from 'node:assert';
import { CompilerService } from '../src/compiler-service.ts';

describe('Jarvis Template Hoisting & Code Generation', () => {
  const service = new CompilerService();

  after(() => {
    service.dispose();
  });

  it('should compile static subtrees and wire dynamic signal interpolations at build time', async () => {
    const template = '<div class="banner"><h1>Jarvis Platform</h1><p>{{ user() }}</p></div>';
    const result = await service.compile(template, 'banner.component.html');

    assert.strictEqual(result.success, true);
    assert.ok(result.code.includes('export function template(renderer, ctx)'));
    // Static subtree elements
    assert.ok(result.code.includes("renderer.createElement('div')"));
    assert.ok(result.code.includes("renderer.createElement('h1')"));
    assert.ok(result.code.includes("renderer.createText('Jarvis Platform')"));
    // Dynamic signal binding
    assert.ok(result.code.includes('renderer.bindText'));
    assert.ok(result.code.includes('ctx.user()'));
  });

  it('should compile event bindings and property bindings without runtime evaluation', async () => {
    const template = '<button [disabled]="loading()" (click)="submit()">Submit</button>';
    const result = await service.compile(template, 'btn.component.html');

    assert.strictEqual(result.success, true);
    assert.ok(result.code.includes('renderer.listen'));
    assert.ok(result.code.includes('ctx.submit()'));
  });
});
