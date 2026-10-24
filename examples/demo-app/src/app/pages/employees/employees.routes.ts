import { Routes } from '@jarvis/router';
import { EmployeeListComponent } from './employee-list/employee-list.component.ts';
import { EmployeeDetailComponent } from './employee-detail/employee-detail.component.ts';
import { employeeResolver } from '../../core/resolvers/employee.resolver.ts';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard.ts';

export const EMPLOYEE_ROUTES: Routes = [
  { path: '', title: 'Employees', component: EmployeeListComponent },
  {
    path: ':id',
    title: 'Employee Detail',
    component: EmployeeDetailComponent,
    resolve: { employee: employeeResolver },
    canDeactivate: [unsavedChangesGuard],
    data: { breadcrumb: 'Detail' },
  },
];
