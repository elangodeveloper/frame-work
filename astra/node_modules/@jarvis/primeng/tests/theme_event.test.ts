import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  JarvisEvent,
  jarvisEvent,
  providePrimeNG,
  getPrimeNGConfig,
  PrimeComponentRegistry,
  AURA_THEME_TOKENS,
  LARA_THEME_TOKENS,
} from '../src/index.ts';

describe('Jarvis-PrimeNG Core: Events, Theming & Registry', () => {
  it('JarvisEvent should emit events to subscribers without RxJS', () => {
    const event = jarvisEvent<string>();
    const received: string[] = [];

    const sub = event.subscribe((val) => {
      received.push(val);
    });

    event.emit('hello');
    event.emit('world');

    assert.deepStrictEqual(received, ['hello', 'world']);
    assert.strictEqual(event.listenerCount, 1);

    sub.unsubscribe();
    assert.strictEqual(event.listenerCount, 0);

    event.emit('should not receive');
    assert.deepStrictEqual(received, ['hello', 'world']);
  });

  it('JarvisEvent should support multiple independent listeners', () => {
    const event = new JarvisEvent<number>();
    let count1 = 0;
    let count2 = 0;

    const sub1 = event.subscribe((n) => { count1 += n; });
    const sub2 = event.subscribe((n) => { count2 += n * 2; });

    event.emit(5);
    assert.strictEqual(count1, 5);
    assert.strictEqual(count2, 10);

    sub1.unsubscribe();
    event.emit(3);
    assert.strictEqual(count1, 5);
    assert.strictEqual(count2, 16);
  });

  it('PrimeComponentRegistry should hold metadata for all components', () => {
    assert.strictEqual(PrimeComponentRegistry.has('jarvis-p-button'), true);
    assert.strictEqual(PrimeComponentRegistry.has('jarvis-p-input'), true);
    assert.strictEqual(PrimeComponentRegistry.has('jarvis-p-select'), true);
    assert.strictEqual(PrimeComponentRegistry.has('jarvis-p-checkbox'), true);
    assert.strictEqual(PrimeComponentRegistry.has('jarvis-p-dialog'), true);
    assert.strictEqual(PrimeComponentRegistry.has('jarvis-p-table'), true);

    const buttonMeta = PrimeComponentRegistry.get('jarvis-p-button');
    assert.ok(buttonMeta);
    assert.ok(buttonMeta.inputs.includes('label'));
    assert.ok(buttonMeta.outputs.includes('clicked'));
  });

  it('providePrimeNG should configure theme presets and token definitions', () => {
    providePrimeNG({
      theme: 'Aura',
      ripple: true,
      darkMode: 'never',
      cssLayer: true,
    });

    const config = getPrimeNGConfig();
    assert.strictEqual(config.theme, 'Aura');
    assert.strictEqual(config.ripple, true);
    assert.strictEqual(config.darkMode, 'never');
    assert.strictEqual(config.cssLayer, true);

    assert.ok(AURA_THEME_TOKENS['--p-primary-color']);
    assert.ok(LARA_THEME_TOKENS['--p-primary-color']);
  });
});
