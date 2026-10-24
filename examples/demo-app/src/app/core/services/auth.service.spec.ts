import { describe, it, expect } from 'vitest';
import { AuthService } from './auth.service.ts';

describe('AuthService', () => {
  it('should initialize authenticated by default', () => {
    const auth = new AuthService();
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('should handle logout and login reactively', () => {
    const auth = new AuthService();
    auth.logout();
    expect(auth.isAuthenticated()).toBe(false);

    auth.login();
    expect(auth.isAuthenticated()).toBe(true);
  });
});
