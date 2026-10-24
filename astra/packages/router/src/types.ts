/**
 * @astra/router & @jarvis/router
 * Comprehensive TypeScript interfaces for config-based, fine-grained signal routing.
 */

export type LoadComponentCallback = () => Promise<any | { default: any }>;
export type LoadChildrenCallback = () => Promise<Routes | { default: Routes }>;

export interface UrlTree {
  readonly root: UrlSegmentGroup;
  readonly queryParams: Record<string, string>;
  readonly fragment: string | null;
  toString(): string;
}

export interface UrlSegment {
  readonly path: string;
  readonly parameters: Record<string, string>;
}

export interface UrlSegmentGroup {
  readonly segments: UrlSegment[];
  readonly children: Record<string, UrlSegmentGroup>;
  readonly parent: UrlSegmentGroup | null;
  hasChildren(): boolean;
}

export type GuardResult = boolean | UrlTree | string | Promise<boolean | UrlTree | string>;
export type ResolverResult<T = any> = T | Promise<T>;

export type CanMatchFn = (route: Route, segments: UrlSegment[]) => GuardResult;
export type CanActivateFn = (route: RouteMatch, state: RouterStateSnapshot) => GuardResult;
export type CanActivateChildFn = (childRoute: RouteMatch, state: RouterStateSnapshot) => GuardResult;
export type CanDeactivateFn<T = any> = (
  component: T,
  currentRoute: RouteMatch,
  currentState: RouterStateSnapshot,
  nextState?: RouterStateSnapshot
) => GuardResult;

export type ResolveFn<T = any> = (route: RouteMatch, state: RouterStateSnapshot) => ResolverResult<T>;

export interface RouteMatch {
  readonly route: Route;
  readonly url: string;
  readonly pathname: string;
  readonly params: Record<string, string>;
  readonly queryParams: Record<string, string>;
  readonly fragment: string | null;
  readonly data: Record<string, any>;
  readonly title?: string;
  readonly outlet: string;
  readonly resolvedData: Record<string, any>;
}

export interface RouterStateSnapshot {
  readonly url: string;
  readonly root: RouteMatch;
}

export interface Route {
  path?: string;
  component?: any;
  loadComponent?: LoadComponentCallback;
  loadChildren?: LoadChildrenCallback;
  children?: Route[];
  redirectTo?: string;
  pathMatch?: 'full' | 'prefix';
  title?: string;
  outlet?: string;
  data?: Record<string, any>;
  resolve?: Record<string, ResolveFn>;
  canMatch?: CanMatchFn[];
  canActivate?: CanActivateFn[];
  canActivateChild?: CanActivateChildFn[];
  canDeactivate?: CanDeactivateFn[];
}

export type Routes = Route[];

export interface NavigationExtras {
  queryParams?: Record<string, string>;
  fragment?: string;
  replaceUrl?: boolean;
  skipPushState?: boolean;
  state?: any;
}

export type RouterEventType =
  | 'NavigationStart'
  | 'RoutesRecognized'
  | 'GuardsCheckStart'
  | 'GuardsCheckEnd'
  | 'ResolveStart'
  | 'ResolveEnd'
  | 'NavigationEnd'
  | 'NavigationCancel'
  | 'NavigationError';

export interface RouterEvent {
  type: RouterEventType;
  id: number;
  url: string;
  reason?: string;
}

export interface Navigation {
  id: number;
  initialUrl: string;
  extractedUrl: string;
  trigger: 'imperative' | 'popstate' | 'hashchange';
  extras: NavigationExtras;
}

export interface LocationStrategy {
  path(): string;
  prepareExternalUrl(internal: string): string;
  pushState(state: any, title: string, url: string): void;
  replaceState(state: any, title: string, url: string): void;
  forward(): void;
  back(): void;
  onPopState(fn: (event: any) => void): () => void;
  getBaseHref(): string;
}

export interface RouterOptions {
  initialUrl?: string;
  useHash?: boolean;
  locationStrategy?: LocationStrategy;
  baseHref?: string;
  scrollRestoration?: 'enabled' | 'disabled' | 'top';
}
