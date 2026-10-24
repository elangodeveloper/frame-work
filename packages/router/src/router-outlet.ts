import type { Renderer } from '../../renderer/src/index.ts';
import { effect, getComponentDef, Injector } from '../../core/src/index.ts';
import type { Router } from './router.ts';
import type { RouteMatch } from './types.ts';

export interface RouterOutletOptions {
  name?: string;
  injector?: Injector;
}

export interface RouteReuseStrategy {
  shouldReuseRoute(future: RouteMatch, curr: RouteMatch): boolean;
}

export class DefaultRouteReuseStrategy implements RouteReuseStrategy {
  shouldReuseRoute(future: RouteMatch, curr: RouteMatch): boolean {
    return (
      future.route === curr.route ||
      (future.route.path === curr.route.path && future.route.component === curr.route.component)
    );
  }
}

/**
 * RouterOutlet acts as a dynamic viewport for active routed components.
 * Supports:
 * - Named outlets (e.g. outlet="sidebar")
 * - Route reuse: updating inputs & signals on the same component instance reactively without recreating the DOM
 * - Route-level DI scopes (route.providers)
 * - Automatic cleanup of child scope, component lifecycle (onDestroy), and effects with 0 memory leaks
 */
export class RouterOutlet {
  readonly name: string;
  private readonly renderer: Renderer;
  private readonly router: Router;
  private readonly container: any;
  private currentComponentInstance: any = null;
  private currentRootNode: any = null;
  private currentMatch: RouteMatch | null = null;
  private routeInjector: Injector | null = null;
  private disposeEffect: (() => void) | null = null;
  private reuseStrategy: RouteReuseStrategy;

  constructor(
    renderer: Renderer,
    router: Router,
    container?: any,
    options: RouterOutletOptions = {},
    reuseStrategy: RouteReuseStrategy = new DefaultRouteReuseStrategy()
  ) {
    this.renderer = renderer;
    this.router = router;
    this.name = options.name || 'primary';
    this.reuseStrategy = reuseStrategy;
    this.container = container || renderer.createElement('div');
    if (this.container) {
      this.renderer.setAttribute(this.container, 'class', 'jarvis-router-outlet outlet-' + this.name);
    }
    this.init();
  }

  getElement(): any {
    return this.container;
  }

  get isActivated(): boolean {
    return this.currentComponentInstance !== null;
  }

  get component(): any {
    return this.currentComponentInstance;
  }

  private init(): void {
    this.disposeEffect = effect(() => {
      const match = this.router.activeRoute();
      if (match && (match.outlet || 'primary') === this.name) {
        this.activateRoute(match);
      } else if (!match && this.isActivated) {
        this.destroyCurrentComponent();
      }
    });
  }

  private activateRoute(match: RouteMatch): void {
    if (!match.route.component) {
      this.destroyCurrentComponent();
      return;
    }

    const ComponentClass = match.route.component;

    // Helper: bind route params, query params, data, and resolved values to component inputs
    const bindInputs = (inst: any) => {
      if (this.router.options.bindComponentInputs || (this.router as any).bindComponentInputs) {
        const allValues: Record<string, any> = {
          ...match.data,
          ...match.resolvedData,
          ...match.queryParams,
          ...match.params,
        };
        for (const [key, val] of Object.entries(allValues)) {
          if (key in inst) {
            const prop = inst[key];
            if (typeof prop?.set === 'function') {
              prop.set(val);
            } else if (typeof prop !== 'function') {
              inst[key] = val;
            }
          }
        }
      }
    };

    // Route Reuse: If same component class and reuseStrategy says reuse, update inputs & params reactively without destroying DOM!
    if (
      this.currentComponentInstance &&
      this.currentMatch &&
      this.reuseStrategy.shouldReuseRoute(match, this.currentMatch) &&
      this.currentComponentInstance.constructor === ComponentClass
    ) {
      this.currentMatch = match;
      bindInputs(this.currentComponentInstance);
      return;
    }

    // Otherwise destroy previous component cleanly
    this.destroyCurrentComponent();
    this.currentMatch = match;

    // Create route-level DI scope if route.providers is specified
    const parentInjector = Injector.current;
    if (match.route.providers && match.route.providers.length > 0) {
      this.routeInjector = new Injector(parentInjector);
      for (const p of match.route.providers) {
        this.routeInjector.provide(p);
      }
    } else {
      this.routeInjector = parentInjector;
    }

    const prevActiveInjector = Injector.setActive(this.routeInjector);

    let instance: any;
    try {
      instance = new ComponentClass();
    } finally {
      Injector.setActive(prevActiveInjector);
    }

    this.currentComponentInstance = instance;
    this.router.registerActiveComponent(this.name, instance);

    (instance as any).activatedRoute = this.router.activatedRoute;
    (instance as any).router = this.router;

    bindInputs(instance);

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
      this.router.registerActiveComponent(this.name, null);
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

    this.currentMatch = null;
    this.routeInjector = null;
  }

  destroy(): void {
    if (this.disposeEffect) {
      this.disposeEffect();
      this.disposeEffect = null;
    }
    this.destroyCurrentComponent();
  }
}
