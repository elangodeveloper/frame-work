import type { Renderer } from '@jarvis/renderer';
import { input } from '@jarvis/core';

export type GridCols = 1 | 2 | 3 | 4 | 6 | 12;

/**
 * Reusable Responsive Grid layout primitive.
 */
export class GridComponent {
  readonly cols = input<GridCols>(3);
  readonly gap = input<string>('var(--jarvis-space-4, 1rem)');
  readonly responsive = input<boolean>(true);

  render(r: Renderer): any {
    const el = r.createElement('div');
    const colsClass = `jarvis-grid--cols-${this.cols()}`;
    const respClass = this.responsive() ? 'jarvis-grid--responsive' : '';

    r.setAttribute(el, 'class', `jarvis-grid ${colsClass} ${respClass}`.trim());
    return el;
  }
}
