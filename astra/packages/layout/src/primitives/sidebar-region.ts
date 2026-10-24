import type { Renderer } from '@jarvis/renderer';
import { input } from '@jarvis/core';

/**
 * SidebarRegion primitive representing an aside layout container with responsive drawers.
 */
export class SidebarRegionComponent {
  readonly collapsed = input<boolean>(false);
  readonly mobileOpen = input<boolean>(false);
  readonly width = input<string>('260px');

  render(r: Renderer): any {
    const el = r.createElement('aside');
    r.setAttribute(el, 'role', 'navigation');
    r.setAttribute(el, 'aria-label', 'Sidebar Navigation');

    const collapsedClass = this.collapsed() ? 'jarvis-sidebar--collapsed' : '';
    const mobileClass = this.mobileOpen() ? 'jarvis-sidebar--mobile-open' : '';

    r.setAttribute(el, 'class', `jarvis-layout__sidebar ${collapsedClass} ${mobileClass}`.trim());
    return el;
  }
}
