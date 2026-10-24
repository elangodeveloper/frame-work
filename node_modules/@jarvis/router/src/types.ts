/**
 * @jarvis/router - Comprehensive TypeScript interfaces and types
 * Angular-compatible API without RxJS, powered by fine-grained signals.
 */

import type { Signal } from '../../core/src/index.ts';

export type LoadComponentCallback = () => Promise<any | { default: any }>;
export type LoadChildrenCallback = () => Promise<Routes | { default: Routes }>;

export interface ParamMap {
  has(name: string): boolean;
  get(name: string): string | null;
  getAll(name: string): string[];
  readonly keys: string[];
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
  numberOfChildren: number;
}

export interface UrlTree {
  readonly root: UrlSegmentGroup;
  readonly queryParams: Record<string, string | string[]>;
  readonly fragment: string | null;
  toString(): string;
}

export class RedirectCommand {
  readonly redirectTo: UrlTree;
  readonly navigationBehaviorOptions?: NavigationBehaviorOptions;

  constructor(
    redirectTo: UrlTree,
    navigationBehaviorOptions?: NavigationBehaviorOptions
  ) {
    this.redirectTo = redirectTo;
    this.navigationBehaviorOptions = navigationBehaviorOptions;
  }
}

export type GuardResult =
  | boolean
  | UrlTree
  | RedirectCommand
  | string
  | Promise<boolean | UrlTree | RedirectCommand | string>;

export type ResolverResult<T = any> = T | Promise<T>;

export type CanMatchFn = (route: Route, segments: UrlSegment[]) => GuardResult;
export type CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => GuardResult;
export type CanActivateChildFn = (childRoute: ActivatedRouteSnapshot, state: RouterStateSnapshot) => GuardResult;
export type CanDeactivateFn<T = any> = (
  component: T,
  currentRoute: ActivatedRouteSnapshot,
  currentState: RouterStateSnapshot,
  nextState?: RouterStateSnapshot
) => GuardResult;

export type ResolveFn<T = any> = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => ResolverResult<T>;

export type TitleResolveFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => ResolverResult<string>;

export type RunGuardsAndResolvers =
  | 'paramsChange'
  | 'paramsOrQueryParamsChange'
  | 'always'
  | ((from: ActivatedRouteSnapshot, to: ActivatedRouteSnapshot) => boolean);

export type RenderMode = 'client' | 'server' | 'prerender';

export interface Route {
  path?: string;
  pathMatch?: 'full' | 'prefix';
  redirectTo?: string | ((redirectData: { urlTree: UrlTree; params: Record<string, string>; queryParams: Record<string, string | string[]> }) => string | UrlTree);
  component?: any;
  loadComponent?: LoadComponentCallback;
  children?: Route[];
  loadChildren?: LoadChildrenCallback;
  canMatch?: CanMatchFn[];
  canActivate?: CanActivateFn[];
  canActivateChild?: CanActivateChildFn[];
  canDeactivate?: CanDeactivateFn[];
  resolve?: Record<string, ResolveFn>;
  data?: Record<string, any>;
  title?: string | TitleResolveFn;
  providers?: any[];
  outlet?: string;
  runGuardsAndResolvers?: RunGuardsAndResolvers;
  renderMode?: RenderMode;
}

export type Routes = Route[];

export interface NavigationBehaviorOptions {
  skipLocationChange?: boolean;
  replaceUrl?: boolean;
  state?: any;
}

export interface NavigationExtras extends NavigationBehaviorOptions {
  relativeTo?: any; // ActivatedRoute
  queryParams?: Record<string, any>;
  queryParamsHandling?: 'merge' | 'preserve' | '' | null;
  fragment?: string;
  preserveFragment?: boolean;
  onSameUrlNavigation?: 'ignore' | 'reload';
}

export interface IsActiveMatchOptions {
  matrixParams?: 'exact' | 'subset' | 'ignored';
  queryParams?: 'exact' | 'subset' | 'ignored';
  paths?: 'exact' | 'subset';
  fragment?: 'exact' | 'ignored';
}

export interface ActivatedRouteSnapshot {
  readonly routeConfig: Route | null;
  readonly url: UrlSegment[];
  readonly params: Record<string, string>;
  readonly queryParams: Record<string, string | string[]>;
  readonly fragment: string | null;
  readonly data: Record<string, any>;
  readonly resolvedData: Record<string, any>;
  readonly outlet: string;
  readonly component: any;
  readonly title?: string;
  readonly paramMap: ParamMap;
  readonly queryParamMap: ParamMap;
  readonly parent: ActivatedRouteSnapshot | null;
  readonly firstChild: ActivatedRouteSnapshot | null;
  readonly children: ActivatedRouteSnapshot[];
  readonly root: ActivatedRouteSnapshot;
}

export interface RouterStateSnapshot {
  readonly url: string;
  readonly root: ActivatedRouteSnapshot;
}

export interface RouteMatch {
  readonly route: Route;
  readonly url: string;
  readonly pathname: string;
  readonly params: Record<string, string>;
  readonly queryParams: Record<string, string | string[]>;
  readonly fragment: string | null;
  readonly data: Record<string, any>;
  readonly title?: string;
  readonly outlet: string;
  readonly resolvedData: Record<string, any>;
  readonly segments: UrlSegment[];
  readonly parentMatch?: RouteMatch | null;
  readonly childMatches?: RouteMatch[];
}

export type RouterEventType =
  | 'NavigationStart'
  | 'RoutesRecognized'
  | 'GuardsCheckStart'
  | 'GuardsCheckEnd'
  | 'ResolveStart'
  | 'ResolveEnd'
  | 'ActivationStart'
  | 'ActivationEnd'
  | 'NavigationEnd'
  | 'NavigationCancel'
  | 'NavigationSkipped'
  | 'NavigationError';

export interface RouterEvent {
  type: RouterEventType;
  id: number;
  url: string;
  urlAfterRedirects?: string;
  state?: RouterStateSnapshot;
  reason?: string;
  error?: any;
}

export interface Navigation {
  id: number;
  initialUrl: string;
  extractedUrl: string;
  trigger: 'imperative' | 'popstate' | 'hashchange';
  extras: NavigationExtras;
  previousNavigation?: Navigation | null;
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

export interface InMemoryScrollingOptions {
  scrollPositionRestoration?: 'disabled' | 'top' | 'enabled';
  anchorScrolling?: 'disabled' | 'enabled';
}

export interface ExtraOptions extends InMemoryScrollingOptions {
  enableTracing?: boolean;
  useHash?: boolean;
  initialNavigation?: 'disabled' | 'enabled' | 'enabledBlocking' | 'enabledNonBlocking';
  errorHandler?: (error: any) => void;
  preloadingStrategy?: any;
  onSameUrlNavigation?: 'ignore' | 'reload';
  paramsInheritanceStrategy?: 'emptyOnly' | 'always';
  urlUpdateStrategy?: 'deferred' | 'eager';
  bindComponentInputs?: boolean;
  viewTransitions?: boolean;
}

export interface RouterOptions extends ExtraOptions {
  baseHref?: string;
  locationStrategy?: LocationStrategy;
  initialUrl?: string;
}
