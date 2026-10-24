import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TestRenderer } from '@jarvis/renderer';
import { Component, input, output } from '@jarvis/core';
import { signal } from '@jarvis/reactive';
import { mountComponent, unmountComponent } from '../src/composition/component-host.ts';
import { MainLayoutComponent } from '../src/layouts/main-layout.component.ts';

// 1. Reusable Page Header Component
class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');

  render(r: any): any {
    const box = r.createElement('div');
    r.setAttribute(box, 'class', 'page-header');
    const h1 = r.createElement('h1');
    r.bindText(h1, () => this.title());
    r.appendChild(box, h1);

    if (this.subtitle()) {
      const p = r.createElement('p');
      r.bindText(p, () => this.subtitle());
      r.appendChild(box, p);
    }
    return box;
  }
}
Component({ selector: 'app-page-header' })(PageHeaderComponent);

// 2. Reusable Toolbar Component
class ToolbarComponent {
  readonly searchFilter = output<string>();

  render(r: any): any {
    const box = r.createElement('div');
    r.setAttribute(box, 'class', 'toolbar-box');
    const btn = r.createElement('button');
    btn.textContent = 'Add Employee';
    r.appendChild(box, btn);
    return box;
  }
}
Component({ selector: 'app-toolbar' })(ToolbarComponent);

// 3. Reusable Table Component
class DataTableComponent {
  readonly rows = input<any[]>([]);

  render(r: any): any {
    const table = r.createElement('table');
    r.setAttribute(table, 'class', 'jarvis-data-table');
    const tbody = r.createElement('tbody');

    for (const row of this.rows()) {
      const tr = r.createElement('tr');
      const td = r.createElement('td');
      td.textContent = row.name || '';
      r.appendChild(tr, td);
      r.appendChild(tbody, tr);
    }
    r.appendChild(table, tbody);
    return table;
  }
}
Component({ selector: 'app-data-table' })(DataTableComponent);

// 4. Feature Screen: Employee Management Page (Composes the three above without owning them)
class EmployeeManagementPageComponent {
  readonly employees = signal([
    { id: '1', name: 'Sophia Martinez', role: 'Staff Architect' },
    { id: '2', name: 'Alexander Wright', role: 'Compiler Engineer' },
  ]);

  private headerRef: any = null;
  private toolbarRef: any = null;
  private tableRef: any = null;

  render(r: any): any {
    const page = r.createElement('div');
    r.setAttribute(page, 'class', 'employee-screen-root');

    // Mount page header
    const headerContainer = r.createElement('div');
    this.headerRef = mountComponent(r, PageHeaderComponent, headerContainer, {
      inputs: {
        title: 'Personnel Directory',
        subtitle: 'Enterprise human capital management',
      },
    });
    r.appendChild(page, headerContainer);

    // Mount toolbar
    const toolbarContainer = r.createElement('div');
    this.toolbarRef = mountComponent(r, ToolbarComponent, toolbarContainer);
    r.appendChild(page, toolbarContainer);

    // Mount table
    const tableContainer = r.createElement('div');
    this.tableRef = mountComponent(r, DataTableComponent, tableContainer, {
      inputs: { rows: this.employees() },
    });
    r.appendChild(page, tableContainer);

    return page;
  }

  onDestroy(): void {
    unmountComponent(this.headerRef);
    unmountComponent(this.toolbarRef);
    unmountComponent(this.tableRef);
  }
}
Component({ selector: 'app-employee-page' })(EmployeeManagementPageComponent);

describe('Milestones 5 & 11: Screen Composition Model & Loose Coupling', () => {
  it('should compose complex screens from reusable components with zero coupling to layout', () => {
    const renderer = new TestRenderer();
    const container = renderer.createElement('div');

    // 1. Mount MainLayout
    const layoutRef = mountComponent(renderer, MainLayoutComponent, container);
    const contentOutlet = layoutRef.instance.getContentOutlet();

    // 2. Mount EmployeeManagementPageComponent inside layout's outlet
    const screenRef = contentOutlet!.project(EmployeeManagementPageComponent);

    const html = container.toHtml();

    // Layout structure present
    assert.ok(html.includes('jarvis-layout-shell'));
    assert.ok(html.includes('jarvis-header'));
    assert.ok(html.includes('jarvis-sidebar'));

    // Screen composed components present
    assert.ok(html.includes('Personnel Directory'));
    assert.ok(html.includes('Enterprise human capital management'));
    assert.ok(html.includes('Add Employee'));
    assert.ok(html.includes('Sophia Martinez'));
    assert.ok(html.includes('Alexander Wright'));

    // 3. Unmount layout cleanly disposes both layout and screen hierarchy
    unmountComponent(layoutRef);
  });
});
