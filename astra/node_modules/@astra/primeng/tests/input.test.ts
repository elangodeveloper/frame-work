import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TestRenderer } from '../../../packages/renderer/src/index.ts';
import { signal, flushJobs } from '../../../packages/reactive/src/index.ts';
import { JarvisInputText } from '../src/index.ts';

describe('JarvisInputText (<jarvis-p-input>) Adapter', () => {
  it('should render a PrimeNG v20 input with initial attributes', () => {
    const renderer = new TestRenderer();
    const input = new JarvisInputText(renderer, {
      placeholder: 'Enter username...',
      variant: 'filled',
    });

    const el = input.getElement();
    assert.strictEqual(el.tag, 'input');
    assert.strictEqual(el.attributes.get('type'), 'text');
    assert.strictEqual(el.attributes.get('placeholder'), 'Enter username...');
    assert.strictEqual(el.attributes.get('class'), 'p-inputtext p-component p-variant-filled');
  });

  it('should reactively sync value from signal to input element', () => {
    const renderer = new TestRenderer();
    const textSig = signal('Initial Text');

    const input = new JarvisInputText(renderer, {
      value: textSig,
    });

    const el = input.getElement();
    assert.strictEqual(el.properties.get('value'), 'Initial Text');

    textSig.set('Updated from Model');
    flushJobs();

    assert.strictEqual(el.properties.get('value'), 'Updated from Model');
  });

  it('should emit valueChange event on user input', () => {
    const renderer = new TestRenderer();
    const input = new JarvisInputText(renderer);

    const emitted: string[] = [];
    input.valueChange.subscribe((val) => {
      emitted.push(val);
    });

    const el = input.getElement();
    el.dispatch('input', { target: { value: 'Alpha' } });
    el.dispatch('input', { target: { value: 'Alpha Beta' } });

    assert.deepStrictEqual(emitted, ['Alpha', 'Alpha Beta']);
  });

  it('should reactively apply p-invalid class when invalid signal is true', () => {
    const renderer = new TestRenderer();
    const isInvalid = signal(false);

    const input = new JarvisInputText(renderer, {
      invalid: isInvalid,
    });

    const el = input.getElement();
    assert.strictEqual(el.attributes.get('class'), 'p-inputtext p-component');

    isInvalid.set(true);
    flushJobs();
    assert.strictEqual(el.attributes.get('class'), 'p-inputtext p-component p-invalid');

    isInvalid.set(false);
    flushJobs();
    assert.strictEqual(el.attributes.get('class'), 'p-inputtext p-component');
  });

  it('should reactively manage disabled and readonly states', () => {
    const renderer = new TestRenderer();
    const disabled = signal(false);
    const readonly = signal(false);

    const input = new JarvisInputText(renderer, {
      disabled,
      readonly,
    });

    const el = input.getElement();
    assert.strictEqual(el.properties.get('disabled'), false);
    assert.strictEqual(el.properties.get('readOnly'), false);

    disabled.set(true);
    readonly.set(true);
    flushJobs();

    assert.strictEqual(el.properties.get('disabled'), true);
    assert.strictEqual(el.properties.get('readOnly'), true);
  });
});
