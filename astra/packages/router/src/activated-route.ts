import { signal, type Signal } from '../../reactive/src/index.ts';
import type { RouteMatch } from './types.ts';

/**
 * ActivatedRoute provides fine-grained Signal access to the currently matched route.
 * All router observables are modeled strictly as Signals with zero RxJS.
 */
export class ActivatedRoute {
  readonly url: Signal<string>;
  readonly pathname: Signal<string>;
  readonly params: Signal<Record<string, string>>;
  readonly queryParams: Signal<Record<string, string>>;
  readonly fragment: Signal<string | null>;
  readonly data: Signal<Record<string, any>>;
  readonly title: Signal<string | undefined>;
  readonly outlet: Signal<string>;

  private _snapshot: RouteMatch | null = null;

  constructor() {
    this.url = signal('');
    this.pathname = signal('');
    this.params = signal({});
    this.queryParams = signal({});
    this.fragment = signal(null);
    this.data = signal({});
    this.title = signal(undefined);
    this.outlet = signal('primary');
  }

  get snapshot(): RouteMatch | null {
    return this._snapshot;
  }

  _update(match: RouteMatch): void {
    this._snapshot = match;
    this.url.set(match.url);
    this.pathname.set(match.pathname);
    this.params.set(match.params);
    this.queryParams.set(match.queryParams);
    this.fragment.set(match.fragment);
    this.data.set({ ...match.data, ...match.resolvedData });
    this.title.set(match.title);
    this.outlet.set(match.outlet || 'primary');
  }
}
