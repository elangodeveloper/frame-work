import type { Renderer } from '@jarvis/renderer';
import { input } from '@jarvis/core';

/**
 * AppFooterComponent: Standard application footer region.
 */
export class AppFooterComponent {
  readonly copyright = input<string>('© 2026 JARVIS Framework. All rights reserved.');
  readonly links = input<Array<{ label: string; href: string }>>([
    { label: 'Privacy', href: '#' },
    { label: 'Terms', href: '#' },
    { label: 'Support', href: '#' },
  ]);

  render(r: Renderer): any {
    const footer = r.createElement('footer');
    r.setAttribute(footer, 'role', 'contentinfo');
    r.setAttribute(footer, 'class', 'jarvis-footer');

    const copyEl = r.createElement('p');
    r.setAttribute(copyEl, 'class', 'jarvis-footer__copyright');
    r.bindText(copyEl, () => this.copyright());
    r.appendChild(footer, copyEl);

    const linksBox = r.createElement('nav');
    r.setAttribute(linksBox, 'class', 'jarvis-footer__links');

    for (const link of this.links()) {
      const a = r.createElement('a');
      r.setAttribute(a, 'href', link.href);
      r.setAttribute(a, 'class', 'jarvis-footer__link');
      r.appendChild(a, r.createText(link.label));
      r.appendChild(linksBox, a);
    }

    r.appendChild(footer, linksBox);
    return footer;
  }
}
