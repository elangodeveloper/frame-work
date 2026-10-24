import type { Routes } from '@jarvis/router';
import { DashboardPage } from './features/dashboard/pages/dashboard-page/dashboard.page.ts';
import { EmployeeListPage } from './features/employees/pages/employee-list/employee-list.page.ts';
import { LoginPage } from './features/authentication/pages/login-page/login.page.ts';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    component: DashboardPage,
    title: 'JARVIS Portal — Executive Dashboard',
    data: {
      layout: 'main',
      layoutConfig: {
        showHeader: true,
        showSidebar: true,
        showFooter: true,
        contentWidth: 'wide',
      },
    },
  },
  {
    path: 'employees',
    component: EmployeeListPage,
    title: 'JARVIS Portal — Personnel Directory',
    data: {
      layout: 'main',
      layoutConfig: {
        showHeader: true,
        showSidebar: true,
        showFooter: true,
        contentWidth: 'normal',
      },
    },
  },
  {
    path: 'login',
    component: LoginPage,
    title: 'JARVIS Portal — Sign In',
    data: {
      layout: 'auth',
      layoutConfig: {
        showHeader: false,
        showSidebar: false,
        showFooter: true,
        contentWidth: 'narrow',
      },
    },
  },
];
