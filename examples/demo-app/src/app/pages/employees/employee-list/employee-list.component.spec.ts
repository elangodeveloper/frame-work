import { describe, it, expect } from 'vitest';
import { EmployeeListComponent } from './employee-list.component.ts';

describe('EmployeeListComponent', () => {
  it('should initialize and compute total employees', () => {
    const comp = new EmployeeListComponent();
    expect(comp.employees().length).toBeGreaterThan(0);
    expect(comp.totalEmployees()).toBe(comp.employees().length);
  });
});
