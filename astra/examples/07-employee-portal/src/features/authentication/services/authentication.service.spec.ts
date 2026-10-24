import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { AuthenticationService } from './authentication.service.ts';

describe('AuthenticationService', () => {
  let authService: AuthenticationService;

  beforeEach(() => {
    authService = new AuthenticationService();
    authService.clearSession();
  });

  it('should initialize with unauthenticated state', () => {
    assert.strictEqual(authService.isAuthenticated(), false);
    assert.strictEqual(authService.currentUser(), null);
    assert.strictEqual(authService.sessionInfo(), null);
    assert.strictEqual(authService.isLoading(), false);
  });

  it('should successfully authenticate Tony Stark via work email', async () => {
    const res = await authService.login('stark@jarvis.ai', 'Password@2026', true);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.user?.name, 'Tony Stark');
    assert.strictEqual(authService.isAuthenticated(), true);
    assert.strictEqual(authService.currentUser()?.role, 'Chief Technology Architect');
  });

  it('should successfully authenticate via Employee ID (EMP-10001)', async () => {
    const res = await authService.login('EMP-10001', 'Password@2026', false);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.user?.name, 'Tony Stark');
    assert.strictEqual(authService.isAuthenticated(), true);
  });

  it('should reject invalid credentials with clear error message', async () => {
    const res = await authService.login('stark@jarvis.ai', 'wrong-password', false);
    assert.strictEqual(res.success, false);
    assert.match(res.message || '', /Invalid credentials/);
    assert.strictEqual(authService.isAuthenticated(), false);
    assert.strictEqual(authService.lastError(), res.message);
  });

  it('should trigger MFA challenge for Pepper Potts', async () => {
    const res = await authService.login('pepper@jarvis.ai', 'Password@2026', true);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.requiresMfa, true);
    assert.strictEqual(authService.pendingMfaIdentifier(), 'pepper@jarvis.ai');
    assert.strictEqual(authService.isAuthenticated(), false); // Not authenticated until MFA completed
  });

  it('should complete MFA verification with valid 6-digit code', async () => {
    await authService.login('pepper@jarvis.ai', 'Password@2026', true);
    const mfaRes = await authService.verifyMfa('849201');
    assert.strictEqual(mfaRes.success, true);
    assert.strictEqual(authService.isAuthenticated(), true);
    assert.strictEqual(authService.currentUser()?.name, 'Pepper Potts');
  });

  it('should reject invalid MFA code length', async () => {
    const mfaRes = await authService.verifyMfa('12');
    assert.strictEqual(mfaRes.success, false);
    assert.match(mfaRes.message || '', /6-digit/);
  });

  it('should validate password complexity policy', () => {
    const weak = authService.validatePasswordPolicy('short');
    assert.strictEqual(weak.minLength, false);
    assert.strictEqual(weak.hasUppercase, false);
    assert.strictEqual(weak.hasNumber, false);
    assert.strictEqual(weak.hasSpecialChar, false);

    const strong = authService.validatePasswordPolicy('StrongPass@123', 'StrongPass@123');
    assert.strictEqual(strong.minLength, true);
    assert.strictEqual(strong.hasUppercase, true);
    assert.strictEqual(strong.hasLowercase, true);
    assert.strictEqual(strong.hasNumber, true);
    assert.strictEqual(strong.hasSpecialChar, true);
    assert.strictEqual(strong.passwordsMatch, true);
  });

  it('should return generic confirmation on password reset request', async () => {
    const res = await authService.requestPasswordReset('unknown@random.org');
    assert.strictEqual(res.success, true);
    // Security check: Must not reveal account existence
    assert.match(res.message, /If an employee account matches/);
  });

  it('should terminate session on logout', async () => {
    await authService.login('stark@jarvis.ai', 'Password@2026', true);
    assert.strictEqual(authService.isAuthenticated(), true);
    authService.logout();
    assert.strictEqual(authService.isAuthenticated(), false);
    assert.strictEqual(authService.currentUser(), null);
    assert.strictEqual(authService.sessionInfo(), null);
  });
});
