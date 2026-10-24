import { describe, it } from 'node:test';
import assert from 'node:assert';
import { FormControl, FormGroup } from '../src/index.ts';

describe('@jarvis/forms - Reactive Forms', () => {
  it('should initialize FormControl with value and validation', () => {
    const ctrl = new FormControl<string>('', [(v) => (!v ? 'Required' : null)]);
    assert.strictEqual(ctrl.value(), '');
    assert.strictEqual(ctrl.valid, false);

    ctrl.setValue('Jarvis');
    assert.strictEqual(ctrl.value(), 'Jarvis');
    assert.strictEqual(ctrl.valid, true);
  });

  it('should manage FormGroup aggregation', () => {
    const group = new FormGroup({
      name: new FormControl('Admin'),
      email: new FormControl('admin@example.com'),
    });

    assert.strictEqual(group.valid, true);
    assert.deepStrictEqual(group.value, { name: 'Admin', email: 'admin@example.com' });
  });
});
