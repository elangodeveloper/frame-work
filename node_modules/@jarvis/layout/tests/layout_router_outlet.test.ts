import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TestRenderer } from '@jarvis/renderer';
import { provideRouter, type Routes } from '@jarvis/router';
import { LayoutRouterOutlet } from '../src/router/layout-router-outlet.ts';
import { LayoutRegistry } from '../src/router/layout-registry.ts';
import { MainLayoutComponent } from '../src/layouts/main-layout.component.ts';
import { AuthLayoutComponent } from '../src/layouts/auth-layout.component.ts';
import { Component, input, type OnInit, type OnDestroy } from '@jarvis/core';

class DashboardScreen implements OnInit, OnDestroy {
  readonly routeData = input<any>({});
  destroyed = false;

  onInit(): void {}
  onDestroy(): void {
    this.destroyed = true;
  }

  render(r: any): any {
    const el = r.createElement('div');
    r.setAttribute(el, 'class', 'dashboard-screen');
    const h2 = r.createElement('h2');
    h2.textContent = 'Dashboard View';
    r.appendChild(el, h2);
    return el;
  }
}
Component({ selector: 'page-dashboard' })(DashboardScreen);

class EmployeesScreen implements OnInit, OnDestroy {
  readonly routeData = input<any>({});
  destroyed = false;

  onInit(): void {}
  onDestroy(): void {
    this.destroyed = true;
  }

  render(r: any): any {
    const el = r.createElement('div');
    r.setAttribute(el, 'class', 'employees-screen');
    const h2 = r.createElement('h2');
    h2.textContent = 'Employees Directory';
    r.appendChild(el, h2);
    return el;
  }
}
Component({ selector: 'page-employees' })(EmployeesScreen);

class LoginScreen implements OnInit, OnDestroy {
  readonly routeData = input<any>({});
  destroyed = false;

  onInit(): void {}
  onDestroy(): void {
    this.destroyed = true;
  }

  render(r: any): any {
    const el = r.createElement('div');
    r.setAttribute(el, 'class', 'login-screen');
    const h2 = r.createElement('h2');
    h2.textContent = 'Sign In to Portal';
    r.appendChild(el, h2);
    return el;
  }
}
Component({ selector: 'page-login' })(LoginScreen);

describe('Milestone 7: Route-Based Layout Integration & Lifecycle', () => {
  const routes: Routes = [
    {
      path: '/dashboard',
      component: DashboardScreen,
      data: { layout: 'main' },
    },
    {
      path: '/employees',
      component: EmployeesScreen,
      data: { layout: 'main' },
    },
    {
      path: '/login',
      component: LoginScreen,
      data: { layout: 'auth' },
    },
    {
      path: '/admin',
      data: { layout: 'main' },
      children: [
        {
          path: 'staff',
          component: EmployeesScreen,
        },
      ],
    },
  ];

  it('should render route screen inside the designated layout', async () => {
    const renderer = new TestRenderer();
    const router = provideRouter(routes, { initialUrl: '/dashboard' });
    const outlet = new LayoutRouterOutlet(renderer, router);

    await router.navigate(['/dashboard']);

    const currentLayout = outlet.getCurrentLayout();
    assert.ok(currentLayout instanceof MainLayoutComponent);
    const currentScreen = outlet.getCurrentScreen();
    assert.ok(currentScreen instanceof DashboardScreen);

    assert.ok(outlet.getElement().toHtml().includes('jarvis-layout-shell'));
    assert.ok(outlet.getElement().toHtml().includes('Dashboard View'));

    outlet.destroy();
  });

  it('should preserve layout instance and state when navigating between routes sharing the same layout', async () => {
    const renderer = new TestRenderer();
    const router = provideRouter(routes, { initialUrl: '/dashboard' });
    const outlet = new LayoutRouterOutlet(renderer, router);

    await router.navigate(['/dashboard']);
    const layoutInstance1 = outlet.getCurrentLayout();
    const dashboardScreen = outlet.getCurrentScreen() as DashboardScreen;

    // Mutate layout state (e.g. toggle sidebar)
    layoutInstance1.toggleSidebar();
    assert.equal(layoutInstance1.sidebarOpen(), false);

    // Navigate to /employees which also uses layout: 'main'
    await router.navigate(['/employees']);

    const layoutInstance2 = outlet.getCurrentLayout();
    // Layout instance MUST be preserved!
    assert.strictEqual(layoutInstance1, layoutInstance2);
    // Preserved sidebar state!
    assert.equal(layoutInstance2.sidebarOpen(), false);

    // Old screen was destroyed
    assert.equal(dashboardScreen.destroyed, true);

    // New screen is mounted
    const employeesScreen = outlet.getCurrentScreen();
    assert.ok(employeesScreen instanceof EmployeesScreen);
    assert.ok(outlet.getElement().toHtml().includes('Employees Directory'));

    outlet.destroy();
  });

  it('should destroy old layout and instantiate new layout when navigating across layout boundaries', async () => {
    const renderer = new TestRenderer();
    const router = provideRouter(routes, { initialUrl: '/dashboard' });
    const outlet = new LayoutRouterOutlet(renderer, router);

    await router.navigate(['/dashboard']);
    const mainLayout = outlet.getCurrentLayout();
    assert.ok(mainLayout instanceof MainLayoutComponent);

    // Navigate to /login which uses layout: 'auth'
    await router.navigate(['/login']);

    const authLayout = outlet.getCurrentLayout();
    assert.ok(authLayout instanceof AuthLayoutComponent);
    assert.notStrictEqual(mainLayout, authLayout);

    // Verify HTML has auth layout structure without sidebars
    const html = outlet.getElement().toHtml();
    assert.ok(html.includes('jarvis-auth-layout'));
    assert.ok(html.includes('Sign In to Portal'));
    assert.ok(!html.includes('jarvis-sidebar'));

    outlet.destroy();
  });

  it('should produce clear diagnostic error when route references an unknown layout', () => {
    const renderer = new TestRenderer();
    const router = provideRouter(routes);
    const outlet = new LayoutRouterOutlet(renderer, router);

    assert.throws(
      () => {
        outlet.resolveLayout('non-existent-layout', '/unknown');
      },
      (err: any) => {
        return (
          err.message.includes('[JARVIS Layout Error]') &&
          err.message.includes("Unknown layout 'non-existent-layout'") &&
          err.message.includes('Registered layouts: [')
        );
      }
    );

    outlet.destroy();
  });

  it('should inherit layout from parent route configuration', async () => {
    const renderer = new TestRenderer();
    const router = provideRouter(routes, { initialUrl: '/admin/staff' });
    const outlet = new LayoutRouterOutlet(renderer, router);

    await router.navigate(['/admin/staff']);
    const layout = outlet.getCurrentLayout();
    assert.ok(layout instanceof MainLayoutComponent);

    const screen = outlet.getCurrentScreen();
    assert.ok(screen instanceof EmployeesScreen);
    assert.ok(outlet.getElement().toHtml().includes('Employees Directory'));

    outlet.destroy();
  });
});
