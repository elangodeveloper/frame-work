import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ForgotPasswordPage } from './forgot-password.page.ts';
import { AuthenticationService } from '../../services/authentication.service.ts';
import { OrganizationConfigService } from '../../services/organization-config.service.ts';

describe('ForgotPasswordPage', () => {
  let page: ForgotPasswordPage;
  let authService: AuthenticationService;
  let orgConfig: OrganizationConfigService;

  beforeEach(() => {
    authService = new AuthenticationService();
    orgConfig = new OrganizationConfigService();
    page = new ForgotPasswordPage(authService, orgConfig);
  });

  it('should validate that identifier is required', async () => {
    page.identifier.set('');
    const success = await page.handleRequestReset();
    assert.strictEqual(success, false);
    assert.match(page.identifierError() || '', /required/);
  });

  it('should submit request and show generic confirmation message', async () => {
    page.identifier.set('stark@jarvis.ai');
    const success = await page.handleRequestReset();
    assert.strictEqual(success, true);
    assert.strictEqual(page.isSubmitted(), true);
    assert.match(page.statusMessage() || '', /If an employee account matches/);
  });
});
