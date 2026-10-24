import type { CanActivateFn } from '@jarvis/router';
import { authService } from '../services/auth.service.ts';

export const authGuard: CanActivateFn = () => {
  if (authService.isAuthenticated()) {
    return true;
  }
  return '/home';
};
