import { signal, computed, type Signal } from '@jarvis/reactive';
import type { LayoutConfig } from '../contracts/layout.contract.ts';

/**
 * Scoped/Injectable service managing dynamic layout states.
 * Uses fine-grained reactive signals with zero RxJS dependencies.
 */
export class LayoutStateService {
  readonly sidebarOpen = signal<boolean>(true);
  readonly sidebarCollapsed = signal<boolean>(false);
  readonly isMobile = signal<boolean>(false);
  readonly mobileDrawerOpen = signal<boolean>(false);
  readonly activeLayout = signal<string>('main');
  readonly config = signal<LayoutConfig>({
    showHeader: true,
    showSidebar: true,
    showFooter: true,
    sidebarCollapsible: true,
    sidebarCollapsed: false,
    headerSticky: true,
    contentWidth: 'normal',
    theme: 'light',
  });

  readonly isSidebarVisible = computed<boolean>(() => {
    if (this.isMobile()) {
      return this.mobileDrawerOpen();
    }
    return this.sidebarOpen() && (this.config().showSidebar !== false);
  });

  toggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileDrawerOpen.update((open) => !open);
    } else {
      this.sidebarOpen.update((open) => !open);
    }
  }

  setSidebarOpen(open: boolean): void {
    if (this.isMobile()) {
      this.mobileDrawerOpen.set(open);
    } else {
      this.sidebarOpen.set(open);
    }
  }

  toggleCollapsed(): void {
    this.sidebarCollapsed.update((c) => !c);
  }

  setCollapsed(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
  }

  toggleMobileDrawer(): void {
    this.mobileDrawerOpen.update((open) => !open);
  }

  closeMobileDrawer(): void {
    this.mobileDrawerOpen.set(false);
  }

  setMobile(mobile: boolean): void {
    this.isMobile.set(mobile);
    if (!mobile) {
      this.mobileDrawerOpen.set(false);
    }
  }

  updateConfig(patch: Partial<LayoutConfig>): void {
    this.config.update((prev) => ({ ...prev, ...patch }));
    if (patch.sidebarCollapsed !== undefined) {
      this.sidebarCollapsed.set(patch.sidebarCollapsed);
    }
    if (patch.showSidebar !== undefined) {
      this.sidebarOpen.set(patch.showSidebar);
    }
  }

  reset(): void {
    this.sidebarOpen.set(true);
    this.sidebarCollapsed.set(false);
    this.mobileDrawerOpen.set(false);
    this.activeLayout.set('main');
  }
}
