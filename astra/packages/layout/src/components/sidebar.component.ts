import type { Renderer } from '@jarvis/renderer';
import { input, output } from '@jarvis/core';
import { effect } from '@jarvis/reactive';
import type { NavItem } from '../contracts/layout.contract.ts';
import { SlotOutlet } from '../composition/content-slot.ts';

/**
 * AppSidebarComponent: Navigation sidebar and drawer.
 * Completely decoupled from concrete screens and feature business logic.
 */
export class AppSidebarComponent {
  readonly navItems = input<NavItem[]>([]);
  readonly collapsed = input<boolean>(false);
  readonly mobileOpen = input<boolean>(false);
  readonly activeRoute = input<string>('');

  readonly navSelect = output<NavItem>();
  readonly closeMobile = output<void>();

  private sidebarEl: any = null;
  private headerSlotOutlet: SlotOutlet | null = null;
  private footerSlotOutlet: SlotOutlet | null = null;

  render(r: Renderer): any {
    const aside = r.createElement('aside');
    this.sidebarEl = aside;
    r.setAttribute(aside, 'role', 'navigation');
    r.setAttribute(aside, 'aria-label', 'Sidebar Navigation');

    // Dynamic classes based on collapsed and mobile drawer state
    effect(() => {
      const isCollapsed = this.collapsed();
      const isMobileOpen = this.mobileOpen();
      const classes = [
        'jarvis-sidebar',
        isCollapsed ? 'jarvis-sidebar--collapsed' : '',
        isMobileOpen ? 'jarvis-sidebar--mobile-open' : '',
      ]
        .filter(Boolean)
        .join(' ');
      r.setAttribute(aside, 'class', classes);
    });

    // Mobile Close Button (shown on mobile viewport)
    const mobileCloseBar = r.createElement('div');
    r.setAttribute(mobileCloseBar, 'class', 'jarvis-sidebar__mobile-close-bar');
    const closeBtn = r.createElement('button');
    r.setAttribute(closeBtn, 'type', 'button');
    r.setAttribute(closeBtn, 'class', 'jarvis-sidebar__close-btn');
    r.setAttribute(closeBtn, 'aria-label', 'Close Navigation Drawer');
    closeBtn.innerHTML = '&times;';
    r.listen(closeBtn, 'click', () => {
      this.closeMobile.emit();
    });
    r.appendChild(mobileCloseBar, closeBtn);
    r.appendChild(aside, mobileCloseBar);

    // Sidebar Header Slot (e.g. Branding / Logo / User info)
    const headerWrapper = r.createElement('div');
    r.setAttribute(headerWrapper, 'class', 'jarvis-sidebar__header');
    this.headerSlotOutlet = new SlotOutlet(r, 'sidebar-header');
    r.appendChild(headerWrapper, this.headerSlotOutlet.getElement());
    r.appendChild(aside, headerWrapper);

    // Navigation Menu List
    const navList = r.createElement('ul');
    r.setAttribute(navList, 'class', 'jarvis-sidebar__nav-list');
    r.setAttribute(navList, 'role', 'menubar');

    effect(() => {
      // Clear existing menu items
      navList.innerHTML = '';
      const items = this.navItems();
      const current = this.activeRoute();

      for (const item of items) {
        const li = r.createElement('li');
        r.setAttribute(li, 'role', 'none');
        r.setAttribute(li, 'class', 'jarvis-sidebar__nav-item');

        const btn = r.createElement('button');
        r.setAttribute(btn, 'type', 'button');
        r.setAttribute(btn, 'role', 'menuitem');
        const isActive = current === item.route;
        r.setAttribute(
          btn,
          'class',
          `jarvis-sidebar__nav-link ${isActive ? 'jarvis-sidebar__nav-link--active' : ''}`
        );
        r.setAttribute(btn, 'data-route', item.route || '');

        if (item.icon) {
          const icon = r.createElement('span');
          r.setAttribute(icon, 'class', `jarvis-nav-icon ${item.icon}`);
          r.appendChild(btn, icon);
        }

        const label = r.createElement('span');
        r.setAttribute(label, 'class', 'jarvis-nav-label');
        r.appendChild(label, r.createText(item.label));
        r.appendChild(btn, label);

        if (item.badge) {
          const badge = r.createElement('span');
          r.setAttribute(badge, 'class', `jarvis-nav-badge jarvis-nav-badge--${item.badgeSeverity || 'info'}`);
          r.appendChild(badge, r.createText(item.badge));
          r.appendChild(btn, badge);
        }

        r.listen(btn, 'click', () => {
          this.navSelect.emit(item);
        });

        r.appendChild(li, btn);
        r.appendChild(navList, li);
      }
    });

    r.appendChild(aside, navList);

    // Sidebar Footer Slot (e.g. User Profile summary / Sign out button)
    const footerWrapper = r.createElement('div');
    r.setAttribute(footerWrapper, 'class', 'jarvis-sidebar__footer');
    this.footerSlotOutlet = new SlotOutlet(r, 'sidebar-footer');
    r.appendChild(footerWrapper, this.footerSlotOutlet.getElement());
    r.appendChild(aside, footerWrapper);

    return aside;
  }

  getHeaderSlot(): SlotOutlet | null {
    return this.headerSlotOutlet;
  }

  getFooterSlot(): SlotOutlet | null {
    return this.footerSlotOutlet;
  }

  onDestroy(): void {
    if (this.headerSlotOutlet) {
      this.headerSlotOutlet.destroy();
      this.headerSlotOutlet = null;
    }
    if (this.footerSlotOutlet) {
      this.footerSlotOutlet.destroy();
      this.footerSlotOutlet = null;
    }
  }
}
