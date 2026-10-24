import type { ComponentOptions, ComponentDef } from './metadata.ts';
import { setComponentDef } from './metadata.ts';

/**
 * Class decorator declaring a JARVIS component.
 * Can be used as @Component(options) or Component(options)(Class).
 */
export function Component(options: ComponentOptions): <T extends new (...args: any[]) => any>(target: T) => T;
export function Component<T extends new (...args: any[]) => any>(options: ComponentOptions, target: T): T;
export function Component(options: ComponentOptions, maybeTarget?: any): any {
  const decorator = function <T extends new (...args: any[]) => any>(target: T): T {
    const def: ComponentDef<InstanceType<T>> = {
      type: target,
      selector: options.selector,
      template: options.template,
      templateUrl: options.templateUrl,
      styles: options.styles ? [...options.styles] : [],
      styleUrl: options.styleUrl,
      styleUrls: options.styleUrls ? [...options.styleUrls] : [],
    };

    setComponentDef(target, def);
    return target;
  };

  if (maybeTarget) {
    return decorator(maybeTarget);
  }
  return decorator;
}

/**
 * Lifecycle hook interfaces.
 */
export interface OnInit {
  onInit(): void;
}

export interface AfterRender {
  afterRender(): void;
}

export interface OnDestroy {
  onDestroy(): void;
}
