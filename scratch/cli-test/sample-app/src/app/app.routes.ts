import type { Route } from '@jarvis/router';

export const routes: Route[] = [
  {
    path: '',
    redirectTo: 'employees',
    pathMatch: 'full',
  },
  {
    path: 'employees',
    loadChildren: () => import('../features/employees/employees.routes.ts').then(m => m.employeeRoutes),
  },
];
