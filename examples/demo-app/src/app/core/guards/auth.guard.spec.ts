import { describe, it, expect } from 'vitest';
import { authGuard } from './auth.guard.ts';
import { authService } from '../services/auth.service.ts';

describe('authGuard', () => {
  it('should allow navigation when authenticated', async () => {
    authService.login();
    const result = await authGuard({} as any, {} as any);
    expect(result).toBe(true);
  });

  it('should redirect to /home when logged out', async () => {
    authService.logout();
    const result = await authGuard({} as any, {} as any);
    expect(result).toBe('/home');
  });
});
