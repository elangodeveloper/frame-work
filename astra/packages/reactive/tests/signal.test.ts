import { describe, it } from 'node:test';
import assert from 'node:assert';
import { signal, computed, effect, batch, resource } from '../src/index.ts';

describe('Jarvis Reactive Engine', () => {
  it('should read and update signal values', () => {
    const count = signal(0);
    assert.strictEqual(count(), 0);

    count.set(5);
    assert.strictEqual(count(), 5);

    count.update((n) => n * 2);
    assert.strictEqual(count(), 10);
  });

  it('should recompute derivations lazily', () => {
    const count = signal(10);
    let computeCalls = 0;
    const double = computed(() => {
      computeCalls++;
      return count() * 2;
    });

    assert.strictEqual(computeCalls, 0); // Lazy, not yet evaluated
    assert.strictEqual(double(), 20);
    assert.strictEqual(computeCalls, 1);

    // Reading again without changing count should use cache
    assert.strictEqual(double(), 20);
    assert.strictEqual(computeCalls, 1);

    count.set(20);
    // Still not re-evaluated until read!
    assert.strictEqual(computeCalls, 1);
    assert.strictEqual(double(), 40);
    assert.strictEqual(computeCalls, 2);
  });

  it('should run effects and respond to signal mutations within microtask/batch', () => {
    const name = signal('Jarvis');
    const logs: string[] = [];

    const dispose = effect(() => {
      logs.push(`Hello ${name()}`);
    });

    assert.deepStrictEqual(logs, ['Hello Jarvis']);

    batch(() => {
      name.set('World');
      name.set('Frontend');
    });

    assert.deepStrictEqual(logs, ['Hello Jarvis', 'Hello Frontend']);
    dispose();

    name.set('After dispose');
    assert.deepStrictEqual(logs, ['Hello Jarvis', 'Hello Frontend']);
  });
  it('should support resource() with async loading, signals, and AbortSignal', async () => {
    const userId = signal(1);
    const userResource = resource(userId, {
      loader: async ({ params, signal: abortSignal }) => {
        if (abortSignal.aborted) throw new Error('aborted');
        return 'User: ' + params;
      }
    });

    assert.strictEqual(userResource.loading(), true);
    assert.strictEqual(userResource.value(), undefined);

    await new Promise(r => setTimeout(r, 20));

    assert.strictEqual(userResource.loading(), false);
    assert.strictEqual(userResource.value(), 'User: 1');

    let resolver: (val: string) => void = () => {};
    const asyncResource = resource(userId, {
      loader: () => new Promise<string>(r => { resolver = r; })
    });

    assert.strictEqual(asyncResource.loading(), true);
    resolver('Async Loaded');
    await new Promise(r => setTimeout(r, 10));
    assert.strictEqual(asyncResource.loading(), false);
    assert.strictEqual(asyncResource.value(), 'Async Loaded');
  });
});
