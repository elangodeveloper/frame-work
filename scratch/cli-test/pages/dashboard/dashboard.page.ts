import { Component, type OnInit } from '@jarvis/core';
import { signal } from '@jarvis/reactive';

@Component({
  selector: 'app-dashboard-page',
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.css',
})
export class DashboardPage implements OnInit {
  readonly pageTitle = signal('Dashboard Page');

  onInit(): void {}
}
