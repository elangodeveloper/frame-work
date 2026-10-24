import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { VerifyIdentityPage } from './verify-identity.page.ts';
import { AuthenticationService } from '../../services/authentication.service.ts';

describe('VerifyIdentityPage', () => {
  let page: VerifyIdentityPage;
  let authService: AuthenticationService;

  beforeEach(() => {
    authService = new AuthenticationService();
    page = new VerifyIdentityPage(authService);
  });

  afterEach(() => {
    page.onDestroy();
  });

  it('should initialize with default code and resend countdown', () => {
    assert.strictEqual(page.mfaCode(), '849201');
    assert.strictEqual(page.remainingAttempts(), 3);
    assert.strictEqual(page.resendCountdown(), 30);
  });

  it('should reject invalid code lengths', async () => {
    page.mfaCode.set('123');
    const success = await page.handleVerify();
    assert.strictEqual(success, false);
    assert.match(page.codeError() || '', /6-digit/);
  });

  it('should verify with correct 6-digit code and authenticate user', async () => {
    page.mfaCode.set('849201');
    const success = await page.handleVerify();
    assert.strictEqual(success, true);
    assert.strictEqual(authService.isAuthenticated(), true);
    assert.match(page.statusSuccess() || '', /Identity verified/);
  });

  it('should decrement remaining attempts on invalid code', async () => {
    page.mfaCode.set('000000');
    const success = await page.handleVerify();
    assert.strictEqual(success, false);
    assert.strictEqual(page.remainingAttempts(), 2);
    assert.match(page.statusError() || '', /2 attempts remaining/);
  });
});
