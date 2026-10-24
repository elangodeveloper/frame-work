import { Component, input } from '@jarvis/core';
import { signal } from '@jarvis/reactive';
import type { LayoutConfig, NavItem } from '@jarvis/layout';
import { MainLayoutComponent as BaseMainLayout } from '@jarvis/layout';

/**
 * Main application layout for enterprise dashboard & employees workspace.
 */
export class AppMainLayoutComponent extends BaseMainLayout {
  constructor() {
    super();
  }
}

Component({
  selector: 'app-main-layout',
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})(AppMainLayoutComponent);
