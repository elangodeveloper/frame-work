import type { Renderer } from '@jarvis/renderer';
import { input } from '@jarvis/core';

export type ContainerWidth = 'full' | 'wide' | 'normal' | 'narrow';

/**
 * Reusable Container layout primitive for constraining content width.
 */
export class ContainerComponent {
  readonly width = input<ContainerWidth>('normal');
  readonly centered = input<boolean>(true);
  readonly padding = input<string>('var(--jarvis-space-4, 1rem)');

  render(r: Renderer): any {
    const el = r.createElement('div');
    const widthClass = `jarvis-container--${this.width()}`;
    const centerClass = this.centered() ? 'jarvis-container--centered' : '';
    r.setAttribute(el, 'class', `jarvis-container ${widthClass} ${centerClass}`.trim());
    return el;
  }
}
