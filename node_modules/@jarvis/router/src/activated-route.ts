import { signal, computed, type Signal } from '../../core/src/index.ts';
import type {
  ActivatedRouteSnapshot,
  ParamMap,
  Route,
  RouteMatch,
  UrlSegment,
} from './types.ts';
import { convertToParamMap } from './param-map.ts';

export class DefaultActivatedRouteSnapshot implements ActivatedRouteSnapshot {
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
  parent: ActivatedRouteSnapshot | null = null;
  firstChild: ActivatedRouteSnapshot | null = null;
  children: ActivatedRouteSnapshot[] = [];

  constructor(match: RouteMatch | null) {
    if (match) {
      this.routeConfig = match.route;
      this.url = match.segments;
      this.params = { ...match.params };
      this.queryParams = { ...match.queryParams };
      this.fragment = match.fragment;
      this.resolvedData = match.resolvedData ? { ...match.resolvedData } : {};
      this.data = { ...match.data, ...this.resolvedData };
      this.outlet = match.outlet || 'primary';
      this.component = match.route.component;
      this.title = match.title;
      this.paramMap = convertToParamMap(this.params);
      this.queryParamMap = convertToParamMap(this.queryParams);
    } else {
      this.routeConfig = null;
      this.url = [];
      this.params = {};
      this.queryParams = {};
      this.fragment = null;
      this.data = {};
      this.outlet = 'primary';
      this.component = null;
      this.paramMap = convertToParamMap({});
      this.queryParamMap = convertToParamMap({});
    }
  }

  get root(): ActivatedRouteSnapshot {
    let curr: ActivatedRouteSnapshot = this;
    while (curr.parent) {
      curr = curr.parent;
    }
    return curr;
  }
}

/**
 * ActivatedRoute provides fine-grained Signal access to the currently matched route.
 * Zero RxJS; completely signal-driven.
 */
export class ActivatedRoute {
  readonly url: Signal<UrlSegment[]>;
  readonly pathname: Signal<string>;
  readonly params: Signal<Record<string, string>>;
  readonly queryParams: Signal<Record<string, string | string[]>>;
  readonly fragment: Signal<string | null>;
  readonly data: Signal<Record<string, any>>;
  readonly title: Signal<string | undefined>;
  readonly outlet: Signal<string>;
  readonly paramMap: Signal<ParamMap>;
  readonly queryParamMap: Signal<ParamMap>;

  routeConfig: Route | null = null;
  parent: ActivatedRoute | null = null;
  firstChild: ActivatedRoute | null = null;
  children: ActivatedRoute[] = [];

  private _snapshot: ActivatedRouteSnapshot;

  constructor() {
    this.url = signal<UrlSegment[]>([]);
    this.pathname = signal('');
    this.params = signal<Record<string, string>>({});
    this.queryParams = signal<Record<string, string | string[]>>({});
    this.fragment = signal<string | null>(null);
    this.data = signal<Record<string, any>>({});
    this.title = signal<string | undefined>(undefined);
    this.outlet = signal('primary');
    this.paramMap = computed(() => convertToParamMap(this.params()));
    this.queryParamMap = computed(() => convertToParamMap(this.queryParams()));
    this._snapshot = new DefaultActivatedRouteSnapshot(null);
  }

  get snapshot(): ActivatedRouteSnapshot {
    return this._snapshot;
  }

  _update(match: RouteMatch): void {
    this.routeConfig = match.route;
    this._snapshot = new DefaultActivatedRouteSnapshot(match);

    this.url.set(match.segments);
    this.pathname.set(match.pathname);
    this.params.set(match.params);
    this.queryParams.set(match.queryParams);
    this.fragment.set(match.fragment);
    this.data.set({ ...match.data, ...match.resolvedData });
    this.title.set(match.title);
    this.outlet.set(match.outlet || 'primary');
  }
}
