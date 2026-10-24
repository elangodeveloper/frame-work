import { Component, type OnInit } from '@jarvis/core';
import { signal } from '@jarvis/reactive';

@Component({
  selector: 'app-employee-list-page',
  templateUrl: './employee-list.page.html',
  styleUrl: './employee-list.page.css',
})
export class EmployeeListPage implements OnInit {
  readonly pageTitle = signal('EmployeeList Page');

  onInit(): void {}
}
