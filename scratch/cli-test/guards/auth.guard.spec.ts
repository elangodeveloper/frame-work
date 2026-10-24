import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { authGuard } from './auth.guard.ts';

describe('authGuard', () => {
  it('should return true for allowed routes', () => {
    const res = authGuard({} as any, {} as any);
    assert.strictEqual(res, true);
  });
});
