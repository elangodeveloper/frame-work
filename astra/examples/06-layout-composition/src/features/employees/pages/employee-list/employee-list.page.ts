import { Component, input, type OnInit, type OnDestroy } from '@jarvis/core';
import { signal } from '@jarvis/reactive';

export class EmployeeListPage implements OnInit, OnDestroy {
  readonly pageTitle = signal('Personnel Directory');
  readonly employees = signal([
    { id: 'EMP001', name: 'Sophia Martinez', role: 'Staff Frontend Architect', dept: 'Engineering' },
    { id: 'EMP002', name: 'Alexander Wright', role: 'Compiler Engineer', dept: 'Engineering' },
    { id: 'EMP003', name: 'Elena Rostova', role: 'Principal Designer', dept: 'Design' },
  ]);

  destroyed = false;

  onInit(): void {}
  onDestroy(): void {
    this.destroyed = true;
  }

  render(r: any): any {
    const root = r.createElement('div');
    r.setAttribute(root, 'class', 'employee-list-page');

    const h1 = r.createElement('h1');
    r.bindText(h1, () => this.pageTitle());
    r.appendChild(root, h1);

    const table = r.createElement('table');
    r.setAttribute(table, 'class', 'employee-table');
    const tbody = r.createElement('tbody');

    for (const emp of this.employees()) {
      const tr = r.createElement('tr');
      const td1 = r.createElement('td');
      td1.textContent = emp.name;
      const td2 = r.createElement('td');
      td2.textContent = emp.role;
      const td3 = r.createElement('td');
      td3.textContent = emp.dept;

      r.appendChild(tr, td1);
      r.appendChild(tr, td2);
      r.appendChild(tr, td3);
      r.appendChild(tbody, tr);
    }

    r.appendChild(table, tbody);
    r.appendChild(root, table);
    return root;
  }
}

Component({
  selector: 'app-employee-list-page',
  templateUrl: './employee-list.page.html',
  styleUrl: './employee-list.page.css',
})(EmployeeListPage);
