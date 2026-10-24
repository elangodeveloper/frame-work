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

// packages/forms/src/form-control.ts
var FormControl = class {
  constructor(initialValue, validators = []) {
    this.initialValue = initialValue;
    this.validators = validators;
    this.value = signal(initialValue);
    this.touched = signal(false);
    this.dirty = signal(false);
    this.errors = signal(this.runValidators(initialValue));
  }
  setValue(newValue) {
    this.value.set(newValue);
    this.dirty.set(true);
    this.errors.set(this.runValidators(newValue));
  }
  markAsTouched() {
    this.touched.set(true);
  }
  reset() {
    this.value.set(this.initialValue);
    this.touched.set(false);
    this.dirty.set(false);
    this.errors.set(this.runValidators(this.initialValue));
  }
  get valid() {
    return this.errors().length === 0;
  }
  get invalid() {
    return !this.valid;
  }
  runValidators(val) {
    const errs = [];
    for (const v of this.validators) {
      const res = v(val);
      if (res) errs.push(res);
    }
    return errs;
  }
};

// examples/04-login-storage/login.component.ts
var LoginComponent = class {
  constructor(authService2) {
    // Reactive Form Controls
    this.emailControl = new FormControl("stark@jarvis.ai", [
      (val) => !val || !val.includes("@") ? "Valid email required" : null
    ]);
    this.passwordControl = new FormControl("password123", [
      (val) => !val || val.length < 6 ? "Password must be at least 6 characters" : null
    ]);
    this.rememberMe = signal(true);
    // UI state signals
    this.isLoading = signal(false);
    this.errorMessage = signal(null);
    this.successMessage = signal(null);
    // Quick user presets
    this.quickUsers = DUMMY_USERS;
    this.authService = authService2 || new AuthService();
  }
  onInit() {
    if (this.authService.isAuthenticated()) {
      const user = this.authService.currentUser();
      this.successMessage.set("Active session restored from LocalStorage for " + (user?.name || "User") + ".");
    }
  }
  fillDummy(email, pass) {
    this.emailControl.setValue(email);
    this.passwordControl.setValue(pass);
    this.errorMessage.set(null);
  }
  async handleLogin() {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.emailControl.markAsTouched();
    this.passwordControl.markAsTouched();
    if (this.emailControl.invalid) {
      this.errorMessage.set(this.emailControl.errors()[0]);
      return;
    }
    if (this.passwordControl.invalid) {
      this.errorMessage.set(this.passwordControl.errors()[0]);
      return;
    }
    this.isLoading.set(true);
    await new Promise((res2) => setTimeout(res2, 400));
    const res = this.authService.login(
      this.emailControl.value(),
      this.passwordControl.value(),
      this.rememberMe()
    );
    this.isLoading.set(false);
    if (res.success) {
      const user = this.authService.currentUser();
      this.successMessage.set("Welcome back, " + (user?.name || "") + "! Session saved to LocalStorage.");
    } else {
      this.errorMessage.set(res.message || "Authentication failed.");
    }
  }
  handleLogout() {
    this.authService.logout();
    this.successMessage.set(null);
    this.errorMessage.set("Session terminated. LocalStorage cleared.");
  }
  onDestroy() {
  }
};
Component({
  selector: "jarvis-login",
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.css"
})(LoginComponent);

// examples/04-login-storage/app.ts
var authService = new AuthService();
var loginComponent = new LoginComponent(authService);
var emailInput = document.getElementById("email-input");
var passwordInput = document.getElementById("password-input");
var rememberMeInput = document.getElementById("remember-me");
var btnSubmit = document.getElementById("btn-submit");
var btnSpinner = document.getElementById("btn-spinner");
var btnLabel = document.getElementById("btn-label");
var dummyProfilesContainer = document.getElementById("dummy-profiles");
var notificationBox = document.getElementById("notification-box");
var sessionCard = document.getElementById("session-card");
var sessionDetails = document.getElementById("session-details");
var sessionJson = document.getElementById("session-json");
var btnLogout = document.getElementById("btn-logout");
var btnClear = document.getElementById("btn-clear");
if (dummyProfilesContainer) {
  dummyProfilesContainer.innerHTML = "";
  DUMMY_USERS.forEach((u) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "flex flex-col items-start p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/50 transition-all text-left";
    btn.innerHTML = '<div class="flex items-center gap-1.5 w-full"><span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span><span class="text-[11px] font-semibold text-white truncate">' + u.name + '</span></div><span class="text-[10px] text-slate-400 truncate w-full">' + u.role + "</span>";
    btn.addEventListener("click", () => {
      loginComponent.fillDummy(u.email, u.password);
      if (emailInput) emailInput.value = u.email;
      if (passwordInput) passwordInput.value = u.password;
    });
    dummyProfilesContainer.appendChild(btn);
  });
}
if (emailInput) {
  emailInput.value = loginComponent.emailControl.value();
  emailInput.addEventListener("input", (e) => {
    loginComponent.emailControl.setValue(e.target.value);
  });
}
if (passwordInput) {
  passwordInput.value = loginComponent.passwordControl.value();
  passwordInput.addEventListener("input", (e) => {
    loginComponent.passwordControl.setValue(e.target.value);
  });
}
if (rememberMeInput) {
  rememberMeInput.checked = loginComponent.rememberMe();
  rememberMeInput.addEventListener("change", (e) => {
    loginComponent.rememberMe.set(e.target.checked);
  });
}
if (btnSubmit) {
  btnSubmit.addEventListener("click", async () => {
    await loginComponent.handleLogin();
  });
}
if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    loginComponent.handleLogout();
  });
}
if (btnClear) {
  btnClear.addEventListener("click", () => {
    authService.clearLocalStorage();
    loginComponent.errorMessage.set("LocalStorage purged completely.");
  });
}
effect(() => {
  const loading = loginComponent.isLoading();
  if (btnSpinner && btnLabel && btnSubmit) {
    if (loading) {
      btnSpinner.classList.remove("hidden");
      btnLabel.textContent = "Authenticating...";
      btnSubmit.disabled = true;
    } else {
      btnSpinner.classList.add("hidden");
      btnLabel.textContent = "Authenticate & Store";
      btnSubmit.disabled = false;
    }
  }
});
effect(() => {
  const err = loginComponent.errorMessage();
  const succ = loginComponent.successMessage();
  if (!notificationBox) return;
  if (err) {
    notificationBox.className = "rounded-lg p-3 text-xs font-medium border bg-rose-500/10 border-rose-500/30 text-rose-300 block";
    notificationBox.textContent = err;
  } else if (succ) {
    notificationBox.className = "rounded-lg p-3 text-xs font-medium border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 block";
    notificationBox.textContent = succ;
  } else {
    notificationBox.className = "hidden";
    notificationBox.textContent = "";
  }
});
effect(() => {
  const isAuth = authService.isAuthenticated();
  const session = authService.sessionInfo();
  const user = authService.currentUser();
  if (sessionCard && sessionDetails && sessionJson) {
    if (isAuth && session && user) {
      sessionCard.classList.remove("hidden");
      sessionDetails.innerHTML = '<img src="' + user.avatar + '" alt="' + user.name + '" class="w-10 h-10 rounded-full border border-cyan-400/40 object-cover" /><div><div class="text-xs font-bold text-white flex items-center gap-1.5"><span>' + user.name + '</span><span class="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium">' + user.role + '</span></div><div class="text-[11px] text-slate-400 font-mono">' + user.email + '</div><div class="text-[10px] text-slate-500">Login: ' + new Date(session.loginTime).toLocaleTimeString() + "</div></div>";
      sessionJson.textContent = JSON.stringify(session, null, 2);
    } else {
      sessionCard.classList.add("hidden");
      sessionDetails.innerHTML = "";
      sessionJson.textContent = "";
    }
  }
});
loginComponent.onInit();
console.log("Mounted JARVIS Login & LocalStorage Screen");
//# sourceMappingURL=bundle.js.map
