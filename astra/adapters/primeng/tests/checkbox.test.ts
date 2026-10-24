import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TestRenderer } from '../../../packages/renderer/src/index.ts';
import { signal, flushJobs } from '../../../packages/reactive/src/index.ts';
import { JarvisCheckbox } from '../src/index.ts';

describe('JarvisCheckbox (<jarvis-p-checkbox>) Adapter', () => {
  it('should render checkbox with label and initial classes', () => {
    const renderer = new TestRenderer();
    const cb = new JarvisCheckbox(renderer, {
      label: 'Accept Terms',
      checked: false,
    });

    const el = cb.getElement();
    assert.strictEqual(el.tag, 'div');
    assert.strictEqual(el.attributes.get('class'), 'p-checkbox p-component');
    assert.ok(el.textContent.includes('Accept Terms'));
  });

  it('should reactively reflect checked state via signals', () => {
    const renderer = new TestRenderer();
    const checked = signal(false);

    const cb = new JarvisCheckbox(renderer, {
      label: 'Remember Me',
      checked,
    });

    const el = cb.getElement();
    assert.strictEqual(el.attributes.get('class'), 'p-checkbox p-component');

    const boxEl = el.children[0];
    assert.strictEqual(boxEl.attributes.get('class'), 'p-checkbox-box');

    checked.set(true);
    flushJobs();

    assert.strictEqual(el.attributes.get('class'), 'p-checkbox p-component p-checkbox-checked');
    assert.strictEqual(boxEl.attributes.get('class'), 'p-checkbox-box p-highlight');
  });

  it('should emit checkedChange and change events on click', () => {
    const renderer = new TestRenderer();
    const checked = signal(false);

    const cb = new JarvisCheckbox(renderer, {
      checked,
    });

    const emittedChanges: boolean[] = [];
    cb.checkedChange.subscribe((val) => {
      emittedChanges.push(val);
    });

    const el = cb.getElement();
    el.dispatch('click');

    assert.deepStrictEqual(emittedChanges, [true]);
  });

  it('should prevent toggle when disabled', () => {
    const renderer = new TestRenderer();
    const disabled = signal(true);
    const cb = new JarvisCheckbox(renderer, {
      disabled,
      checked: false,
    });

    let toggled = false;
    cb.checkedChange.subscribe(() => {
      toggled = true;
    });

    const el = cb.getElement();
    assert.ok(el.attributes.get('class')?.includes('p-checkbox-disabled'));

    el.dispatch('click');
    assert.strictEqual(toggled, false);
  });
});
