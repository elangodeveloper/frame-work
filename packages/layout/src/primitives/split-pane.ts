import type { Renderer } from '@jarvis/renderer';
import { input } from '@jarvis/core';

/**
 * SplitPane layout primitive for multi-panel master-detail or editor layouts.
 */
export class SplitPaneComponent {
  readonly ratio = input<string>('30% 70%');
  readonly direction = input<'row' | 'column'>('row');

  render(r: Renderer): any {
    const el = r.createElement('div');
    r.setAttribute(el, 'class', `jarvis-split-pane jarvis-split-pane--${this.direction()}`);
    return el;
  }
}
