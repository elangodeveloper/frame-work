import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ResetPasswordPage } from './reset-password.page.ts';
import { AuthenticationService } from '../../services/authentication.service.ts';

describe('ResetPasswordPage', () => {
  let page: ResetPasswordPage;
  let authService: AuthenticationService;

  beforeEach(() => {
    authService = new AuthenticationService();
    page = new ResetPasswordPage(authService);
  });

  it('should initialize with strong initial password satisfying policy', () => {
    assert.strictEqual(page.isPolicySatisfied(), true);
  });

  it('should invalidate policy when password is too short', () => {
    page.newPassword.set('Short1!');
    page.confirmPassword.set('Short1!');
    assert.strictEqual(page.isPolicySatisfied(), false);
    assert.strictEqual(page.policyCheck().minLength, false);
  });

  it('should invalidate policy when passwords do not match', () => {
    page.newPassword.set('Password@2026');
    page.confirmPassword.set('Different@2026');
    assert.strictEqual(page.isPolicySatisfied(), false);
    assert.strictEqual(page.policyCheck().passwordsMatch, false);
  });

  it('should successfully update password when requirements are met', async () => {
    page.newPassword.set('NewStrongPass@2026');
    page.confirmPassword.set('NewStrongPass@2026');
    const success = await page.handleReset();
    assert.strictEqual(success, true);
    assert.match(page.statusSuccess() || '', /securely updated/);
  });
});
