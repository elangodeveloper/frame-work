import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TestRenderer } from '../../../packages/renderer/src/index.ts';
import { signal, flushJobs } from '../../../packages/reactive/src/index.ts';
import { JarvisButton } from '../src/index.ts';

describe('JarvisButton (<jarvis-p-button>) Adapter', () => {
  it('should render a PrimeNG v20 button with static label and default classes', () => {
    const renderer = new TestRenderer();
    const btn = new JarvisButton(renderer, {
      label: 'Submit',
      severity: 'success',
      variant: 'outlined',
    });

    const el = btn.getElement();
    assert.strictEqual(el.tag, 'button');
    assert.strictEqual(el.attributes.get('class'), 'p-button p-component p-button-success p-button-outlined');
    assert.strictEqual(el.textContent, 'Submit');
  });

  it('should reactively update label when signal changes', () => {
    const renderer = new TestRenderer();
    const labelSig = signal('Initial Text');

    const btn = new JarvisButton(renderer, {
      label: labelSig,
    });

    const el = btn.getElement();
    assert.strictEqual(el.textContent, 'Initial Text');

    labelSig.set('Updated Text');
    flushJobs();

    assert.strictEqual(el.textContent, 'Updated Text');
  });

  it('should reactively update severity and size classes via signals', () => {
    const renderer = new TestRenderer();
    const severity = signal<'primary' | 'danger' | 'info'>('primary');
    const size = signal<'small' | 'large' | undefined>(undefined);

    const btn = new JarvisButton(renderer, {
      label: 'Action',
      severity,
      size,
    });

    const el = btn.getElement();
    assert.strictEqual(el.attributes.get('class'), 'p-button p-component');

    severity.set('danger');
    flushJobs();
    assert.strictEqual(el.attributes.get('class'), 'p-button p-component p-button-danger');

    size.set('small');
    flushJobs();
    assert.strictEqual(el.attributes.get('class'), 'p-button p-component p-button-danger p-button-sm');
  });

  it('should reactively toggle loading state and prevent click events', () => {
    const renderer = new TestRenderer();
    const loading = signal(false);
    const btn = new JarvisButton(renderer, {
      label: 'Save',
      loading,
    });

    let clicks = 0;
    btn.clicked.subscribe(() => {
      clicks++;
    });

    const el = btn.getElement();

    // Normal click
    el.dispatch('click');
    assert.strictEqual(clicks, 1);

    // Switch to loading
    loading.set(true);
    flushJobs();

    assert.ok(el.attributes.get('class')?.includes('p-button-loading'));
    assert.strictEqual(el.attributes.get('disabled'), '');

    // Click while loading should be suppressed
    el.dispatch('click');
    assert.strictEqual(clicks, 1);

    // Reset loading
    loading.set(false);
    flushJobs();
    assert.strictEqual(el.properties.get('disabled'), false);

    el.dispatch('click');
    assert.strictEqual(clicks, 2);
  });

  it('should clean up reactive effects on destroy()', () => {
    const renderer = new TestRenderer();
    const labelSig = signal('Before Destroy');
    const btn = new JarvisButton(renderer, { label: labelSig });

    assert.strictEqual(btn.getElement().textContent, 'Before Destroy');

    btn.destroy();
    assert.strictEqual(btn.getElement(), null);

    // Further signal updates should not cause errors
    labelSig.set('After Destroy');
    flushJobs();
  });
});
