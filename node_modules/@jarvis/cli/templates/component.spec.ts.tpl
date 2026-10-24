import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { {{className}} } from './{{kebabName}}.component.ts';

describe('{{className}}', () => {
  it('should initialize with default title signal', () => {
    const comp = new {{className}}();
    assert.strictEqual(comp.title(), '{{pascalName}} Works!');
  });
});
