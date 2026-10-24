import type { Renderer } from '@jarvis/renderer';
import { input, output } from '@jarvis/core';
import { effect } from '@jarvis/reactive';
import { SlotOutlet } from '../composition/content-slot.ts';

/**
 * AppHeaderComponent: Structural application top bar.
 * Emits menuToggle event to communicate with parent layout without direct coupling to sidebar.
 */
export class AppHeaderComponent {
  readonly title = input<string>('JARVIS Enterprise');
  readonly showMenuToggle = input<boolean>(true);
  readonly sticky = input<boolean>(true);
  readonly sidebarOpen = input<boolean>(true);

  readonly menuToggle = output<void>();

  private actionsOutlet: SlotOutlet | null = null;
  private rootElement: any = null;

  render(r: Renderer): any {
    const header = r.createElement('header');
    this.rootElement = header;
    r.setAttribute(header, 'role', 'banner');

    const stickyClass = this.sticky() ? 'jarvis-header--sticky' : '';
    r.setAttribute(header, 'class', `jarvis-header ${stickyClass}`.trim());

    // Left container: Menu Toggle & Title
    const leftBox = r.createElement('div');
    r.setAttribute(leftBox, 'class', 'jarvis-header__left');

    if (this.showMenuToggle()) {
      const toggleBtn = r.createElement('button');
      r.setAttribute(toggleBtn, 'type', 'button');
      r.setAttribute(toggleBtn, 'class', 'jarvis-header__toggle-btn');
      r.setAttribute(toggleBtn, 'aria-label', 'Toggle Navigation Menu');

      effect(() => {
        r.setAttribute(toggleBtn, 'aria-expanded', String(this.sidebarOpen()));
      });

      const icon = r.createElement('span');
      r.setAttribute(icon, 'class', 'jarvis-icon jarvis-icon--menu');
      icon.innerHTML = '&#9776;';
      r.appendChild(toggleBtn, icon);

      r.listen(toggleBtn, 'click', () => {
        this.menuToggle.emit();
      });

      r.appendChild(leftBox, toggleBtn);
    }

    const titleEl = r.createElement('h1');
    r.setAttribute(titleEl, 'class', 'jarvis-header__title');
    r.bindText(titleEl, () => this.title());
    r.appendChild(leftBox, titleEl);

    // Right container: Actions Slot
    const rightBox = r.createElement('div');
    r.setAttribute(rightBox, 'class', 'jarvis-header__right');

    this.actionsOutlet = new SlotOutlet(r, 'header-actions');
    r.appendChild(rightBox, this.actionsOutlet.getElement());

    r.appendChild(header, leftBox);
    r.appendChild(header, rightBox);

    return header;
  }

  getActionsOutlet(): SlotOutlet | null {
    return this.actionsOutlet;
  }

  onDestroy(): void {
    if (this.actionsOutlet) {
      this.actionsOutlet.destroy();
      this.actionsOutlet = null;
    }
  }
}
