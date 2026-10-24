import type { HttpInterceptorFn } from '@jarvis/http';
import { authService } from '../services/auth.service.ts';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = authService.currentUser()?.token;
  if (token) {
    req.headers['Authorization'] = `Bearer ${token}`;
  }
  return next(req);
};
