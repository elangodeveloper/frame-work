import { signal, computed } from '@jarvis/core';
import type { Employee } from '../../shared/models/employee.model.ts';

const INITIAL_EMPLOYEES: Employee[] = [
  { id: '1', name: 'Alice Smith', role: 'Staff Engineer', department: 'Platform Core', email: 'alice@jarvis.dev', status: 'active' },
  { id: '2', name: 'Bob Jones', role: 'Compiler Specialist', department: 'Tooling', email: 'bob@jarvis.dev', status: 'active' },
  { id: '3', name: 'Carol Danvers', role: 'UI Architect', department: 'Design Systems', email: 'carol@jarvis.dev', status: 'active' },
];

export class EmployeeService {
  private readonly _employees = signal<Employee[]>(INITIAL_EMPLOYEES);

  readonly employees = computed(() => this._employees());

  getEmployee(id: string): Employee | undefined {
    return this._employees().find((e) => e.id === id);
  }

  updateEmployee(id: string, updates: Partial<Employee>): void {
    this._employees.update((list) =>
      list.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  }
}

export const employeeService = new EmployeeService();
