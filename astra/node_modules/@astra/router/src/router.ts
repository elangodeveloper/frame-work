import { signal, type Signal } from '../../reactive/src/index.ts';
import { JarvisEvent, jarvisEvent } from '../../core/src/index.ts';
import type {
  Route,
  RouteMatch,
  RouterEvent,
  NavigationExtras,
  RouterOptions,
  Navigation,
  LocationStrategy,
  RouterStateSnapshot
} from './types.ts';
import { matchRouteTree, parseUrl } from './url-parser.ts';
import { ActivatedRoute } from './activated-route.ts';

export class PathLocationStrategy implements LocationStrategy {
  readonly baseHref: string;
  constructor(baseHref: string = '/') {
    this.baseHref = baseHref;
  }
  path(): string {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.pathname + window.location.search + window.location.hash;
    }
    return '/';
  }
  prepareExternalUrl(internal: string): string {
    return internal.startsWith('/') ? internal : '/' + internal;
  }
  pushState(state: any, title: string, url: string): void {
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState(state, title, url);
    }
  }
  replaceState(state: any, title: string, url: string): void {
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState(state, title, url);
    }
  }
  forward(): void {
    if (typeof window !== 'undefined' && window.history) window.history.forward();
  }
  back(): void {
    if (typeof window !== 'undefined' && window.history) window.history.back();
  }
  onPopState(fn: (event: any) => void): () => void {
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', fn);
      return () => window.removeEventListener('popstate', fn);
    }
    return () => {};
  }
  getBaseHref(): string {
    return this.baseHref;
  }
}

export class HashLocationStrategy implements LocationStrategy {
  path(): string {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.hash.slice(1) || '/';
    }
    return '/';
  }
  prepareExternalUrl(internal: string): string {
    return '#' + (internal.startsWith('/') ? internal : '/' + internal);
  }
  pushState(state: any, title: string, url: string): void {
    if (typeof window !== 'undefined' && window.location) {
      window.location.hash = url;
    }
  }
  replaceState(state: any, title: string, url: string): void {
    if (typeof window !== 'undefined' && window.location) {
      window.location.hash = url;
    }
  }
  forward(): void {
    if (typeof window !== 'undefined' && window.history) window.history.forward();
  }
  back(): void {
    if (typeof window !== 'undefined' && window.history) window.history.back();
  }
  onPopState(fn: (event: any) => void): () => void {
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', fn);
      return () => window.removeEventListener('hashchange', fn);
    }
    return () => {};
  }
  getBaseHref(): string {
    return '';
  }
}

export class Router {
  readonly routes: Route[];
  readonly currentUrl: Signal<string>;
  readonly activeRoute: Signal<RouteMatch | null>;
  readonly events: JarvisEvent<RouterEvent>;
  readonly currentNavigation: Signal<Navigation | null>;
  readonly activatedRoute: ActivatedRoute;

  private readonly locationStrategy: LocationStrategy;
  private readonly scrollRestoration: 'enabled' | 'disabled' | 'top';
  private navigationIdCounter = 0;
  private activeNavigationId: number | null = null;
  private unbindLocationListener: (() => void) | null = null;

  constructor(routes: Route[], options: RouterOptions = {}) {
    this.routes = routes;
    this.locationStrategy = options.locationStrategy ??
      (options.useHash ? new HashLocationStrategy() : new PathLocationStrategy(options.baseHref || '/'));
    this.scrollRestoration = options.scrollRestoration ?? 'top';
    this.events = jarvisEvent<RouterEvent>();
    this.activatedRoute = new ActivatedRoute();
    this.currentUrl = signal('');
    this.activeRoute = signal<RouteMatch | null>(null);
    this.currentNavigation = signal<Navigation | null>(null);

    this.initHistory();
    const initial = options.initialUrl ?? this.locationStrategy.path();
    this.navigateByUrl(initial, { replaceUrl: true });
  }

  private initHistory(): void {
    this.unbindLocationListener = this.locationStrategy.onPopState(() => {
      this.navigateByUrl(this.locationStrategy.path(), { replaceUrl: true, skipPushState: true });
    });
  }

  async navigate(commands: string[], extras: NavigationExtras = {}): Promise<boolean> {
    const raw = commands.join('/').replace(/\/+/g, '/');
    const url = raw.startsWith('/') ? raw : '/' + raw;
    return this.navigateByUrl(url, extras);
  }

  /**
   * Full Angular-style Navigation Pipeline:
   * 1. Parse URL & supersede previous in-flight navigation if active
   * 2. Recognize route tree (running canMatch guards)
   * 3. Load lazy chunks (loadComponent / loadChildren)
   * 4. Run guards (canDeactivate on active component, canActivate, canActivateChild)
   * 5. Run resolvers in parallel with chunk loading
   * 6. Activate route, update fine-grained signals, update location & title, scroll restoration
   */
  async navigateByUrl(targetUrl: string, extras: NavigationExtras = {}): Promise<boolean> {
    const navId = ++this.navigationIdCounter;
    this.activeNavigationId = navId;

    // Extract & format URL
    let fullUrl = (targetUrl || '/').trim();
    if (!fullUrl.startsWith('/') && !fullUrl.startsWith('#')) fullUrl = '/' + fullUrl;
    if (extras.queryParams && Object.keys(extras.queryParams).length > 0) {
      const q = new URLSearchParams(extras.queryParams).toString();
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + q;
    }
    if (extras.fragment) {
      fullUrl += '#' + extras.fragment;
    }

    const navigation: Navigation = {
      id: navId,
      initialUrl: targetUrl,
      extractedUrl: fullUrl,
      trigger: extras.skipPushState ? 'popstate' : 'imperative',
      extras,
    };
    this.currentNavigation.set(navigation);
    this.events.emit({ type: 'NavigationStart', id: navId, url: fullUrl });

    try {
      // STEP 1: Match route tree with canMatch evaluations
      const match = await matchRouteTree(this.routes, fullUrl);
      if (this.activeNavigationId !== navId) return false; // Superseded

      if (!match) {
        this.events.emit({
          type: 'NavigationError',
          id: navId,
          url: fullUrl,
          reason: 'Cannot match any routes for URL: ' + fullUrl,
        });
        this.currentNavigation.set(null);
        return false;
      }
      this.events.emit({ type: 'RoutesRecognized', id: navId, url: fullUrl });

      // STEP 2: Load lazy chunk if declared via loadComponent
      let loadedComponent = match.route.component;
      if (!loadedComponent && match.route.loadComponent) {
        const loaded = await match.route.loadComponent();
        if (this.activeNavigationId !== navId) return false; // Superseded
        loadedComponent = (loaded && loaded.default) ? loaded.default : loaded;
      }

      // STEP 3: Run canDeactivate on current active component
      const currentMatch = this.activeRoute();
      const snapshot: RouterStateSnapshot = {
        url: fullUrl,
        root: match,
      };

      if (currentMatch && currentMatch.route.canDeactivate) {
        for (const guard of currentMatch.route.canDeactivate) {
          const res = await guard(null, currentMatch, { url: this.currentUrl(), root: currentMatch }, snapshot);
          if (this.activeNavigationId !== navId) return false;
          if (res === false) {
            this.events.emit({ type: 'NavigationCancel', id: navId, url: fullUrl, reason: 'canDeactivate rejected' });
            this.currentNavigation.set(null);
            return false;
          }
          if (typeof res === 'string' || (res && typeof res === 'object' && 'root' in res)) {
            this.currentNavigation.set(null);
            return this.navigateByUrl(String(res));
          }
        }
      }

      // STEP 4: Run canActivate & canActivateChild guards
      this.events.emit({ type: 'GuardsCheckStart', id: navId, url: fullUrl });
      if (match.route.canActivate && match.route.canActivate.length > 0) {
        for (const guard of match.route.canActivate) {
          const res = await guard(match, snapshot);
          if (this.activeNavigationId !== navId) return false;
          if (res === false) {
            this.events.emit({ type: 'NavigationCancel', id: navId, url: fullUrl, reason: 'canActivate rejected' });
            this.currentNavigation.set(null);
            return false;
          }
          if (typeof res === 'string' || (res && typeof res === 'object' && 'root' in res)) {
            this.currentNavigation.set(null);
            return this.navigateByUrl(String(res));
          }
        }
      }
      this.events.emit({ type: 'GuardsCheckEnd', id: navId, url: fullUrl });

      // STEP 5: Run parallel resolvers
      this.events.emit({ type: 'ResolveStart', id: navId, url: fullUrl });
      const resolvedData: Record<string, any> = {};
      if (match.route.resolve) {
        const resolveKeys = Object.keys(match.route.resolve);
        const promises = resolveKeys.map((k) => match.route.resolve![k](match, snapshot));
        const resolvedValues = await Promise.all(promises);
        if (this.activeNavigationId !== navId) return false;
        for (let i = 0; i < resolveKeys.length; i++) {
          resolvedData[resolveKeys[i]] = resolvedValues[i];
        }
      }
      this.events.emit({ type: 'ResolveEnd', id: navId, url: fullUrl });

      // STEP 6: Commit Navigation, Update History, Signals, and Title
      if (!extras.skipPushState) {
        const prepUrl = this.locationStrategy.prepareExternalUrl(match.url);
        if (extras.replaceUrl) {
          this.locationStrategy.replaceState(extras.state ?? null, match.title || '', prepUrl);
        } else {
          this.locationStrategy.pushState(extras.state ?? null, match.title || '', prepUrl);
        }
      }

      if (match.title && typeof document !== 'undefined') {
        document.title = match.title;
      }

      if (this.scrollRestoration === 'top' && typeof window !== 'undefined') {
        window.scrollTo(0, 0);
      }

      // Update activated route with resolved component and data
      const finalizedMatch: RouteMatch = {
        ...match,
        route: { ...match.route, component: loadedComponent },
        resolvedData,
      };

      this.currentUrl.set(match.url);
      this.activeRoute.set(finalizedMatch);
      this.activatedRoute._update(finalizedMatch);

      this.events.emit({ type: 'NavigationEnd', id: navId, url: match.url });
      this.currentNavigation.set(null);
      return true;
    } catch (err: any) {
      this.events.emit({
        type: 'NavigationError',
        id: navId,
        url: fullUrl,
        reason: err?.message || String(err),
      });
      this.currentNavigation.set(null);
      return false;
    }
  }

  destroy(): void {
    if (this.unbindLocationListener) {
      this.unbindLocationListener();
      this.unbindLocationListener = null;
    }
  }
}
