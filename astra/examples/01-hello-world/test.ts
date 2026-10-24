import { describe, it } from 'node:test';
import assert from 'node:assert';
import { App } from './app.component.ts';
import { compileComponent } from '../../packages/compiler-runtime/src/index.ts';
import { bootstrap } from '../../packages/runtime/src/index.ts';
import { TestRenderer } from '../../packages/renderer/src/index.ts';

describe('Milestone 1: Hello World Pipeline', () => {
  it('should compile template via Rust compiler and bootstrap into renderer', () => {
    // 1. Rust Compiler Pipeline
    compileComponent(App);

    // 2. Test Container & Headless Renderer
    const renderer = new TestRenderer();
    const container = renderer.createElement('div');

    // 3. Runtime Bootstrap
    const ref = bootstrap(App, container, renderer);

    // 4. Assert Output
    assert.strictEqual(container.toHtml(), '<div><h1>Hello Jarvis</h1></div>');
    assert.strictEqual(container.textContent, 'Hello Jarvis');

    // 5. Cleanup
    ref.destroy();
    assert.strictEqual(container.toHtml(), '<div></div>');
  });
});
