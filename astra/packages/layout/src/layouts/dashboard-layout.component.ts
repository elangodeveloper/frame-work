import type { Renderer } from '@jarvis/renderer';
import { Component, input } from '@jarvis/core';
import { signal, effect } from '@jarvis/reactive';
import type { LayoutConfig, NavItem } from '../contracts/layout.contract.ts';
import { AppHeaderComponent } from '../components/header.component.ts';
import { AppSidebarComponent } from '../components/sidebar.component.ts';
import { SlotOutlet } from '../composition/content-slot.ts';
import { mountComponent, unmountComponent } from '../composition/component-host.ts';
import type { ComponentRef } from '@jarvis/runtime';

/**
 * DashboardLayoutComponent: High-density layout tailored for analytics and operations.
 * Features a collapsible mini-sidebar, sub-header toolbar slot, and high-performance scroll outlet.
 */
export class DashboardLayoutComponent {
  readonly config = input<LayoutConfig>({
    showHeader: true,
    showSidebar: true,
    showFooter: false,
    sidebarCollapsible: true,
    sidebarCollapsed: false,
    contentWidth: 'wide',
  });

  readonly navItems = input<NavItem[]>([]);
  readonly appTitle = input<string>('JARVIS Analytics & Operations');

  readonly sidebarOpen = signal<boolean>(true);
  readonly sidebarCollapsed = signal<boolean>(false);

  private headerRef: ComponentRef<AppHeaderComponent> | null = null;
  private sidebarRef: ComponentRef<AppSidebarComponent> | null = null;
  private toolbarOutlet: SlotOutlet | null = null;
  private contentOutlet: SlotOutlet | null = null;

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  toggleCollapsed(): void {
    this.sidebarCollapsed.update((c) => !c);
  }

  render(r: Renderer): any {
    const root = r.createElement('div');
    r.setAttribute(root, 'class', 'jarvis-layout-shell jarvis-layout-shell--dashboard');

    // 1. Header with custom actions slot
    const headerBox = r.createElement('div');
    r.setAttribute(headerBox, 'class', 'jarvis-layout-shell__header-slot');
    this.headerRef = mountComponent(r, AppHeaderComponent, headerBox, {
      inputs: {
        title: this.appTitle(),
        sidebarOpen: this.sidebarOpen(),
        sticky: true,
      },
      outputs: {
        menuToggle: () => this.toggleSidebar(),
      },
    });
    r.appendChild(root, headerBox);

    // 2. Middle Body
    const bodyBox = r.createElement('div');
    r.setAttribute(bodyBox, 'class', 'jarvis-layout-shell__body');

    // Sidebar
    const sidebarBox = r.createElement('div');
    r.setAttribute(sidebarBox, 'class', 'jarvis-layout-shell__sidebar-slot');
    effect(() => {
      sidebarBox.style = this.sidebarOpen() ? '' : 'display: none;';
    });

    this.sidebarRef = mountComponent(r, AppSidebarComponent, sidebarBox, {
      inputs: {
        navItems: this.navItems(),
        collapsed: this.sidebarCollapsed(),
      },
    });
    r.appendChild(bodyBox, sidebarBox);

    // Main Content container with dedicated Toolbar Slot
    const contentBox = r.createElement('main');
    r.setAttribute(contentBox, 'role', 'main');
    r.setAttribute(contentBox, 'class', 'jarvis-layout-shell__content jarvis-dashboard-content');

    // Sub-header / Toolbar Slot for KPIs and Quick Filters
    const toolbarContainer = r.createElement('div');
    r.setAttribute(toolbarContainer, 'class', 'jarvis-dashboard-toolbar');
    this.toolbarOutlet = new SlotOutlet(r, 'toolbar');
    r.appendChild(toolbarContainer, this.toolbarOutlet.getElement());
    r.appendChild(contentBox, toolbarContainer);

    // Primary Content Outlet
    this.contentOutlet = new SlotOutlet(r, 'content');
    r.appendChild(contentBox, this.contentOutlet.getElement());

    r.appendChild(bodyBox, contentBox);
    r.appendChild(root, bodyBox);

    return root;
  }

  getContentOutlet(): SlotOutlet | null {
    return this.contentOutlet;
  }

  getToolbarOutlet(): SlotOutlet | null {
    return this.toolbarOutlet;
  }

  onDestroy(): void {
    if (this.headerRef) {
      unmountComponent(this.headerRef);
      this.headerRef = null;
    }
    if (this.sidebarRef) {
      unmountComponent(this.sidebarRef);
      this.sidebarRef = null;
    }
    if (this.toolbarOutlet) {
      this.toolbarOutlet.destroy();
      this.toolbarOutlet = null;
    }
    if (this.contentOutlet) {
      this.contentOutlet.destroy();
      this.contentOutlet = null;
    }
  }
}

Component({
  selector: 'jarvis-dashboard-layout',
})(DashboardLayoutComponent);
