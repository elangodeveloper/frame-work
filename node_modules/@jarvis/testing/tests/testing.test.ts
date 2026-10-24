import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TestBed } from '../src/index.ts';

describe('@jarvis/testing - TestBed', () => {
  it('should expose TestBed utilities', () => {
    assert.strictEqual(typeof TestBed.createComponent, 'function');
  });
});
