import type { Renderer } from '@jarvis/renderer';
import { input } from '@jarvis/core';

/**
 * ContentRegion primitive representing the primary main scrollable outlet area.
 */
export class ContentRegionComponent {
  readonly padding = input<string>('var(--jarvis-space-6, 1.5rem)');

  render(r: Renderer): any {
    const el = r.createElement('main');
    r.setAttribute(el, 'role', 'main');
    r.setAttribute(el, 'class', 'jarvis-layout__content');
    return el;
  }
}
