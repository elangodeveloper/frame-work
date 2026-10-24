import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { UserProfileComponent } from './user-profile.component.ts';

describe('UserProfileComponent', () => {
  it('should instantiate and expose initial reactive title', () => {
    const comp = new UserProfileComponent();
    assert.strictEqual(comp.title(), 'UserProfile Works!');
  });

  it('should emit selected event on onSelect()', () => {
    const comp = new UserProfileComponent();
    let received = '';
    comp.selected.subscribe((val) => { received = val; });
    comp.onSelect();
    assert.strictEqual(received, 'UserProfile Works!');
  });
});
