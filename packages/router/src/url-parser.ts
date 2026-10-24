import type { Route, RouteMatch, UrlSegment } from './types.ts';

export interface ParsedUrl {
  pathname: string;
  queryParams: Record<string, string>;
  fragment: string | null;
}

/**
 * Parses a raw URL into pathname, queryParams, and fragment.
 * Time Complexity: O(L) where L is length of the URL string.
 */
export function parseUrl(rawUrl: string): ParsedUrl {
  let url = (rawUrl || '/').trim();

  if (url.startsWith('#')) {
    url = url.slice(1);
  }
  if (!url.startsWith('/')) {
    url = '/' + url;
  }

  let fragment: string | null = null;
  const hashIdx = url.indexOf('#');
  if (hashIdx !== -1) {
    fragment = url.slice(hashIdx + 1);
    url = url.slice(0, hashIdx);
  }

  let queryParams: Record<string, string> = {};
  const queryIdx = url.indexOf('?');
  if (queryIdx !== -1) {
    const queryString = url.slice(queryIdx + 1);
    url = url.slice(0, queryIdx);
    if (queryString.length > 0) {
      const pairs = queryString.split('&');
      for (const pair of pairs) {
        if (!pair) continue;
        const eqIdx = pair.indexOf('=');
        if (eqIdx !== -1) {
          const k = decodeURIComponent(pair.slice(0, eqIdx));
          const v = decodeURIComponent(pair.slice(eqIdx + 1));
          queryParams[k] = v;
        } else {
          queryParams[decodeURIComponent(pair)] = '';
        }
      }
    }
  }

  const pathname = normalizePathname(url);
  return { pathname, queryParams, fragment };
}

export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const cleaned = pathname.replace(/\/+/g, '/').replace(/\/+$/, '');
  return cleaned.startsWith('/') ? cleaned : '/' + cleaned;
}

export function splitSegments(path: string): string[] {
  return normalizePathname(path)
    .split('/')
    .filter((s) => s.length > 0);
}

export function toUrlSegments(segments: string[]): UrlSegment[] {
  return segments.map((p) => ({ path: p, parameters: {} }));
}

/**
 * Route Matching Algorithm with Hierarchical Children & CanMatch Support.
 * Complexity:
 *   - Depth D (max route tree depth) and Branching Factor B (children per node).
 *   - Best case: O(D) path search.
 *   - Worst case: O(B * D) across nested routes with backtracking.
 */
export async function matchRouteTree(
  routes: Route[],
  rawUrl: string,
  parentParams: Record<string, string> = {},
  parentData: Record<string, any> = {},
  baseSegments: string[] = []
): Promise<RouteMatch | null> {
  const { pathname, queryParams, fragment } = parseUrl(rawUrl);
  const totalUrlSegments = splitSegments(pathname);
  const activeSegments = totalUrlSegments.slice(baseSegments.length);

  for (const route of routes) {
    // 1. CanMatch Guard Check
    if (route.canMatch && route.canMatch.length > 0) {
      const urlSegs = toUrlSegments(activeSegments);
      let passed = true;
      for (const guard of route.canMatch) {
        const result = await guard(route, urlSegs);
        if (result === false) {
          passed = false;
          break;
        }
      }
      if (!passed) continue;
    }

    // 2. Redirect Handling
    if (route.redirectTo != null) {
      const matchFull = route.pathMatch === 'full';
      const routeSegs = splitSegments(route.path ?? '');

      let isMatch = false;
      if (routeSegs.length === 0) {
        isMatch = matchFull ? activeSegments.length === 0 : true;
      } else if (matchFull) {
        isMatch = activeSegments.join('/') === routeSegs.join('/');
      } else {
        isMatch = activeSegments.slice(0, routeSegs.length).join('/') === routeSegs.join('/');
      }

      if (isMatch) {
        const target = route.redirectTo.startsWith('/')
          ? route.redirectTo
          : '/' + [...baseSegments, ...splitSegments(route.redirectTo)].join('/');
        return matchRouteTree(routes, target, parentParams, parentData, []);
      }
      continue;
    }

    // 3. Wildcard ('**')
    if (route.path === '**') {
      return {
        route,
        url: rawUrl,
        pathname,
        params: { ...parentParams },
        queryParams,
        fragment,
        data: { ...parentData, ...(route.data || {}) },
        title: route.title,
        outlet: route.outlet || 'primary',
        resolvedData: {},
      };
    }

    // 4. Segment Comparison
    const routeSegs = splitSegments(route.path ?? '');
    const matchFull = route.pathMatch === 'full' || (!route.children && !route.loadChildren);

    if (matchFull && !route.children && !route.loadChildren) {
      if (routeSegs.length !== activeSegments.length) continue;
    } else if (activeSegments.length < routeSegs.length) {
      continue;
    }

    let isSegMatch = true;
    const matchedParams: Record<string, string> = { ...parentParams };

    for (let i = 0; i < routeSegs.length; i++) {
      const rSeg = routeSegs[i];
      const uSeg = activeSegments[i];
      if (rSeg.startsWith(':')) {
        matchedParams[rSeg.slice(1)] = uSeg;
      } else if (rSeg !== uSeg) {
        isSegMatch = false;
        break;
      }
    }

    if (!isSegMatch) continue;

    const consumedCount = baseSegments.length + routeSegs.length;
    const combinedData = { ...parentData, ...(route.data || {}) };

    // 5. Nested children matching
    if (route.children && route.children.length > 0) {
      const childMatch = await matchRouteTree(
        route.children,
        rawUrl,
        matchedParams,
        combinedData,
        totalUrlSegments.slice(0, consumedCount)
      );
      if (childMatch) return childMatch;
    }

    // 5b. Lazy children loading via loadChildren
    if (route.loadChildren) {
      const loaded: any = await route.loadChildren();
      const childRoutes: Route[] = Array.isArray(loaded)
        ? loaded
        : (loaded && (loaded.default || loaded.routes || Object.values(loaded)[0])) || [];
      route.children = childRoutes;
      const childMatch = await matchRouteTree(
        childRoutes,
        rawUrl,
        matchedParams,
        combinedData,
        totalUrlSegments.slice(0, consumedCount)
      );
      if (childMatch) return childMatch;
    }

    // 6. Direct match terminal node
    if (consumedCount === totalUrlSegments.length) {
      return {
        route,
        url: rawUrl,
        pathname,
        params: matchedParams,
        queryParams,
        fragment,
        data: combinedData,
        title: route.title,
        outlet: route.outlet || 'primary',
        resolvedData: {},
      };
    }
  }

  return null;
}

export function matchRoute(routes: Route[], rawUrl: string): RouteMatch | null {
  // Synchronous wrapper used by legacy sync call sites
  const { pathname, queryParams, fragment } = parseUrl(rawUrl);
  const urlSegments = splitSegments(pathname);

  for (const route of routes) {
    if (route.redirectTo != null) {
      const matchFull = route.pathMatch === 'full';
      const routeSegments = splitSegments(route.path ?? '');
      let isMatch = false;
      if (route.path === '' || route.path === '/') {
        isMatch = matchFull ? urlSegments.length === 0 : true;
      } else if (matchFull) {
        isMatch = urlSegments.join('/') === routeSegments.join('/');
      } else {
        isMatch = urlSegments.slice(0, routeSegments.length).join('/') === routeSegments.join('/');
      }
      if (isMatch) {
        const redirectTarget = route.redirectTo.startsWith('/') ? route.redirectTo : '/' + route.redirectTo;
        return matchRoute(routes, redirectTarget);
      }
      continue;
    }

    if (route.path === '**') {
      return {
        route,
        url: rawUrl,
        pathname,
        params: {},
        queryParams,
        fragment,
        data: route.data || {},
        title: route.title,
        outlet: route.outlet || 'primary',
        resolvedData: {},
      };
    }

    const routeSegments = splitSegments(route.path ?? '');
    if (routeSegments.length === 0) {
      if (urlSegments.length === 0) {
        return {
          route,
          url: rawUrl,
          pathname,
          params: {},
          queryParams,
          fragment,
          data: route.data || {},
          title: route.title,
          outlet: route.outlet || 'primary',
          resolvedData: {},
        };
      }
      continue;
    }

    if (routeSegments.length !== urlSegments.length) continue;

    let isMatch = true;
    const params: Record<string, string> = {};
    for (let i = 0; i < routeSegments.length; i++) {
      const routeSeg = routeSegments[i];
      const urlSeg = urlSegments[i];
      if (routeSeg.startsWith(':')) {
        params[routeSeg.slice(1)] = urlSeg;
      } else if (routeSeg !== urlSeg) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      return {
        route,
        url: rawUrl,
        pathname,
        params,
        queryParams,
        fragment,
        data: route.data || {},
        title: route.title,
        outlet: route.outlet || 'primary',
        resolvedData: {},
      };
    }
  }

  return null;
}
