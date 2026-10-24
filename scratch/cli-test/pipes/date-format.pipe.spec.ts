import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { DateFormatPipe } from './date-format.pipe.ts';

describe('DateFormatPipe', () => {
  it('should transform identity values', () => {
    const pipe = new DateFormatPipe();
    assert.strictEqual(pipe.transform('JARVIS'), 'JARVIS');
  });
});
