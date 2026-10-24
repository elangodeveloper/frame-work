import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { TestRenderer } from '@jarvis/renderer';
import { provideRouter } from '@jarvis/router';
import { bootstrap } from '@jarvis/runtime';
import { PortalAppComponent } from './src/portal-app.component.ts';
import { authRoutes } from './src/features/authentication/authentication.routes.ts';
import { AuthenticationService } from './src/features/authentication/services/authentication.service.ts';
import { OrganizationConfigService } from './src/features/authentication/services/organization-config.service.ts';
import { EmployeeLoginPage } from './src/features/authentication/pages/employee-login/employee-login.page.ts';
import { ForgotPasswordPage } from './src/features/authentication/pages/forgot-password/forgot-password.page.ts';
import { VerifyIdentityPage } from './src/features/authentication/pages/verify-identity/verify-identity.page.ts';
import { ResetPasswordPage } from './src/features/authentication/pages/reset-password/reset-password.page.ts';
import { WorkspaceSessionPage } from './src/features/authentication/pages/workspace-session/workspace-session.page.ts';

describe('JARVIS Employee Portal Integration Test Suite', () => {
  let authService: AuthenticationService;
  let orgConfig: OrganizationConfigService;
  let renderer: TestRenderer;

  beforeEach(() => {
    authService = new AuthenticationService();
    authService.clearSession();
    orgConfig = new OrganizationConfigService();
    renderer = new TestRenderer();
  });

  it('1. should mount PortalAppComponent with balanced split-screen layout', () => {
    const router = provideRouter(authRoutes, { initialUrl: '/login' });
    const container = renderer.createElement('div');
    const appRef = bootstrap(PortalAppComponent, container, renderer, {
      inputs: {
        authService,
        orgConfig,
        router,
      },
    });

    assert.ok(appRef.instance);
    assert.strictEqual(appRef.instance.authService.isAuthenticated(), false);

    // Verify HTML structure
    const html = container.toHtml();
    assert.match(html, /jarvis-auth-split/);
    assert.match(html, /jarvis-brand-panel/);
    assert.match(html, /Your work\. One connected space\./);
    assert.match(html, /jarvis-auth-panel/);

    appRef.destroy();
  });

  it('2. should navigate between all authentication screens using router', async () => {
    const container = renderer.createElement('div');
    const appRef = bootstrap(PortalAppComponent, container, renderer, {
      inputs: {
        authService,
        orgConfig,
      },
    });
    const router = appRef.instance.router;

    // 1. Initial screen: /login
    await router.navigate(['login']);
    let html = container.toHtml();
    assert.match(html, /Welcome back/);
    assert.match(html, /Sign In to Workspace/);

    // 2. Navigate to /forgot-password
    await router.navigate(['forgot-password']);
    html = container.toHtml();
    assert.match(html, /Reset your password/);
    assert.match(html, /Dispatch Recovery Link/);

    // 3. Navigate to /verify-identity
    await router.navigate(['verify-identity']);
    html = container.toHtml();
    assert.match(html, /Verify your identity/);
    assert.match(html, /Verify & Enter Workspace/);

    // 4. Navigate to /reset-password
    await router.navigate(['reset-password']);
    html = container.toHtml();
    assert.match(html, /Set new password/);
    assert.match(html, /Enterprise Password Policy Checklist/);

    // 5. Navigate to /workspace
    await router.navigate(['workspace']);
    html = container.toHtml();
    assert.match(html, /Employee Workspace/);

    appRef.destroy();
  });

  it('3. should complete end-to-end authentication workflow for Tony Stark', async () => {
    const router = provideRouter(authRoutes, { initialUrl: '/login' });
    const loginPage = new EmployeeLoginPage(authService, orgConfig);
    loginPage.router = router;

    const res = await loginPage.handleSignIn();
    assert.strictEqual(res, true);
    assert.strictEqual(authService.isAuthenticated(), true);
    assert.strictEqual(authService.currentUser()?.name, 'Tony Stark');
    assert.strictEqual(authService.currentUser()?.clearanceLevel, 'Level 3 - Executive Clearance');
  });

  it('4. should handle MFA challenge flow for Pepper Potts', async () => {
    const router = provideRouter(authRoutes, { initialUrl: '/login' });
    const loginPage = new EmployeeLoginPage(authService, orgConfig);
    loginPage.router = router;

    loginPage.fillQuickUser(loginPage.directoryUsers[1]); // Pepper Potts
    const loginRes = await loginPage.handleSignIn();
    assert.strictEqual(loginRes, true);
    assert.strictEqual(authService.pendingMfaIdentifier(), 'pepper@jarvis.ai');
    assert.strictEqual(authService.isAuthenticated(), false); // MFA pending

    // Verify MFA step
    const verifyPage = new VerifyIdentityPage(authService);
    verifyPage.router = router;
    verifyPage.mfaCode.set('849201');
    const verifyRes = await verifyPage.handleVerify();
    assert.strictEqual(verifyRes, true);
    assert.strictEqual(authService.isAuthenticated(), true);
    assert.strictEqual(authService.currentUser()?.name, 'Pepper Potts');
    verifyPage.onDestroy();
  });

  it('5. should enforce password policy on reset password screen', async () => {
    const resetPage = new ResetPasswordPage(authService);

    // Non-compliant password
    resetPage.newPassword.set('bad');
    resetPage.confirmPassword.set('bad');
    assert.strictEqual(resetPage.isPolicySatisfied(), false);

    const failRes = await resetPage.handleReset();
    assert.strictEqual(failRes, false);

    // Compliant password
    resetPage.newPassword.set('ValidComplex@2026');
    resetPage.confirmPassword.set('ValidComplex@2026');
    assert.strictEqual(resetPage.isPolicySatisfied(), true);

    const successRes = await resetPage.handleReset();
    assert.strictEqual(successRes, true);
    assert.match(resetPage.statusSuccess() || '', /securely updated/);
  });

  it('6. should terminate active session and purge storage on logout', async () => {
    await authService.login('stark@jarvis.ai', 'Password@2026', true);
    assert.strictEqual(authService.isAuthenticated(), true);

    const workspacePage = new WorkspaceSessionPage(authService);
    workspacePage.handleLogout();

    assert.strictEqual(authService.isAuthenticated(), false);
    assert.strictEqual(authService.currentUser(), null);
    assert.strictEqual(workspacePage.sessionPurged(), true);
  });
});
