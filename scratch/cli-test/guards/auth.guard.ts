import { inject } from '@jarvis/core';
import { Router, type CanActivateFn } from '@jarvis/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  // Verify authentication or permission criteria
  return true;
};
