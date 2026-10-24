/**
 * EmployeeDashboardPage Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TestRenderer } from '@jarvis/renderer';
import { AuthenticationService } from '../../../authentication/services/authentication.service.ts';
import { DashboardService } from '../../services/dashboard.service.ts';
import { EmployeeDashboardPage } from './employee-dashboard.page.ts';

describe('EmployeeDashboardPage', () => {
  it('should initialize with current authenticated user and render KPI metrics', async () => {
    const authService = new AuthenticationService();
    await authService.login('stark@jarvis.ai', 'Password@2026', false);

    const dashboardService = new DashboardService();
    const page = new EmployeeDashboardPage(authService, dashboardService);
    page.onInit();

    const renderer = new TestRenderer();
    const el = page.render(renderer);
    assert.ok(el, 'Dashboard root element should be rendered');

    assert.equal(dashboardService.kpis().length, 4, 'Should initialize with 4 executive KPI metrics');
    assert.equal(page.editDisplayName(), 'Tony Stark', 'Should populate current user display name');
    page.onDestroy();
  });

  it('should reactively filter workspace projects by search query', async () => {
    const dashboardService = new DashboardService();
    const page = new EmployeeDashboardPage(undefined, dashboardService);
    page.onInit();

    assert.equal(dashboardService.filteredProjects().length, 4, 'Initial unfiltered projects should be 4');

    // Search for "Nanotech"
    page.handleSearchInput('Nanotech');
    assert.equal(dashboardService.filteredProjects().length, 1, 'Should filter down to 1 project matching Nanotech');
    assert.equal(dashboardService.filteredProjects()[0].code, 'MK-85');

    // Clear search
    page.handleSearchInput('');
    assert.equal(dashboardService.filteredProjects().length, 4, 'Clearing search should restore all 4 projects');
    page.onDestroy();
  });

  it('should filter projects by status tag', async () => {
    const dashboardService = new DashboardService();
    const page = new EmployeeDashboardPage(undefined, dashboardService);
    page.onInit();

    page.handleFilterStatus('ACTIVE');
    assert.equal(dashboardService.filteredProjects().length, 2, 'Should have 2 ACTIVE projects');

    page.handleFilterStatus('DEPLOYED');
    assert.equal(dashboardService.filteredProjects().length, 1, 'Should have 1 DEPLOYED project');
    assert.equal(dashboardService.filteredProjects()[0].code, 'ARC-V4');

    page.handleFilterStatus('ALL');
    assert.equal(dashboardService.filteredProjects().length, 4, 'Resetting filter to ALL should return 4 projects');
    page.onDestroy();
  });

  it('should enforce error handling on profile edit modal with PrimeNG inputs', async () => {
    const authService = new AuthenticationService();
    await authService.login('stark@jarvis.ai', 'Password@2026', false);

    const page = new EmployeeDashboardPage(authService);
    page.onInit();

    page.openProfileModal();
    assert.equal(page.isProfileModalOpen(), true, 'Profile modal should be open');

    // Trigger validation error: empty display name
    page.editDisplayName.set('');
    page.editPhone.set('+1 555-0199');
    const savedInvalid = page.saveProfileChanges();
    assert.equal(savedInvalid, false, 'Should reject empty display name');
    assert.equal(page.nameError(), 'Display name is required.');

    // Trigger validation error: short phone
    page.editDisplayName.set('Tony Stark');
    page.editPhone.set('123');
    const savedShortPhone = page.saveProfileChanges();
    assert.equal(savedShortPhone, false, 'Should reject phone under 8 digits');
    assert.equal(page.phoneError(), 'Phone must be at least 8 digits.');

    // Valid update
    page.editDisplayName.set('Anthony E. Stark');
    page.editPhone.set('+1 (212) 555-9999');
    const savedValid = page.saveProfileChanges();
    assert.equal(savedValid, true, 'Should successfully save valid profile');
    assert.equal(authService.currentUser()?.name, 'Anthony E. Stark');

    page.onDestroy();
  });

  it('should handle session sign out and navigate to login', async () => {
    const authService = new AuthenticationService();
    await authService.login('stark@jarvis.ai', 'Password@2026', false);
    assert.ok(authService.isAuthenticated(), 'User should be authenticated');

    let navigatedRoute = '';
    const mockRouter: any = {
      navigate: (commands: string[]) => {
        navigatedRoute = commands[0];
      },
    };

    const page = new EmployeeDashboardPage(authService, undefined, mockRouter);
    page.handleLogout();

    assert.equal(authService.isAuthenticated(), false, 'Session should be terminated');
    assert.equal(navigatedRoute, 'login', 'Should navigate back to login route');
    page.onDestroy();
  });
});
