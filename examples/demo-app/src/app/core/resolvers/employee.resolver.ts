import type { ResolveFn } from '@jarvis/router';
import type { Employee } from '../../shared/models/employee.model.ts';
import { employeeService } from '../services/employee.service.ts';

export const employeeResolver: ResolveFn<Employee | null> = (route) => {
  const id = route.params.id;
  return employeeService.getEmployee(id) ?? null;
};
