import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TestRenderer } from '@jarvis/renderer';
import { provideRouter } from '@jarvis/router';
import { LayoutRouterOutlet, MainLayoutComponent, AuthLayoutComponent } from '@jarvis/layout';
import { routes } from './src/app.routes.ts';
import { DashboardPage } from './src/features/dashboard/pages/dashboard-page/dashboard.page.ts';
import { EmployeeListPage } from './src/features/employees/pages/employee-list/employee-list.page.ts';
import { LoginPage } from './src/features/authentication/pages/login-page/login.page.ts';

describe('06-layout-composition Integration Showcase', () => {
  it('should navigate between Dashboard, Employees, and Login across layouts with identity preservation', async () => {
    const renderer = new TestRenderer();
    const router = provideRouter(routes, { initialUrl: '/dashboard' });
    const outlet = new LayoutRouterOutlet(renderer, router);

    // 1. Initial Route: /dashboard in MainLayout
    await router.navigate(['dashboard']);
    const mainLayoutInstance = outlet.getCurrentLayout();
    assert.ok(mainLayoutInstance instanceof MainLayoutComponent);

    const dashboardScreen = outlet.getCurrentScreen();
    assert.ok(dashboardScreen instanceof DashboardPage);
    assert.ok(outlet.getElement().toHtml().includes('Executive Dashboard'));

    // 2. Mutate Layout State (collapse sidebar)
    mainLayoutInstance.toggleSidebar();
    assert.equal(mainLayoutInstance.sidebarOpen(), false);

    // 3. Navigate to /employees (same MainLayout)
    await router.navigate(['employees']);
    const secondLayoutInstance = outlet.getCurrentLayout();

    // Verify Layout instance and sidebar state are strictly preserved!
    assert.strictEqual(mainLayoutInstance, secondLayoutInstance);
    assert.equal(secondLayoutInstance.sidebarOpen(), false);

    // Verify old screen disposed and new screen active
    assert.equal(dashboardScreen.destroyed, true);
    const employeeScreen = outlet.getCurrentScreen();
    assert.ok(employeeScreen instanceof EmployeeListPage);
    assert.ok(outlet.getElement().toHtml().includes('Personnel Directory'));

    // 4. Navigate to /login (AuthLayout)
    await router.navigate(['login']);
    const authLayoutInstance = outlet.getCurrentLayout();

    // Verify old layout is destroyed and AuthLayout is instantiated
    assert.notStrictEqual(mainLayoutInstance, authLayoutInstance);
    assert.ok(authLayoutInstance instanceof AuthLayoutComponent);

    // Verify employee screen disposed and login screen active
    assert.equal(employeeScreen.destroyed, true);
    const loginScreen = outlet.getCurrentScreen();
    assert.ok(loginScreen instanceof LoginPage);
    assert.ok(outlet.getElement().toHtml().includes('Sign In to Corporate Portal'));
    assert.ok(!outlet.getElement().toHtml().includes('jarvis-sidebar'));

    // 5. Cleanup
    outlet.destroy();
    assert.equal(loginScreen.destroyed, true);
  });
});
