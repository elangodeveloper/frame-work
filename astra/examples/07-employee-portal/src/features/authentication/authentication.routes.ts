import type { Routes } from '@jarvis/router';
import { EmployeeLoginPage } from './pages/employee-login/employee-login.page.ts';
import { ForgotPasswordPage } from './pages/forgot-password/forgot-password.page.ts';
import { VerifyIdentityPage } from './pages/verify-identity/verify-identity.page.ts';
import { ResetPasswordPage } from './pages/reset-password/reset-password.page.ts';
import { EmployeeDashboardPage } from '../dashboard/pages/employee-dashboard/employee-dashboard.page.ts';

export const authRoutes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    component: EmployeeLoginPage,
    title: 'JARVIS Portal — Employee Access',
    data: { screen: 'login' },
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordPage,
    title: 'JARVIS Portal — Credential Recovery',
    data: { screen: 'forgot-password' },
  },
  {
    path: 'verify-identity',
    component: VerifyIdentityPage,
    title: 'JARVIS Portal — Two-Factor Verification',
    data: { screen: 'verify-identity' },
  },
  {
    path: 'reset-password',
    component: ResetPasswordPage,
    title: 'JARVIS Portal — Set New Password',
    data: { screen: 'reset-password' },
  },
  {
    path: 'dashboard',
    component: EmployeeDashboardPage,
    title: 'JARVIS Portal — Employee Dashboard',
    data: { screen: 'dashboard' },
  },
  {
    path: 'workspace',
    component: EmployeeDashboardPage,
    title: 'JARVIS Portal — Employee Dashboard',
    data: { screen: 'dashboard' },
  },
];
