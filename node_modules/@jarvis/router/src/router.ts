import { signal, type Signal, JarvisEvent, jarvisEvent } from '../../core/src/index.ts';
import { RedirectCommand } from './types.ts';
import type {
  Route,
  Routes,
  RouteMatch,
  RouterEvent,
  NavigationExtras,
  RouterOptions,
  Navigation,
  LocationStrategy,
  RouterStateSnapshot,
  ActivatedRouteSnapshot,
  UrlTree,
  IsActiveMatchOptions,
} from './types.ts';
import { RouteTrie } from './trie.ts';
import { parseUrl, serializeUrl, createUrlTree, isActive } from './url-tree.ts';
import { ActivatedRoute, DefaultActivatedRouteSnapshot } from './activated-route.ts';

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
  private _routes: Routes;
  private trie: RouteTrie;

  readonly url: Signal<string>;
  readonly currentUrl: Signal<string>; // Alias for backwards compat
  readonly activeRoute: Signal<RouteMatch | null>;
  readonly currentNavigation: Signal<Navigation | null>;
  readonly lastEvent: Signal<RouterEvent | null>;
  readonly events: JarvisEvent<RouterEvent>;
  readonly activatedRoute: ActivatedRoute;
  readonly options: RouterOptions;

  private readonly locationStrategy: LocationStrategy;
  private navigationIdCounter = 0;
  private activeNavigationId: number | null = null;
  private unbindLocationListener: (() => void) | null = null;
  private lastSuccessfulNavigation: Navigation | null = null;

  // Active component instances for canDeactivate guards
  private activeComponentInstances = new Map<string, any>();

  constructor(routes: Routes, options: RouterOptions = {}) {
    this._routes = routes;
    this.options = options;
    this.trie = new RouteTrie(routes);

    this.locationStrategy =
      options.locationStrategy ??
      (options.useHash ? new HashLocationStrategy() : new PathLocationStrategy(options.baseHref || '/'));

    this.events = jarvisEvent<RouterEvent>();
    this.activatedRoute = new ActivatedRoute();
    this.url = signal('');
    this.currentUrl = this.url;
    this.activeRoute = signal<RouteMatch | null>(null);
    this.currentNavigation = signal<Navigation | null>(null);
    this.lastEvent = signal<RouterEvent | null>(null);

    // Synchronize lastEvent signal with events stream
    this.events.subscribe((evt) => {
      this.lastEvent.set(evt);
      if (this.options.enableTracing) {
        console.log(`[Router Trace] ${evt.type} (#${evt.id}): ${evt.url}`, evt);
      }
    });

    this.initHistory();

    const initial = options.initialUrl ?? this.locationStrategy.path();
    const syncMatch = this.trie.matchSync(initial, this.options.paramsInheritanceStrategy || 'emptyOnly');
    if (syncMatch) {
      this.url.set(syncMatch.url);
      this.activeRoute.set(syncMatch);
      this.activatedRoute._update(syncMatch);
    }
    this.navigateByUrl(initial, { replaceUrl: true });
  }

  get routes(): Routes {
    return this._routes;
  }

  resetConfig(routes: Routes): void {
    this._routes = routes;
    this.trie = new RouteTrie(routes);
  }

  private initHistory(): void {
    this.unbindLocationListener = this.locationStrategy.onPopState(() => {
      this.navigateByUrl(this.locationStrategy.path(), { replaceUrl: true, skipLocationChange: false });
    });
  }

  registerActiveComponent(outlet: string, instance: any): void {
    if (instance) {
      this.activeComponentInstances.set(outlet, instance);
    } else {
      this.activeComponentInstances.delete(outlet);
    }
  }

  parseUrl(url: string): UrlTree {
    return parseUrl(url);
  }

  serializeUrl(urlTree: UrlTree): string {
    return serializeUrl(urlTree);
  }

  createUrlTree(commands: any[], extras: NavigationExtras = {}): UrlTree {
    const currentTree = this.url() ? parseUrl(this.url()) : undefined;
    return createUrlTree(commands, extras, currentTree);
  }

  isActive(url: string | UrlTree, options: IsActiveMatchOptions = { paths: 'exact', queryParams: 'exact', fragment: 'exact' }): boolean {
    return isActive(url, this.url(), options);
  }

  async navigate(commands: any[], extras: NavigationExtras = {}): Promise<boolean> {
    const tree = this.createUrlTree(commands, extras);
    return this.navigateByUrl(tree, extras);
  }

  /**
   * Complete Angular-style Navigation Lifecycle:
   * Order of execution (tested and documented):
   *   1. canMatch
   *   2. canDeactivate (deepest first)
   *   3. canActivateChild & canActivate (top-down)
   *   4. resolvers (run in parallel)
   * Any newer navigation immediately cancels previous pending operations.
   */
  async navigateByUrl(urlOrTree: string | UrlTree, extras: NavigationExtras = {}): Promise<boolean> {
    const navId = ++this.navigationIdCounter;
    this.activeNavigationId = navId;

    const targetUrl = typeof urlOrTree === 'string' ? urlOrTree : serializeUrl(urlOrTree);
    const parsedTarget = typeof urlOrTree === 'string' ? parseUrl(targetUrl) : urlOrTree;
    let fullUrl = serializeUrl(parsedTarget);

    const onSameUrl = extras.onSameUrlNavigation || this.options.onSameUrlNavigation || 'ignore';
    if (fullUrl === this.url() && onSameUrl === 'ignore') {
      this.events.emit({ type: 'NavigationSkipped', id: navId, url: fullUrl, reason: 'same URL navigation ignored' });
      return true;
    }

    const navigation: Navigation = {
      id: navId,
      initialUrl: targetUrl,
      extractedUrl: fullUrl,
      trigger: extras.skipLocationChange ? 'popstate' : 'imperative',
      extras,
      previousNavigation: this.lastSuccessfulNavigation,
    };
    this.currentNavigation.set(navigation);
    this.events.emit({ type: 'NavigationStart', id: navId, url: fullUrl });

    try {
      // 1. MATCH ROUTE TREE WITH CANMATCH
      const match = await this.trie.match(fullUrl, this.options.paramsInheritanceStrategy || 'emptyOnly');
      if (this.activeNavigationId !== navId) {
        this.events.emit({ type: 'NavigationCancel', id: navId, url: fullUrl, reason: 'Superseded by newer navigation' });
        return false;
      }

      if (!match) {
        const error = new Error(`Cannot match any routes for URL: ${fullUrl}`);
        this.events.emit({ type: 'NavigationError', id: navId, url: fullUrl, error });
        if (this.options.errorHandler) this.options.errorHandler(error);
        this.currentNavigation.set(null);
        return false;
      }

      this.events.emit({ type: 'RoutesRecognized', id: navId, url: fullUrl });

      const targetSnapshot = new DefaultActivatedRouteSnapshot(match);
      const routerState: RouterStateSnapshot = {
        url: fullUrl,
        root: targetSnapshot,
      };

      // 2. CANDEACTIVATE GUARDS (Deepest first)
      const currentMatch = this.activeRoute();
      if (currentMatch && currentMatch.route.canDeactivate) {
        const activeComp = this.activeComponentInstances.get(currentMatch.outlet || 'primary');
        const currentSnapshot = new DefaultActivatedRouteSnapshot(currentMatch);
        const currentStateSnapshot: RouterStateSnapshot = {
          url: this.url(),
          root: currentSnapshot,
        };

        for (const guard of currentMatch.route.canDeactivate) {
          const res = await guard(activeComp, currentSnapshot, currentStateSnapshot, routerState);
          if (this.activeNavigationId !== navId) return false;

          if (res === false) {
            this.events.emit({ type: 'NavigationCancel', id: navId, url: fullUrl, reason: 'canDeactivate rejected' });
            this.currentNavigation.set(null);
            return false;
          }

          if (res instanceof RedirectCommand) {
            this.currentNavigation.set(null);
            return this.navigateByUrl(res.redirectTo, res.navigationBehaviorOptions);
          }

          if (typeof res === 'string' || (res && typeof res === 'object' && 'root' in res)) {
            this.currentNavigation.set(null);
            return this.navigateByUrl(res as any);
          }
        }
      }

      // 3. CANACTIVATE & CANACTIVATECHILD GUARDS (Top-down)
      this.events.emit({ type: 'GuardsCheckStart', id: navId, url: fullUrl });

      if (match.route.canActivate && match.route.canActivate.length > 0) {
        for (const guard of match.route.canActivate) {
          const res = await guard(targetSnapshot, routerState);
          if (this.activeNavigationId !== navId) return false;

          if (res === false) {
            this.events.emit({ type: 'NavigationCancel', id: navId, url: fullUrl, reason: 'canActivate rejected' });
            this.currentNavigation.set(null);
            return false;
          }

          if (res instanceof RedirectCommand) {
            this.currentNavigation.set(null);
            return this.navigateByUrl(res.redirectTo, res.navigationBehaviorOptions);
          }

          if (typeof res === 'string' || (res && typeof res === 'object' && 'root' in res)) {
            this.currentNavigation.set(null);
            return this.navigateByUrl(res as any);
          }
        }
      }

      if (match.route.canActivateChild && match.route.canActivateChild.length > 0) {
        for (const guard of match.route.canActivateChild) {
          const res = await guard(targetSnapshot, routerState);
          if (this.activeNavigationId !== navId) return false;

          if (res === false) {
            this.events.emit({ type: 'NavigationCancel', id: navId, url: fullUrl, reason: 'canActivateChild rejected' });
            this.currentNavigation.set(null);
            return false;
          }

          if (res instanceof RedirectCommand) {
            this.currentNavigation.set(null);
            return this.navigateByUrl(res.redirectTo, res.navigationBehaviorOptions);
          }

          if (typeof res === 'string' || (res && typeof res === 'object' && 'root' in res)) {
            this.currentNavigation.set(null);
            return this.navigateByUrl(res as any);
          }
        }
      }

      this.events.emit({ type: 'GuardsCheckEnd', id: navId, url: fullUrl });

      // 4. LOAD LAZY CHUNK (loadComponent)
      let loadedComponent = match.route.component;
      if (!loadedComponent && match.route.loadComponent) {
        const loaded = await match.route.loadComponent();
        if (this.activeNavigationId !== navId) return false;
        loadedComponent = loaded?.default ?? loaded;
      }

      // 5. RUN RESOLVERS
      this.events.emit({ type: 'ResolveStart', id: navId, url: fullUrl });
      const resolvedData: Record<string, any> = {};

      if (match.route.resolve) {
        const entries = Object.entries(match.route.resolve);
        const resolvedPromises = entries.map(async ([k, fn]) => {
          const res = await fn(targetSnapshot, routerState);
          return [k, res];
        });
        const results = await Promise.all(resolvedPromises);
        if (this.activeNavigationId !== navId) return false;

        for (const [k, v] of results) {
          if (v instanceof RedirectCommand) {
            this.currentNavigation.set(null);
            return this.navigateByUrl(v.redirectTo, v.navigationBehaviorOptions);
          }
          if (typeof v === 'string' && (v.startsWith('/') || v.startsWith('#'))) {
            this.currentNavigation.set(null);
            return this.navigateByUrl(v);
          }
          resolvedData[k as string] = v;
        }
      }

      // Title resolution (string or resolver function)
      let pageTitle: string | undefined = undefined;
      if (typeof match.route.title === 'function') {
        pageTitle = await match.route.title(targetSnapshot, routerState);
      } else if (typeof match.route.title === 'string') {
        pageTitle = match.route.title;
      }

      this.events.emit({ type: 'ResolveEnd', id: navId, url: fullUrl });

      // 6. ACTIVATION START & COMMIT
      this.events.emit({ type: 'ActivationStart', id: navId, url: fullUrl });

      // Optional View Transitions API
      const commitNavigation = () => {
        if (!extras.skipLocationChange) {
          const prepUrl = this.locationStrategy.prepareExternalUrl(fullUrl);
          if (extras.replaceUrl) {
            this.locationStrategy.replaceState(extras.state ?? null, pageTitle || '', prepUrl);
          } else {
            this.locationStrategy.pushState(extras.state ?? null, pageTitle || '', prepUrl);
          }
        }

        if (pageTitle && typeof document !== 'undefined') {
          document.title = pageTitle;
        }

        // Scroll restoration
        const scrollRestoration = this.options.scrollPositionRestoration ?? 'top';
        if (scrollRestoration === 'top' && typeof window !== 'undefined') {
          window.scrollTo(0, 0);
        } else if (this.options.anchorScrolling === 'enabled' && match.fragment && typeof document !== 'undefined') {
          const el = document.getElementById(match.fragment);
          if (el) el.scrollIntoView();
        }

        const finalizedRoute =
          loadedComponent === match.route.component
            ? match.route
            : { ...match.route, component: loadedComponent };

        const finalizedMatch: RouteMatch = {
          ...match,
          route: finalizedRoute,
          resolvedData,
          title: pageTitle,
        };

        this.url.set(fullUrl);
        this.activeRoute.set(finalizedMatch);
        this.activatedRoute._update(finalizedMatch);
      };

      if (this.options.viewTransitions && typeof document !== 'undefined' && 'startViewTransition' in document) {
        await (document as any).startViewTransition(() => commitNavigation()).finished;
      } else {
        commitNavigation();
      }

      this.events.emit({ type: 'ActivationEnd', id: navId, url: fullUrl });
      this.events.emit({ type: 'NavigationEnd', id: navId, url: fullUrl });

      this.lastSuccessfulNavigation = navigation;
      this.currentNavigation.set(null);
      return true;
    } catch (err: any) {
      this.events.emit({ type: 'NavigationError', id: navId, url: fullUrl, error: err });
      if (this.options.errorHandler) this.options.errorHandler(err);
      this.currentNavigation.set(null);
      return false;
    }
  }

  destroy(): void {
    if (this.unbindLocationListener) {
      this.unbindLocationListener();
      this.unbindLocationListener = null;
    }
    this.activeComponentInstances.clear();
  }
}
