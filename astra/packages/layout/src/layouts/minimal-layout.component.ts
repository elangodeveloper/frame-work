import type { Renderer } from '@jarvis/renderer';
import { Component, input } from '@jarvis/core';
import type { LayoutConfig } from '../contracts/layout.contract.ts';
import { SlotOutlet } from '../composition/content-slot.ts';

/**
 * MinimalLayoutComponent: Clean, distraction-free container layout.
 * No navigation sidebar or large headers. Perfect for wizards, print reports, and full-screen views.
 */
export class MinimalLayoutComponent {
  readonly config = input<LayoutConfig>({
    showHeader: false,
    showSidebar: false,
    showFooter: false,
    contentWidth: 'wide',
  });

  private contentOutlet: SlotOutlet | null = null;

  render(r: Renderer): any {
    const root = r.createElement('div');
    r.setAttribute(root, 'class', 'jarvis-minimal-layout');

    const main = r.createElement('main');
    r.setAttribute(main, 'role', 'main');
    r.setAttribute(main, 'class', 'jarvis-minimal-layout__content');

    this.contentOutlet = new SlotOutlet(r, 'content');
    r.appendChild(main, this.contentOutlet.getElement());

    r.appendChild(root, main);
    return root;
  }

  getContentOutlet(): SlotOutlet | null {
    return this.contentOutlet;
  }

  onDestroy(): void {
    if (this.contentOutlet) {
      this.contentOutlet.destroy();
      this.contentOutlet = null;
    }
  }
}

Component({
  selector: 'jarvis-minimal-layout',
})(MinimalLayoutComponent);
