import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { input, output, JARVIS_INPUT_METADATA, JARVIS_OUTPUT_METADATA } from '../src/index.ts';

describe('@jarvis/core — Signal input() and output()', () => {
  it('should initialize optional input with default value', () => {
    const title = input('Default Title');
    assert.strictEqual(title(), 'Default Title');
    assert.strictEqual(title.get(), 'Default Title');

    title.set('Updated Title');
    assert.strictEqual(title(), 'Updated Title');

    const meta = (title as any)[JARVIS_INPUT_METADATA];
    assert.ok(meta);
    assert.strictEqual(meta.required, false);
    assert.strictEqual(meta.defaultValue, 'Default Title');
  });

  it('should initialize required input and flag metadata', () => {
    const userId = input.required<string>();
    const meta = (userId as any)[JARVIS_INPUT_METADATA];
    assert.ok(meta);
    assert.strictEqual(meta.required, true);

    userId.set('user_123');
    assert.strictEqual(userId(), 'user_123');

    userId.update((prev) => prev.toUpperCase());
    assert.strictEqual(userId(), 'USER_123');
  });

  it('should emit values via output() and support subscriptions without RxJS', () => {
    const selected = output<{ id: number; name: string }>();
    assert.strictEqual((selected as any)[JARVIS_OUTPUT_METADATA], true);

    const received: { id: number; name: string }[] = [];
    const sub = selected.subscribe((val) => {
      received.push(val);
    });

    assert.strictEqual(selected.listenerCount, 1);

    selected.emit({ id: 1, name: 'Alice' });
    selected.emit({ id: 2, name: 'Bob' });

    assert.strictEqual(received.length, 2);
    assert.strictEqual(received[0].name, 'Alice');
    assert.strictEqual(received[1].name, 'Bob');

    sub.unsubscribe();
    assert.strictEqual(selected.listenerCount, 0);

    selected.emit({ id: 3, name: 'Charlie' });
    assert.strictEqual(received.length, 2);
  });
});
