import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TestRenderer } from '../../packages/renderer/src/index.ts';
import { flushJobs } from '../../packages/reactive/src/index.ts';
import {
  provideRouter,
  RouterOutlet,
  type Routes,
} from '../../packages/router/src/index.ts';
import {
  DashboardComponent,
  EmployeeListComponent,
  EmployeeDetailComponent,
  SettingsComponent,
  NotFoundComponent,
  LoginComponent,
  authService,
  employeesState,
  initialEmployees,
} from './app.ts';

describe('03-router-primeng-tailwind Integration Verification', () => {
  it('should navigate between Dashboard, List, and Detail with params and state persistence', async () => {
    // Reset state
    employeesState.set([...initialEmployees]);

    const renderer = new TestRenderer();
    const outletHost = renderer.createElement('div');

    const routes: Routes = [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'login', component: LoginComponent },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'employees', component: EmployeeListComponent },
      { path: 'employees/:id', component: EmployeeDetailComponent },
      { path: 'settings', component: SettingsComponent },
      { path: '**', component: NotFoundComponent },
    ];

    const router = provideRouter(routes, { initialUrl: '/' });
    const outlet = new RouterOutlet(renderer, router, outletHost);

    // 1. Initial Landing Screen Check (Redirect to Dashboard)
    await router.navigateByUrl('/');
    flushJobs();
    assert.strictEqual(router.currentUrl(), '/dashboard');
    let html = outletHost.toHtml();
    assert.ok(html.includes('Executive Dashboard'));
    assert.ok(html.includes('Total Personnel'));

    // 1b. Navigate to Login Route
    await router.navigate(['login']);
    flushJobs();
    assert.strictEqual(router.currentUrl(), '/login');
    html = outletHost.toHtml();
    assert.ok(html.includes('Authentication & Access Control'));
    assert.ok(html.includes('Work Email'));
    assert.ok(html.includes('Sign In to Portal'));

    // 2. Navigate to Personnel Directory (/employees)
    await router.navigate(['employees']);
    flushJobs();

    assert.strictEqual(router.currentUrl(), '/employees');
    html = outletHost.toHtml();
    assert.ok(html.includes('Personnel Directory'));
    assert.ok(html.includes('Alexander Wright'));
    assert.ok(html.includes('Staff Frontend Architect'));

    // 3. Navigate to Employee Detail (/employees/EMP002)
    await router.navigate(['employees', 'EMP002']);
    flushJobs();

    assert.strictEqual(router.currentUrl(), '/employees/EMP002');
    assert.strictEqual(router.activatedRoute.params().id, 'EMP002');

    html = outletHost.toHtml();
    assert.ok(html.includes('Alexander Wright'));
    assert.ok(html.includes('ID: EMP002'));
    assert.ok(html.includes('Job Role'));

    // 4. Update Employee data and return to list
    employeesState.update((list) =>
      list.map((e) =>
        e.id === 'EMP002' ? { ...e, role: 'Principal Compiler Architect' } : e
      )
    );

    await router.navigate(['employees']);
    flushJobs();

    html = outletHost.toHtml();
    assert.ok(html.includes('Principal Compiler Architect'));

    // 5. Navigate to 404
    await router.navigateByUrl('/nonexistent/path');
    flushJobs();

    html = outletHost.toHtml();
    assert.ok(html.includes('404'));
    assert.ok(html.includes('Requested route was not found'));

    outlet.destroy();
  });
});
