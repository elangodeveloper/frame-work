import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { EmployeeLoginPage } from './employee-login.page.ts';
import { AuthenticationService } from '../../services/authentication.service.ts';
import { OrganizationConfigService } from '../../services/organization-config.service.ts';

describe('EmployeeLoginPage', () => {
  let page: EmployeeLoginPage;
  let authService: AuthenticationService;
  let orgConfig: OrganizationConfigService;

  beforeEach(() => {
    authService = new AuthenticationService();
    authService.clearSession();
    orgConfig = new OrganizationConfigService();
    page = new EmployeeLoginPage(authService, orgConfig);
  });

  it('should initialize with default signals and directory profiles', () => {
    assert.strictEqual(page.identifier(), 'stark@jarvis.ai');
    assert.strictEqual(page.password(), 'Password@2026');
    assert.strictEqual(page.showPassword(), false);
    assert.strictEqual(page.rememberMe(), true);
    assert.strictEqual(page.directoryUsers.length, 3);
  });

  it('should toggle password visibility reactively', () => {
    assert.strictEqual(page.showPassword(), false);
    page.togglePasswordVisibility();
    assert.strictEqual(page.showPassword(), true);
    page.togglePasswordVisibility();
    assert.strictEqual(page.showPassword(), false);
  });

  it('should fill credentials when quick profile preset is clicked', () => {
    const pepper = page.directoryUsers[1];
    page.fillQuickUser(pepper);
    assert.strictEqual(page.identifier(), 'pepper@jarvis.ai');
    assert.strictEqual(page.password(), 'Password@2026');
    assert.strictEqual(page.identifierError(), null);
    assert.strictEqual(page.passwordError(), null);
  });

  it('should validate identifier requirements on submission', async () => {
    page.identifier.set('');
    const success = await page.handleSignIn();
    assert.strictEqual(success, false);
    assert.match(page.identifierError() || '', /required/);
  });

  it('should validate password length requirements on submission', async () => {
    page.password.set('123');
    const success = await page.handleSignIn();
    assert.strictEqual(success, false);
    assert.match(page.passwordError() || '', /at least 6 characters/);
  });

  it('should successfully authenticate Tony Stark and set success feedback', async () => {
    page.identifier.set('stark@jarvis.ai');
    page.password.set('Password@2026');
    const success = await page.handleSignIn();
    assert.strictEqual(success, true);
    assert.strictEqual(authService.isAuthenticated(), true);
    assert.match(page.formSuccess() || '', /Access authorized/);
  });

  it('should route to MFA verification when Pepper Potts authenticates', async () => {
    page.identifier.set('pepper@jarvis.ai');
    page.password.set('Password@2026');
    const success = await page.handleSignIn();
    assert.strictEqual(success, true);
    assert.match(page.formSuccess() || '', /Multi-Factor Verification/);
  });

  it('should display error message on invalid credentials', async () => {
    page.identifier.set('stark@jarvis.ai');
    page.password.set('wrongPass123');
    const success = await page.handleSignIn();
    assert.strictEqual(success, false);
    assert.match(page.formError() || '', /Invalid credentials/);
    assert.strictEqual(authService.isAuthenticated(), false);
  });

  it('should toggle and support help modal dialog', () => {
    assert.strictEqual(page.helpModalVisible(), false);
    page.openHelpModal();
    assert.strictEqual(page.helpModalVisible(), true);
    page.closeHelpModal();
    assert.strictEqual(page.helpModalVisible(), false);
  });

  it('should validate fields on blur with touched tracking and format enforcement', () => {
    // Empty identifier
    page.identifier.set('');
    page.validateIdentifier();
    assert.match(page.identifierError() || '', /required/);

    // Invalid email format
    page.identifier.set('invalid-email@');
    page.validateIdentifier();
    assert.match(page.identifierError() || '', /valid corporate email format/);

    // Valid email
    page.identifier.set('stark@jarvis.ai');
    const validEmail = page.validateIdentifier();
    assert.strictEqual(validEmail, true);
    assert.strictEqual(page.identifierError(), null);

    // Short password
    page.password.set('123');
    page.validatePassword();
    assert.match(page.passwordError() || '', /at least 6 characters/);

    // Valid password
    page.password.set('Password@2026');
    const validPass = page.validatePassword();
    assert.strictEqual(validPass, true);
    assert.strictEqual(page.passwordError(), null);
  });

  it('should track failed attempts, trigger shake, and show lockout warning after repeated failures', async () => {
    assert.strictEqual(page.failedAttempts(), 0);

    // Attempt 1: bad credentials
    page.identifier.set('stark@jarvis.ai');
    page.password.set('badpass1');
    await page.handleSignIn();
    assert.strictEqual(page.failedAttempts(), 1);
    assert.strictEqual(page.isShaking(), true);

    // Attempt 2: bad credentials -> should trigger lockout warning notice
    page.password.set('badpass2');
    await page.handleSignIn();
    assert.strictEqual(page.failedAttempts(), 2);
    assert.match(page.formError() || '', /Attempt 2 of 5/);
  });
});
