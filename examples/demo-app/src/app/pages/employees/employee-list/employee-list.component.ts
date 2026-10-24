import { Component, computed } from '@jarvis/core';
import { employeeService } from '../../../core/services/employee.service.ts';

@Component({
  selector: 'app-employee-list',
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.css',
})
export class EmployeeListComponent {
  readonly employees = employeeService.employees;
  readonly totalEmployees = computed(() => this.employees().length);
}
