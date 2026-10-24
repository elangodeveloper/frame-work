import type { Renderer } from '@jarvis/renderer';
import { Component, input } from '@jarvis/core';
import type { LayoutConfig } from '../contracts/layout.contract.ts';
import { SlotOutlet } from '../composition/content-slot.ts';

/**
 * AuthLayoutComponent: Minimal, distraction-free layout for authentication workflows.
 * No navigation sidebars, optimized for login, registration, and password recovery.
 */
export class AuthLayoutComponent {
  readonly config = input<LayoutConfig>({
    showHeader: false,
    showSidebar: false,
    showFooter: true,
    contentWidth: 'narrow',
  });

  readonly brandName = input<string>('JARVIS Portal');
  readonly brandSubtitle = input<string>('Enterprise Identity & Access Management');

  private contentOutlet: SlotOutlet | null = null;

  render(r: Renderer): any {
    const root = r.createElement('div');
    r.setAttribute(root, 'class', 'jarvis-auth-layout');

    // Centered or Split Container
    const cardWrapper = r.createElement('div');
    r.setAttribute(cardWrapper, 'class', 'jarvis-auth-layout__card-wrapper');

    // Header Branding
    const brandBox = r.createElement('div');
    r.setAttribute(brandBox, 'class', 'jarvis-auth-layout__brand');

    const logo = r.createElement('div');
    r.setAttribute(logo, 'class', 'jarvis-auth-layout__logo');
    logo.innerHTML = '&#9733;';
    r.appendChild(brandBox, logo);

    const title = r.createElement('h1');
    r.setAttribute(title, 'class', 'jarvis-auth-layout__title');
    r.bindText(title, () => this.brandName());
    r.appendChild(brandBox, title);

    const subtitle = r.createElement('p');
    r.setAttribute(subtitle, 'class', 'jarvis-auth-layout__subtitle');
    r.bindText(subtitle, () => this.brandSubtitle());
    r.appendChild(brandBox, subtitle);

    r.appendChild(cardWrapper, brandBox);

    // Primary Content Outlet (Active Screen: Login, Register, Forgot Password)
    const contentBox = r.createElement('div');
    r.setAttribute(contentBox, 'class', 'jarvis-auth-layout__content');
    this.contentOutlet = new SlotOutlet(r, 'content');
    r.appendChild(contentBox, this.contentOutlet.getElement());
    r.appendChild(cardWrapper, contentBox);

    // Minimal Footer
    const footer = r.createElement('footer');
    r.setAttribute(footer, 'class', 'jarvis-auth-layout__footer');
    const copy = r.createElement('p');
    copy.textContent = '© 2026 JARVIS Secure System. All rights reserved.';
    r.appendChild(footer, copy);
    r.appendChild(cardWrapper, footer);

    r.appendChild(root, cardWrapper);
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
  selector: 'jarvis-auth-layout',
})(AuthLayoutComponent);
