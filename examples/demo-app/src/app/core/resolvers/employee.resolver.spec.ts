import { describe, it, expect } from 'vitest';
import { employeeResolver } from './employee.resolver.ts';

describe('employeeResolver', () => {
  it('should resolve existing employee from route params', async () => {
    const route = { params: { id: '1' } };
    const employee = await employeeResolver(route as any, {} as any);
    expect(employee).toBeDefined();
    expect(employee?.id).toBe('1');
  });

  it('should return null for non-existent employee', async () => {
    const route = { params: { id: '9999' } };
    const employee = await employeeResolver(route as any, {} as any);
    expect(employee).toBeNull();
  });
});
