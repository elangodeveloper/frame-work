import { Router } from './router.ts';
import type { Route, Routes, RouterOptions, ExtraOptions } from './types.ts';

export * from './types.ts';
export * from './param-map.ts';
export * from './url-tree.ts';
export * from './trie.ts';
export * from './activated-route.ts';
export * from './router.ts';
export * from './router-outlet.ts';
export * from './router-link.ts';

export type RouterFeature = (options: RouterOptions) => void;

export const PreloadAllModules = {
  preload(route: Route, fn: () => Promise<any>): Promise<any> {
    return fn();
  },
};

export const NoPreloading = {
  preload(_route: Route, _fn: () => Promise<any>): Promise<any> {
    return Promise.resolve(null);
  },
};

export function withComponentInputBinding(): RouterFeature {
  return (options: RouterOptions) => {
    options.bindComponentInputs = true;
  };
}

export function withViewTransitions(): RouterFeature {
  return (options: RouterOptions) => {
    options.viewTransitions = true;
  };
}

export function withHashLocation(): RouterFeature {
  return (options: RouterOptions) => {
    options.useHash = true;
  };
}

export function withPreloading(strategy = PreloadAllModules): RouterFeature {
  return (options: RouterOptions) => {
    options.preloadingStrategy = strategy;
  };
}

export function withInMemoryScrolling(scrollingOptions: {
  scrollPositionRestoration?: 'disabled' | 'top' | 'enabled';
  anchorScrolling?: 'disabled' | 'enabled';
}): RouterFeature {
  return (options: RouterOptions) => {
    if (scrollingOptions.scrollPositionRestoration) {
      options.scrollPositionRestoration = scrollingOptions.scrollPositionRestoration;
    }
    if (scrollingOptions.anchorScrolling) {
      options.anchorScrolling = scrollingOptions.anchorScrolling;
    }
  };
}

export function withRouterConfig(config: {
  paramsInheritanceStrategy?: 'emptyOnly' | 'always';
  onSameUrlNavigation?: 'ignore' | 'reload';
  urlUpdateStrategy?: 'deferred' | 'eager';
}): RouterFeature {
  return (options: RouterOptions) => {
    if (config.paramsInheritanceStrategy) {
      options.paramsInheritanceStrategy = config.paramsInheritanceStrategy;
    }
    if (config.onSameUrlNavigation) {
      options.onSameUrlNavigation = config.onSameUrlNavigation;
    }
    if (config.urlUpdateStrategy) {
      options.urlUpdateStrategy = config.urlUpdateStrategy;
    }
  };
}

export function withNavigationErrorHandler(fn: (error: any) => void): RouterFeature {
  return (options: RouterOptions) => {
    options.errorHandler = fn;
  };
}

export function withDebugTracing(): RouterFeature {
  return (options: RouterOptions) => {
    options.enableTracing = true;
  };
}

export function withEnabledBlockingInitialNavigation(): RouterFeature {
  return (options: RouterOptions) => {
    options.initialNavigation = 'enabledBlocking';
  };
}

/**
 * Angular-compatible provideRouter function.
 * Initializes and configures the singleton Router.
 */
export function provideRouter(
  routes: Routes,
  ...featuresOrOptions: (RouterFeature | ExtraOptions)[]
): Router {
  const options: RouterOptions = {};

  for (const item of featuresOrOptions) {
    if (typeof item === 'function') {
      item(options);
    } else if (typeof item === 'object' && item !== null) {
      Object.assign(options, item);
    }
  }

  const router = new Router(routes, options);

  // Apply preloading strategy if configured
  if (options.preloadingStrategy && typeof options.preloadingStrategy.preload === 'function') {
    for (const r of routes) {
      if (r.loadComponent) {
        options.preloadingStrategy.preload(r, r.loadComponent);
      }
      if (r.loadChildren) {
        options.preloadingStrategy.preload(r, r.loadChildren);
      }
    }
  }

  return router;
}
