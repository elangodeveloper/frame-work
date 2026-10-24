import type { Route, RouteMatch, UrlSegment } from './types.ts';
import { parseUrl, DefaultUrlSegment } from './url-tree.ts';

export class RouteConfigError extends Error {
  constructor(message: string) {
    super(`[JARVIS RouteConfigError] ${message}`);
    this.name = 'RouteConfigError';
  }
}

interface TrieNode {
  segment: string;
  isParam: boolean;
  paramName?: string;
  isWildcard: boolean;
  routes: Route[];
  children: Map<string, TrieNode>;
  paramChild?: TrieNode;
  wildcardChild?: TrieNode;
}

export class RouteTrie {
  readonly root: TrieNode;
  private lastMatchKey: string | null = null;
  private lastMatchResult: RouteMatch | null = null;

  constructor(routes: Route[]) {
    this.validateRoutes(routes, new Set());
    this.root = this.createNode('');
    this.compileRoutes(routes, this.root);
  }

  private createNode(segment: string, isParam = false, paramName?: string, isWildcard = false): TrieNode {
    return {
      segment,
      isParam,
      paramName,
      isWildcard,
      routes: [],
      children: new Map(),
    };
  }

  /**
   * Validates route config at startup according to 2.1 specs:
   * - No component + loadComponent together
   * - No children + loadChildren together
   * - No redirect loops
   * - Clear errors with full diagnostic details
   */
  private validateRoutes(routes: Route[], visitedRedirects: Set<string>): void {
    const seenPathsWithoutCanMatch = new Set<string>();

    for (const route of routes) {
      if (route.component && route.loadComponent) {
        throw new RouteConfigError(
          `Invalid route config at path "${route.path}": cannot specify both "component" and "loadComponent" together.`
        );
      }
      if (route.children && route.loadChildren) {
        throw new RouteConfigError(
          `Invalid route config at path "${route.path}": cannot specify both "children" and "loadChildren" together.`
        );
      }

      if (route.redirectTo != null && typeof route.redirectTo === 'string') {
        if (route.redirectTo === route.path) {
          throw new RouteConfigError(
            `Redirect loop detected at path "${route.path}": redirects to itself ("${route.redirectTo}").`
          );
        }
        if (visitedRedirects.has(route.redirectTo)) {
          throw new RouteConfigError(
            `Circular redirect loop detected: path "${route.path}" redirects to previously visited "${route.redirectTo}".`
          );
        }
      }

      const key = `${route.path ?? ''}|${route.outlet ?? 'primary'}|${route.pathMatch ?? 'prefix'}`;
      const hasCanMatch = Boolean(route.canMatch && route.canMatch.length > 0);
      if (seenPathsWithoutCanMatch.has(key) && !hasCanMatch) {
        throw new RouteConfigError(
          `Duplicate route definition detected for path "${route.path}" on outlet "${route.outlet ?? 'primary'}". Use canMatch guards to disambiguate.`
        );
      }
      if (!hasCanMatch) {
        seenPathsWithoutCanMatch.add(key);
      }

      if (route.children) {
        const nextVisited = new Set(visitedRedirects);
        if (route.path) nextVisited.add(route.path);
        this.validateRoutes(route.children, nextVisited);
      }
    }
  }

  private compileRoutes(routes: Route[], parentNode: TrieNode): void {
    for (const route of routes) {
      const path = (route.path ?? '').replace(/^\/|\/$/g, '');
      const segments = path ? path.split('/') : [];
      let current = parentNode;

      for (const seg of segments) {
        if (seg === '**') {
          if (!current.wildcardChild) {
            current.wildcardChild = this.createNode('**', false, undefined, true);
          }
          current = current.wildcardChild;
        } else if (seg.startsWith(':')) {
          const paramName = seg.slice(1);
          if (!current.paramChild) {
            current.paramChild = this.createNode(seg, true, paramName);
          }
          current = current.paramChild;
        } else {
          if (!current.children.has(seg)) {
            current.children.set(seg, this.createNode(seg));
          }
          current = current.children.get(seg)!;
        }
      }

      current.routes.push(route);
    }
  }

  matchSync(rawUrl: string, paramsInheritance: 'emptyOnly' | 'always' = 'emptyOnly'): RouteMatch | null {
    const tree = parseUrl(rawUrl);
    const pathname = '/' + tree.root.segments.map((s) => s.path).join('/');
    const urlSegs = tree.root.segments;
    return this.matchSegmentsSync(this.root, urlSegs, 0, {}, {}, rawUrl, pathname, tree.queryParams, tree.fragment, paramsInheritance);
  }

  private matchSegmentsSync(
    node: TrieNode,
    segments: UrlSegment[],
    index: number,
    parentParams: Record<string, string>,
    parentData: Record<string, any>,
    rawUrl: string,
    pathname: string,
    queryParams: Record<string, string | string[]>,
    fragment: string | null,
    paramsInheritance: 'emptyOnly' | 'always'
  ): RouteMatch | null {
    const isEnd = index >= segments.length;
    for (const route of node.routes) {
      if (route.redirectTo != null) {
        const isMatch = route.pathMatch === 'full' ? isEnd : true;
        if (isMatch) {
          const target = typeof route.redirectTo === 'string' ? (route.redirectTo.startsWith('/') ? route.redirectTo : '/' + route.redirectTo) : '/';
          return this.matchSync(target, paramsInheritance);
        }
        continue;
      }
      const isMatch = route.pathMatch === 'full' ? isEnd : true;
      if (!isMatch) continue;
      const currentParams = { ...parentParams };
      const currentData = { ...parentData, ...(route.data || {}) };
      if (route.children && route.children.length > 0) {
        const childTrie = new RouteTrie(route.children);
        const remaining = segments.slice(index);
        const childMatch = childTrie.matchSegmentsSync(
          childTrie.root,
          remaining,
          0,
          currentParams,
          currentData,
          rawUrl,
          pathname,
          queryParams,
          fragment,
          paramsInheritance
        );
        if (childMatch) return childMatch;
      }
      if (isEnd) {
        return {
          route,
          url: rawUrl,
          pathname,
          params: currentParams,
          queryParams,
          fragment,
          data: currentData,
          title: typeof route.title === 'string' ? route.title : undefined,
          outlet: route.outlet || 'primary',
          resolvedData: {},
          segments,
        };
      }
    }
    if (isEnd) return null;
    const currentSegment = segments[index].path;
    const childNode = node.children.get(currentSegment);
    if (childNode) {
      const res = this.matchSegmentsSync(childNode, segments, index + 1, parentParams, parentData, rawUrl, pathname, queryParams, fragment, paramsInheritance);
      if (res) return res;
    }
    if (node.paramChild) {
      const nextParams = { ...parentParams, [node.paramChild.paramName!]: decodeURIComponent(currentSegment) };
      const res = this.matchSegmentsSync(node.paramChild, segments, index + 1, nextParams, parentData, rawUrl, pathname, queryParams, fragment, paramsInheritance);
      if (res) return res;
    }
    if (node.wildcardChild) {
      for (const route of node.wildcardChild.routes) {
        return {
          route,
          url: rawUrl,
          pathname,
          params: { ...parentParams },
          queryParams,
          fragment,
          data: { ...parentData, ...(route.data || {}) },
          title: typeof route.title === 'string' ? route.title : undefined,
          outlet: route.outlet || 'primary',
          resolvedData: {},
          segments,
        };
      }
    }
    return null;
  }

  /**
   * Fast O(path segments) lookup using compiled radix/trie.
   * Zero regex per route.
   */
  async match(rawUrl: string, paramsInheritance: 'emptyOnly' | 'always' = 'emptyOnly'): Promise<RouteMatch | null> {
    if (this.lastMatchKey === rawUrl && this.lastMatchResult) {
      return this.lastMatchResult;
    }

    const tree = parseUrl(rawUrl);
    const pathname = '/' + tree.root.segments.map((s) => s.path).join('/');
    const urlSegs = tree.root.segments;

    const match = await this.matchSegments(this.root, urlSegs, 0, {}, {}, rawUrl, pathname, tree.queryParams, tree.fragment, paramsInheritance);
    if (match) {
      this.lastMatchKey = rawUrl;
      this.lastMatchResult = match;
    }
    return match;
  }

  private async matchSegments(
    node: TrieNode,
    segments: UrlSegment[],
    index: number,
    parentParams: Record<string, string>,
    parentData: Record<string, any>,
    rawUrl: string,
    pathname: string,
    queryParams: Record<string, string | string[]>,
    fragment: string | null,
    paramsInheritance: 'emptyOnly' | 'always'
  ): Promise<RouteMatch | null> {
    const isEnd = index >= segments.length;

    // 1. Check routes on the current node
    for (const route of node.routes) {
      // Check canMatch guards
      if (route.canMatch && route.canMatch.length > 0) {
        const remaining = segments.slice(index);
        let passed = true;
        for (const guard of route.canMatch) {
          const res = await guard(route, remaining);
          if (res === false) {
            passed = false;
            break;
          }
        }
        if (!passed) continue;
      }

      // Redirect handling
      if (route.redirectTo != null) {
        const isMatch = route.pathMatch === 'full' ? isEnd : true;
        if (isMatch) {
          let target: string;
          if (typeof route.redirectTo === 'function') {
            const redirectTree = parseUrl(rawUrl);
            const redirectRes = route.redirectTo({ urlTree: redirectTree, params: parentParams, queryParams });
            target = typeof redirectRes === 'string' ? redirectRes : redirectRes.toString();
          } else {
            target = route.redirectTo.startsWith('/') ? route.redirectTo : '/' + route.redirectTo;
          }
          return this.match(target, paramsInheritance);
        }
        continue;
      }

      // Check pathMatch
      const isMatch = route.pathMatch === 'full' ? isEnd : true;
      if (!isMatch) continue;

      const currentParams = paramsInheritance === 'always' || route.path === ''
        ? { ...parentParams }
        : { ...parentParams };

      const currentData = { ...parentData, ...(route.data || {}) };

      // Check children
      if (route.children && route.children.length > 0) {
        const childTrie = new RouteTrie(route.children);
        const remaining = segments.slice(index);
        const childUrl = '/' + remaining.map((s) => s.path).join('/');
        const childMatch = await childTrie.matchSegments(
          childTrie.root,
          remaining,
          0,
          currentParams,
          currentData,
          rawUrl,
          pathname,
          queryParams,
          fragment,
          paramsInheritance
        );
        if (childMatch) return childMatch;
      }

      // Check lazy loadChildren
      if (route.loadChildren && !isEnd) {
        const loaded: any = await route.loadChildren();
        const childRoutes: Route[] = Array.isArray(loaded)
          ? loaded
          : loaded?.default || loaded?.routes || [];
        route.children = childRoutes;
        const childTrie = new RouteTrie(childRoutes);
        const remaining = segments.slice(index);
        const childMatch = await childTrie.matchSegments(
          childTrie.root,
          remaining,
          0,
          currentParams,
          currentData,
          rawUrl,
          pathname,
          queryParams,
          fragment,
          paramsInheritance
        );
        if (childMatch) return childMatch;
      }

      if (isEnd) {
        return {
          route,
          url: rawUrl,
          pathname,
          params: currentParams,
          queryParams,
          fragment,
          data: currentData,
          title: typeof route.title === 'string' ? route.title : undefined,
          outlet: route.outlet || 'primary',
          resolvedData: {},
          segments,
        };
      }
    }

    if (isEnd) return null;

    const currentSegment = segments[index].path;

    // 2. Exact literal match
    const childNode = node.children.get(currentSegment);
    if (childNode) {
      const res = await this.matchSegments(childNode, segments, index + 1, parentParams, parentData, rawUrl, pathname, queryParams, fragment, paramsInheritance);
      if (res) return res;
    }

    // 3. Param match (:id)
    if (node.paramChild) {
      const nextParams = { ...parentParams, [node.paramChild.paramName!]: decodeURIComponent(currentSegment) };
      const res = await this.matchSegments(node.paramChild, segments, index + 1, nextParams, parentData, rawUrl, pathname, queryParams, fragment, paramsInheritance);
      if (res) return res;
    }

    // 4. Wildcard match (**)
    if (node.wildcardChild) {
      for (const route of node.wildcardChild.routes) {
        return {
          route,
          url: rawUrl,
          pathname,
          params: { ...parentParams },
          queryParams,
          fragment,
          data: { ...parentData, ...(route.data || {}) },
          title: typeof route.title === 'string' ? route.title : undefined,
          outlet: route.outlet || 'primary',
          resolvedData: {},
          segments,
        };
      }
    }

    return null;
  }
}

export async function matchRouteTree(routes: Route[], rawUrl: string): Promise<RouteMatch | null> {
  const trie = new RouteTrie(routes);
  return trie.match(rawUrl);
}
