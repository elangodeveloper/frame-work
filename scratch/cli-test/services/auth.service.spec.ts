import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { AuthService } from './auth.service.ts';

describe('AuthService', () => {
  it('should instantiate and return status message', () => {
    const service = new AuthService();
    assert.strictEqual(service.fetchData(), 'AuthService operational');
  });
});
