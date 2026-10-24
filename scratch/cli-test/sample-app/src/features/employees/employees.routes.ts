import type { Route } from '@jarvis/router';
import { EmployeeListPage } from './pages/employee-list/employee-list.page.ts';

export const employeeRoutes: Route[] = [
  {
    path: '',
    component: EmployeeListPage,
  },
];
