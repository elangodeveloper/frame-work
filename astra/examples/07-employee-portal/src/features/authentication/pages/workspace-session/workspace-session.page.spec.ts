import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { WorkspaceSessionPage } from './workspace-session.page.ts';
import { AuthenticationService } from '../../services/authentication.service.ts';

describe('WorkspaceSessionPage', () => {
  let page: WorkspaceSessionPage;
  let authService: AuthenticationService;

  beforeEach(() => {
    authService = new AuthenticationService();
    page = new WorkspaceSessionPage(authService);
  });

  it('should reflect current authenticated user data in session', async () => {
    await authService.login('stark@jarvis.ai', 'Password@2026', true);
    page.onInit();
    assert.strictEqual(authService.isAuthenticated(), true);
    assert.strictEqual(authService.currentUser()?.name, 'Tony Stark');
  });

  it('should terminate session when handleLogout is invoked', async () => {
    await authService.login('stark@jarvis.ai', 'Password@2026', true);
    assert.strictEqual(authService.isAuthenticated(), true);
    page.handleLogout();
    assert.strictEqual(authService.isAuthenticated(), false);
    assert.strictEqual(page.sessionPurged(), true);
  });
});
