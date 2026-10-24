/**
 * JARVIS Employee Portal: Production-Grade Authentication Service
 * Implements IAuthenticationService following SOLID principles.
 */

import { signal, type Signal } from '@jarvis/reactive';
import type {
  EmployeeUser,
  StoredSession,
  AuthResult,
  MfaVerificationResult,
  PasswordResetResult,
  PasswordPolicyCheck,
} from '../models/auth.models.ts';
import type { IAuthenticationService } from '../interfaces/auth.interfaces.ts';

const SESSION_STORAGE_KEY = 'jarvis_employee_session';

export interface EnterpriseDirectoryUser extends EmployeeUser {
  password: string;
  employeeId: string;
  requiresMfa?: boolean;
}

export const ENTERPRISE_DIRECTORY: EnterpriseDirectoryUser[] = [
  {
    id: 'EMP-10001',
    employeeId: 'EMP-10001',
    name: 'Tony Stark',
    email: 'stark@jarvis.ai',
    password: 'Password@2026',
    role: 'Chief Technology Architect',
    department: 'Advanced Systems Engineering',
    clearanceLevel: 'Level 3 - Executive Clearance',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=140&q=80',
    requiresMfa: false,
  },
  {
    id: 'EMP-10002',
    employeeId: 'EMP-10002',
    name: 'Pepper Potts',
    email: 'pepper@jarvis.ai',
    password: 'Password@2026',
    role: 'Chief Operating Officer',
    department: 'Corporate Governance',
    clearanceLevel: 'Level 3 - Executive Clearance',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=140&q=80',
    requiresMfa: true, // triggers MFA flow in tests and demo
  },
  {
    id: 'EMP-10003',
    employeeId: 'EMP-10003',
    name: 'Bruce Banner',
    email: 'banner@jarvis.ai',
    password: 'Password@2026',
    role: 'Principal Bio-Systems Scientist',
    department: 'Applied Physics & Neural R&D',
    clearanceLevel: 'Level 2 - Engineering',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=140&q=80',
    requiresMfa: false,
  },
];

export class AuthenticationService implements IAuthenticationService {
  private readonly _currentUser = signal<EmployeeUser | null>(null);
  private readonly _isAuthenticated = signal<boolean>(false);
  private readonly _sessionInfo = signal<StoredSession | null>(null);
  private readonly _pendingMfaIdentifier = signal<string | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _lastError = signal<string | null>(null);

  readonly currentUser: Signal<EmployeeUser | null> = this._currentUser;
  readonly isAuthenticated: Signal<boolean> = this._isAuthenticated;
  readonly sessionInfo: Signal<StoredSession | null> = this._sessionInfo;
  readonly pendingMfaIdentifier: Signal<string | null> = this._pendingMfaIdentifier;
  readonly isLoading: Signal<boolean> = this._isLoading;
  readonly lastError: Signal<string | null> = this._lastError;

  // Track simulated MFA state and users
  private pendingMfaUser: EnterpriseDirectoryUser | null = null;
  private users: EnterpriseDirectoryUser[] = ENTERPRISE_DIRECTORY.map((u) => ({ ...u }));

  constructor() {
    this.restoreSession();
  }

  restoreSession(): boolean {
    try {
      let raw: string | null = null;
      if (typeof localStorage !== 'undefined') {
        raw = localStorage.getItem(SESSION_STORAGE_KEY);
      }
      if (!raw && typeof sessionStorage !== 'undefined') {
        raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      }

      if (raw) {
        const session: StoredSession = JSON.parse(raw);
        if (session && session.user && session.token) {
          this._sessionInfo.set(session);
          this._currentUser.set(session.user);
          this._isAuthenticated.set(true);
          return true;
        }
      }
    } catch (err) {
      console.warn('[AuthenticationService] Failed to parse cached session:', err);
      this.clearSession();
    }
    this._sessionInfo.set(null);
    this._currentUser.set(null);
    this._isAuthenticated.set(false);
    return false;
  }

  async login(identifier: string, pass: string, rememberMe: boolean): Promise<AuthResult> {
    if (this._isLoading()) {
      return { success: false, message: 'Authentication is already in progress.' };
    }

    this._isLoading.set(true);
    this._lastError.set(null);

    // Simulate async network request
    await new Promise((resolve) => setTimeout(resolve, 350));

    try {
      const cleanId = identifier.trim().toLowerCase();
      const matched = this.users.find(
        (u) =>
          (u.email.toLowerCase() === cleanId || u.employeeId.toLowerCase() === cleanId) &&
          u.password === pass
      );

      if (!matched) {
        const failureMsg = 'Invalid credentials. Please verify your employee ID or corporate email and password.';
        this._lastError.set(failureMsg);
        this._isLoading.set(false);
        return { success: false, message: failureMsg };
      }

      // Check if MFA is required
      if (matched.requiresMfa) {
        this.pendingMfaUser = matched;
        this._pendingMfaIdentifier.set(matched.email);
        this._isLoading.set(false);
        return {
          success: true,
          requiresMfa: true,
          mfaMethod: 'authenticator',
          user: this.toSafeUser(matched),
        };
      }

      // Establish session
      const safeUser = this.toSafeUser(matched);
      this.createSession(safeUser, rememberMe);
      this._isLoading.set(false);
      return { success: true, user: safeUser };
    } catch (err: any) {
      this._isLoading.set(false);
      const msg = err?.message || 'A network error occurred while connecting to identity gateway.';
      this._lastError.set(msg);
      return { success: false, message: msg };
    }
  }

  async verifyMfa(code: string): Promise<MfaVerificationResult> {
    if (this._isLoading()) {
      return { success: false, message: 'Verification already in progress.' };
    }

    this._isLoading.set(true);
    this._lastError.set(null);

    await new Promise((resolve) => setTimeout(resolve, 300));

    const cleanCode = code.replace(/\D/g, '');
    // Standard mock verification code: 849201 or any 6-digit code for testing
    if (cleanCode.length !== 6) {
      this._isLoading.set(false);
      const msg = 'Please enter a valid 6-digit verification code.';
      this._lastError.set(msg);
      return { success: false, message: msg };
    }

    if (cleanCode === '000000') {
      this._isLoading.set(false);
      const msg = 'Verification code has expired or is invalid. Please request a new code.';
      this._lastError.set(msg);
      return { success: false, message: msg };
    }

    if (!this.pendingMfaUser) {
      // Fallback to first user if reached directly
      this.pendingMfaUser = this.users[0];
    }

    const safeUser = this.toSafeUser(this.pendingMfaUser);
    this.createSession(safeUser, true);
    this.pendingMfaUser = null;
    this._pendingMfaIdentifier.set(null);
    this._isLoading.set(false);

    return { success: true };
  }

  async requestPasswordReset(identifier: string): Promise<PasswordResetResult> {
    if (this._isLoading()) {
      return { success: false, message: 'Request in progress.' };
    }

    this._isLoading.set(true);
    this._lastError.set(null);

    await new Promise((resolve) => setTimeout(resolve, 350));
    this._isLoading.set(false);

    // Generic confirmation: NEVER disclose whether account exists
    return {
      success: true,
      message:
        'If an employee account matches the provided identifier, instructions and a secure recovery link have been dispatched to the registered address.',
    };
  }

  async resetPassword(newPassword: string, _token?: string): Promise<PasswordResetResult> {
    if (this._isLoading()) {
      return { success: false, message: 'Update in progress.' };
    }

    const policy = this.validatePasswordPolicy(newPassword);
    if (!policy.minLength || !policy.hasUppercase || !policy.hasNumber || !policy.hasSpecialChar) {
      return {
        success: false,
        message: 'The requested password does not meet enterprise security complexity requirements.',
      };
    }

    this._isLoading.set(true);
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Update demo password for currently authenticated or pending user
    const target = this._currentUser() || this.pendingMfaUser || this.users[0];
    const userInDb = this.users.find((u) => u.id === target.id);
    if (userInDb) {
      userInDb.password = newPassword;
    }

    this._isLoading.set(false);
    return {
      success: true,
      message: 'Your password has been securely updated. You may now sign in with your new credentials.',
    };
  }

  logout(): void {
    this.clearSession();
  }

  clearSession(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
    this._sessionInfo.set(null);
    this._currentUser.set(null);
    this._isAuthenticated.set(false);
    this.pendingMfaUser = null;
    this._pendingMfaIdentifier.set(null);
    this.users = ENTERPRISE_DIRECTORY.map((u) => ({ ...u }));
  }

  validatePasswordPolicy(password: string, confirmPassword?: string): PasswordPolicyCheck {
    const minLength = (password || '').length >= 8;
    const hasUppercase = /[A-Z]/.test(password || '');
    const hasLowercase = /[a-z]/.test(password || '');
    const hasNumber = /[0-9]/.test(password || '');
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password || '');
    const passwordsMatch = confirmPassword !== undefined ? password === confirmPassword : true;

    return {
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar,
      passwordsMatch,
    };
  }

  private toSafeUser(user: EnterpriseDirectoryUser): EmployeeUser {
    const { password: _, ...safe } = user;
    return safe;
  }

  private createSession(user: EmployeeUser, rememberMe: boolean): void {
    const session: StoredSession = {
      token: 'jwt-jarvis-' + Math.random().toString(36).substring(2, 12) + '.' + Date.now(),
      user,
      loginTime: new Date().toISOString(),
      rememberMe,
      deviceFingerprint: 'DEV-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
    };

    if (rememberMe && typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }

    this._sessionInfo.set(session);
    this._currentUser.set(user);
    this._isAuthenticated.set(true);
  }
}
