import { Router } from './router.ts';
import type { Route, RouterOptions } from './types.ts';

export * from './types.ts';
export * from './url-parser.ts';
export * from './activated-route.ts';
export * from './router.ts';
export * from './router-outlet.ts';
export * from './router-link.ts';

export type RouterFeature = (router: Router) => void;

export function withHashLocation(): RouterFeature {
  return () => {};
}

export function withEnabledBlockingInitialNavigation(): RouterFeature {
  return () => {};
}

export function withInMemoryScrolling(options: { scrollPositionRestoration?: 'top' | 'enabled' | 'disabled' }): RouterFeature {
  return () => {};
}

/**
 * Angular-style provideRouter helper for initializing the singleton Router.
 */
export function provideRouter(routes: Route[], optionsOrFeature?: RouterOptions | RouterFeature, ...features: RouterFeature[]): Router {
  let opts: RouterOptions = {};
  if (typeof optionsOrFeature === 'object' && optionsOrFeature !== null) {
    opts = optionsOrFeature;
  }
  const router = new Router(routes, opts);
  if (typeof optionsOrFeature === 'function') {
    optionsOrFeature(router);
  }
  for (const feat of features) {
    feat(router);
  }
  return router;
}
