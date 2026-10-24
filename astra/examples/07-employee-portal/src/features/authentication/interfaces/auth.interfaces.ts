/**
 * JARVIS Authentication Service & Repository Contracts (OOAD Interfaces)
 */

import type { Signal } from '@jarvis/reactive';
import type {
  EmployeeUser,
  StoredSession,
  AuthResult,
  MfaVerificationResult,
  PasswordResetResult,
  PasswordPolicyCheck,
} from '../models/auth.models.ts';

export interface IAuthenticationService {
  readonly currentUser: Signal<EmployeeUser | null>;
  readonly isAuthenticated: Signal<boolean>;
  readonly sessionInfo: Signal<StoredSession | null>;
  readonly pendingMfaIdentifier: Signal<string | null>;
  readonly isLoading: Signal<boolean>;
  readonly lastError: Signal<string | null>;

  login(identifier: string, pass: string, rememberMe: boolean): Promise<AuthResult>;
  verifyMfa(code: string): Promise<MfaVerificationResult>;
  requestPasswordReset(identifier: string): Promise<PasswordResetResult>;
  resetPassword(newPassword: string, token?: string): Promise<PasswordResetResult>;
  logout(): void;
  clearSession(): void;
  restoreSession(): boolean;
  validatePasswordPolicy(password: string, confirmPassword?: string): PasswordPolicyCheck;
}
