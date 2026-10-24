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

// examples/05-lazy-routing/dashboard.ts
var DashboardComponent = class {
  render(r) {
    const el = r.createElement("div");
    r.appendChild(el, r.createText("Executive Dashboard (Eager)"));
    return el;
  }
};

// examples/05-lazy-routing/main.ts
var adminGuard = async () => true;
var analyticsResolver = async () => ({ metric: "RealTime_TPS_9800" });
var routes = [
  { path: "", redirectTo: "dashboard", pathMatch: "full" },
  { path: "dashboard", component: DashboardComponent, title: "Astra - Dashboard" },
  {
    path: "analytics",
    loadComponent: () => import("./chunk-analytics-VMCYJSCG.js"),
    resolve: { metricData: analyticsResolver },
    title: "Astra - Analytics"
  },
  {
    path: "admin",
    loadComponent: () => import("./chunk-admin-ANQY7SEQ.js"),
    canActivate: [adminGuard],
    title: "Astra - Admin"
  }
];
var router = provideRouter(routes);
var renderer = new DOMRenderer();
if (typeof document !== "undefined") {
  const host = document.getElementById("router-outlet");
  if (host) new RouterOutlet(renderer, router, host);
}
console.log("Astra 3-feature app information loaded");
export {
  adminGuard,
  analyticsResolver,
  router,
  routes
};
