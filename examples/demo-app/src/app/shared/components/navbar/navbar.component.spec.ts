import { describe, it, expect } from 'vitest';
import { NavbarComponent } from './navbar.component.ts';
import { authService } from '../../../core/services/auth.service.ts';

describe('NavbarComponent', () => {
  it('should toggle authentication state', () => {
    const nav = new NavbarComponent();
    authService.logout();
    expect(nav.isAuthenticated()).toBe(false);

    nav.toggleAuth();
    expect(nav.isAuthenticated()).toBe(true);

    nav.toggleAuth();
    expect(nav.isAuthenticated()).toBe(false);
  });
});
