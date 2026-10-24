import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TestRenderer } from '../../../packages/renderer/src/index.ts';
import { signal, flushJobs } from '../../../packages/reactive/src/index.ts';
import { JarvisSelect } from '../src/index.ts';

describe('JarvisSelect (<jarvis-p-select>) Adapter', () => {
  const cities = [
    { name: 'New York', code: 'NY' },
    { name: 'Rome', code: 'RM' },
    { name: 'London', code: 'LDN' },
    { name: 'Tokyo', code: 'TKO' },
  ];

  it('should render placeholder and open/close overlay panel', () => {
    const renderer = new TestRenderer();
    const select = new JarvisSelect(renderer, {
      options: cities,
      optionLabel: 'name',
      optionValue: 'code',
      placeholder: 'Select a City',
    });

    const el = select.getElement();
    assert.strictEqual(el.tag, 'div');
    assert.ok(el.textContent.includes('Select a City'));

    // Open dropdown
    el.dispatch('click');
    assert.ok(el.attributes.get('class')?.includes('p-select-open'));

    // Close dropdown
    el.dispatch('click');
    assert.strictEqual(el.attributes.get('class'), 'p-select p-component');
  });

  it('should display selected option label reactively based on signal value', () => {
    const renderer = new TestRenderer();
    const selectedCity = signal('RM');

    const select = new JarvisSelect(renderer, {
      options: cities,
      optionLabel: 'name',
      optionValue: 'code',
      value: selectedCity,
    });

    const el = select.getElement();
    assert.ok(el.textContent.includes('Rome'));

    selectedCity.set('TKO');
    flushJobs();

    assert.ok(el.textContent.includes('Tokyo'));
  });

  it('should emit valueChange and change events when an option is clicked', () => {
    const renderer = new TestRenderer();
    const select = new JarvisSelect(renderer, {
      options: cities,
      optionLabel: 'name',
      optionValue: 'code',
      placeholder: 'Select a City',
    });

    const emittedValues: string[] = [];
    select.valueChange.subscribe((val) => {
      emittedValues.push(val);
    });

    // Find the options list items
    // Structure: container -> [labelSpan, trigger, overlay] -> overlay -> list -> [li...]
    const overlay = select.getElement().children[2];
    const list = (overlay as any).children[0];
    assert.strictEqual((list as any).children.length, 4);

    // Click on London (index 2)
    const londonItem = (list as any).children[2];
    londonItem.dispatch('click');

    assert.deepStrictEqual(emittedValues, ['LDN']);
  });

  it('should dynamically update options list when options signal updates', () => {
    const renderer = new TestRenderer();
    const dynamicOptions = signal(['Option 1', 'Option 2']);

    const select = new JarvisSelect(renderer, {
      options: dynamicOptions,
    });

    const overlay = select.getElement().children[2];
    const list = (overlay as any).children[0];
    assert.strictEqual((list as any).children.length, 2);

    dynamicOptions.set(['Option 1', 'Option 2', 'Option 3']);
    flushJobs();

    assert.strictEqual((list as any).children.length, 3);
  });
});
