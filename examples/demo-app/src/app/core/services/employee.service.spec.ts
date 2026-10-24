import { describe, it, expect } from 'vitest';
import { EmployeeService } from './employee.service.ts';

describe('EmployeeService', () => {
  it('should return all employees signal', () => {
    const service = new EmployeeService();
    expect(service.employees().length).toBe(3);
  });

  it('should retrieve employee by ID and update', () => {
    const service = new EmployeeService();
    const emp = service.getEmployee('1');
    expect(emp?.name).toBe('Alice Smith');

    service.updateEmployee('1', { role: 'Principal Architect' });
    expect(service.getEmployee('1')?.role).toBe('Principal Architect');
  });
});
