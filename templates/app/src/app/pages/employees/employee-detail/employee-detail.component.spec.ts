import { describe, it, expect } from 'vitest';
import { EmployeeDetailComponent } from './employee-detail.component.ts';

describe('EmployeeDetailComponent', () => {
  it('should reactively derive employee data when id changes', () => {
    const comp = new EmployeeDetailComponent();
    comp.id.set('1');
    expect(comp.employee()?.name).toBe('Alice Smith');

    // Navigating between same component: id updates from '1' to '2'
    comp.id.set('2');
    expect(comp.employee()?.name).toBe('Bob Jones');
  });

  it('should track pending changes and satisfy canDeactivate check', () => {
    const comp = new EmployeeDetailComponent();
    comp.id.set('1');
    expect(comp.hasPendingChanges()).toBe(false);

    comp.markChanged('Ada Byron', 'Pioneer');
    expect(comp.hasPendingChanges()).toBe(true);

    comp.save();
    expect(comp.hasPendingChanges()).toBe(false);
  });
});
