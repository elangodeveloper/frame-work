import type { Renderer } from '@jarvis/renderer';
import { Component, input } from '@jarvis/core';
import { signal, effect, type Signal } from '@jarvis/reactive';
import type { LayoutConfig, NavItem } from '../contracts/layout.contract.ts';
import { AppHeaderComponent } from '../components/header.component.ts';
import { AppSidebarComponent } from '../components/sidebar.component.ts';
import { AppFooterComponent } from '../components/footer.component.ts';
import { SlotOutlet } from '../composition/content-slot.ts';
import { mountComponent, unmountComponent } from '../composition/component-host.ts';
import type { ComponentRef } from '@jarvis/runtime';

/**
 * MainLayoutComponent: Standard application shell.
 * Composes Header, Sidebar, Main Content Outlet, and Footer using explicit contracts.
 */
export class MainLayoutComponent {
  readonly config = input<LayoutConfig>({
    showHeader: true,
    showSidebar: true,
    showFooter: true,
    sidebarCollapsible: true,
    sidebarCollapsed: false,
    headerSticky: true,
    contentWidth: 'normal',
  });

  readonly navItems = input<NavItem[]>([]);
  readonly appTitle = input<string>('JARVIS Application');
  readonly activeRoute = input<string>('');

  // Internal reactive layout state
  readonly sidebarOpen = signal<boolean>(true);
  readonly sidebarCollapsed = signal<boolean>(false);
  readonly mobileDrawerOpen = signal<boolean>(false);

  private headerRef: ComponentRef<AppHeaderComponent> | null = null;
  private sidebarRef: ComponentRef<AppSidebarComponent> | null = null;
  private footerRef: ComponentRef<AppFooterComponent> | null = null;
  private contentOutlet: SlotOutlet | null = null;
  private rootElement: any = null;

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  toggleCollapsed(): void {
    this.sidebarCollapsed.update((c) => !c);
  }

  toggleMobileDrawer(): void {
    this.mobileDrawerOpen.update((open) => !open);
  }

  closeMobileDrawer(): void {
    this.mobileDrawerOpen.set(false);
  }

  render(r: Renderer): any {
    const shell = r.createElement('div');
    this.rootElement = shell;
    r.setAttribute(shell, 'class', 'jarvis-layout-shell');

    // 1. Mobile backdrop overlay
    const backdrop = r.createElement('div');
    r.setAttribute(backdrop, 'class', 'jarvis-drawer-backdrop');
    effect(() => {
      if (this.mobileDrawerOpen()) {
        r.setAttribute(backdrop, 'class', 'jarvis-drawer-backdrop jarvis-drawer-backdrop--active');
      } else {
        r.setAttribute(backdrop, 'class', 'jarvis-drawer-backdrop');
      }
    });
    r.listen(backdrop, 'click', () => {
      this.closeMobileDrawer();
    });
    r.appendChild(shell, backdrop);

    // 2. Application Header
    const headerContainer = r.createElement('div');
    r.setAttribute(headerContainer, 'class', 'jarvis-layout-shell__header-slot');
    this.headerRef = mountComponent(r, AppHeaderComponent, headerContainer, {
      inputs: {
        title: this.appTitle(),
        sidebarOpen: this.sidebarOpen(),
        sticky: this.config().headerSticky !== false,
      },
      outputs: {
        menuToggle: () => {
          this.toggleSidebar();
          this.toggleMobileDrawer();
        },
      },
    });
    r.appendChild(shell, headerContainer);

    // 3. Middle Body Region (Sidebar + Main Content Area)
    const bodyRegion = r.createElement('div');
    r.setAttribute(bodyRegion, 'class', 'jarvis-layout-shell__body');

    // Sidebar mount container
    const sidebarContainer = r.createElement('div');
    r.setAttribute(sidebarContainer, 'class', 'jarvis-layout-shell__sidebar-slot');
    effect(() => {
      const show = this.sidebarOpen() && (this.config().showSidebar !== false);
      const isMobile = this.mobileDrawerOpen();
      if (!show && !isMobile) {
        sidebarContainer.style = 'display: none;';
      } else {
        sidebarContainer.style = '';
      }
    });

    this.sidebarRef = mountComponent(r, AppSidebarComponent, sidebarContainer, {
      inputs: {
        navItems: this.navItems(),
        collapsed: this.sidebarCollapsed(),
        mobileOpen: this.mobileDrawerOpen(),
        activeRoute: this.activeRoute(),
      },
      outputs: {
        closeMobile: () => this.closeMobileDrawer(),
      },
    });
    r.appendChild(bodyRegion, sidebarContainer);

    // Main Content Region
    const mainRegion = r.createElement('main');
    r.setAttribute(mainRegion, 'role', 'main');
    r.setAttribute(mainRegion, 'class', 'jarvis-layout-shell__content');

    this.contentOutlet = new SlotOutlet(r, 'content');
    r.appendChild(mainRegion, this.contentOutlet.getElement());
    r.appendChild(bodyRegion, mainRegion);

    r.appendChild(shell, bodyRegion);

    // 4. Application Footer
    if (this.config().showFooter !== false) {
      const footerContainer = r.createElement('div');
      r.setAttribute(footerContainer, 'class', 'jarvis-layout-shell__footer-slot');
      this.footerRef = mountComponent(r, AppFooterComponent, footerContainer);
      r.appendChild(shell, footerContainer);
    }

    return shell;
  }

  getContentOutlet(): SlotOutlet | null {
    return this.contentOutlet;
  }

  getHeader(): AppHeaderComponent | null {
    return this.headerRef ? this.headerRef.instance : null;
  }

  getSidebar(): AppSidebarComponent | null {
    return this.sidebarRef ? this.sidebarRef.instance : null;
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
    if (this.footerRef) {
      unmountComponent(this.footerRef);
      this.footerRef = null;
    }
    if (this.contentOutlet) {
      this.contentOutlet.destroy();
      this.contentOutlet = null;
    }
  }
}

Component({
  selector: 'jarvis-main-layout',
})(MainLayoutComponent);
