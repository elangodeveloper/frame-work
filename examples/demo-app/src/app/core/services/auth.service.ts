import { signal, computed } from '@jarvis/core';

export class AuthService {
  private readonly _currentUser = signal<{ id: string; name: string; token: string } | null>({
    id: 'usr_1',
    name: 'Admin User',
    token: 'jwt_mock_valid_token',
  });

  readonly currentUser = computed(() => this._currentUser());
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  login(name: string): void {
    this._currentUser.set({ id: 'usr_1', name, token: 'jwt_mock_valid_token' });
  }

  logout(): void {
    this._currentUser.set(null);
  }
}

export const authService = new AuthService();
