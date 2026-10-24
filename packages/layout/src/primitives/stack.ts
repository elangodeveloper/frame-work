import type { Renderer } from '@jarvis/renderer';
import { input } from '@jarvis/core';

export type StackDirection = 'vertical' | 'horizontal';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch';
export type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around';

/**
 * Reusable Stack layout primitive for Flexbox alignment and spacing.
 */
export class StackComponent {
  readonly direction = input<StackDirection>('vertical');
  readonly gap = input<string>('var(--jarvis-space-3, 0.75rem)');
  readonly align = input<StackAlign>('stretch');
  readonly justify = input<StackJustify>('start');
  readonly wrap = input<boolean>(false);

  render(r: Renderer): any {
    const el = r.createElement('div');
    const dirClass = this.direction() === 'vertical' ? 'jarvis-stack--col' : 'jarvis-stack--row';
    const alignClass = `jarvis-stack--align-${this.align()}`;
    const justifyClass = `jarvis-stack--justify-${this.justify()}`;
    const wrapClass = this.wrap() ? 'jarvis-stack--wrap' : '';

    r.setAttribute(
      el,
      'class',
      `jarvis-stack ${dirClass} ${alignClass} ${justifyClass} ${wrapClass}`.trim()
    );
    return el;
  }
}
