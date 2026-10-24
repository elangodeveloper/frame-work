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
function getComponentDef(target) {
  return target[JARVIS_COMPONENT_METADATA];
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

// packages/router/src/router-outlet.ts
var RouterOutlet = class {
  name;
  renderer;
  router;
  container;
  currentComponentInstance = null;
  currentRootNode = null;
  disposeEffect = null;
  constructor(renderer2, router2, container, options = {}) {
    this.renderer = renderer2;
    this.router = router2;
    this.name = options.name || "primary";
    this.container = container || renderer2.createElement("div");
    if (this.container) {
      this.renderer.setAttribute(this.container, "class", "astra-router-outlet outlet-" + this.name);
    }
    this.init();
  }
  getElement() {
    return this.container;
  }
  init() {
    this.disposeEffect = effect(() => {
      const match = this.router.activeRoute();
      if (match && (match.outlet || "primary") === this.name) {
        this.activateRoute(match);
      }
    });
  }
  activateRoute(match) {
    this.destroyCurrentComponent();
    if (!match || !match.route.component) {
      return;
    }
    const ComponentClass = match.route.component;
    const instance = new ComponentClass();
    this.currentComponentInstance = instance;
    instance.activatedRoute = this.router.activatedRoute;
    instance.router = this.router;
    if (typeof instance.onInit === "function") {
      instance.onInit();
    }
    let rootNode = null;
    const def = getComponentDef(ComponentClass);
    if (def && typeof def.templateFn === "function") {
      const res = def.templateFn(this.renderer, instance);
      rootNode = res.root;
    } else if (typeof instance.render === "function") {
      rootNode = instance.render(this.renderer);
    } else if (typeof instance.getElement === "function") {
      rootNode = instance.getElement();
    }
    if (rootNode) {
      this.currentRootNode = rootNode;
      this.renderer.appendChild(this.container, rootNode);
    }
    if (typeof instance.afterRender === "function") {
      instance.afterRender();
    }
  }
  destroyCurrentComponent() {
    if (this.currentComponentInstance) {
      if (typeof this.currentComponentInstance.onDestroy === "function") {
        this.currentComponentInstance.onDestroy();
      }
      if (typeof this.currentComponentInstance.destroy === "function") {
        this.currentComponentInstance.destroy();
      }
      this.currentComponentInstance = null;
    }
    if (this.currentRootNode && this.container) {
      this.renderer.removeChild(this.container, this.currentRootNode);
      this.currentRootNode = null;
    }
  }
  destroy() {
    if (this.disposeEffect) {
      this.disposeEffect();
      this.disposeEffect = null;
    }
    this.destroyCurrentComponent();
  }
};

// packages/router/src/router-link.ts
function bindRouterLink(renderer2, element, router2, targetUrl, options = {}) {
  renderer2.setAttribute(element, "href", targetUrl);
  const unlisten = renderer2.listen(element, "click", (event) => {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    router2.navigateByUrl(targetUrl);
  });
  let disposeEffect = null;
  if (options.activeClass) {
    const activeClasses = options.activeClass.split(" ").filter(Boolean);
    const exact = options.exact ?? false;
    disposeEffect = effect(() => {
      const current = router2.currentUrl();
      const currentPath = current.split("?")[0];
      const targetPath = targetUrl.split("?")[0];
      const isActive = exact ? currentPath === targetPath : currentPath === targetPath || targetPath !== "/" && currentPath.startsWith(targetPath);
      const existingClass = (element.attributes && typeof element.attributes.get === "function" ? element.attributes.get("class") : element.className) || "";
      const classList = new Set(existingClass.split(" ").filter(Boolean));
      if (isActive) {
        for (const c of activeClasses) classList.add(c);
      } else {
        for (const c of activeClasses) classList.delete(c);
      }
      renderer2.setAttribute(element, "class", Array.from(classList).join(" "));
    });
  }
  return () => {
    unlisten();
    if (disposeEffect) {
      disposeEffect();
    }
  };
}

// packages/router/src/index.ts
function provideRouter(routes2, optionsOrFeature, ...features) {
  let opts = {};
  if (typeof optionsOrFeature === "object" && optionsOrFeature !== null) {
    opts = optionsOrFeature;
  }
  const router2 = new Router(routes2, opts);
  if (typeof optionsOrFeature === "function") {
    optionsOrFeature(router2);
  }
  for (const feat of features) {
    feat(router2);
  }
  return router2;
}

// adapters/primeng/src/core/component.ts
function isSignal(val) {
  return typeof val === "function";
}
function unwrap(val) {
  if (isSignal(val)) {
    return val();
  }
  return val;
}
var JarvisPrimeComponent = class {
  constructor(renderer2) {
    this.hostElement = null;
    this.disposers = [];
    this.renderer = renderer2;
  }
  /**
   * Binds a reactive computation to a side-effect, ensuring cleanup on destroy.
   */
  bindReactive(compute, apply) {
    const dispose = effect(() => {
      const val = compute();
      apply(val);
    });
    this.disposers.push(dispose);
  }
  /**
   * Destroys all active subscriptions and effects.
   */
  destroy() {
    for (const dispose of this.disposers) {
      try {
        dispose();
      } catch (err) {
        console.error("[JarvisPrimeComponent] Error during teardown:", err);
      }
    }
    this.disposers.length = 0;
    this.hostElement = null;
  }
  getElement() {
    return this.hostElement;
  }
};

// adapters/primeng/src/core/overlay.ts
var OverlayService = class {
  static {
    this.zIndexStack = 1100;
  }
  static {
    this.escapeListenerAttached = false;
  }
  static {
    this.activeOverlays = [];
  }
  static {
    this.nextId = 1;
  }
  /**
   * Allocates the next highest z-index in the overlay stack.
   */
  static nextZIndex() {
    this.zIndexStack += 10;
    return this.zIndexStack;
  }
  /**
   * Registers an open overlay to participate in escape key listeners and viewport management.
   */
  static register(options = {}) {
    const id = this.nextId++;
    this.activeOverlays.push({ id, onDismiss: options.onDismiss });
    if (options.dismissOnEscape !== false && !this.escapeListenerAttached && typeof window !== "undefined") {
      this.escapeListenerAttached = true;
      window.addEventListener("keydown", this.handleKeyDown);
    }
    return id;
  }
  /**
   * Unregisters an overlay when closed.
   */
  static unregister(id) {
    this.activeOverlays = this.activeOverlays.filter((o) => o.id !== id);
    if (this.activeOverlays.length === 0 && this.escapeListenerAttached && typeof window !== "undefined") {
      window.removeEventListener("keydown", this.handleKeyDown);
      this.escapeListenerAttached = false;
    }
  }
  static {
    this.handleKeyDown = (event) => {
      if (event.key === "Escape" && this.activeOverlays.length > 0) {
        const topOverlay = this.activeOverlays[this.activeOverlays.length - 1];
        if (topOverlay && topOverlay.onDismiss) {
          topOverlay.onDismiss();
        }
      }
    };
  }
};

// adapters/primeng/src/core/registry.ts
var PrimeComponentRegistry = class {
  static {
    this.adapters = /* @__PURE__ */ new Map();
  }
  static register(metadata) {
    this.adapters.set(metadata.selector, metadata);
  }
  static get(selector) {
    return this.adapters.get(selector);
  }
  static has(selector) {
    return this.adapters.has(selector);
  }
  static all() {
    return Array.from(this.adapters.values());
  }
};

// adapters/primeng/src/core/theme.ts
var AURA_THEME_TOKENS = {
  "--p-primary-color": "#10b981",
  "--p-primary-contrast-color": "#ffffff",
  "--p-primary-hover-color": "#059669",
  "--p-primary-active-color": "#047857",
  "--p-primary-50": "#ecfdf5",
  "--p-primary-100": "#d1fae5",
  "--p-primary-200": "#a7f3d0",
  "--p-primary-300": "#6ee7b7",
  "--p-primary-400": "#34d399",
  "--p-primary-500": "#10b981",
  "--p-primary-600": "#059669",
  "--p-primary-700": "#047857",
  "--p-primary-800": "#065f46",
  "--p-primary-900": "#064e3b",
  "--p-border-radius-sm": "4px",
  "--p-border-radius-md": "6px",
  "--p-border-radius-lg": "8px",
  "--p-surface-0": "#ffffff",
  "--p-surface-50": "#f8fafc",
  "--p-surface-100": "#f1f5f9",
  "--p-surface-200": "#e2e8f0",
  "--p-surface-300": "#cbd5e1",
  "--p-surface-700": "#334155",
  "--p-surface-800": "#1e293b",
  "--p-surface-900": "#0f172a",
  "--p-text-color": "#1e293b",
  "--p-text-muted-color": "#64748b",
  "--p-focus-ring-width": "2px",
  "--p-focus-ring-style": "solid",
  "--p-focus-ring-color": "rgba(16, 185, 129, 0.4)",
  "--p-focus-ring-offset": "1px",
  "--p-transition-duration": "0.15s"
};
var LARA_THEME_TOKENS = {
  ...AURA_THEME_TOKENS,
  "--p-primary-color": "#3b82f6",
  "--p-primary-hover-color": "#2563eb",
  "--p-primary-500": "#3b82f6",
  "--p-focus-ring-color": "rgba(59, 130, 246, 0.4)"
};
var currentConfig = {
  theme: "Aura",
  darkMode: "system",
  ripple: true,
  cssLayer: true
};
function providePrimeNG(options = {}) {
  currentConfig = { ...currentConfig, ...options };
  const presetName = typeof currentConfig.theme === "string" ? currentConfig.theme : currentConfig.theme?.preset ?? "Aura";
  const tokens = presetName === "Lara" ? LARA_THEME_TOKENS : AURA_THEME_TOKENS;
  if (typeof document === "undefined") {
    return;
  }
  const styleId = "jarvis-primeng-theme";
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  let css = ":root {\n";
  for (const [key, val] of Object.entries(tokens)) {
    css += `  ${key}: ${val};
`;
  }
  css += "}\n";
  css += `
    @layer primeng {
      .p-component {
        font-family: inherit;
        box-sizing: border-box;
      }
      .p-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        cursor: pointer;
        user-select: none;
        vertical-align: middle;
        text-decoration: none;
        overflow: hidden;
        position: relative;
        font-weight: 600;
        font-size: 0.875rem;
        padding: 0.625rem 1rem;
        border-radius: var(--p-border-radius-md);
        border: 1px solid var(--p-primary-color);
        background: var(--p-primary-color);
        color: var(--p-primary-contrast-color);
        transition: background-color var(--p-transition-duration), border-color var(--p-transition-duration);
      }
      .p-button:hover:not(:disabled) {
        background: var(--p-primary-hover-color);
        border-color: var(--p-primary-hover-color);
      }
      .p-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .p-button-outlined {
        background: transparent;
        color: var(--p-primary-color);
      }
      .p-button-outlined:hover:not(:disabled) {
        background: var(--p-primary-50);
      }
      .p-button-text {
        background: transparent;
        border-color: transparent;
        color: var(--p-primary-color);
      }
      .p-button-text:hover:not(:disabled) {
        background: var(--p-surface-100);
      }
      .p-inputtext {
        font-family: inherit;
        font-size: 0.875rem;
        color: var(--p-text-color);
        background: var(--p-surface-0);
        padding: 0.625rem 0.75rem;
        border: 1px solid var(--p-surface-300);
        border-radius: var(--p-border-radius-md);
        transition: border-color var(--p-transition-duration), box-shadow var(--p-transition-duration);
        box-sizing: border-box;
      }
      .p-inputtext:focus {
        outline: none;
        border-color: var(--p-primary-color);
        box-shadow: 0 0 0 var(--p-focus-ring-width) var(--p-focus-ring-color);
      }
      .p-inputtext.p-invalid {
        border-color: #ef4444;
      }
      .p-datatable {
        width: 100%;
        border-collapse: collapse;
      }
      .p-datatable th, .p-datatable td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid var(--p-surface-200);
      }
      .p-datatable th {
        background: var(--p-surface-50);
        font-weight: 600;
        color: var(--p-text-color);
      }
      .p-dialog-mask {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1100;
      }
      .p-dialog {
        background: var(--p-surface-0);
        border-radius: var(--p-border-radius-lg);
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
        min-width: 320px;
        max-width: 90vw;
        border: 1px solid var(--p-surface-200);
        overflow: hidden;
      }
      .p-dialog-header {
        padding: 1.25rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--p-surface-200);
        font-weight: 600;
        font-size: 1.125rem;
      }
      .p-dialog-content {
        padding: 1.25rem;
      }
    }
  `;
  styleEl.textContent = css;
}

// adapters/primeng/src/button/button.component.ts
var JarvisButton = class extends JarvisPrimeComponent {
  constructor(renderer2, props = {}) {
    super(renderer2);
    this.clicked = jarvisEvent();
    this.props = props;
    this.createDom();
    this.bindProperties();
  }
  createDom() {
    this.buttonEl = this.renderer.createElement("button");
    this.hostElement = this.buttonEl;
    this.iconEl = this.renderer.createElement("span");
    this.renderer.appendChild(this.buttonEl, this.iconEl);
    const labelSpan = this.renderer.createElement("span");
    this.renderer.setAttribute(labelSpan, "class", "p-button-label");
    this.labelTextNode = this.renderer.createText("");
    this.renderer.appendChild(labelSpan, this.labelTextNode);
    this.renderer.appendChild(this.buttonEl, labelSpan);
    this.renderer.listen(this.buttonEl, "click", (event) => {
      const isDisabled = Boolean(unwrap(this.props.disabled) || unwrap(this.props.loading));
      if (!isDisabled) {
        this.clicked.emit(event);
      }
    });
  }
  bindProperties() {
    this.bindReactive(
      () => {
        const severity = unwrap(this.props.severity) || "primary";
        const variant = unwrap(this.props.variant);
        const size = unwrap(this.props.size);
        const raised = unwrap(this.props.raised);
        const rounded = unwrap(this.props.rounded);
        const loading = unwrap(this.props.loading);
        const customClass = this.props.class || "";
        const classes = ["p-button", "p-component"];
        if (severity && severity !== "primary") classes.push(`p-button-${severity}`);
        if (variant === "outlined") classes.push("p-button-outlined");
        if (variant === "text") classes.push("p-button-text");
        if (variant === "link") classes.push("p-button-link");
        if (size === "small") classes.push("p-button-sm");
        if (size === "large") classes.push("p-button-lg");
        if (raised) classes.push("p-button-raised");
        if (rounded) classes.push("p-button-rounded");
        if (loading) classes.push("p-button-loading");
        if (customClass) classes.push(customClass);
        return classes.join(" ");
      },
      (classes) => {
        this.renderer.setAttribute(this.buttonEl, "class", classes);
      }
    );
    this.bindReactive(
      () => Boolean(unwrap(this.props.disabled) || unwrap(this.props.loading)),
      (disabled) => {
        if (disabled) {
          this.renderer.setAttribute(this.buttonEl, "disabled", "");
        } else {
          this.renderer.setProperty(this.buttonEl, "disabled", false);
        }
      }
    );
    this.bindReactive(
      () => unwrap(this.props.label) ?? "",
      (label) => {
        this.renderer.setText(this.labelTextNode, label);
      }
    );
    this.bindReactive(
      () => {
        const isLoading = unwrap(this.props.loading);
        const icon = unwrap(this.props.icon);
        if (isLoading) {
          return "p-button-icon pi pi-spinner pi-spin";
        }
        if (icon) {
          return `p-button-icon ${icon}`;
        }
        return "";
      },
      (iconClass) => {
        if (iconClass) {
          this.renderer.setAttribute(this.iconEl, "class", iconClass);
          this.renderer.setProperty(this.iconEl, "style", "display: inline-block");
        } else {
          this.renderer.setAttribute(this.iconEl, "class", "");
          this.renderer.setProperty(this.iconEl, "style", "display: none");
        }
      }
    );
  }
  getElement() {
    return this.hostElement;
  }
};

// adapters/primeng/src/input/input.component.ts
var JarvisInputText = class extends JarvisPrimeComponent {
  constructor(renderer2, props = {}) {
    super(renderer2);
    this.valueChange = jarvisEvent();
    this.input = jarvisEvent();
    this.blur = jarvisEvent();
    this.props = props;
    this.createDom();
    this.bindProperties();
  }
  createDom() {
    this.inputEl = this.renderer.createElement("input");
    this.hostElement = this.inputEl;
    const inputType = this.props.type || "text";
    this.renderer.setAttribute(this.inputEl, "type", inputType);
    this.renderer.listen(this.inputEl, "input", (event) => {
      const val = event.target ? event.target.value : event.value ?? "";
      this.valueChange.emit(val);
      this.input.emit(event);
    });
    this.renderer.listen(this.inputEl, "blur", (event) => {
      this.blur.emit(event);
    });
  }
  bindProperties() {
    this.bindReactive(
      () => {
        const invalid = unwrap(this.props.invalid);
        const variant = unwrap(this.props.variant);
        const size = unwrap(this.props.size);
        const customClass = this.props.class || "";
        const classes = ["p-inputtext", "p-component"];
        if (invalid) classes.push("p-invalid");
        if (variant === "filled") classes.push("p-variant-filled");
        if (size === "small") classes.push("p-inputtext-sm");
        if (size === "large") classes.push("p-inputtext-lg");
        if (customClass) classes.push(customClass);
        return classes.join(" ");
      },
      (classes) => {
        this.renderer.setAttribute(this.inputEl, "class", classes);
      }
    );
    this.bindReactive(
      () => unwrap(this.props.value) ?? "",
      (val) => {
        this.renderer.setProperty(this.inputEl, "value", val);
      }
    );
    this.bindReactive(
      () => unwrap(this.props.placeholder) ?? "",
      (placeholder) => {
        if (placeholder) {
          this.renderer.setAttribute(this.inputEl, "placeholder", placeholder);
        }
      }
    );
    this.bindReactive(
      () => Boolean(unwrap(this.props.disabled)),
      (disabled) => {
        this.renderer.setProperty(this.inputEl, "disabled", disabled);
      }
    );
    this.bindReactive(
      () => Boolean(unwrap(this.props.readonly)),
      (readonly) => {
        this.renderer.setProperty(this.inputEl, "readOnly", readonly);
      }
    );
  }
  getElement() {
    return this.hostElement;
  }
};

// adapters/primeng/src/select/select.component.ts
var JarvisSelect = class extends JarvisPrimeComponent {
  constructor(renderer2, props = {}) {
    super(renderer2);
    this.valueChange = jarvisEvent();
    this.change = jarvisEvent();
    this.isOpen = false;
    this.overlayId = null;
    this.props = props;
    this.createDom();
    this.bindProperties();
  }
  createDom() {
    this.containerEl = this.renderer.createElement("div");
    this.hostElement = this.containerEl;
    const labelSpan = this.renderer.createElement("span");
    this.renderer.setAttribute(labelSpan, "class", "p-select-label");
    this.labelTextNode = this.renderer.createText("");
    this.renderer.appendChild(labelSpan, this.labelTextNode);
    this.renderer.appendChild(this.containerEl, labelSpan);
    const trigger = this.renderer.createElement("div");
    this.renderer.setAttribute(trigger, "class", "p-select-dropdown");
    const icon = this.renderer.createElement("span");
    this.renderer.setAttribute(icon, "class", "p-select-dropdown-icon pi pi-chevron-down");
    this.renderer.appendChild(trigger, icon);
    this.renderer.appendChild(this.containerEl, trigger);
    this.overlayEl = this.renderer.createElement("div");
    this.renderer.setAttribute(this.overlayEl, "class", "p-select-overlay p-component");
    this.renderer.setProperty(this.overlayEl, "style", "display: none;");
    this.listEl = this.renderer.createElement("ul");
    this.renderer.setAttribute(this.listEl, "class", "p-select-list");
    this.renderer.appendChild(this.overlayEl, this.listEl);
    this.renderer.appendChild(this.containerEl, this.overlayEl);
    this.renderer.listen(this.containerEl, "click", (event) => {
      const isDisabled = Boolean(unwrap(this.props.disabled) || unwrap(this.props.loading));
      if (!isDisabled) {
        this.toggle();
      }
    });
  }
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
  open() {
    this.isOpen = true;
    this.renderer.setProperty(this.overlayEl, "style", "display: block;");
    this.renderer.setAttribute(this.containerEl, "class", "p-select p-component p-select-open");
    this.overlayId = OverlayService.register({
      onDismiss: () => this.close()
    });
  }
  close() {
    this.isOpen = false;
    this.renderer.setProperty(this.overlayEl, "style", "display: none;");
    this.renderer.setAttribute(this.containerEl, "class", "p-select p-component");
    if (this.overlayId != null) {
      OverlayService.unregister(this.overlayId);
      this.overlayId = null;
    }
  }
  bindProperties() {
    this.bindReactive(
      () => {
        const options = unwrap(this.props.options) || [];
        const selectedVal = unwrap(this.props.value);
        const labelProp = this.props.optionLabel || "label";
        const valProp = this.props.optionValue || "value";
        const placeholder = this.props.placeholder || "Select an option";
        let displayLabel = placeholder;
        const items = [];
        for (const opt of options) {
          const optLabel = typeof opt === "object" && opt !== null ? opt[labelProp] : String(opt);
          const optValue = typeof opt === "object" && opt !== null ? opt[valProp] : opt;
          const isSelected = Object.is(optValue, selectedVal);
          if (isSelected) {
            displayLabel = optLabel;
          }
          items.push({ label: optLabel, val: optValue, selected: isSelected });
        }
        return { displayLabel, items };
      },
      ({ displayLabel, items }) => {
        this.renderer.setText(this.labelTextNode, displayLabel);
        while (this.listEl.children?.length > 0) {
          this.renderer.removeChild(this.listEl, this.listEl.children[0]);
        }
        for (const item of items) {
          const li = this.renderer.createElement("li");
          const liClass = item.selected ? "p-select-option p-select-option-selected" : "p-select-option";
          this.renderer.setAttribute(li, "class", liClass);
          const txt = this.renderer.createText(item.label);
          this.renderer.appendChild(li, txt);
          this.renderer.listen(li, "click", (event) => {
            event.stopPropagation?.();
            this.valueChange.emit(item.val);
            this.change.emit({ originalEvent: event, value: item.val });
            this.close();
          });
          this.renderer.appendChild(this.listEl, li);
        }
      }
    );
  }
  destroy() {
    this.close();
    super.destroy();
  }
  getElement() {
    return this.hostElement;
  }
};

// adapters/primeng/src/checkbox/checkbox.component.ts
var JarvisCheckbox = class extends JarvisPrimeComponent {
  constructor(renderer2, props = {}) {
    super(renderer2);
    this.checkedChange = jarvisEvent();
    this.change = jarvisEvent();
    this.props = props;
    this.createDom();
    this.bindProperties();
  }
  createDom() {
    this.containerEl = this.renderer.createElement("div");
    this.hostElement = this.containerEl;
    this.boxEl = this.renderer.createElement("div");
    this.renderer.setAttribute(this.boxEl, "class", "p-checkbox-box");
    this.iconEl = this.renderer.createElement("span");
    this.renderer.setAttribute(this.iconEl, "class", "p-checkbox-icon pi pi-check");
    this.renderer.appendChild(this.boxEl, this.iconEl);
    this.renderer.appendChild(this.containerEl, this.boxEl);
    const labelEl = this.renderer.createElement("label");
    this.renderer.setAttribute(labelEl, "class", "p-checkbox-label");
    this.labelTextNode = this.renderer.createText("");
    this.renderer.appendChild(labelEl, this.labelTextNode);
    this.renderer.appendChild(this.containerEl, labelEl);
    this.renderer.listen(this.containerEl, "click", (event) => {
      const isDisabled = Boolean(unwrap(this.props.disabled));
      if (!isDisabled) {
        const nextVal = !Boolean(unwrap(this.props.checked));
        this.checkedChange.emit(nextVal);
        this.change.emit({ originalEvent: event, checked: nextVal });
      }
    });
  }
  bindProperties() {
    this.bindReactive(
      () => Boolean(unwrap(this.props.checked)),
      (isChecked) => {
        const baseClass = "p-checkbox-box";
        const checkedClass = isChecked ? `${baseClass} p-highlight` : baseClass;
        this.renderer.setAttribute(this.boxEl, "class", checkedClass);
        this.renderer.setProperty(this.iconEl, "style", isChecked ? "display: block;" : "display: none;");
      }
    );
    this.bindReactive(
      () => {
        const isChecked = Boolean(unwrap(this.props.checked));
        const isDisabled = Boolean(unwrap(this.props.disabled));
        const isInvalid = Boolean(unwrap(this.props.invalid));
        const customClass = this.props.class || "";
        const classes = ["p-checkbox", "p-component"];
        if (isChecked) classes.push("p-checkbox-checked");
        if (isDisabled) classes.push("p-checkbox-disabled");
        if (isInvalid) classes.push("p-invalid");
        if (customClass) classes.push(customClass);
        return classes.join(" ");
      },
      (classes) => {
        this.renderer.setAttribute(this.containerEl, "class", classes);
      }
    );
    this.bindReactive(
      () => unwrap(this.props.label) ?? "",
      (label) => {
        this.renderer.setText(this.labelTextNode, label);
      }
    );
  }
  getElement() {
    return this.hostElement;
  }
};

// adapters/primeng/src/dialog/dialog.component.ts
var JarvisDialog = class extends JarvisPrimeComponent {
  constructor(renderer2, props = {}) {
    super(renderer2);
    this.visibleChange = jarvisEvent();
    this.onShow = jarvisEvent();
    this.onHide = jarvisEvent();
    this.overlayId = null;
    this.isShown = false;
    this.props = props;
    this.createDom();
    this.bindProperties();
  }
  createDom() {
    this.maskEl = this.renderer.createElement("div");
    this.hostElement = this.maskEl;
    this.renderer.setAttribute(this.maskEl, "class", "p-dialog-mask");
    this.renderer.setProperty(this.maskEl, "style", "display: none;");
    this.dialogEl = this.renderer.createElement("div");
    this.renderer.setAttribute(this.dialogEl, "class", "p-dialog p-component");
    if (this.props.width) {
      this.renderer.setProperty(this.dialogEl, "style", `width: ${this.props.width};`);
    }
    const headerEl = this.renderer.createElement("div");
    this.renderer.setAttribute(headerEl, "class", "p-dialog-header");
    const titleEl = this.renderer.createElement("span");
    this.renderer.setAttribute(titleEl, "class", "p-dialog-title");
    this.headerTitleNode = this.renderer.createText("");
    this.renderer.appendChild(titleEl, this.headerTitleNode);
    this.renderer.appendChild(headerEl, titleEl);
    if (this.props.closable !== false) {
      const closeBtn = this.renderer.createElement("button");
      this.renderer.setAttribute(closeBtn, "class", "p-dialog-header-close p-button-text");
      const closeIcon = this.renderer.createElement("span");
      this.renderer.setAttribute(closeIcon, "class", "pi pi-times");
      this.renderer.appendChild(closeBtn, closeIcon);
      this.renderer.listen(closeBtn, "click", () => {
        this.close();
      });
      this.renderer.appendChild(headerEl, closeBtn);
    }
    this.renderer.appendChild(this.dialogEl, headerEl);
    this.contentEl = this.renderer.createElement("div");
    this.renderer.setAttribute(this.contentEl, "class", "p-dialog-content");
    this.renderer.appendChild(this.dialogEl, this.contentEl);
    this.renderer.appendChild(this.maskEl, this.dialogEl);
    if (this.props.dismissableMask) {
      this.renderer.listen(this.maskEl, "click", (event) => {
        if (event.target === this.maskEl) {
          this.close();
        }
      });
    }
  }
  bindProperties() {
    this.bindReactive(
      () => Boolean(unwrap(this.props.visible)),
      (visible) => {
        if (visible && !this.isShown) {
          this.open();
        } else if (!visible && this.isShown) {
          this.close();
        }
      }
    );
    this.bindReactive(
      () => unwrap(this.props.header) ?? "",
      (title) => {
        this.renderer.setText(this.headerTitleNode, title);
      }
    );
  }
  open() {
    this.isShown = true;
    const zIndex = OverlayService.nextZIndex();
    this.renderer.setProperty(this.maskEl, "style", `display: flex; z-index: ${zIndex};`);
    this.overlayId = OverlayService.register({
      onDismiss: () => this.close()
    });
    this.onShow.emit();
  }
  close() {
    this.isShown = false;
    this.renderer.setProperty(this.maskEl, "style", "display: none;");
    if (this.overlayId != null) {
      OverlayService.unregister(this.overlayId);
      this.overlayId = null;
    }
    this.visibleChange.emit(false);
    this.onHide.emit();
  }
  getContentContainer() {
    return this.contentEl;
  }
  destroy() {
    this.close();
    super.destroy();
  }
  getElement() {
    return this.hostElement;
  }
};

// adapters/primeng/src/table/table.component.ts
var JarvisTable = class extends JarvisPrimeComponent {
  constructor(renderer2, props) {
    super(renderer2);
    this.sortChange = jarvisEvent();
    this.pageChange = jarvisEvent();
    this.currentSortField = null;
    this.currentSortOrder = 1;
    this.currentPage = 1;
    this.props = props;
    this.currentSortField = props.sortField || null;
    this.currentSortOrder = props.sortOrder || 1;
    this.createDom();
    this.bindProperties();
  }
  createDom() {
    this.containerEl = this.renderer.createElement("div");
    this.hostElement = this.containerEl;
    this.renderer.setAttribute(this.containerEl, "class", "p-datatable p-component");
    this.renderer.setProperty(this.containerEl, "style", "position: relative;");
    this.tableEl = this.renderer.createElement("table");
    this.renderer.setAttribute(this.tableEl, "class", "p-datatable-table");
    this.renderer.appendChild(this.containerEl, this.tableEl);
    this.theadEl = this.renderer.createElement("thead");
    this.renderer.setAttribute(this.theadEl, "class", "p-datatable-thead");
    this.renderer.appendChild(this.tableEl, this.theadEl);
    this.tbodyEl = this.renderer.createElement("tbody");
    this.renderer.setAttribute(this.tbodyEl, "class", "p-datatable-tbody");
    this.renderer.appendChild(this.tableEl, this.tbodyEl);
    this.loadingOverlayEl = this.renderer.createElement("div");
    this.renderer.setAttribute(this.loadingOverlayEl, "class", "p-datatable-loading-overlay");
    this.renderer.setProperty(
      this.loadingOverlayEl,
      "style",
      "position: absolute; inset: 0; background: rgba(255,255,255,0.7); display: none; align-items: center; justify-content: center;"
    );
    const spinner = this.renderer.createElement("span");
    this.renderer.setAttribute(spinner, "class", "pi pi-spinner pi-spin");
    this.renderer.setProperty(spinner, "style", "font-size: 2rem; color: var(--p-primary-color);");
    this.renderer.appendChild(this.loadingOverlayEl, spinner);
    this.renderer.appendChild(this.containerEl, this.loadingOverlayEl);
    this.renderHeaders();
    if (this.props.paginator) {
      this.paginatorEl = this.renderer.createElement("div");
      this.renderer.setAttribute(this.paginatorEl, "class", "p-paginator p-component");
      this.renderer.appendChild(this.containerEl, this.paginatorEl);
    }
  }
  renderHeaders() {
    const headerRow = this.renderer.createElement("tr");
    for (const col of this.props.columns) {
      const th = this.renderer.createElement("th");
      this.renderer.setAttribute(th, "class", col.sortable ? "p-sortable-column" : "");
      const titleSpan = this.renderer.createElement("span");
      const titleTxt = this.renderer.createText(col.header);
      this.renderer.appendChild(titleSpan, titleTxt);
      this.renderer.appendChild(th, titleSpan);
      if (col.sortable) {
        const sortIcon = this.renderer.createElement("span");
        this.renderer.setAttribute(sortIcon, "class", "p-sortable-column-icon pi pi-sort");
        this.renderer.appendChild(th, sortIcon);
        this.renderer.listen(th, "click", () => {
          const field = String(col.field);
          if (this.currentSortField === field) {
            this.currentSortOrder = this.currentSortOrder === 1 ? -1 : 1;
          } else {
            this.currentSortField = field;
            this.currentSortOrder = 1;
          }
          this.sortChange.emit({ field, order: this.currentSortOrder });
          this.renderRows();
        });
      }
      this.renderer.appendChild(headerRow, th);
    }
    this.renderer.appendChild(this.theadEl, headerRow);
  }
  bindProperties() {
    this.bindReactive(
      () => {
        const rawRows = unwrap(this.props.value) || [];
        return [...rawRows];
      },
      () => {
        this.renderRows();
      }
    );
    this.bindReactive(
      () => Boolean(unwrap(this.props.loading)),
      (isLoading) => {
        this.renderer.setProperty(
          this.loadingOverlayEl,
          "style",
          isLoading ? "position: absolute; inset: 0; background: rgba(255,255,255,0.7); display: flex; align-items: center; justify-content: center;" : "display: none;"
        );
      }
    );
  }
  renderRows() {
    const rawRows = unwrap(this.props.value) || [];
    let rows = [...rawRows];
    if (this.currentSortField) {
      const field = this.currentSortField;
      const order = this.currentSortOrder;
      rows.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA < valB) return -1 * order;
        if (valA > valB) return 1 * order;
        return 0;
      });
    }
    const pageSize = this.props.rows || 10;
    const total = this.props.totalRecords ?? rows.length;
    let displayRows = rows;
    if (this.props.paginator) {
      const start = (this.currentPage - 1) * pageSize;
      displayRows = rows.slice(start, start + pageSize);
    }
    while (this.tbodyEl.children?.length > 0) {
      this.renderer.removeChild(this.tbodyEl, this.tbodyEl.children[0]);
    }
    if (displayRows.length === 0) {
      const emptyRow = this.renderer.createElement("tr");
      const emptyTd = this.renderer.createElement("td");
      this.renderer.setAttribute(emptyTd, "colspan", String(this.props.columns.length));
      this.renderer.setAttribute(emptyTd, "class", "p-datatable-emptymessage");
      const emptyTxt = this.renderer.createText("No records found.");
      this.renderer.appendChild(emptyTd, emptyTxt);
      this.renderer.appendChild(emptyRow, emptyTd);
      this.renderer.appendChild(this.tbodyEl, emptyRow);
    } else {
      for (const row of displayRows) {
        const tr = this.renderer.createElement("tr");
        for (const col of this.props.columns) {
          const td = this.renderer.createElement("td");
          const rawVal = row[col.field];
          const textVal = col.formatter ? col.formatter(rawVal, row) : rawVal != null ? String(rawVal) : "";
          const tdTxt = this.renderer.createText(textVal);
          this.renderer.appendChild(td, tdTxt);
          this.renderer.appendChild(tr, td);
        }
        this.renderer.appendChild(this.tbodyEl, tr);
      }
    }
    if (this.props.paginator && this.paginatorEl) {
      while (this.paginatorEl.children?.length > 0) {
        this.renderer.removeChild(this.paginatorEl, this.paginatorEl.children[0]);
      }
      const pageInfo = this.renderer.createText(
        `Page ${this.currentPage} of ${Math.max(1, Math.ceil(total / pageSize))} (${total} items)`
      );
      this.renderer.appendChild(this.paginatorEl, pageInfo);
    }
  }
  getElement() {
    return this.hostElement;
  }
};

// adapters/primeng/src/index.ts
PrimeComponentRegistry.register({
  selector: "jarvis-p-button",
  inputs: ["label", "icon", "severity", "variant", "size", "raised", "rounded", "loading", "disabled"],
  outputs: ["clicked"],
  adapterClass: JarvisButton
});
PrimeComponentRegistry.register({
  selector: "jarvis-p-input",
  inputs: ["value", "placeholder", "disabled", "readonly", "type", "variant", "size", "invalid"],
  outputs: ["valueChange", "input", "blur"],
  adapterClass: JarvisInputText
});
PrimeComponentRegistry.register({
  selector: "jarvis-p-select",
  inputs: ["value", "options", "optionLabel", "optionValue", "placeholder", "disabled", "filter"],
  outputs: ["valueChange", "change"],
  adapterClass: JarvisSelect
});
PrimeComponentRegistry.register({
  selector: "jarvis-p-checkbox",
  inputs: ["checked", "label", "disabled", "binary"],
  outputs: ["checkedChange", "change"],
  adapterClass: JarvisCheckbox
});
PrimeComponentRegistry.register({
  selector: "jarvis-p-dialog",
  inputs: ["visible", "header", "width", "modal", "closable", "dismissableMask"],
  outputs: ["visibleChange", "onShow", "onHide"],
  adapterClass: JarvisDialog
});
PrimeComponentRegistry.register({
  selector: "jarvis-p-table",
  inputs: ["value", "columns", "loading", "paginator", "rows", "totalRecords", "sortField", "sortOrder"],
  outputs: ["sortChange", "pageChange"],
  adapterClass: JarvisTable
});

// examples/04-login-storage/auth.service.ts
var STORAGE_KEY = "jarvis_auth_session";
var DUMMY_USERS = [
  {
    id: "USR-001",
    name: "Tony Stark",
    email: "stark@jarvis.ai",
    password: "password123",
    role: "Architect",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
  },
  {
    id: "USR-002",
    name: "Pepper Potts",
    email: "pepper@jarvis.ai",
    password: "password123",
    role: "Security Officer",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80"
  },
  {
    id: "USR-003",
    name: "Bruce Banner",
    email: "banner@jarvis.ai",
    password: "password123",
    role: "Lead Engineer",
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80"
  }
];
var AuthService = class {
  constructor() {
    this._currentUser = signal(null);
    this._isAuthenticated = signal(false);
    this._sessionInfo = signal(null);
    this.currentUser = this._currentUser;
    this.isAuthenticated = this._isAuthenticated;
    this.sessionInfo = this._sessionInfo;
    this.restoreSession();
  }
  restoreSession() {
    try {
      const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored) {
        const session = JSON.parse(stored);
        if (session && session.user && session.token) {
          this._sessionInfo.set(session);
          this._currentUser.set(session.user);
          this._isAuthenticated.set(true);
          return true;
        }
      }
    } catch (e) {
      console.warn("[AuthService] Failed to parse stored session:", e);
      if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
    }
    this._sessionInfo.set(null);
    this._currentUser.set(null);
    this._isAuthenticated.set(false);
    return false;
  }
  login(email, pass, rememberMe = true) {
    const matched = DUMMY_USERS.find(
      (u) => u.email.trim().toLowerCase() === email.trim().toLowerCase() && u.password === pass
    );
    if (!matched) {
      return { success: false, message: "Invalid credentials. Please verify your email and password." };
    }
    const { password: _, ...safeUser } = matched;
    const session = {
      token: "jwt-jarvis-" + Math.random().toString(36).substring(2) + "-" + Date.now(),
      user: safeUser,
      loginTime: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (typeof localStorage !== "undefined") {
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } else {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      }
    }
    this._sessionInfo.set(session);
    this._currentUser.set(safeUser);
    this._isAuthenticated.set(true);
    return { success: true };
  }
  logout() {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    }
    this._sessionInfo.set(null);
    this._currentUser.set(null);
    this._isAuthenticated.set(false);
  }
  clearLocalStorage() {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
      sessionStorage.clear();
    }
    this.restoreSession();
  }
};

// examples/03-router-primeng-tailwind/app.ts
providePrimeNG({
  theme: "Aura",
  ripple: true,
  cssLayer: true
});
var renderer = new DOMRenderer();
var initialEmployees = [
  { id: "EMP001", name: "Sophia Martinez", role: "Staff Frontend Architect", dept: "Engineering", salary: 165e3, status: "Active" },
  { id: "EMP002", name: "Alexander Wright", role: "Compiler Engineer", dept: "Engineering", salary: 155e3, status: "Active" },
  { id: "EMP003", name: "Elena Rostova", role: "Principal Designer", dept: "Design", salary: 14e4, status: "Active" },
  { id: "EMP004", name: "Marcus Chen", role: "Lead Product Manager", dept: "Product", salary: 15e4, status: "On Leave" },
  { id: "EMP005", name: "Liam O'Connor", role: "Systems Developer", dept: "Engineering", salary: 135e3, status: "Active" }
];
var employeesState = signal(initialEmployees);
var DashboardComponent = class {
  render(r) {
    const root = r.createElement("div");
    r.setAttribute(root, "class", "space-y-6");
    const header = r.createElement("div");
    r.setAttribute(header, "class", "flex items-center justify-between");
    const title = r.createElement("h1");
    r.setAttribute(title, "class", "text-2xl font-bold text-slate-800");
    r.appendChild(title, r.createText("Executive Dashboard"));
    r.appendChild(header, title);
    const grid = r.createElement("div");
    r.setAttribute(grid, "class", "grid grid-cols-1 md:grid-cols-3 gap-5");
    const total = employeesState().length;
    const active = employeesState().filter((e) => e.status === "Active").length;
    const avgSalary = Math.round(
      employeesState().reduce((acc, e) => acc + e.salary, 0) / (total || 1)
    );
    const cards = [
      { label: "Total Personel", val: String(total), icon: "pi pi-users", color: "text-blue-600", bg: "bg-blue-50" },
      { label: "Active Headcount", val: String(active), icon: "pi pi-check-circle", color: "text-emerald-600", bg: "bg-emerald-50" },
      { label: "Avg Compensation", val: `$${avgSalary.toLocaleString()}`, icon: "pi pi-dollar", color: "text-amber-600", bg: "bg-amber-50" }
    ];
    for (const card of cards) {
      const cardEl = r.createElement("div");
      r.setAttribute(cardEl, "class", "bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between");
      const textWrap = r.createElement("div");
      const label = r.createElement("p");
      r.setAttribute(label, "class", "text-xs font-semibold uppercase tracking-wider text-slate-400");
      r.appendChild(label, r.createText(card.label));
      const val = r.createElement("p");
      r.setAttribute(val, "class", "text-2xl font-extrabold text-slate-800 mt-1");
      r.appendChild(val, r.createText(card.val));
      r.appendChild(textWrap, label);
      r.appendChild(textWrap, val);
      const iconWrap = r.createElement("div");
      r.setAttribute(iconWrap, "class", `w-12 h-12 rounded-xl flex items-center justify-center text-xl ${card.bg} ${card.color}`);
      const icon = r.createElement("i");
      r.setAttribute(icon, "class", card.icon);
      r.appendChild(iconWrap, icon);
      r.appendChild(cardEl, textWrap);
      r.appendChild(cardEl, iconWrap);
      r.appendChild(grid, cardEl);
    }
    const ctaCard = r.createElement("div");
    r.setAttribute(ctaCard, "class", "bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6");
    const ctaText = r.createElement("div");
    const ctaHeading = r.createElement("h2");
    r.setAttribute(ctaHeading, "class", "text-lg font-bold text-slate-800");
    r.appendChild(ctaHeading, r.createText("Personnel Directory Management"));
    const ctaSub = r.createElement("p");
    r.setAttribute(ctaSub, "class", "text-sm text-slate-500 mt-1");
    r.appendChild(ctaSub, r.createText("Review team rosters, compensation allocations, and update profiles with fine-grained reactivity."));
    r.appendChild(ctaText, ctaHeading);
    r.appendChild(ctaText, ctaSub);
    const navBtn = new JarvisButton(r, {
      label: "Open Directory",
      icon: "pi pi-arrow-right",
      severity: "primary"
    });
    navBtn.clicked.subscribe(() => {
      this.router.navigate(["employees"]);
    });
    r.appendChild(ctaCard, ctaText);
    r.appendChild(ctaCard, navBtn.getElement());
    r.appendChild(root, header);
    r.appendChild(root, grid);
    r.appendChild(root, ctaCard);
    return root;
  }
};
var EmployeeListComponent = class {
  render(r) {
    const root = r.createElement("div");
    r.setAttribute(root, "class", "space-y-6");
    const header = r.createElement("div");
    r.setAttribute(header, "class", "flex items-center justify-between");
    const titleWrap = r.createElement("div");
    const title = r.createElement("h1");
    r.setAttribute(title, "class", "text-2xl font-bold text-slate-800");
    r.appendChild(title, r.createText("Personnel Directory"));
    const sub = r.createElement("p");
    r.setAttribute(sub, "class", "text-sm text-slate-500 mt-1");
    r.appendChild(sub, r.createText("Select any team member to view and edit details via dynamic Angular routing."));
    r.appendChild(titleWrap, title);
    r.appendChild(titleWrap, sub);
    r.appendChild(header, titleWrap);
    const table = new JarvisTable(r, {
      value: employeesState,
      paginator: true,
      rows: 5,
      columns: [
        { field: "id", header: "ID", sortable: true },
        { field: "name", header: "Employee Name", sortable: true },
        { field: "role", header: "Job Role", sortable: true },
        { field: "dept", header: "Department", sortable: true },
        {
          field: "salary",
          header: "Salary",
          sortable: true,
          formatter: (val) => `$${Number(val).toLocaleString()}`
        },
        { field: "status", header: "Status", sortable: true },
        {
          field: "id",
          header: "Action",
          formatter: (id) => `[Edit ${id}]`
        }
      ]
    });
    const quickNav = r.createElement("div");
    r.setAttribute(quickNav, "class", "bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between");
    const info = r.createElement("span");
    r.setAttribute(info, "class", "text-sm text-slate-600 font-medium");
    r.appendChild(info, r.createText("Quick profile shortcuts:"));
    r.appendChild(quickNav, info);
    const shortcutsWrap = r.createElement("div");
    r.setAttribute(shortcutsWrap, "class", "flex gap-2");
    for (const emp of employeesState().slice(0, 3)) {
      const btn = new JarvisButton(r, {
        label: emp.name.split(" ")[0],
        variant: "outlined",
        size: "small"
      });
      btn.clicked.subscribe(() => {
        this.router.navigate(["employees", emp.id]);
      });
      r.appendChild(shortcutsWrap, btn.getElement());
    }
    r.appendChild(quickNav, shortcutsWrap);
    r.appendChild(root, header);
    r.appendChild(root, table.getElement());
    r.appendChild(root, quickNav);
    return root;
  }
};
var EmployeeDetailComponent = class {
  render(r) {
    const root = r.createElement("div");
    r.setAttribute(root, "class", "space-y-6 max-w-3xl");
    const empId = this.activatedRoute.params().id;
    const employee = employeesState().find((e) => e.id === empId);
    const topBar = r.createElement("div");
    r.setAttribute(topBar, "class", "flex items-center gap-4");
    const backBtn = new JarvisButton(r, {
      label: "Back to Personel",
      icon: "pi pi-arrow-left",
      variant: "text",
      size: "small"
    });
    backBtn.clicked.subscribe(() => {
      this.router.navigate(["employees"]);
    });
    r.appendChild(topBar, backBtn.getElement());
    if (!employee) {
      const errCard = r.createElement("div");
      r.setAttribute(errCard, "class", "bg-red-50 text-red-700 p-6 rounded-xl border border-red-200");
      r.appendChild(errCard, r.createText(`Employee record '${empId}' not found.`));
      r.appendChild(root, topBar);
      r.appendChild(root, errCard);
      return root;
    }
    const card = r.createElement("div");
    r.setAttribute(card, "class", "bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden");
    const cardHeader = r.createElement("div");
    r.setAttribute(cardHeader, "class", "p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between");
    const profileInfo = r.createElement("div");
    r.setAttribute(profileInfo, "class", "flex items-center gap-4");
    const avatar = r.createElement("div");
    r.setAttribute(avatar, "class", "w-14 h-14 rounded-full bg-white text-emerald-700 font-extrabold text-xl flex items-center justify-center shadow");
    r.appendChild(avatar, r.createText(employee.name.split(" ").map((n) => n[0]).join("")));
    const meta = r.createElement("div");
    const empName = r.createElement("h2");
    r.setAttribute(empName, "class", "text-xl font-bold");
    r.appendChild(empName, r.createText(employee.name));
    const empIdBadge = r.createElement("span");
    r.setAttribute(empIdBadge, "class", "text-xs text-emerald-100 font-mono");
    r.appendChild(empIdBadge, r.createText(`ID: ${employee.id} \u2022 ${employee.dept}`));
    r.appendChild(meta, empName);
    r.appendChild(meta, empIdBadge);
    r.appendChild(profileInfo, avatar);
    r.appendChild(profileInfo, meta);
    const statusBadge = r.createElement("span");
    r.setAttribute(statusBadge, "class", "text-xs font-semibold px-3 py-1 rounded-full bg-white/20 text-white");
    r.appendChild(statusBadge, r.createText(employee.status));
    r.appendChild(cardHeader, profileInfo);
    r.appendChild(cardHeader, statusBadge);
    r.appendChild(card, cardHeader);
    const formBody = r.createElement("div");
    r.setAttribute(formBody, "class", "p-6 space-y-4");
    const roleSig = signal(employee.role);
    const salarySig = signal(String(employee.salary));
    const deptSig = signal(employee.dept);
    const activeSig = signal(employee.status === "Active");
    const roleField = r.createElement("div");
    r.setAttribute(roleField, "class", "space-y-1");
    const roleLabel = r.createElement("label");
    r.setAttribute(roleLabel, "class", "text-xs font-semibold text-slate-600");
    r.appendChild(roleLabel, r.createText("Job Role"));
    const roleInput = new JarvisInputText(r, { value: roleSig });
    roleInput.valueChange.subscribe((v) => roleSig.set(v));
    r.appendChild(roleField, roleLabel);
    r.appendChild(roleField, roleInput.getElement());
    r.appendChild(formBody, roleField);
    const deptField = r.createElement("div");
    r.setAttribute(deptField, "class", "space-y-1");
    const deptLabel = r.createElement("label");
    r.setAttribute(deptLabel, "class", "text-xs font-semibold text-slate-600");
    r.appendChild(deptLabel, r.createText("Department"));
    const deptSelect = new JarvisSelect(r, {
      options: ["Engineering", "Design", "Product", "Marketing"],
      value: deptSig
    });
    deptSelect.valueChange.subscribe((v) => deptSig.set(v));
    r.appendChild(deptField, deptLabel);
    r.appendChild(deptField, deptSelect.getElement());
    r.appendChild(formBody, deptField);
    const activeField = r.createElement("div");
    r.setAttribute(activeField, "class", "pt-2");
    const activeCheckbox = new JarvisCheckbox(r, {
      label: "Active Full-time Status",
      checked: activeSig
    });
    activeCheckbox.checkedChange.subscribe((c) => activeSig.set(c));
    r.appendChild(activeField, activeCheckbox.getElement());
    r.appendChild(formBody, activeField);
    const footer = r.createElement("div");
    r.setAttribute(footer, "class", "flex items-center justify-between pt-6 border-t border-slate-100");
    const cancelBtn = new JarvisButton(r, {
      label: "Cancel",
      variant: "text"
    });
    cancelBtn.clicked.subscribe(() => {
      this.router.navigate(["employees"]);
    });
    const saveBtn = new JarvisButton(r, {
      label: "Save Changes",
      icon: "pi pi-check",
      severity: "primary"
    });
    saveBtn.clicked.subscribe(() => {
      employeesState.update(
        (list) => list.map(
          (item) => item.id === employee.id ? {
            ...item,
            role: roleSig(),
            dept: deptSig(),
            salary: Number(salarySig()) || item.salary,
            status: activeSig() ? "Active" : "Inactive"
          } : item
        )
      );
      this.router.navigate(["employees"]);
    });
    r.appendChild(footer, cancelBtn.getElement());
    r.appendChild(footer, saveBtn.getElement());
    r.appendChild(formBody, footer);
    r.appendChild(card, formBody);
    r.appendChild(root, topBar);
    r.appendChild(root, card);
    return root;
  }
};
var SettingsComponent = class {
  render(r) {
    const root = r.createElement("div");
    r.setAttribute(root, "class", "space-y-6 max-w-2xl");
    const title = r.createElement("h1");
    r.setAttribute(title, "class", "text-2xl font-bold text-slate-800");
    r.appendChild(title, r.createText("System Configuration"));
    const card = r.createElement("div");
    r.setAttribute(card, "class", "bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4");
    const cb1 = new JarvisCheckbox(r, { label: "Enable Automatic Telemetry", checked: true });
    const cb2 = new JarvisCheckbox(r, { label: "Enable Dark Mode Tokens", checked: false });
    const cb3 = new JarvisCheckbox(r, { label: "Strict CanActivate Guard Verification", checked: true });
    r.appendChild(card, cb1.getElement());
    r.appendChild(card, cb2.getElement());
    r.appendChild(card, cb3.getElement());
    r.appendChild(root, title);
    r.appendChild(root, card);
    return root;
  }
};
var NotFoundComponent = class {
  render(r) {
    const root = r.createElement("div");
    r.setAttribute(root, "class", "text-center py-16 space-y-4");
    const h1 = r.createElement("h1");
    r.setAttribute(h1, "class", "text-6xl font-black text-slate-300");
    r.appendChild(h1, r.createText("404"));
    const p = r.createElement("p");
    r.setAttribute(p, "class", "text-slate-600 font-medium");
    r.appendChild(p, r.createText("Requested route was not found in the Jarvis Router table."));
    const btn = new JarvisButton(r, {
      label: "Return to Dashboard",
      icon: "pi pi-home",
      severity: "primary"
    });
    btn.clicked.subscribe(() => {
      this.router.navigate(["dashboard"]);
    });
    r.appendChild(root, h1);
    r.appendChild(root, p);
    r.appendChild(root, btn.getElement());
    return root;
  }
};
var authService = new AuthService();
var authGuard = async () => {
  if (authService.isAuthenticated()) {
    return true;
  }
  if (typeof router !== "undefined") {
    router.navigate(["login"]);
  }
  return false;
};
var LoginComponent = class {
  constructor() {
    this.email = signal("stark@jarvis.ai");
    this.password = signal("password123");
    this.rememberMe = signal(true);
    this.errorMessage = signal(null);
    this.successMessage = signal(null);
    this.isLoading = signal(false);
  }
  render(r) {
    const root = r.createElement("div");
    r.setAttribute(root, "class", "max-w-xl mx-auto py-8 px-4 space-y-6");
    const hero = r.createElement("div");
    r.setAttribute(hero, "class", "text-center space-y-2");
    const h1 = r.createElement("h1");
    r.setAttribute(h1, "class", "text-3xl font-extrabold text-slate-800 tracking-tight");
    r.appendChild(h1, r.createText("Authentication & Access Control"));
    const sub = r.createElement("p");
    r.setAttribute(sub, "class", "text-sm text-slate-500");
    r.appendChild(sub, r.createText("Protected access with JARVIS Signals and LocalStorage session persistence."));
    r.appendChild(hero, h1);
    r.appendChild(hero, sub);
    const card = r.createElement("div");
    r.setAttribute(card, "class", "bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6");
    const presetsBox = r.createElement("div");
    r.setAttribute(presetsBox, "class", "p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5");
    const presetsLabel = r.createElement("span");
    r.setAttribute(presetsLabel, "class", "text-xs font-semibold text-slate-500 uppercase tracking-wider block");
    r.appendChild(presetsLabel, r.createText("1-Click Demo Profiles:"));
    r.appendChild(presetsBox, presetsLabel);
    const presetGrid = r.createElement("div");
    r.setAttribute(presetGrid, "class", "grid grid-cols-1 sm:grid-cols-3 gap-2");
    for (const u of DUMMY_USERS) {
      const pBtn = r.createElement("button");
      r.setAttribute(pBtn, "type", "button");
      r.setAttribute(pBtn, "class", "p-2.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left");
      const pName = r.createElement("div");
      r.setAttribute(pName, "class", "text-xs font-bold text-slate-800 truncate");
      r.appendChild(pName, r.createText(u.name));
      const pRole = r.createElement("div");
      r.setAttribute(pRole, "class", "text-[11px] text-slate-500 truncate");
      r.appendChild(pRole, r.createText(u.role));
      r.appendChild(pBtn, pName);
      r.appendChild(pBtn, pRole);
      r.listen(pBtn, "click", () => {
        this.email.set(u.email);
        this.password.set(u.password);
        this.errorMessage.set(null);
      });
      r.appendChild(presetGrid, pBtn);
    }
    r.appendChild(presetsBox, presetGrid);
    const alertBox = r.createElement("div");
    effect(() => {
      const err = this.errorMessage();
      const succ = this.successMessage();
      if (err) {
        r.setAttribute(alertBox, "class", "p-3.5 rounded-xl text-xs font-medium bg-rose-50 border border-rose-200 text-rose-700 block");
        alertBox.textContent = err;
      } else if (succ) {
        r.setAttribute(alertBox, "class", "p-3.5 rounded-xl text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 block");
        alertBox.textContent = succ;
      } else {
        r.setAttribute(alertBox, "class", "hidden");
        alertBox.textContent = "";
      }
    });
    const formFields = r.createElement("div");
    r.setAttribute(formFields, "class", "space-y-4");
    const emailGroup = r.createElement("div");
    r.setAttribute(emailGroup, "class", "space-y-1.5");
    const emailLabel = r.createElement("label");
    r.setAttribute(emailLabel, "class", "block text-xs font-bold uppercase tracking-wider text-slate-600");
    r.appendChild(emailLabel, r.createText("Work Email"));
    const emailInput = new JarvisInputText(r, {
      value: this.email,
      placeholder: "stark@jarvis.ai"
    });
    emailInput.valueChange.subscribe((v) => this.email.set(v));
    r.appendChild(emailGroup, emailLabel);
    r.appendChild(emailGroup, emailInput.getElement());
    const passGroup = r.createElement("div");
    r.setAttribute(passGroup, "class", "space-y-1.5");
    const passLabel = r.createElement("label");
    r.setAttribute(passLabel, "class", "block text-xs font-bold uppercase tracking-wider text-slate-600");
    r.appendChild(passLabel, r.createText("Password / Secret Key"));
    const passInput = new JarvisInputText(r, {
      value: this.password,
      placeholder: "password123"
    });
    passInput.valueChange.subscribe((v) => this.password.set(v));
    r.appendChild(passGroup, passLabel);
    r.appendChild(passGroup, passInput.getElement());
    const rememberBox = new JarvisCheckbox(r, {
      label: "Persist session in LocalStorage",
      checked: this.rememberMe()
    });
    rememberBox.checkedChange.subscribe((c) => this.rememberMe.set(c));
    r.appendChild(formFields, emailGroup);
    r.appendChild(formFields, passGroup);
    r.appendChild(formFields, rememberBox.getElement());
    const submitBtn = new JarvisButton(r, {
      label: "Sign In to Portal",
      icon: "pi pi-sign-in",
      severity: "primary",
      loading: this.isLoading
    });
    submitBtn.clicked.subscribe(async () => {
      this.errorMessage.set(null);
      this.successMessage.set(null);
      if (!this.email() || !this.email().includes("@")) {
        this.errorMessage.set("Please provide a valid corporate email address.");
        return;
      }
      if (!this.password() || this.password().length < 6) {
        this.errorMessage.set("Password must contain at least 6 characters.");
        return;
      }
      this.isLoading.set(true);
      const res = authService.login(this.email(), this.password(), this.rememberMe());
      this.isLoading.set(false);
      if (res.success) {
        const u = authService.currentUser();
        this.successMessage.set(`Welcome back, ${u?.name}! Redirecting to Dashboard...`);
        setTimeout(() => {
          this.router.navigate(["dashboard"]);
        }, 500);
      } else {
        this.errorMessage.set(res.message || "Authentication failed.");
      }
    });
    r.appendChild(card, presetsBox);
    r.appendChild(card, alertBox);
    r.appendChild(card, formFields);
    r.appendChild(card, submitBtn.getElement());
    const sessionCard = r.createElement("div");
    r.setAttribute(sessionCard, "class", "p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3");
    effect(() => {
      const isAuth = authService.isAuthenticated();
      const user = authService.currentUser();
      sessionCard.innerHTML = "";
      if (isAuth && user) {
        const row = r.createElement("div");
        r.setAttribute(row, "class", "flex items-center justify-between");
        const userDesc = r.createElement("div");
        userDesc.innerHTML = `<span class="text-xs font-bold text-slate-800">${user.name}</span> <span class="text-[11px] text-emerald-600 font-semibold">(${user.role})</span><div class="text-[11px] text-slate-500 font-mono">${user.email}</div>`;
        const logoutBtn = new JarvisButton(r, {
          label: "Sign Out",
          icon: "pi pi-power-off",
          severity: "danger",
          size: "small"
        });
        logoutBtn.clicked.subscribe(() => {
          authService.logout();
          this.successMessage.set(null);
          this.errorMessage.set("Logged out and cleared LocalStorage.");
        });
        r.appendChild(row, userDesc);
        r.appendChild(row, logoutBtn.getElement());
        r.appendChild(sessionCard, row);
      } else {
        const guestText = r.createElement("p");
        r.setAttribute(guestText, "class", "text-xs text-slate-500");
        r.appendChild(guestText, r.createText("Status: Guest mode (no active LocalStorage session)"));
        r.appendChild(sessionCard, guestText);
      }
    });
    r.appendChild(root, hero);
    r.appendChild(root, card);
    r.appendChild(root, sessionCard);
    return root;
  }
};
var routes = [
  { path: "", redirectTo: "dashboard", pathMatch: "full" },
  { path: "login", component: LoginComponent, title: "Jarvis Portal \u2014 Sign In" },
  { path: "dashboard", component: DashboardComponent, title: "Jarvis Portal \u2014 Dashboard" },
  { path: "employees", component: EmployeeListComponent, title: "Jarvis Portal \u2014 Personnel" },
  { path: "employees/:id", component: EmployeeDetailComponent, title: "Jarvis Portal \u2014 Employee Details" },
  { path: "settings", component: SettingsComponent, title: "Jarvis Portal \u2014 Settings" },
  { path: "**", component: NotFoundComponent, title: "Jarvis Portal \u2014 404" }
];
var router = provideRouter(routes);
if (typeof document !== "undefined") {
  const outletHost = document.getElementById("router-outlet");
  if (outletHost) {
    new RouterOutlet(renderer, router, outletHost);
  }
  const navDashboard = document.getElementById("nav-dashboard");
  const navEmployees = document.getElementById("nav-employees");
  const navSettings = document.getElementById("nav-settings");
  const navLogin = document.getElementById("nav-login");
  if (navDashboard) bindRouterLink(renderer, navDashboard, router, "/dashboard", { activeClass: "nav-link-active" });
  if (navEmployees) bindRouterLink(renderer, navEmployees, router, "/employees", { activeClass: "nav-link-active" });
  if (navSettings) bindRouterLink(renderer, navSettings, router, "/settings", { activeClass: "nav-link-active" });
  if (navLogin) bindRouterLink(renderer, navLogin, router, "/login", { activeClass: "nav-link-active" });
  const currentUrlDisplay = document.getElementById("current-url-display");
  if (currentUrlDisplay) {
    effect(() => {
      currentUrlDisplay.textContent = router.currentUrl();
    });
  }
  const currentUserDisplay = document.getElementById("current-user-display");
  const userAvatarDisplay = document.getElementById("user-avatar-display");
  if (currentUserDisplay || userAvatarDisplay) {
    effect(() => {
      const isAuth = authService.isAuthenticated();
      const user = authService.currentUser();
      if (currentUserDisplay) {
        currentUserDisplay.textContent = isAuth && user ? user.name : "Guest User";
      }
      if (userAvatarDisplay) {
        userAvatarDisplay.textContent = isAuth && user ? user.name.slice(0, 2).toUpperCase() : "GU";
      }
    });
  }
  console.log("[Jarvis] Router + PrimeNG v20 + Tailwind showcase bootstrapped successfully!");
}
export {
  DashboardComponent,
  EmployeeDetailComponent,
  EmployeeListComponent,
  LoginComponent,
  NotFoundComponent,
  SettingsComponent,
  authGuard,
  authService,
  employeesState,
  initialEmployees,
  router
};
//# sourceMappingURL=bundle.js.map
