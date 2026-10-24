import { Component, input, type OnInit, type OnDestroy } from '@jarvis/core';
import { signal } from '@jarvis/reactive';

export class DashboardPage implements OnInit, OnDestroy {
  readonly pageTitle = signal('Executive Dashboard');
  readonly metrics = signal([
    { label: 'Total Personnel', val: '142', trend: '+12% this month' },
    { label: 'Active Projects', val: '28', trend: '4 nearing delivery' },
    { label: 'System Uptime', val: '99.98%', trend: 'Operational' },
  ]);

  destroyed = false;

  onInit(): void {}
  onDestroy(): void {
    this.destroyed = true;
  }

  render(r: any): any {
    const root = r.createElement('div');
    r.setAttribute(root, 'class', 'dashboard-page space-y-6');

    // Header
    const header = r.createElement('div');
    r.setAttribute(header, 'class', 'dashboard-page__header');
    const h1 = r.createElement('h1');
    r.bindText(h1, () => this.pageTitle());
    r.appendChild(header, h1);
    r.appendChild(root, header);

    // Metrics grid
    const grid = r.createElement('div');
    r.setAttribute(grid, 'class', 'dashboard-grid');

    for (const m of this.metrics()) {
      const card = r.createElement('div');
      r.setAttribute(card, 'class', 'dashboard-card');
      const lbl = r.createElement('span');
      lbl.textContent = m.label;
      const num = r.createElement('strong');
      num.textContent = m.val;
      const trn = r.createElement('small');
      trn.textContent = m.trend;

      r.appendChild(card, lbl);
      r.appendChild(card, num);
      r.appendChild(card, trn);
      r.appendChild(grid, card);
    }

    r.appendChild(root, grid);
    return root;
  }
}

Component({
  selector: 'app-dashboard-page',
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.css',
})(DashboardPage);
