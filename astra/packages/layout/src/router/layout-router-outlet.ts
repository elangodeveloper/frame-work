import type { Renderer } from '@jarvis/renderer';
import type { Router, RouteMatch } from '@jarvis/router';
import { effect } from '@jarvis/reactive';
import { LayoutRegistry, defaultLayoutRegistry } from './layout-registry.ts';
import type { LayoutConfig } from '../contracts/layout.contract.ts';
import { mountComponent, unmountComponent } from '../composition/component-host.ts';
import type { ComponentRef } from '@jarvis/runtime';
import type { SlotOutlet } from '../composition/content-slot.ts';

export interface LayoutRouterOutletOptions {
  name?: string;
  defaultLayout?: string;
  registry?: LayoutRegistry;
}

/**
 * LayoutRouterOutlet: Connects routing with the layout composition system.
 * Resolves layouts declaratively via route metadata, optimizes layout reuse,
 * and renders routed screens into layout content outlets.
 */
export class LayoutRouterOutlet {
  readonly name: string;
  private readonly renderer: Renderer;
  private readonly router: Router;
  private readonly registry: LayoutRegistry;
  private readonly container: any;
  private readonly defaultLayout: string;

  private currentLayoutRef: ComponentRef | null = null;
  private currentLayoutClass: any = null;
  private currentScreenRef: ComponentRef | null = null;
  private disposeEffect: (() => void) | null = null;

  constructor(
    renderer: Renderer,
    router: Router,
    container?: any,
    options: LayoutRouterOutletOptions = {}
  ) {
    this.renderer = renderer;
    this.router = router;
    this.registry = options.registry || defaultLayoutRegistry;
    this.defaultLayout = options.defaultLayout || 'main';
    this.name = options.name || 'primary';
    this.container = container || renderer.createElement('div');

    if (this.container) {
      renderer.setAttribute(
        this.container,
        'class',
        `jarvis-layout-router-outlet outlet-${this.name}`
      );
    }

    this.init();
  }

  getElement(): any {
    return this.container;
  }

  getCurrentLayout(): any | null {
    return this.currentLayoutRef ? this.currentLayoutRef.instance : null;
  }

  getCurrentScreen(): any | null {
    return this.currentScreenRef ? this.currentScreenRef.instance : null;
  }

  private init(): void {
    this.disposeEffect = effect(() => {
      const match = this.router.activeRoute();
      if (match && (match.outlet || 'primary') === this.name) {
        this.activateRouteWithLayout(match);
      }
    });
  }

  resolveLayout(layoutSpec: any, url: string): any {
    if (typeof layoutSpec === 'function') {
      return layoutSpec;
    }
    if (typeof layoutSpec === 'string') {
      if (layoutSpec.toLowerCase() === 'none') {
        return null;
      }
      const def = this.registry.get(layoutSpec);
      if (!def) {
        const registered = this.registry.getRegisteredNames().join(', ');
        throw new Error(
          `[JARVIS Layout Error] Unknown layout '${layoutSpec}' requested by route '${url}'. Registered layouts: [${registered}].`
        );
      }
      return def.component;
    }
    return null;
  }

  private activateRouteWithLayout(match: RouteMatch): void {
    if (!match.route.component) {
      this.clearScreen();
      return;
    }

    // 1. Resolve Layout specification from route data (or defaults)
    const layoutSpec = match.route.data?.layout ?? match.data?.layout ?? this.defaultLayout;
    const layoutConfig: LayoutConfig = {
      ...(match.route.data?.layoutConfig || match.data?.layoutConfig || {}),
    };

    const targetLayoutClass = this.resolveLayout(layoutSpec, match.url);
    if (typeof layoutSpec === 'string' && layoutSpec.toLowerCase() !== 'none') {
      const def = this.registry.get(layoutSpec);
      if (def?.defaultConfig) {
        Object.assign(layoutConfig, { ...def.defaultConfig, ...layoutConfig });
      }
    }

    // 2. Determine if we can preserve the existing layout instance
    const isSameLayout =
      this.currentLayoutClass === targetLayoutClass &&
      this.currentLayoutRef !== null;

    if (!isSameLayout) {
      // Layout changed (e.g. from 'main' to 'auth') -> Destroy old layout and screen
      this.destroyCurrentLayout();

      if (targetLayoutClass) {
        // Instantiate and mount the new Layout
        this.currentLayoutClass = targetLayoutClass;
        this.currentLayoutRef = mountComponent(
          this.renderer,
          targetLayoutClass,
          this.container,
          {
            inputs: {
              config: layoutConfig,
              activeRoute: match.pathname,
            },
          }
        );
      }
    } else {
      // Reusing existing layout -> update route-dependent inputs without DOM destruction
      if (this.currentLayoutRef) {
        this.currentLayoutRef.setInput('activeRoute', match.pathname);
        if (Object.keys(layoutConfig).length > 0) {
          this.currentLayoutRef.setInput('config', layoutConfig);
        }
      }
    }

    // 3. Resolve the target content outlet for screen mounting
    let contentTargetEl: any = this.container;
    let slotOutlet: SlotOutlet | null = null;

    if (this.currentLayoutRef) {
      const layoutInstance = this.currentLayoutRef.instance;
      if (typeof layoutInstance.getContentOutlet === 'function') {
        slotOutlet = layoutInstance.getContentOutlet();
      }
    }

    // 4. Destroy previous screen and mount the new screen component
    this.clearScreen();

    const ScreenClass = match.route.component;
    if (slotOutlet) {
      // Mount via layout's content slot outlet
      this.currentScreenRef = slotOutlet.project(ScreenClass, {
        activatedRoute: this.router.activatedRoute,
        router: this.router,
        routeData: match.data,
      });
    } else {
      // Fallback direct mount into outlet container
      this.currentScreenRef = mountComponent(
        this.renderer,
        ScreenClass,
        contentTargetEl,
        {
          inputs: {
            activatedRoute: this.router.activatedRoute,
            router: this.router,
            routeData: match.data,
          },
        }
      );
    }

    // Pass activatedRoute and router references
    if (this.currentScreenRef) {
      const screenInstance = this.currentScreenRef.instance;
      (screenInstance as any).activatedRoute = this.router.activatedRoute;
      (screenInstance as any).router = this.router;
    }
  }

  private clearScreen(): void {
    if (this.currentScreenRef) {
      unmountComponent(this.currentScreenRef);
      this.currentScreenRef = null;
    }
  }

  private destroyCurrentLayout(): void {
    this.clearScreen();
    if (this.currentLayoutRef) {
      unmountComponent(this.currentLayoutRef);
      this.currentLayoutRef = null;
      this.currentLayoutClass = null;
    }
  }

  destroy(): void {
    if (this.disposeEffect) {
      this.disposeEffect();
      this.disposeEffect = null;
    }
    this.destroyCurrentLayout();
  }
}
