// packages/reactive/src/graph.ts
var activeConsumer = null;
var consumerStack = [];
function setActiveConsumer(consumer) {
  consumerStack.push(activeConsumer);
  activeConsumer = consumer;
}
function restoreActiveConsumer() {
  activeConsumer = consumerStack.pop() ?? null;
}
function trackProducer(producer) {
  if (activeConsumer) {
    producer.subscribers.add(activeConsumer);
    activeConsumer.dependencies.add(producer);
  }
}
function cleanupConsumer(consumer) {
  for (const producer of consumer.dependencies) {
    producer.subscribers.delete(consumer);
  }
  consumer.dependencies.clear();
}

// packages/reactive/src/scheduler.ts
var pendingJobs = /* @__PURE__ */ new Set();
var isScheduled = false;
var batchDepth = 0;
function scheduleJob(job) {
  pendingJobs.add(job);
  if (batchDepth === 0 && !isScheduled) {
    isScheduled = true;
    queueMicrotask(flushJobs);
  }
}
function flushJobs() {
  isScheduled = false;
  while (pendingJobs.size > 0) {
    const jobs = Array.from(pendingJobs);
    pendingJobs.clear();
    for (const job of jobs) {
      job();
    }
  }
}

// packages/reactive/src/signal.ts
var SignalNode = class {
  constructor(value) {
    this.subscribers = /* @__PURE__ */ new Set();
    this.value = value;
  }
  get() {
    trackProducer(this);
    return this.value;
  }
  set(newValue) {
    if (!Object.is(this.value, newValue)) {
      this.value = newValue;
      this.notify();
    }
  }
  update(fn) {
    this.set(fn(this.value));
  }
  notify() {
    const subs = Array.from(this.subscribers);
    for (const sub of subs) {
      sub.markDirty();
    }
  }
};
function signal(initialValue) {
  const node = new SignalNode(initialValue);
  const accessor = (() => node.get());
  accessor.get = () => node.get();
  accessor.set = (val) => node.set(val);
  accessor.update = (fn) => node.update(fn);
  return accessor;
}
var EffectNode = class {
  constructor(effectFn) {
    this.dependencies = /* @__PURE__ */ new Set();
    this.disposed = false;
    this.scheduled = false;
    this.effectFn = effectFn;
    this.run();
  }
  run() {
    if (this.disposed) return;
    this.scheduled = false;
    if (this.cleanupFn) {
      try {
        this.cleanupFn();
      } catch (err) {
        console.error("Error during effect cleanup:", err);
      }
      this.cleanupFn = void 0;
    }
    cleanupConsumer(this);
    setActiveConsumer(this);
    try {
      const res = this.effectFn();
      if (typeof res === "function") {
        this.cleanupFn = res;
      }
    } finally {
      restoreActiveConsumer();
    }
  }
  markDirty() {
    if (!this.disposed && !this.scheduled) {
      this.scheduled = true;
      scheduleJob(() => this.run());
    }
  }
  dispose() {
    if (!this.disposed) {
      this.disposed = true;
      if (this.cleanupFn) {
        this.cleanupFn();
        this.cleanupFn = void 0;
      }
      cleanupConsumer(this);
    }
  }
};
function effect(fn) {
  const node = new EffectNode(fn);
  return () => node.dispose();
}

// packages/renderer/src/dom_renderer.ts
var DOMRenderer = class {
  createElement(tag) {
    return document.createElement(tag);
  }
  createText(content = "") {
    return document.createTextNode(content);
  }
  appendChild(parent, child) {
    parent.appendChild(child);
  }
  removeChild(parent, child) {
    parent.removeChild(child);
  }
  setAttribute(element, name, value) {
    element.setAttribute(name, value);
  }
  setProperty(element, property, value) {
    element[property] = value;
  }
  setText(textNode, content) {
    textNode.textContent = content;
  }
  bindText(textNode, expressionFn) {
    return effect(() => {
      const val = expressionFn();
      textNode.textContent = val != null ? String(val) : "";
    });
  }
  bindProperty(element, property, expressionFn) {
    return effect(() => {
      const val = expressionFn();
      element[property] = val;
    });
  }
  listen(element, event, handler) {
    element.addEventListener(event, handler);
    return () => element.removeEventListener(event, handler);
  }
};

// packages/core/src/metadata.ts
var JARVIS_COMPONENT_METADATA = /* @__PURE__ */ Symbol.for("jarvis:component_metadata");
function setComponentDef(target, def) {
  Object.defineProperty(target, JARVIS_COMPONENT_METADATA, {
    value: def,
    writable: false,
    enumerable: false,
    configurable: true
  });
}
function getComponentDef(target) {
  return target[JARVIS_COMPONENT_METADATA];
}

// packages/core/src/component.ts
function Component(options, maybeTarget) {
  const decorator = function(target) {
    const def = {
      type: target,
      selector: options.selector,
      template: options.template,
      templateUrl: options.templateUrl,
      styles: options.styles ? [...options.styles] : [],
      styleUrl: options.styleUrl,
      styleUrls: options.styleUrls ? [...options.styleUrls] : []
    };
    setComponentDef(target, def);
    return target;
  };
  if (maybeTarget) {
    return decorator(maybeTarget);
  }
  return decorator;
}

// packages/core/src/event.ts
var JarvisEvent = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Set();
  }
  /**
   * Dispatches an event with the given payload to all active subscribers.
   */
  emit(value) {
    const active = Array.from(this.listeners);
    for (const listener of active) {
      try {
        listener(value);
      } catch (err) {
        console.error("[JarvisEvent] Error during listener execution:", err);
      }
    }
  }
  /**
   * Subscribes a listener callback to this event.
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
      }
    };
  }
  /**
   * Returns the count of active listeners.
   */
  get listenerCount() {
    return this.listeners.size;
  }
  /**
   * Clears all listeners.
   */
  clear() {
    this.listeners.clear();
  }
};
function jarvisEvent() {
  return new JarvisEvent();
}

// packages/core/src/di.ts
var InjectionToken = class {
  constructor(description, options) {
    this.description = description;
    this.options = options;
  }
  toString() {
    return "InjectionToken(" + this.description + ")";
  }
};
var Injector = class _Injector {
  constructor(parent = null) {
    this.records = /* @__PURE__ */ new Map();
    this.resolving = /* @__PURE__ */ new Set();
    this.parent = parent;
  }
  static {
    this.rootInjector = null;
  }
  static {
    this.activeContextInjector = null;
  }
  static get root() {
    if (!this.rootInjector) {
      this.rootInjector = new _Injector();
    }
    return this.rootInjector;
  }
  static get current() {
    return this.activeContextInjector || this.rootInjector;
  }
  static setActive(injector) {
    const prev = this.activeContextInjector;
    this.activeContextInjector = injector;
    return prev;
  }
  provide(providerOrToken, value) {
    if (value !== void 0) {
      this.records.set(providerOrToken, value);
      return;
    }
    if (typeof providerOrToken === "function") {
      this.records.set(providerOrToken, { provide: providerOrToken, useClass: providerOrToken });
    } else if (providerOrToken && typeof providerOrToken === "object" && "provide" in providerOrToken) {
      this.records.set(providerOrToken.provide, providerOrToken);
    }
  }
  get(token, notFoundValue) {
    if (this.resolving.has(token)) {
      const path = Array.from(this.resolving).map((t) => String(t)).join(" -> ");
      throw new Error("[JARVIS DI] Circular dependency detected: " + path + " -> " + String(token));
    }
    if (this.records.has(token)) {
      const record = this.records.get(token);
      if (record && typeof record === "object" && "provide" in record) {
        this.resolving.add(token);
        try {
          const instance = this.instantiateProvider(record);
          this.records.set(token, instance);
          return instance;
        } finally {
          this.resolving.delete(token);
        }
      }
      return record;
    }
    if (this.parent) {
      return this.parent.get(token, notFoundValue);
    }
    if (token instanceof InjectionToken && token.options?.factory) {
      this.resolving.add(token);
      try {
        const val = token.options.factory();
        this.records.set(token, val);
        return val;
      } finally {
        this.resolving.delete(token);
      }
    }
    if (typeof token === "function") {
      this.resolving.add(token);
      try {
        const instance = new token();
        this.records.set(token, instance);
        return instance;
      } finally {
        this.resolving.delete(token);
      }
    }
    if (notFoundValue !== void 0) {
      return notFoundValue;
    }
    throw new Error("[JARVIS DI] No provider found for token: " + String(token));
  }
  instantiateProvider(provider) {
    if ("useValue" in provider) {
      return provider.useValue;
    }
    if ("useClass" in provider) {
      return new provider.useClass();
    }
    if ("useFactory" in provider) {
      const deps = (provider.deps || []).map((dep) => this.get(dep));
      return provider.useFactory(...deps);
    }
    if ("useExisting" in provider) {
      return this.get(provider.useExisting);
    }
    throw new Error("[JARVIS DI] Invalid provider configuration for token: " + String(provider.provide));
  }
};

// packages/core/src/input_output.ts
var JARVIS_INPUT_METADATA = /* @__PURE__ */ Symbol.for("jarvis:input_metadata");
var JARVIS_OUTPUT_METADATA = /* @__PURE__ */ Symbol.for("jarvis:output_metadata");
function input(initialValue) {
  const innerSignal = signal(initialValue);
  const accessor = (() => innerSignal());
  accessor.get = () => innerSignal.get();
  accessor.set = (val) => innerSignal.set(val);
  accessor.update = (fn) => innerSignal.update(fn);
  Object.defineProperty(accessor, JARVIS_INPUT_METADATA, {
    value: { required: false, defaultValue: initialValue },
    writable: false,
    enumerable: false
  });
  return accessor;
}
input.required = function() {
  let isAssigned = false;
  const innerSignal = signal(void 0);
  const accessor = (() => {
    return innerSignal();
  });
  accessor.get = () => innerSignal.get();
  accessor.set = (val) => {
    isAssigned = true;
    innerSignal.set(val);
  };
  accessor.update = (fn) => {
    isAssigned = true;
    innerSignal.update(fn);
  };
  Object.defineProperty(accessor, JARVIS_INPUT_METADATA, {
    value: { required: true },
    writable: false,
    enumerable: false
  });
  return accessor;
};
function output() {
  const event = new JarvisEvent();
  const emitter = {
    emit(value) {
      event.emit(value);
    },
    subscribe(listener) {
      return event.subscribe(listener);
    },
    get listenerCount() {
      return event.listenerCount;
    },
    [JARVIS_OUTPUT_METADATA]: true
  };
  return emitter;
}

// packages/router/src/url-parser.ts
function parseUrl(rawUrl) {
  let url = (rawUrl || "/").trim();
  if (url.startsWith("#")) {
    url = url.slice(1);
  }
  if (!url.startsWith("/")) {
    url = "/" + url;
  }
  let fragment = null;
  const hashIdx = url.indexOf("#");
  if (hashIdx !== -1) {
    fragment = url.slice(hashIdx + 1);
    url = url.slice(0, hashIdx);
  }
  let queryParams = {};
  const queryIdx = url.indexOf("?");
  if (queryIdx !== -1) {
    const queryString = url.slice(queryIdx + 1);
    url = url.slice(0, queryIdx);
    if (queryString.length > 0) {
      const pairs = queryString.split("&");
      for (const pair of pairs) {
        if (!pair) continue;
        const eqIdx = pair.indexOf("=");
        if (eqIdx !== -1) {
          const k = decodeURIComponent(pair.slice(0, eqIdx));
          const v = decodeURIComponent(pair.slice(eqIdx + 1));
          queryParams[k] = v;
        } else {
          queryParams[decodeURIComponent(pair)] = "";
        }
      }
    }
  }
  const pathname = normalizePathname(url);
  return { pathname, queryParams, fragment };
}
function normalizePathname(pathname) {
  if (!pathname || pathname === "/") return "/";
  const cleaned = pathname.replace(/\/+/g, "/").replace(/\/+$/, "");
  return cleaned.startsWith("/") ? cleaned : "/" + cleaned;
}
function splitSegments(path) {
  return normalizePathname(path).split("/").filter((s) => s.length > 0);
}
function toUrlSegments(segments) {
  return segments.map((p) => ({ path: p, parameters: {} }));
}
async function matchRouteTree(routes2, rawUrl, parentParams = {}, parentData = {}, baseSegments = []) {
  const { pathname, queryParams, fragment } = parseUrl(rawUrl);
  const totalUrlSegments = splitSegments(pathname);
  const activeSegments = totalUrlSegments.slice(baseSegments.length);
  for (const route of routes2) {
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
    if (route.redirectTo != null) {
      const matchFull2 = route.pathMatch === "full";
      const routeSegs2 = splitSegments(route.path ?? "");
      let isMatch = false;
      if (routeSegs2.length === 0) {
        isMatch = matchFull2 ? activeSegments.length === 0 : true;
      } else if (matchFull2) {
        isMatch = activeSegments.join("/") === routeSegs2.join("/");
      } else {
        isMatch = activeSegments.slice(0, routeSegs2.length).join("/") === routeSegs2.join("/");
      }
      if (isMatch) {
        const target = route.redirectTo.startsWith("/") ? route.redirectTo : "/" + [...baseSegments, ...splitSegments(route.redirectTo)].join("/");
        return matchRouteTree(routes2, target, parentParams, parentData, []);
      }
      continue;
    }
    if (route.path === "**") {
      return {
        route,
        url: rawUrl,
        pathname,
        params: { ...parentParams },
        queryParams,
        fragment,
        data: { ...parentData, ...route.data || {} },
        title: route.title,
        outlet: route.outlet || "primary",
        resolvedData: {}
      };
    }
    const routeSegs = splitSegments(route.path ?? "");
    const matchFull = route.pathMatch === "full" || !route.children && !route.loadChildren;
    if (matchFull && !route.children && !route.loadChildren) {
      if (routeSegs.length !== activeSegments.length) continue;
    } else if (activeSegments.length < routeSegs.length) {
      continue;
    }
    let isSegMatch = true;
    const matchedParams = { ...parentParams };
    for (let i = 0; i < routeSegs.length; i++) {
      const rSeg = routeSegs[i];
      const uSeg = activeSegments[i];
      if (rSeg.startsWith(":")) {
        matchedParams[rSeg.slice(1)] = uSeg;
      } else if (rSeg !== uSeg) {
        isSegMatch = false;
        break;
      }
    }
    if (!isSegMatch) continue;
    const consumedCount = baseSegments.length + routeSegs.length;
    const combinedData = { ...parentData, ...route.data || {} };
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
        outlet: route.outlet || "primary",
        resolvedData: {}
      };
    }
  }
  return null;
}

// packages/router/src/activated-route.ts
var ActivatedRoute = class {
  url;
  pathname;
  params;
  queryParams;
  fragment;
  data;
  title;
  outlet;
  _snapshot = null;
  constructor() {
    this.url = signal("");
    this.pathname = signal("");
    this.params = signal({});
    this.queryParams = signal({});
    this.fragment = signal(null);
    this.data = signal({});
    this.title = signal(void 0);
    this.outlet = signal("primary");
  }
  get snapshot() {
    return this._snapshot;
  }
  _update(match) {
    this._snapshot = match;
    this.url.set(match.url);
    this.pathname.set(match.pathname);
    this.params.set(match.params);
    this.queryParams.set(match.queryParams);
    this.fragment.set(match.fragment);
    this.data.set({ ...match.data, ...match.resolvedData });
    this.title.set(match.title);
    this.outlet.set(match.outlet || "primary");
  }
};

// packages/router/src/router.ts
var PathLocationStrategy = class {
  baseHref;
  constructor(baseHref = "/") {
    this.baseHref = baseHref;
  }
  path() {
    if (typeof window !== "undefined" && window.location) {
      return window.location.pathname + window.location.search + window.location.hash;
    }
    return "/";
  }
  prepareExternalUrl(internal) {
    return internal.startsWith("/") ? internal : "/" + internal;
  }
  pushState(state, title, url) {
    if (typeof window !== "undefined" && window.history) {
      window.history.pushState(state, title, url);
    }
  }
  replaceState(state, title, url) {
    if (typeof window !== "undefined" && window.history) {
      window.history.replaceState(state, title, url);
    }
  }
  forward() {
    if (typeof window !== "undefined" && window.history) window.history.forward();
  }
  back() {
    if (typeof window !== "undefined" && window.history) window.history.back();
  }
  onPopState(fn) {
    if (typeof window !== "undefined") {
      window.addEventListener("popstate", fn);
      return () => window.removeEventListener("popstate", fn);
    }
    return () => {
    };
  }
  getBaseHref() {
    return this.baseHref;
  }
};
var HashLocationStrategy = class {
  path() {
    if (typeof window !== "undefined" && window.location) {
      return window.location.hash.slice(1) || "/";
    }
    return "/";
  }
  prepareExternalUrl(internal) {
    return "#" + (internal.startsWith("/") ? internal : "/" + internal);
  }
  pushState(state, title, url) {
    if (typeof window !== "undefined" && window.location) {
      window.location.hash = url;
    }
  }
  replaceState(state, title, url) {
    if (typeof window !== "undefined" && window.location) {
      window.location.hash = url;
    }
  }
  forward() {
    if (typeof window !== "undefined" && window.history) window.history.forward();
  }
  back() {
    if (typeof window !== "undefined" && window.history) window.history.back();
  }
  onPopState(fn) {
    if (typeof window !== "undefined") {
      window.addEventListener("hashchange", fn);
      return () => window.removeEventListener("hashchange", fn);
    }
    return () => {
    };
  }
  getBaseHref() {
    return "";
  }
};
var Router = class {
  routes;
  currentUrl;
  activeRoute;
  events;
  currentNavigation;
  activatedRoute;
  locationStrategy;
  scrollRestoration;
  navigationIdCounter = 0;
  activeNavigationId = null;
  unbindLocationListener = null;
  constructor(routes2, options = {}) {
    this.routes = routes2;
    this.locationStrategy = options.locationStrategy ?? (options.useHash ? new HashLocationStrategy() : new PathLocationStrategy(options.baseHref || "/"));
    this.scrollRestoration = options.scrollRestoration ?? "top";
    this.events = jarvisEvent();
    this.activatedRoute = new ActivatedRoute();
    this.currentUrl = signal("");
    this.activeRoute = signal(null);
    this.currentNavigation = signal(null);
    this.initHistory();
    const initial = options.initialUrl ?? this.locationStrategy.path();
    this.navigateByUrl(initial, { replaceUrl: true });
  }
  initHistory() {
    this.unbindLocationListener = this.locationStrategy.onPopState(() => {
      this.navigateByUrl(this.locationStrategy.path(), { replaceUrl: true, skipPushState: true });
    });
  }
  async navigate(commands, extras = {}) {
    const raw = commands.join("/").replace(/\/+/g, "/");
    const url = raw.startsWith("/") ? raw : "/" + raw;
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
  async navigateByUrl(targetUrl, extras = {}) {
    const navId = ++this.navigationIdCounter;
    this.activeNavigationId = navId;
    let fullUrl = (targetUrl || "/").trim();
    if (!fullUrl.startsWith("/") && !fullUrl.startsWith("#")) fullUrl = "/" + fullUrl;
    if (extras.queryParams && Object.keys(extras.queryParams).length > 0) {
      const q = new URLSearchParams(extras.queryParams).toString();
      fullUrl += (fullUrl.includes("?") ? "&" : "?") + q;
    }
    if (extras.fragment) {
      fullUrl += "#" + extras.fragment;
    }
    const navigation = {
      id: navId,
      initialUrl: targetUrl,
      extractedUrl: fullUrl,
      trigger: extras.skipPushState ? "popstate" : "imperative",
      extras
    };
    this.currentNavigation.set(navigation);
    this.events.emit({ type: "NavigationStart", id: navId, url: fullUrl });
    try {
      const match = await matchRouteTree(this.routes, fullUrl);
      if (this.activeNavigationId !== navId) return false;
      if (!match) {
        this.events.emit({
          type: "NavigationError",
          id: navId,
          url: fullUrl,
          reason: "Cannot match any routes for URL: " + fullUrl
        });
        this.currentNavigation.set(null);
        return false;
      }
      this.events.emit({ type: "RoutesRecognized", id: navId, url: fullUrl });
      let loadedComponent = match.route.component;
      if (!loadedComponent && match.route.loadComponent) {
        const loaded = await match.route.loadComponent();
        if (this.activeNavigationId !== navId) return false;
        loadedComponent = loaded && loaded.default ? loaded.default : loaded;
      }
      const currentMatch = this.activeRoute();
      const snapshot = {
        url: fullUrl,
        root: match
      };
      if (currentMatch && currentMatch.route.canDeactivate) {
        for (const guard of currentMatch.route.canDeactivate) {
          const res = await guard(null, currentMatch, { url: this.currentUrl(), root: currentMatch }, snapshot);
          if (this.activeNavigationId !== navId) return false;
          if (res === false) {
            this.events.emit({ type: "NavigationCancel", id: navId, url: fullUrl, reason: "canDeactivate rejected" });
            this.currentNavigation.set(null);
            return false;
          }
          if (typeof res === "string" || res && typeof res === "object" && "root" in res) {
            this.currentNavigation.set(null);
            return this.navigateByUrl(String(res));
          }
        }
      }
      this.events.emit({ type: "GuardsCheckStart", id: navId, url: fullUrl });
      if (match.route.canActivate && match.route.canActivate.length > 0) {
        for (const guard of match.route.canActivate) {
          const res = await guard(match, snapshot);
          if (this.activeNavigationId !== navId) return false;
          if (res === false) {
            this.events.emit({ type: "NavigationCancel", id: navId, url: fullUrl, reason: "canActivate rejected" });
            this.currentNavigation.set(null);
            return false;
          }
          if (typeof res === "string" || res && typeof res === "object" && "root" in res) {
            this.currentNavigation.set(null);
            return this.navigateByUrl(String(res));
          }
        }
      }
      this.events.emit({ type: "GuardsCheckEnd", id: navId, url: fullUrl });
      this.events.emit({ type: "ResolveStart", id: navId, url: fullUrl });
      const resolvedData = {};
      if (match.route.resolve) {
        const resolveKeys = Object.keys(match.route.resolve);
        const promises = resolveKeys.map((k) => match.route.resolve[k](match, snapshot));
        const resolvedValues = await Promise.all(promises);
        if (this.activeNavigationId !== navId) return false;
        for (let i = 0; i < resolveKeys.length; i++) {
          resolvedData[resolveKeys[i]] = resolvedValues[i];
        }
      }
      this.events.emit({ type: "ResolveEnd", id: navId, url: fullUrl });
      if (!extras.skipPushState) {
        const prepUrl = this.locationStrategy.prepareExternalUrl(match.url);
        if (extras.replaceUrl) {
          this.locationStrategy.replaceState(extras.state ?? null, match.title || "", prepUrl);
        } else {
          this.locationStrategy.pushState(extras.state ?? null, match.title || "", prepUrl);
        }
      }
      if (match.title && typeof document !== "undefined") {
        document.title = match.title;
      }
      if (this.scrollRestoration === "top" && typeof window !== "undefined") {
        window.scrollTo(0, 0);
      }
      const finalizedMatch = {
        ...match,
        route: { ...match.route, component: loadedComponent },
        resolvedData
      };
      this.currentUrl.set(match.url);
      this.activeRoute.set(finalizedMatch);
      this.activatedRoute._update(finalizedMatch);
      this.events.emit({ type: "NavigationEnd", id: navId, url: match.url });
      this.currentNavigation.set(null);
      return true;
    } catch (err) {
      this.events.emit({
        type: "NavigationError",
        id: navId,
        url: fullUrl,
        reason: err?.message || String(err)
      });
      this.currentNavigation.set(null);
      return false;
    }
  }
  destroy() {
    if (this.unbindLocationListener) {
      this.unbindLocationListener();
      this.unbindLocationListener = null;
    }
  }
};

// packages/router/src/index.ts
function provideRouter(routes2, optionsOrFeature, ...features) {
  let opts = {};
  if (typeof optionsOrFeature === "object" && optionsOrFeature !== null) {
    opts = optionsOrFeature;
  }
  const router = new Router(routes2, opts);
  if (typeof optionsOrFeature === "function") {
    optionsOrFeature(router);
  }
  for (const feat of features) {
    feat(router);
  }
  return router;
}

// packages/runtime/src/view.ts
var ComponentView = class {
  constructor(root) {
    this.disposers = [];
    this.root = root;
  }
  destroy() {
    for (const dispose of this.disposers) {
      try {
        dispose();
      } catch (err) {
        console.error("Error during view disposal:", err);
      }
    }
    this.disposers = [];
  }
};

// packages/runtime/src/bootstrap.ts
function bootstrap(ComponentClass, container, customRenderer, options) {
  const def = getComponentDef(ComponentClass);
  const renderer = customRenderer || new DOMRenderer();
  const instance = new ComponentClass();
  const subscriptions = [];
  if (options?.inputs) {
    for (const [key, val] of Object.entries(options.inputs)) {
      const prop = instance[key];
      if (prop && typeof prop.set === "function") {
        prop.set(val);
      } else {
        instance[key] = val;
      }
    }
  }
  if (options?.outputs) {
    for (const [key, handler] of Object.entries(options.outputs)) {
      const prop = instance[key];
      if (prop && typeof prop.subscribe === "function") {
        subscriptions.push(prop.subscribe(handler));
      }
    }
  }
  if (typeof instance.onInit === "function") {
    instance.onInit();
  }
  let rootNode = null;
  if (def && typeof def.templateFn === "function") {
    const templateResult = def.templateFn(renderer, instance);
    rootNode = templateResult.root;
  } else if (typeof instance.render === "function") {
    rootNode = instance.render(renderer);
  } else if (typeof instance.getElement === "function") {
    rootNode = instance.getElement();
  } else {
    throw new Error(
      `Cannot bootstrap '${ComponentClass.name}': Missing compiled templateFn, render() method, or getElement() method.`
    );
  }
  const view = new ComponentView(rootNode);
  if (view.root && container) {
    renderer.appendChild(container, view.root);
  }
  if (typeof instance.afterRender === "function") {
    instance.afterRender();
  }
  const componentRef = {
    instance,
    view,
    hostElement: view.root,
    setInput(key, value) {
      const prop = instance[key];
      if (prop && typeof prop.set === "function") {
        prop.set(value);
      } else {
        instance[key] = value;
      }
    },
    destroy() {
      for (const sub of subscriptions) {
        try {
          sub.unsubscribe();
        } catch (e) {
          console.error("[JARVIS] Error unsubscribing output:", e);
        }
      }
      subscriptions.length = 0;
      if (typeof instance.onDestroy === "function") {
        instance.onDestroy();
      }
      if (view.root && container) {
        renderer.removeChild(container, view.root);
      }
      view.destroy();
    }
  };
  return componentRef;
}

// packages/layout/src/composition/component-host.ts
function mountComponent(renderer, ComponentClass, container, options) {
  return bootstrap(ComponentClass, container, renderer, {
    inputs: options?.inputs,
    outputs: options?.outputs
  });
}
function unmountComponent(ref) {
  if (ref) {
    try {
      ref.destroy();
    } catch (err) {
      console.error("[JARVIS Layout] Error unmounting component:", err);
    }
  }
}

// packages/layout/src/composition/content-slot.ts
var ContentSlot = class {
  constructor(name, container, renderer) {
    this.activeComponentRef = null;
    this.activeElement = null;
    this.currentContent = null;
    this.name = name;
    this.container = container;
    this.renderer = renderer;
  }
  getElement() {
    return this.container;
  }
  getContent() {
    return this.currentContent;
  }
  /**
   * Projects a component into this slot.
   * If the component class is identical to what's already mounted, updates inputs instead of recreating DOM.
   */
  projectComponent(ComponentClass, inputs, outputs) {
    if (this.activeComponentRef && this.activeComponentRef.instance instanceof ComponentClass) {
      if (inputs) {
        for (const [key, val] of Object.entries(inputs)) {
          this.activeComponentRef.setInput(key, val);
        }
      }
      return this.activeComponentRef;
    }
    this.clear();
    const ref = mountComponent(this.renderer, ComponentClass, this.container, { inputs, outputs });
    this.activeComponentRef = ref;
    this.currentContent = { type: "component", componentClass: ComponentClass, inputs, outputs };
    return ref;
  }
  /**
   * Projects an existing DOM/Test element into this slot.
   */
  projectElement(element) {
    this.clear();
    this.activeElement = element;
    this.renderer.appendChild(this.container, element);
    this.currentContent = { type: "element", element };
  }
  /**
   * Projects custom rendered content via render function.
   */
  projectRender(renderFn) {
    this.clear();
    const node = renderFn(this.renderer);
    if (node) {
      this.activeElement = node;
      this.renderer.appendChild(this.container, node);
    }
    this.currentContent = { type: "render", renderFn };
  }
  /**
   * Cleans up and disposes any projected content in this slot.
   */
  clear() {
    if (this.activeComponentRef) {
      unmountComponent(this.activeComponentRef);
      this.activeComponentRef = null;
    }
    if (this.activeElement && this.container) {
      try {
        this.renderer.removeChild(this.container, this.activeElement);
      } catch (err) {
      }
      this.activeElement = null;
    }
    this.currentContent = null;
  }
  destroy() {
    this.clear();
  }
};
var SlotOutlet = class {
  constructor(renderer, name = "content", customElement) {
    this.name = name;
    this.element = customElement || renderer.createElement("div");
    renderer.setAttribute(this.element, "class", `jarvis-slot-outlet slot-${name}`);
    renderer.setAttribute(this.element, "data-slot-name", name);
    this.slot = new ContentSlot(name, this.element, renderer);
  }
  getElement() {
    return this.element;
  }
  project(ComponentClass, inputs, outputs) {
    return this.slot.projectComponent(ComponentClass, inputs, outputs);
  }
  clear() {
    this.slot.clear();
  }
  destroy() {
    this.slot.destroy();
  }
};

// packages/layout/src/components/header.component.ts
var AppHeaderComponent = class {
  constructor() {
    this.title = input("JARVIS Enterprise");
    this.showMenuToggle = input(true);
    this.sticky = input(true);
    this.sidebarOpen = input(true);
    this.menuToggle = output();
    this.actionsOutlet = null;
    this.rootElement = null;
  }
  render(r) {
    const header = r.createElement("header");
    this.rootElement = header;
    r.setAttribute(header, "role", "banner");
    const stickyClass = this.sticky() ? "jarvis-header--sticky" : "";
    r.setAttribute(header, "class", `jarvis-header ${stickyClass}`.trim());
    const leftBox = r.createElement("div");
    r.setAttribute(leftBox, "class", "jarvis-header__left");
    if (this.showMenuToggle()) {
      const toggleBtn = r.createElement("button");
      r.setAttribute(toggleBtn, "type", "button");
      r.setAttribute(toggleBtn, "class", "jarvis-header__toggle-btn");
      r.setAttribute(toggleBtn, "aria-label", "Toggle Navigation Menu");
      effect(() => {
        r.setAttribute(toggleBtn, "aria-expanded", String(this.sidebarOpen()));
      });
      const icon = r.createElement("span");
      r.setAttribute(icon, "class", "jarvis-icon jarvis-icon--menu");
      icon.innerHTML = "&#9776;";
      r.appendChild(toggleBtn, icon);
      r.listen(toggleBtn, "click", () => {
        this.menuToggle.emit();
      });
      r.appendChild(leftBox, toggleBtn);
    }
    const titleEl = r.createElement("h1");
    r.setAttribute(titleEl, "class", "jarvis-header__title");
    r.bindText(titleEl, () => this.title());
    r.appendChild(leftBox, titleEl);
    const rightBox = r.createElement("div");
    r.setAttribute(rightBox, "class", "jarvis-header__right");
    this.actionsOutlet = new SlotOutlet(r, "header-actions");
    r.appendChild(rightBox, this.actionsOutlet.getElement());
    r.appendChild(header, leftBox);
    r.appendChild(header, rightBox);
    return header;
  }
  getActionsOutlet() {
    return this.actionsOutlet;
  }
  onDestroy() {
    if (this.actionsOutlet) {
      this.actionsOutlet.destroy();
      this.actionsOutlet = null;
    }
  }
};

// packages/layout/src/components/sidebar.component.ts
var AppSidebarComponent = class {
  constructor() {
    this.navItems = input([]);
    this.collapsed = input(false);
    this.mobileOpen = input(false);
    this.activeRoute = input("");
    this.navSelect = output();
    this.closeMobile = output();
    this.sidebarEl = null;
    this.headerSlotOutlet = null;
    this.footerSlotOutlet = null;
  }
  render(r) {
    const aside = r.createElement("aside");
    this.sidebarEl = aside;
    r.setAttribute(aside, "role", "navigation");
    r.setAttribute(aside, "aria-label", "Sidebar Navigation");
    effect(() => {
      const isCollapsed = this.collapsed();
      const isMobileOpen = this.mobileOpen();
      const classes = [
        "jarvis-sidebar",
        isCollapsed ? "jarvis-sidebar--collapsed" : "",
        isMobileOpen ? "jarvis-sidebar--mobile-open" : ""
      ].filter(Boolean).join(" ");
      r.setAttribute(aside, "class", classes);
    });
    const mobileCloseBar = r.createElement("div");
    r.setAttribute(mobileCloseBar, "class", "jarvis-sidebar__mobile-close-bar");
    const closeBtn = r.createElement("button");
    r.setAttribute(closeBtn, "type", "button");
    r.setAttribute(closeBtn, "class", "jarvis-sidebar__close-btn");
    r.setAttribute(closeBtn, "aria-label", "Close Navigation Drawer");
    closeBtn.innerHTML = "&times;";
    r.listen(closeBtn, "click", () => {
      this.closeMobile.emit();
    });
    r.appendChild(mobileCloseBar, closeBtn);
    r.appendChild(aside, mobileCloseBar);
    const headerWrapper = r.createElement("div");
    r.setAttribute(headerWrapper, "class", "jarvis-sidebar__header");
    this.headerSlotOutlet = new SlotOutlet(r, "sidebar-header");
    r.appendChild(headerWrapper, this.headerSlotOutlet.getElement());
    r.appendChild(aside, headerWrapper);
    const navList = r.createElement("ul");
    r.setAttribute(navList, "class", "jarvis-sidebar__nav-list");
    r.setAttribute(navList, "role", "menubar");
    effect(() => {
      navList.innerHTML = "";
      const items = this.navItems();
      const current = this.activeRoute();
      for (const item of items) {
        const li = r.createElement("li");
        r.setAttribute(li, "role", "none");
        r.setAttribute(li, "class", "jarvis-sidebar__nav-item");
        const btn = r.createElement("button");
        r.setAttribute(btn, "type", "button");
        r.setAttribute(btn, "role", "menuitem");
        const isActive = current === item.route;
        r.setAttribute(
          btn,
          "class",
          `jarvis-sidebar__nav-link ${isActive ? "jarvis-sidebar__nav-link--active" : ""}`
        );
        r.setAttribute(btn, "data-route", item.route || "");
        if (item.icon) {
          const icon = r.createElement("span");
          r.setAttribute(icon, "class", `jarvis-nav-icon ${item.icon}`);
          r.appendChild(btn, icon);
        }
        const label = r.createElement("span");
        r.setAttribute(label, "class", "jarvis-nav-label");
        r.appendChild(label, r.createText(item.label));
        r.appendChild(btn, label);
        if (item.badge) {
          const badge = r.createElement("span");
          r.setAttribute(badge, "class", `jarvis-nav-badge jarvis-nav-badge--${item.badgeSeverity || "info"}`);
          r.appendChild(badge, r.createText(item.badge));
          r.appendChild(btn, badge);
        }
        r.listen(btn, "click", () => {
          this.navSelect.emit(item);
        });
        r.appendChild(li, btn);
        r.appendChild(navList, li);
      }
    });
    r.appendChild(aside, navList);
    const footerWrapper = r.createElement("div");
    r.setAttribute(footerWrapper, "class", "jarvis-sidebar__footer");
    this.footerSlotOutlet = new SlotOutlet(r, "sidebar-footer");
    r.appendChild(footerWrapper, this.footerSlotOutlet.getElement());
    r.appendChild(aside, footerWrapper);
    return aside;
  }
  getHeaderSlot() {
    return this.headerSlotOutlet;
  }
  getFooterSlot() {
    return this.footerSlotOutlet;
  }
  onDestroy() {
    if (this.headerSlotOutlet) {
      this.headerSlotOutlet.destroy();
      this.headerSlotOutlet = null;
    }
    if (this.footerSlotOutlet) {
      this.footerSlotOutlet.destroy();
      this.footerSlotOutlet = null;
    }
  }
};

// packages/layout/src/components/footer.component.ts
var AppFooterComponent = class {
  constructor() {
    this.copyright = input("\xA9 2026 JARVIS Framework. All rights reserved.");
    this.links = input([
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "Support", href: "#" }
    ]);
  }
  render(r) {
    const footer = r.createElement("footer");
    r.setAttribute(footer, "role", "contentinfo");
    r.setAttribute(footer, "class", "jarvis-footer");
    const copyEl = r.createElement("p");
    r.setAttribute(copyEl, "class", "jarvis-footer__copyright");
    r.bindText(copyEl, () => this.copyright());
    r.appendChild(footer, copyEl);
    const linksBox = r.createElement("nav");
    r.setAttribute(linksBox, "class", "jarvis-footer__links");
    for (const link of this.links()) {
      const a = r.createElement("a");
      r.setAttribute(a, "href", link.href);
      r.setAttribute(a, "class", "jarvis-footer__link");
      r.appendChild(a, r.createText(link.label));
      r.appendChild(linksBox, a);
    }
    r.appendChild(footer, linksBox);
    return footer;
  }
};

// packages/layout/src/layouts/main-layout.component.ts
var MainLayoutComponent = class {
  constructor() {
    this.config = input({
      showHeader: true,
      showSidebar: true,
      showFooter: true,
      sidebarCollapsible: true,
      sidebarCollapsed: false,
      headerSticky: true,
      contentWidth: "normal"
    });
    this.navItems = input([]);
    this.appTitle = input("JARVIS Application");
    this.activeRoute = input("");
    // Internal reactive layout state
    this.sidebarOpen = signal(true);
    this.sidebarCollapsed = signal(false);
    this.mobileDrawerOpen = signal(false);
    this.headerRef = null;
    this.sidebarRef = null;
    this.footerRef = null;
    this.contentOutlet = null;
    this.rootElement = null;
  }
  toggleSidebar() {
    this.sidebarOpen.update((open) => !open);
  }
  toggleCollapsed() {
    this.sidebarCollapsed.update((c) => !c);
  }
  toggleMobileDrawer() {
    this.mobileDrawerOpen.update((open) => !open);
  }
  closeMobileDrawer() {
    this.mobileDrawerOpen.set(false);
  }
  render(r) {
    const shell = r.createElement("div");
    this.rootElement = shell;
    r.setAttribute(shell, "class", "jarvis-layout-shell");
    const backdrop = r.createElement("div");
    r.setAttribute(backdrop, "class", "jarvis-drawer-backdrop");
    effect(() => {
      if (this.mobileDrawerOpen()) {
        r.setAttribute(backdrop, "class", "jarvis-drawer-backdrop jarvis-drawer-backdrop--active");
      } else {
        r.setAttribute(backdrop, "class", "jarvis-drawer-backdrop");
      }
    });
    r.listen(backdrop, "click", () => {
      this.closeMobileDrawer();
    });
    r.appendChild(shell, backdrop);
    const headerContainer = r.createElement("div");
    r.setAttribute(headerContainer, "class", "jarvis-layout-shell__header-slot");
    this.headerRef = mountComponent(r, AppHeaderComponent, headerContainer, {
      inputs: {
        title: this.appTitle(),
        sidebarOpen: this.sidebarOpen(),
        sticky: this.config().headerSticky !== false
      },
      outputs: {
        menuToggle: () => {
          this.toggleSidebar();
          this.toggleMobileDrawer();
        }
      }
    });
    r.appendChild(shell, headerContainer);
    const bodyRegion = r.createElement("div");
    r.setAttribute(bodyRegion, "class", "jarvis-layout-shell__body");
    const sidebarContainer = r.createElement("div");
    r.setAttribute(sidebarContainer, "class", "jarvis-layout-shell__sidebar-slot");
    effect(() => {
      const show = this.sidebarOpen() && this.config().showSidebar !== false;
      const isMobile = this.mobileDrawerOpen();
      if (!show && !isMobile) {
        sidebarContainer.style = "display: none;";
      } else {
        sidebarContainer.style = "";
      }
    });
    this.sidebarRef = mountComponent(r, AppSidebarComponent, sidebarContainer, {
      inputs: {
        navItems: this.navItems(),
        collapsed: this.sidebarCollapsed(),
        mobileOpen: this.mobileDrawerOpen(),
        activeRoute: this.activeRoute()
      },
      outputs: {
        closeMobile: () => this.closeMobileDrawer()
      }
    });
    r.appendChild(bodyRegion, sidebarContainer);
    const mainRegion = r.createElement("main");
    r.setAttribute(mainRegion, "role", "main");
    r.setAttribute(mainRegion, "class", "jarvis-layout-shell__content");
    this.contentOutlet = new SlotOutlet(r, "content");
    r.appendChild(mainRegion, this.contentOutlet.getElement());
    r.appendChild(bodyRegion, mainRegion);
    r.appendChild(shell, bodyRegion);
    if (this.config().showFooter !== false) {
      const footerContainer = r.createElement("div");
      r.setAttribute(footerContainer, "class", "jarvis-layout-shell__footer-slot");
      this.footerRef = mountComponent(r, AppFooterComponent, footerContainer);
      r.appendChild(shell, footerContainer);
    }
    return shell;
  }
  getContentOutlet() {
    return this.contentOutlet;
  }
  getHeader() {
    return this.headerRef ? this.headerRef.instance : null;
  }
  getSidebar() {
    return this.sidebarRef ? this.sidebarRef.instance : null;
  }
  onDestroy() {
    if (this.headerRef) {
      unmountComponent(this.headerRef);
      this.headerRef = null;
    }
    if (this.sidebarRef) {
      unmountComponent(this.sidebarRef);
      this.sidebarRef = null;
    }
    if (this.footerRef) {
      unmountComponent(this.footerRef);
      this.footerRef = null;
    }
    if (this.contentOutlet) {
      this.contentOutlet.destroy();
      this.contentOutlet = null;
    }
  }
};
Component({
  selector: "jarvis-main-layout"
})(MainLayoutComponent);

// packages/layout/src/layouts/dashboard-layout.component.ts
var DashboardLayoutComponent = class {
  constructor() {
    this.config = input({
      showHeader: true,
      showSidebar: true,
      showFooter: false,
      sidebarCollapsible: true,
      sidebarCollapsed: false,
      contentWidth: "wide"
    });
    this.navItems = input([]);
    this.appTitle = input("JARVIS Analytics & Operations");
    this.sidebarOpen = signal(true);
    this.sidebarCollapsed = signal(false);
    this.headerRef = null;
    this.sidebarRef = null;
    this.toolbarOutlet = null;
    this.contentOutlet = null;
  }
  toggleSidebar() {
    this.sidebarOpen.update((open) => !open);
  }
  toggleCollapsed() {
    this.sidebarCollapsed.update((c) => !c);
  }
  render(r) {
    const root = r.createElement("div");
    r.setAttribute(root, "class", "jarvis-layout-shell jarvis-layout-shell--dashboard");
    const headerBox = r.createElement("div");
    r.setAttribute(headerBox, "class", "jarvis-layout-shell__header-slot");
    this.headerRef = mountComponent(r, AppHeaderComponent, headerBox, {
      inputs: {
        title: this.appTitle(),
        sidebarOpen: this.sidebarOpen(),
        sticky: true
      },
      outputs: {
        menuToggle: () => this.toggleSidebar()
      }
    });
    r.appendChild(root, headerBox);
    const bodyBox = r.createElement("div");
    r.setAttribute(bodyBox, "class", "jarvis-layout-shell__body");
    const sidebarBox = r.createElement("div");
    r.setAttribute(sidebarBox, "class", "jarvis-layout-shell__sidebar-slot");
    effect(() => {
      sidebarBox.style = this.sidebarOpen() ? "" : "display: none;";
    });
    this.sidebarRef = mountComponent(r, AppSidebarComponent, sidebarBox, {
      inputs: {
        navItems: this.navItems(),
        collapsed: this.sidebarCollapsed()
      }
    });
    r.appendChild(bodyBox, sidebarBox);
    const contentBox = r.createElement("main");
    r.setAttribute(contentBox, "role", "main");
    r.setAttribute(contentBox, "class", "jarvis-layout-shell__content jarvis-dashboard-content");
    const toolbarContainer = r.createElement("div");
    r.setAttribute(toolbarContainer, "class", "jarvis-dashboard-toolbar");
    this.toolbarOutlet = new SlotOutlet(r, "toolbar");
    r.appendChild(toolbarContainer, this.toolbarOutlet.getElement());
    r.appendChild(contentBox, toolbarContainer);
    this.contentOutlet = new SlotOutlet(r, "content");
    r.appendChild(contentBox, this.contentOutlet.getElement());
    r.appendChild(bodyBox, contentBox);
    r.appendChild(root, bodyBox);
    return root;
  }
  getContentOutlet() {
    return this.contentOutlet;
  }
  getToolbarOutlet() {
    return this.toolbarOutlet;
  }
  onDestroy() {
    if (this.headerRef) {
      unmountComponent(this.headerRef);
      this.headerRef = null;
    }
    if (this.sidebarRef) {
      unmountComponent(this.sidebarRef);
      this.sidebarRef = null;
    }
    if (this.toolbarOutlet) {
      this.toolbarOutlet.destroy();
      this.toolbarOutlet = null;
    }
    if (this.contentOutlet) {
      this.contentOutlet.destroy();
      this.contentOutlet = null;
    }
  }
};
Component({
  selector: "jarvis-dashboard-layout"
})(DashboardLayoutComponent);

// packages/layout/src/layouts/auth-layout.component.ts
var AuthLayoutComponent = class {
  constructor() {
    this.config = input({
      showHeader: false,
      showSidebar: false,
      showFooter: true,
      contentWidth: "narrow"
    });
    this.brandName = input("JARVIS Portal");
    this.brandSubtitle = input("Enterprise Identity & Access Management");
    this.contentOutlet = null;
  }
  render(r) {
    const root = r.createElement("div");
    r.setAttribute(root, "class", "jarvis-auth-layout");
    const cardWrapper = r.createElement("div");
    r.setAttribute(cardWrapper, "class", "jarvis-auth-layout__card-wrapper");
    const brandBox = r.createElement("div");
    r.setAttribute(brandBox, "class", "jarvis-auth-layout__brand");
    const logo = r.createElement("div");
    r.setAttribute(logo, "class", "jarvis-auth-layout__logo");
    logo.innerHTML = "&#9733;";
    r.appendChild(brandBox, logo);
    const title = r.createElement("h1");
    r.setAttribute(title, "class", "jarvis-auth-layout__title");
    r.bindText(title, () => this.brandName());
    r.appendChild(brandBox, title);
    const subtitle = r.createElement("p");
    r.setAttribute(subtitle, "class", "jarvis-auth-layout__subtitle");
    r.bindText(subtitle, () => this.brandSubtitle());
    r.appendChild(brandBox, subtitle);
    r.appendChild(cardWrapper, brandBox);
    const contentBox = r.createElement("div");
    r.setAttribute(contentBox, "class", "jarvis-auth-layout__content");
    this.contentOutlet = new SlotOutlet(r, "content");
    r.appendChild(contentBox, this.contentOutlet.getElement());
    r.appendChild(cardWrapper, contentBox);
    const footer = r.createElement("footer");
    r.setAttribute(footer, "class", "jarvis-auth-layout__footer");
    const copy = r.createElement("p");
    copy.textContent = "\xA9 2026 JARVIS Secure System. All rights reserved.";
    r.appendChild(footer, copy);
    r.appendChild(cardWrapper, footer);
    r.appendChild(root, cardWrapper);
    return root;
  }
  getContentOutlet() {
    return this.contentOutlet;
  }
  onDestroy() {
    if (this.contentOutlet) {
      this.contentOutlet.destroy();
      this.contentOutlet = null;
    }
  }
};
Component({
  selector: "jarvis-auth-layout"
})(AuthLayoutComponent);

// packages/layout/src/layouts/minimal-layout.component.ts
var MinimalLayoutComponent = class {
  constructor() {
    this.config = input({
      showHeader: false,
      showSidebar: false,
      showFooter: false,
      contentWidth: "wide"
    });
    this.contentOutlet = null;
  }
  render(r) {
    const root = r.createElement("div");
    r.setAttribute(root, "class", "jarvis-minimal-layout");
    const main = r.createElement("main");
    r.setAttribute(main, "role", "main");
    r.setAttribute(main, "class", "jarvis-minimal-layout__content");
    this.contentOutlet = new SlotOutlet(r, "content");
    r.appendChild(main, this.contentOutlet.getElement());
    r.appendChild(root, main);
    return root;
  }
  getContentOutlet() {
    return this.contentOutlet;
  }
  onDestroy() {
    if (this.contentOutlet) {
      this.contentOutlet.destroy();
      this.contentOutlet = null;
    }
  }
};
Component({
  selector: "jarvis-minimal-layout"
})(MinimalLayoutComponent);

// packages/layout/src/router/layout-registry.ts
var LayoutRegistry = class _LayoutRegistry {
  constructor() {
    this.registry = /* @__PURE__ */ new Map();
    this.register("main", MainLayoutComponent, {
      showHeader: true,
      showSidebar: true,
      showFooter: true,
      contentWidth: "normal"
    }, "Standard enterprise application shell");
    this.register("dashboard", DashboardLayoutComponent, {
      showHeader: true,
      showSidebar: true,
      showFooter: false,
      contentWidth: "wide"
    }, "High-density analytics and operations dashboard");
    this.register("auth", AuthLayoutComponent, {
      showHeader: false,
      showSidebar: false,
      showFooter: true,
      contentWidth: "narrow"
    }, "Focused authentication and identity management");
    this.register("minimal", MinimalLayoutComponent, {
      showHeader: false,
      showSidebar: false,
      showFooter: false,
      contentWidth: "wide"
    }, "Distraction-free full viewport container");
  }
  static {
    this.instance = new _LayoutRegistry();
  }
  static getDefault() {
    return _LayoutRegistry.instance;
  }
  register(name, component, defaultConfig, description) {
    this.registry.set(name.toLowerCase(), {
      name: name.toLowerCase(),
      component,
      defaultConfig,
      description
    });
  }
  get(name) {
    return this.registry.get(name.toLowerCase());
  }
  has(name) {
    return this.registry.has(name.toLowerCase());
  }
  all() {
    return Array.from(this.registry.values());
  }
  getRegisteredNames() {
    return Array.from(this.registry.keys());
  }
  clear() {
    this.registry.clear();
  }
};
var defaultLayoutRegistry = LayoutRegistry.getDefault();

// packages/layout/src/router/layout-router-outlet.ts
var LayoutRouterOutlet = class {
  constructor(renderer, router, container, options = {}) {
    this.currentLayoutRef = null;
    this.currentLayoutClass = null;
    this.currentScreenRef = null;
    this.disposeEffect = null;
    this.renderer = renderer;
    this.router = router;
    this.registry = options.registry || defaultLayoutRegistry;
    this.defaultLayout = options.defaultLayout || "main";
    this.name = options.name || "primary";
    this.container = container || renderer.createElement("div");
    if (this.container) {
      renderer.setAttribute(
        this.container,
        "class",
        `jarvis-layout-router-outlet outlet-${this.name}`
      );
    }
    this.init();
  }
  getElement() {
    return this.container;
  }
  getCurrentLayout() {
    return this.currentLayoutRef ? this.currentLayoutRef.instance : null;
  }
  getCurrentScreen() {
    return this.currentScreenRef ? this.currentScreenRef.instance : null;
  }
  init() {
    this.disposeEffect = effect(() => {
      const match = this.router.activeRoute();
      if (match && (match.outlet || "primary") === this.name) {
        this.activateRouteWithLayout(match);
      }
    });
  }
  resolveLayout(layoutSpec, url) {
    if (typeof layoutSpec === "function") {
      return layoutSpec;
    }
    if (typeof layoutSpec === "string") {
      if (layoutSpec.toLowerCase() === "none") {
        return null;
      }
      const def = this.registry.get(layoutSpec);
      if (!def) {
        const registered = this.registry.getRegisteredNames().join(", ");
        throw new Error(
          `[JARVIS Layout Error] Unknown layout '${layoutSpec}' requested by route '${url}'. Registered layouts: [${registered}].`
        );
      }
      return def.component;
    }
    return null;
  }
  activateRouteWithLayout(match) {
    if (!match.route.component) {
      this.clearScreen();
      return;
    }
    const layoutSpec = match.route.data?.layout ?? match.data?.layout ?? this.defaultLayout;
    const layoutConfig = {
      ...match.route.data?.layoutConfig || match.data?.layoutConfig || {}
    };
    const targetLayoutClass = this.resolveLayout(layoutSpec, match.url);
    if (typeof layoutSpec === "string" && layoutSpec.toLowerCase() !== "none") {
      const def = this.registry.get(layoutSpec);
      if (def?.defaultConfig) {
        Object.assign(layoutConfig, { ...def.defaultConfig, ...layoutConfig });
      }
    }
    const isSameLayout = this.currentLayoutClass === targetLayoutClass && this.currentLayoutRef !== null;
    if (!isSameLayout) {
      this.destroyCurrentLayout();
      if (targetLayoutClass) {
        this.currentLayoutClass = targetLayoutClass;
        this.currentLayoutRef = mountComponent(
          this.renderer,
          targetLayoutClass,
          this.container,
          {
            inputs: {
              config: layoutConfig,
              activeRoute: match.pathname
            }
          }
        );
      }
    } else {
      if (this.currentLayoutRef) {
        this.currentLayoutRef.setInput("activeRoute", match.pathname);
        if (Object.keys(layoutConfig).length > 0) {
          this.currentLayoutRef.setInput("config", layoutConfig);
        }
      }
    }
    let contentTargetEl = this.container;
    let slotOutlet = null;
    if (this.currentLayoutRef) {
      const layoutInstance = this.currentLayoutRef.instance;
      if (typeof layoutInstance.getContentOutlet === "function") {
        slotOutlet = layoutInstance.getContentOutlet();
      }
    }
    this.clearScreen();
    const ScreenClass = match.route.component;
    if (slotOutlet) {
      this.currentScreenRef = slotOutlet.project(ScreenClass, {
        activatedRoute: this.router.activatedRoute,
        router: this.router,
        routeData: match.data
      });
    } else {
      this.currentScreenRef = mountComponent(
        this.renderer,
        ScreenClass,
        contentTargetEl,
        {
          inputs: {
            activatedRoute: this.router.activatedRoute,
            router: this.router,
            routeData: match.data
          }
        }
      );
    }
    if (this.currentScreenRef) {
      const screenInstance = this.currentScreenRef.instance;
      screenInstance.activatedRoute = this.router.activatedRoute;
      screenInstance.router = this.router;
    }
  }
  clearScreen() {
    if (this.currentScreenRef) {
      unmountComponent(this.currentScreenRef);
      this.currentScreenRef = null;
    }
  }
  destroyCurrentLayout() {
    this.clearScreen();
    if (this.currentLayoutRef) {
      unmountComponent(this.currentLayoutRef);
      this.currentLayoutRef = null;
      this.currentLayoutClass = null;
    }
  }
  destroy() {
    if (this.disposeEffect) {
      this.disposeEffect();
      this.disposeEffect = null;
    }
    this.destroyCurrentLayout();
  }
};

// examples/06-layout-composition/src/features/dashboard/pages/dashboard-page/dashboard.page.ts
var DashboardPage = class {
  constructor() {
    this.pageTitle = signal("Executive Dashboard");
    this.metrics = signal([
      { label: "Total Personnel", val: "142", trend: "+12% this month" },
      { label: "Active Projects", val: "28", trend: "4 nearing delivery" },
      { label: "System Uptime", val: "99.98%", trend: "Operational" }
    ]);
    this.destroyed = false;
  }
  onInit() {
  }
  onDestroy() {
    this.destroyed = true;
  }
  render(r) {
    const root = r.createElement("div");
    r.setAttribute(root, "class", "dashboard-page space-y-6");
    const header = r.createElement("div");
    r.setAttribute(header, "class", "dashboard-page__header");
    const h1 = r.createElement("h1");
    r.bindText(h1, () => this.pageTitle());
    r.appendChild(header, h1);
    r.appendChild(root, header);
    const grid = r.createElement("div");
    r.setAttribute(grid, "class", "dashboard-grid");
    for (const m of this.metrics()) {
      const card = r.createElement("div");
      r.setAttribute(card, "class", "dashboard-card");
      const lbl = r.createElement("span");
      lbl.textContent = m.label;
      const num = r.createElement("strong");
      num.textContent = m.val;
      const trn = r.createElement("small");
      trn.textContent = m.trend;
      r.appendChild(card, lbl);
      r.appendChild(card, num);
      r.appendChild(card, trn);
      r.appendChild(grid, card);
    }
    r.appendChild(root, grid);
    return root;
  }
};
Component({
  selector: "app-dashboard-page",
  templateUrl: "./dashboard.page.html",
  styleUrl: "./dashboard.page.css"
})(DashboardPage);

// examples/06-layout-composition/src/features/employees/pages/employee-list/employee-list.page.ts
var EmployeeListPage = class {
  constructor() {
    this.pageTitle = signal("Personnel Directory");
    this.employees = signal([
      { id: "EMP001", name: "Sophia Martinez", role: "Staff Frontend Architect", dept: "Engineering" },
      { id: "EMP002", name: "Alexander Wright", role: "Compiler Engineer", dept: "Engineering" },
      { id: "EMP003", name: "Elena Rostova", role: "Principal Designer", dept: "Design" }
    ]);
    this.destroyed = false;
  }
  onInit() {
  }
  onDestroy() {
    this.destroyed = true;
  }
  render(r) {
    const root = r.createElement("div");
    r.setAttribute(root, "class", "employee-list-page");
    const h1 = r.createElement("h1");
    r.bindText(h1, () => this.pageTitle());
    r.appendChild(root, h1);
    const table = r.createElement("table");
    r.setAttribute(table, "class", "employee-table");
    const tbody = r.createElement("tbody");
    for (const emp of this.employees()) {
      const tr = r.createElement("tr");
      const td1 = r.createElement("td");
      td1.textContent = emp.name;
      const td2 = r.createElement("td");
      td2.textContent = emp.role;
      const td3 = r.createElement("td");
      td3.textContent = emp.dept;
      r.appendChild(tr, td1);
      r.appendChild(tr, td2);
      r.appendChild(tr, td3);
      r.appendChild(tbody, tr);
    }
    r.appendChild(table, tbody);
    r.appendChild(root, table);
    return root;
  }
};
Component({
  selector: "app-employee-list-page",
  templateUrl: "./employee-list.page.html",
  styleUrl: "./employee-list.page.css"
})(EmployeeListPage);

// examples/06-layout-composition/src/features/authentication/pages/login-page/login.page.ts
var LoginPage = class {
  constructor() {
    this.email = signal("architect@jarvis.ai");
    this.password = signal("securePassword123");
    this.status = signal("Ready");
    this.destroyed = false;
  }
  onInit() {
  }
  onDestroy() {
    this.destroyed = true;
  }
  render(r) {
    const root = r.createElement("div");
    r.setAttribute(root, "class", "login-page-form");
    const h2 = r.createElement("h2");
    h2.textContent = "Sign In to Corporate Portal";
    r.appendChild(root, h2);
    const emailInput = r.createElement("input");
    emailInput.value = this.email();
    r.setAttribute(emailInput, "type", "email");
    r.setAttribute(emailInput, "placeholder", "Email address");
    r.appendChild(root, emailInput);
    const passInput = r.createElement("input");
    passInput.value = this.password();
    r.setAttribute(passInput, "type", "password");
    r.setAttribute(passInput, "placeholder", "Password");
    r.appendChild(root, passInput);
    const btn = r.createElement("button");
    btn.textContent = "Authenticate";
    r.appendChild(root, btn);
    return root;
  }
};
Component({
  selector: "app-login-page",
  templateUrl: "./login.page.html",
  styleUrl: "./login.page.css"
})(LoginPage);

// examples/06-layout-composition/src/app.routes.ts
var routes = [
  { path: "", redirectTo: "dashboard", pathMatch: "full" },
  {
    path: "dashboard",
    component: DashboardPage,
    title: "JARVIS Portal \u2014 Executive Dashboard",
    data: {
      layout: "main",
      layoutConfig: {
        showHeader: true,
        showSidebar: true,
        showFooter: true,
        contentWidth: "wide"
      }
    }
  },
  {
    path: "employees",
    component: EmployeeListPage,
    title: "JARVIS Portal \u2014 Personnel Directory",
    data: {
      layout: "main",
      layoutConfig: {
        showHeader: true,
        showSidebar: true,
        showFooter: true,
        contentWidth: "normal"
      }
    }
  },
  {
    path: "login",
    component: LoginPage,
    title: "JARVIS Portal \u2014 Sign In",
    data: {
      layout: "auth",
      layoutConfig: {
        showHeader: false,
        showSidebar: false,
        showFooter: true,
        contentWidth: "narrow"
      }
    }
  }
];

// examples/06-layout-composition/app.ts
function init() {
  const renderer = new DOMRenderer();
  const router = provideRouter(routes, { initialUrl: "/dashboard" });
  const rootEl = document.getElementById("app-root");
  if (!rootEl) {
    console.error("Mount point #app-root not found");
    return;
  }
  const outlet = new LayoutRouterOutlet(renderer, router, rootEl, {
    registry: defaultLayoutRegistry
  });
  const btnDashboard = document.getElementById("btn-route-dashboard");
  const btnEmployees = document.getElementById("btn-route-employees");
  const btnLogin = document.getElementById("btn-route-login");
  btnDashboard?.addEventListener("click", () => router.navigate(["dashboard"]));
  btnEmployees?.addEventListener("click", () => router.navigate(["employees"]));
  btnLogin?.addEventListener("click", () => router.navigate(["login"]));
  console.log("[JARVIS] Layout Composition Showcase mounted successfully.");
  return { router, outlet };
}
if (typeof document !== "undefined") {
  init();
}
export {
  init
};
