import type { Renderer } from '../../renderer/src/index.ts';
import { effect } from '../../reactive/src/index.ts';
import { getComponentDef } from '../../core/src/index.ts';
import type { Router } from './router.ts';
import type { RouteMatch } from './types.ts';

export interface RouterOutletOptions {
  name?: string;
}

/**
 * RouterOutlet acts as a dynamic viewport for active routed components.
 * Supports named outlets, lifecycle management, and automatic effect teardown with zero memory leaks.
 */
export class RouterOutlet {
  readonly name: string;
  private readonly renderer: Renderer;
  private readonly router: Router;
  private readonly container: any;
  private currentComponentInstance: any = null;
  private currentRootNode: any = null;
  private disposeEffect: (() => void) | null = null;

  constructor(renderer: Renderer, router: Router, container?: any, options: RouterOutletOptions = {}) {
    this.renderer = renderer;
    this.router = router;
    this.name = options.name || 'primary';
    this.container = container || renderer.createElement('div');
    if (this.container) {
      this.renderer.setAttribute(this.container, 'class', 'astra-router-outlet outlet-' + this.name);
    }
    this.init();
  }

  getElement(): any {
    return this.container;
  }

  private init(): void {
    this.disposeEffect = effect(() => {
      const match = this.router.activeRoute();
      if (match && (match.outlet || 'primary') === this.name) {
        this.activateRoute(match);
      }
    });
  }

  private activateRoute(match: RouteMatch | null): void {
    this.destroyCurrentComponent();

    if (!match || !match.route.component) {
      return;
    }

    const ComponentClass = match.route.component;
    const instance = new ComponentClass();
    this.currentComponentInstance = instance;

    (instance as any).activatedRoute = this.router.activatedRoute;
    (instance as any).router = this.router;

    if (typeof instance.onInit === 'function') {
      instance.onInit();
    }

    let rootNode: any = null;
    const def = getComponentDef(ComponentClass);
    if (def && typeof def.templateFn === 'function') {
      const res = def.templateFn(this.renderer, instance);
      rootNode = res.root;
    } else if (typeof instance.render === 'function') {
      rootNode = instance.render(this.renderer);
    } else if (typeof instance.getElement === 'function') {
      rootNode = instance.getElement();
    }

    if (rootNode) {
      this.currentRootNode = rootNode;
      this.renderer.appendChild(this.container, rootNode);
    }

    if (typeof instance.afterRender === 'function') {
      instance.afterRender();
    }
  }

  private destroyCurrentComponent(): void {
    if (this.currentComponentInstance) {
      if (typeof this.currentComponentInstance.onDestroy === 'function') {
        this.currentComponentInstance.onDestroy();
      }
      if (typeof this.currentComponentInstance.destroy === 'function') {
        this.currentComponentInstance.destroy();
      }
      this.currentComponentInstance = null;
    }

    if (this.currentRootNode && this.container) {
      this.renderer.removeChild(this.container, this.currentRootNode);
      this.currentRootNode = null;
    }
  }

  destroy(): void {
    if (this.disposeEffect) {
      this.disposeEffect();
      this.disposeEffect = null;
    }
    this.destroyCurrentComponent();
  }
}
