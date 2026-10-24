import { Component, signal, computed, input } from '@jarvis/core';
import { employeeService } from '../../../core/services/employee.service.ts';
import type { Employee } from '../../../shared/models/employee.model.ts';
import type { HasPendingChanges } from '../../../core/guards/unsaved-changes.guard.ts';

@Component({
  selector: 'app-employee-detail',
  templateUrl: './employee-detail.component.html',
  styleUrl: './employee-detail.component.css',
})
export class EmployeeDetailComponent implements HasPendingChanges {
  readonly id = input<string>('');
  readonly employee = computed<Employee | undefined>(() => {
    const empId = this.id();
    return employeeService.getEmployee(empId);
  });

  readonly hasChanges = signal(false);
  readonly editName = signal('');
  readonly editRole = signal('');

  hasPendingChanges(): boolean {
    return this.hasChanges();
  }

  markChanged(name: string, role: string) {
    this.editName.set(name);
    this.editRole.set(role);
    this.hasChanges.set(true);
  }

  save() {
    const current = this.employee();
    if (current && this.hasChanges()) {
      employeeService.updateEmployee(current.id, {
        name: this.editName() || current.name,
        role: this.editRole() || current.role,
      });
      this.hasChanges.set(false);
    }
  }

  reset() {
    this.hasChanges.set(false);
  }
}
