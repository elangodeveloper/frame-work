import { Directive } from '@jarvis/core';

@Directive({ selector: '[appTooltip]' })
export class TooltipDirective {
  attach(element: any): void {
    // Attach behavior to DOM element
  }
}
