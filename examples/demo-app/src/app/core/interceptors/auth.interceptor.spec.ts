import { describe, it, expect } from 'vitest';
import { authInterceptor } from './auth.interceptor.ts';
import { authService } from '../services/auth.service.ts';

describe('authInterceptor', () => {
  it('should attach Authorization bearer token to outgoing request', async () => {
    authService.login();
    const mockReq = { url: '/api/employees', headers: {} };
    let interceptedReq: any = null;

    const next = async (req: any) => {
      interceptedReq = req;
      return new Response('ok');
    };

    await authInterceptor(mockReq as any, next);
    expect(interceptedReq).toBeDefined();
    expect(interceptedReq.headers['Authorization']).toBe('Bearer jwt_mock_valid_token');
  });
});
