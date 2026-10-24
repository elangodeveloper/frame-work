import { describe, it } from 'node:test';
import assert from 'node:assert';
import { UserCardComponent } from './user-card.component.ts';
import { compileComponent } from '../../packages/compiler-runtime/src/index.ts';
import { bootstrap } from '../../packages/runtime/src/index.ts';
import { TestRenderer } from '../../packages/renderer/src/index.ts';

describe('UserCardComponent', () => {
  it('should compile and render user card with initial signals', () => {
    compileComponent(UserCardComponent);
    const renderer = new TestRenderer();
    const container = renderer.createElement('div');
    const ref = bootstrap(UserCardComponent, container, renderer);

    assert.strictEqual(ref.instance.name(), 'Tony Stark');
    assert.strictEqual(ref.instance.email(), 'tony@starkindustries.com');

    ref.destroy();
  });
});
