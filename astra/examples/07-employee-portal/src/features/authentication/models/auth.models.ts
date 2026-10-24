/**
 * JARVIS Employee Portal: Authentication Domain Models
 */

export interface EmployeeUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  clearanceLevel: 'Level 1 - General' | 'Level 2 - Engineering' | 'Level 3 - Executive Clearance';
  avatar: string;
}

export interface StoredSession {
  token: string;
  user: EmployeeUser;
  loginTime: string;
  rememberMe: boolean;
  deviceFingerprint: string;
}

export interface AuthCredentials {
  identifier: string; // Email or Employee ID
  password: string;
  rememberMe: boolean;
}

export interface AuthResult {
  success: boolean;
  message?: string;
  user?: EmployeeUser;
  requiresMfa?: boolean;
  mfaMethod?: 'authenticator' | 'sms' | 'hardware_key';
}

export interface MfaVerificationResult {
  success: boolean;
  message?: string;
}

export interface PasswordResetResult {
  success: boolean;
  message: string;
}

export interface PasswordPolicyCheck {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  passwordsMatch: boolean;
}
