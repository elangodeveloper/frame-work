import type {
  UrlSegment,
  UrlSegmentGroup,
  UrlTree,
  NavigationExtras,
  IsActiveMatchOptions,
} from './types.ts';

export class DefaultUrlSegment implements UrlSegment {
  readonly path: string;
  readonly parameters: Record<string, string>;

  constructor(path: string, parameters: Record<string, string> = {}) {
    this.path = path;
    this.parameters = parameters;
  }
}

export class DefaultUrlSegmentGroup implements UrlSegmentGroup {
  readonly segments: UrlSegment[];
  readonly children: Record<string, UrlSegmentGroup>;
  readonly parent: UrlSegmentGroup | null;

  constructor(
    segments: UrlSegment[],
    children: Record<string, UrlSegmentGroup>,
    parent: UrlSegmentGroup | null = null
  ) {
    this.segments = segments;
    this.children = children;
    this.parent = parent;
  }

  hasChildren(): boolean {
    return Object.keys(this.children).length > 0;
  }

  get numberOfChildren(): number {
    return Object.keys(this.children).length;
  }
}

export class DefaultUrlTree implements UrlTree {
  readonly root: UrlSegmentGroup;
  readonly queryParams: Record<string, string | string[]>;
  readonly fragment: string | null;

  constructor(
    root: UrlSegmentGroup,
    queryParams: Record<string, string | string[]> = {},
    fragment: string | null = null
  ) {
    this.root = root;
    this.queryParams = queryParams;
    this.fragment = fragment;
  }

  get pathname(): string {
    const p = this.root.segments.map((s) => s.path).join('/');
    return p.startsWith('/') ? p : '/' + p;
  }

  toString(): string {
    return serializeUrl(this);
  }
}

/**
 * Hand-written URL parser.
 * Zero-regex, high performance O(N) byte scanner.
 * Supports auxiliary routes `/parent(outlet:child)`, multi-value query params `?a=1&a=2`, and fragment.
 */
export function parseUrl(rawUrl: string): UrlTree {
  let url = (rawUrl || '/').trim();
  if (url.startsWith('#')) url = url.slice(1);
  if (!url.startsWith('/')) url = '/' + url;

  // 1. Extract fragment
  let fragment: string | null = null;
  const hashIdx = url.indexOf('#');
  if (hashIdx !== -1) {
    fragment = decodeURIComponent(url.slice(hashIdx + 1));
    url = url.slice(0, hashIdx);
  }

  // 2. Extract query parameters
  const queryParams: Record<string, string | string[]> = {};
  const queryIdx = url.indexOf('?');
  if (queryIdx !== -1) {
    const qStr = url.slice(queryIdx + 1);
    url = url.slice(0, queryIdx);
    if (qStr.length > 0) {
      const pairs = qStr.split('&');
      for (const pair of pairs) {
        if (!pair) continue;
        const eq = pair.indexOf('=');
        let key = '';
        let val = '';
        if (eq !== -1) {
          key = decodeURIComponent(pair.slice(0, eq));
          val = decodeURIComponent(pair.slice(eq + 1));
        } else {
          key = decodeURIComponent(pair);
          val = '';
        }
        if (key in queryParams) {
          const existing = queryParams[key];
          if (Array.isArray(existing)) {
            existing.push(val);
          } else {
            queryParams[key] = [existing, val];
          }
        } else {
          queryParams[key] = val;
        }
      }
    }
  }

  // 3. Parse path and auxiliary outlets (do not collapse // inside parentheses)
  const root = parseSegmentGroup(url, null);
  return new DefaultUrlTree(root, queryParams, fragment);
}

function parseSegmentGroup(path: string, parent: UrlSegmentGroup | null): UrlSegmentGroup {
  let cleaned = path.replace(/^\/|\/$/g, '');
  if (!cleaned) {
    return new DefaultUrlSegmentGroup([], {}, parent);
  }

  const primarySegments: UrlSegment[] = [];
  const children: Record<string, UrlSegmentGroup> = {};

  // Check for auxiliary groups e.g. path(sidebar:chat//secondary:help)
  const parenStart = cleaned.indexOf('(');
  let mainPath = cleaned;
  let auxPart = '';

  if (parenStart !== -1 && cleaned.endsWith(')')) {
    mainPath = cleaned.slice(0, parenStart);
    auxPart = cleaned.slice(parenStart + 1, -1);
  }

  mainPath = mainPath.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');

  if (mainPath) {
    const parts = mainPath.split('/');
    for (const p of parts) {
      if (p) primarySegments.push(new DefaultUrlSegment(decodeURIComponent(p)));
    }
  }

  const group = new DefaultUrlSegmentGroup(primarySegments, children, parent);

  if (auxPart) {
    // Outlets separated by //
    const auxOutlets = auxPart.split('//');
    for (const aux of auxOutlets) {
      const colonIdx = aux.indexOf(':');
      if (colonIdx !== -1) {
        const outletName = aux.slice(0, colonIdx);
        const subPath = aux.slice(colonIdx + 1);
        children[outletName] = parseSegmentGroup(subPath, group);
      }
    }
  }

  return group;
}

/**
 * Serializes a UrlTree back to a standard string URL.
 */
export function serializeUrl(tree: UrlTree): string {
  let path = serializeSegmentGroup(tree.root);
  if (!path.startsWith('/')) path = '/' + path;

  const qKeys = Object.keys(tree.queryParams);
  if (qKeys.length > 0) {
    const parts: string[] = [];
    for (const k of qKeys) {
      const v = tree.queryParams[k];
      const serializeVal = (val: string) => {
        // preserve slashes in query values
        return encodeURIComponent(val).replace(/%2F/g, '/');
      };
      if (Array.isArray(v)) {
        for (const item of v) {
          parts.push(`${encodeURIComponent(k)}=${serializeVal(item)}`);
        }
      } else {
        parts.push(`${encodeURIComponent(k)}=${serializeVal(v)}`);
      }
    }
    path += (path.includes('?') ? '&' : '?') + parts.join('&');
  }

  if (tree.fragment) {
    path += '#' + encodeURIComponent(tree.fragment);
  }

  return path;
}

function serializeSegmentGroup(group: UrlSegmentGroup): string {
  let res = group.segments.map((s) => encodeURIComponent(s.path)).join('/');
  const auxKeys = Object.keys(group.children);
  if (auxKeys.length > 0) {
    const aux = auxKeys
      .map((k) => `${k}:${serializeSegmentGroup(group.children[k])}`)
      .join('//');
    res += (res ? '' : '') + `(${aux})`;
  }
  return res;
}

// LRU/Memoization cache for createUrlTree
const urlTreeCache = new Map<string, UrlTree>();
const MAX_CACHE_SIZE = 256;

export function createUrlTree(
  commands: any[],
  extras: NavigationExtras = {},
  currentUrlTree?: UrlTree
): UrlTree {
  // Fast cache key
  const cacheKey = JSON.stringify({ commands, extras: { ...extras, relativeTo: undefined } });
  const cached = urlTreeCache.get(cacheKey);
  if (cached) return cached;

  let base = '/';
  if (extras.relativeTo && extras.relativeTo.snapshot) {
    const segments = extras.relativeTo.snapshot.url.map((s: UrlSegment) => s.path);
    base = '/' + segments.join('/');
  }

  let raw = commands
    .map((c) => String(c).trim())
    .filter(Boolean)
    .join('/');

  if (raw.startsWith('./')) {
    raw = base + '/' + raw.slice(2);
  } else if (raw.startsWith('../')) {
    const baseParts = base.split('/').filter(Boolean);
    let rest = raw;
    while (rest.startsWith('../')) {
      baseParts.pop();
      rest = rest.slice(3);
    }
    raw = '/' + [...baseParts, rest].filter(Boolean).join('/');
  } else if (!raw.startsWith('/')) {
    raw = '/' + raw;
  }

  // Handle queryParamsHandling
  let queryParams: Record<string, string | string[]> = {};
  if (extras.queryParamsHandling === 'preserve' && currentUrlTree) {
    queryParams = { ...currentUrlTree.queryParams };
  } else if (extras.queryParamsHandling === 'merge' && currentUrlTree) {
    queryParams = { ...currentUrlTree.queryParams, ...(extras.queryParams || {}) };
  } else if (extras.queryParams) {
    queryParams = { ...extras.queryParams };
  }

  // Handle fragment
  let fragment: string | null = null;
  if (extras.preserveFragment && currentUrlTree) {
    fragment = currentUrlTree.fragment;
  } else if (extras.fragment !== undefined) {
    fragment = extras.fragment;
  }

  const parsed = parseUrl(raw);
  const result = new DefaultUrlTree(parsed.root, queryParams, fragment ?? parsed.fragment);

  if (urlTreeCache.size >= MAX_CACHE_SIZE) {
    const firstKey = urlTreeCache.keys().next().value;
    if (firstKey) urlTreeCache.delete(firstKey);
  }
  urlTreeCache.set(cacheKey, result);

  return result;
}

export function isActive(
  url: string | UrlTree,
  currentUrl: string | UrlTree,
  options: IsActiveMatchOptions = { paths: 'exact', queryParams: 'exact', fragment: 'exact' }
): boolean {
  const targetTree = typeof url === 'string' ? parseUrl(url) : url;
  const currentTree = typeof currentUrl === 'string' ? parseUrl(currentUrl) : currentUrl;

  const targetPath = serializeSegmentGroup(targetTree.root);
  const currentPath = serializeSegmentGroup(currentTree.root);

  if (options.paths === 'exact') {
    if (targetPath !== currentPath) return false;
  } else {
    // subset
    if (!currentPath.startsWith(targetPath)) return false;
  }

  if (options.queryParams === 'exact') {
    const tKeys = Object.keys(targetTree.queryParams);
    const cKeys = Object.keys(currentTree.queryParams);
    if (tKeys.length !== cKeys.length) return false;
    for (const k of tKeys) {
      if (targetTree.queryParams[k] !== currentTree.queryParams[k]) return false;
    }
  } else if (options.queryParams === 'subset') {
    for (const [k, v] of Object.entries(targetTree.queryParams)) {
      if (currentTree.queryParams[k] !== v) return false;
    }
  }

  if (options.fragment === 'exact') {
    if (targetTree.fragment !== currentTree.fragment) return false;
  }

  return true;
}
