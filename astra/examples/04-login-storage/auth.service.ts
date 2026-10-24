import { signal, type Signal } from '../../packages/reactive/src/index.ts';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Architect' | 'Lead Engineer' | 'Security Officer';
  avatar: string;
}

export interface StoredSession {
  token: string;
  user: User;
  loginTime: string;
}

const STORAGE_KEY = 'jarvis_auth_session';

export const DUMMY_USERS: (User & { password: string })[] = [
  {
    id: 'USR-001',
    name: 'Tony Stark',
    email: 'stark@jarvis.ai',
    password: 'password123',
    role: 'Architect',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'
  },
  {
    id: 'USR-002',
    name: 'Pepper Potts',
    email: 'pepper@jarvis.ai',
    password: 'password123',
    role: 'Security Officer',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80'
  },
  {
    id: 'USR-003',
    name: 'Bruce Banner',
    email: 'banner@jarvis.ai',
    password: 'password123',
    role: 'Lead Engineer',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80'
  }
];

export class AuthService {
  private readonly _currentUser = signal<User | null>(null);
  private readonly _isAuthenticated = signal<boolean>(false);
  private readonly _sessionInfo = signal<StoredSession | null>(null);

  readonly currentUser: Signal<User | null> = this._currentUser;
  readonly isAuthenticated: Signal<boolean> = this._isAuthenticated;
  readonly sessionInfo: Signal<StoredSession | null> = this._sessionInfo;

  constructor() {
    this.restoreSession();
  }

  restoreSession(): boolean {
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored) {
        const session: StoredSession = JSON.parse(stored);
        if (session && session.user && session.token) {
          this._sessionInfo.set(session);
          this._currentUser.set(session.user);
          this._isAuthenticated.set(true);
          return true;
        }
      }
    } catch (e) {
      console.warn('[AuthService] Failed to parse stored session:', e);
      if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    }
    this._sessionInfo.set(null);
    this._currentUser.set(null);
    this._isAuthenticated.set(false);
    return false;
  }

  login(email: string, pass: string, rememberMe: boolean = true): { success: boolean; message?: string } {
    const matched = DUMMY_USERS.find(
      u => u.email.trim().toLowerCase() === email.trim().toLowerCase() && u.password === pass
    );

    if (!matched) {
      return { success: false, message: 'Invalid credentials. Please verify your email and password.' };
    }

    const { password: _, ...safeUser } = matched;
    const session: StoredSession = {
      token: 'jwt-jarvis-' + Math.random().toString(36).substring(2) + '-' + Date.now(),
      user: safeUser,
      loginTime: new Date().toISOString()
    };

    if (typeof localStorage !== 'undefined') {
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } else {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      }
    }

    this._sessionInfo.set(session);
    this._currentUser.set(safeUser);
    this._isAuthenticated.set(true);
    return { success: true };
  }

  logout(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    }
    this._sessionInfo.set(null);
    this._currentUser.set(null);
    this._isAuthenticated.set(false);
  }

  clearLocalStorage(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
    }
    this.restoreSession();
  }
}
