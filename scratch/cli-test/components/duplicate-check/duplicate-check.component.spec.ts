import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { DuplicateCheckComponent } from './duplicate-check.component.ts';

describe('DuplicateCheckComponent', () => {
  it('should instantiate and expose initial reactive title', () => {
    const comp = new DuplicateCheckComponent();
    assert.strictEqual(comp.title(), 'DuplicateCheck Works!');
  });

  it('should emit selected event on onSelect()', () => {
    const comp = new DuplicateCheckComponent();
    let received = '';
    comp.selected.subscribe((val) => { received = val; });
    comp.onSelect();
    assert.strictEqual(received, 'DuplicateCheck Works!');
  });
});
