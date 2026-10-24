import { Component, input } from '@jarvis/core';
import type { Renderer } from '@jarvis/renderer';

/**
 * AuthPageHeaderComponent: Structured, accessible header for authentication screens
 */
export class AuthPageHeaderComponent {
  readonly badge = input<string>('SECURE IDENTITY GATEWAY');
  readonly title = input<string>('Welcome back');
  readonly subtitle = input<string>('Access your employee workspace.');
  readonly icon = input<string>('pi pi-shield');

  render(r: Renderer): any {
    const root = r.createElement('header');
    r.setAttribute(root, 'class', 'auth-header-container');

    // Badge with lock / shield
    const badgeEl = r.createElement('div');
    r.setAttribute(badgeEl, 'class', 'auth-badge');
    const iconEl = r.createElement('i');
    r.setAttribute(iconEl, 'class', this.icon());
    const badgeText = r.createElement('span');
    r.bindText(badgeText, () => this.badge());
    r.appendChild(badgeEl, iconEl);
    r.appendChild(badgeEl, badgeText);
    r.appendChild(root, badgeEl);

    // Title
    const titleEl = r.createElement('h1');
    r.setAttribute(titleEl, 'class', 'auth-title');
    r.bindText(titleEl, () => this.title());
    r.appendChild(root, titleEl);

    // Subtitle
    const subEl = r.createElement('p');
    r.setAttribute(subEl, 'class', 'auth-subtitle');
    r.bindText(subEl, () => this.subtitle());
    r.appendChild(root, subEl);

    return root;
  }
}

Component({
  selector: 'jarvis-auth-page-header',
  templateUrl: './auth-page-header.component.html',
  styleUrl: './auth-page-header.component.css',
})(AuthPageHeaderComponent);
