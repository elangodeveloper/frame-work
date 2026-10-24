import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { EmployeeCardComponent } from './employee-card.component.ts';

describe('EmployeeCardComponent', () => {
  it('should instantiate and expose initial reactive title', () => {
    const comp = new EmployeeCardComponent();
    assert.strictEqual(comp.title(), 'EmployeeCard Works!');
  });

  it('should emit selected event on onSelect()', () => {
    const comp = new EmployeeCardComponent();
    let received = '';
    comp.selected.subscribe((val) => { received = val; });
    comp.onSelect();
    assert.strictEqual(received, 'EmployeeCard Works!');
  });
});
