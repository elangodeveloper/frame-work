import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TestRenderer } from '../src/index.ts';
import { signal, flushJobs } from '../../reactive/src/index.ts';

describe('Jarvis Renderer Abstraction', () => {
  it('should create elements, text nodes, and mount hierarchy', () => {
    const renderer = new TestRenderer();
    const h1 = renderer.createElement('h1');
    const txt = renderer.createText('Hello Jarvis');
    renderer.appendChild(h1, txt);

    assert.strictEqual(h1.toHtml(), '<h1>Hello Jarvis</h1>');
    assert.strictEqual(h1.textContent, 'Hello Jarvis');
  });

  it('should update text node reactively on signal changes without recreating node', () => {
    const renderer = new TestRenderer();
    const p = renderer.createElement('p');
    const txt = renderer.createText('');
    renderer.appendChild(p, txt);

    const count = signal(0);
    renderer.bindText(txt, () => `Count: ${count()}`);

    assert.strictEqual(p.textContent, 'Count: 0');

    count.set(1);
    flushJobs();
    assert.strictEqual(p.textContent, 'Count: 1');

    // Confirm that the same text node was updated, not replaced
    assert.strictEqual(p.children[0], txt);
  });
});
