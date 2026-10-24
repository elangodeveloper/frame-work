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
var ComputedNode = class {
  constructor(computeFn) {
    this.subscribers = /* @__PURE__ */ new Set();
    this.dependencies = /* @__PURE__ */ new Set();
    this.dirty = true;
    this.computeFn = computeFn;
  }
  get() {
    trackProducer(this);
    if (this.dirty) {
      cleanupConsumer(this);
      setActiveConsumer(this);
      try {
        this.cachedValue = this.computeFn();
        this.dirty = false;
      } finally {
        restoreActiveConsumer();
      }
    }
    return this.cachedValue;
  }
  markDirty() {
    if (!this.dirty) {
      this.dirty = true;
      const subs = Array.from(this.subscribers);
      for (const sub of subs) {
        sub.markDirty();
      }
    }
  }
};
function computed(fn) {
  const node = new ComputedNode(fn);
  const accessor = (() => node.get());
  accessor.get = () => node.get();
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

// packages/runtime/src/bootstrap.ts
function bootstrap(ComponentClass, container2, customRenderer, options) {
  const def = getComponentDef(ComponentClass);
  const renderer2 = customRenderer || new DOMRenderer();
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
    const templateResult = def.templateFn(renderer2, instance);
    rootNode = templateResult.root;
  } else if (typeof instance.render === "function") {
    rootNode = instance.render(renderer2);
  } else if (typeof instance.getElement === "function") {
    rootNode = instance.getElement();
  } else {
    throw new Error(
      `Cannot bootstrap '${ComponentClass.name}': Missing compiled templateFn, render() method, or getElement() method.`
    );
  }
  const view = new ComponentView(rootNode);
  if (view.root && container2) {
    renderer2.appendChild(container2, view.root);
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
      if (view.root && container2) {
        renderer2.removeChild(container2, view.root);
      }
      view.destroy();
    }
  };
  return componentRef;
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
async function matchRouteTree(routes, rawUrl, parentParams = {}, parentData = {}, baseSegments = []) {
  const { pathname, queryParams, fragment } = parseUrl(rawUrl);
  const totalUrlSegments = splitSegments(pathname);
  const activeSegments = totalUrlSegments.slice(baseSegments.length);
  for (const route of routes) {
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
        return matchRouteTree(routes, target, parentParams, parentData, []);
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
  constructor(routes, options = {}) {
    this.routes = routes;
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
  constructor(renderer2, router2, container2, options = {}) {
    this.renderer = renderer2;
    this.router = router2;
    this.name = options.name || "primary";
    this.container = container2 || renderer2.createElement("div");
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
function provideRouter(routes, optionsOrFeature, ...features) {
  let opts = {};
  if (typeof optionsOrFeature === "object" && optionsOrFeature !== null) {
    opts = optionsOrFeature;
  }
  const router2 = new Router(routes, opts);
  if (typeof optionsOrFeature === "function") {
    optionsOrFeature(router2);
  }
  for (const feat of features) {
    feat(router2);
  }
  return router2;
}

// examples/07-employee-portal/src/features/authentication/models/organization.models.ts
var DEFAULT_ORGANIZATION_CONFIG = {
  organizationName: "JARVIS Enterprise Systems",
  portalTitle: "JARVIS / WORKSPACE",
  tagline: "Intelligent Employee Access",
  identifierLabel: "Work Email or Employee ID",
  identifierPlaceholder: "e.g. stark@jarvis.ai or EMP-10492",
  supportEmail: "support@jarvis.ai",
  supportPhone: "+1 (800) 555-JARVIS",
  helpDocumentationUrl: "https://help.jarvis.internal/access",
  privacyPolicyUrl: "https://jarvis.internal/legal/privacy",
  termsOfServiceUrl: "https://jarvis.internal/legal/terms",
  securityComplianceLabel: "SOC-2 Type II Certified \xB7 Zero-Trust Architecture",
  ssoEnabled: true,
  ssoProviderName: "Enterprise SSO (Okta / Azure AD)",
  version: "v2.4.0"
};

// examples/07-employee-portal/src/features/authentication/components/auth-brand-panel/auth-brand-panel.component.ts
var AuthBrandPanelComponent = class {
  constructor() {
    this.organizationName = input(DEFAULT_ORGANIZATION_CONFIG.organizationName);
    this.portalTitle = input(DEFAULT_ORGANIZATION_CONFIG.portalTitle);
    this.headline = input("Your work. One connected space.");
    this.supportingCopy = input(
      "Access the tools, information, and workflows you need to move your work forward."
    );
    this.securityStatus = input("Operational \xB7 End-to-end Encrypted \xB7 v2.4.0");
  }
  render(r) {
    const root = r.createElement("aside");
    r.setAttribute(root, "class", "jarvis-brand-panel");
    r.setAttribute(root, "aria-label", "Brand and Platform Overview");
    const grid = r.createElement("div");
    r.setAttribute(grid, "class", "jarvis-architectural-grid");
    r.appendChild(root, grid);
    const topBar = r.createElement("div");
    r.setAttribute(topBar, "class", "brand-top-bar");
    const brandIdentity = r.createElement("div");
    r.setAttribute(brandIdentity, "class", "brand-identity");
    const logoSvg = r.createElement("div");
    r.setAttribute(logoSvg, "class", "brand-logo-icon");
    logoSvg.innerHTML = `
      <svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#10b981"/>
            <stop offset="100%" stop-color="#06b6d4"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="#0b1320" stroke="url(#brandGrad)" stroke-width="3.5"/>
        <polygon points="50,20 76,35 76,65 50,80 24,65 24,35" fill="none" stroke="#10b981" stroke-width="1.8" stroke-dasharray="3 2"/>
        <circle cx="50" cy="50" r="14" fill="#047857" fill-opacity="0.2" stroke="url(#brandGrad)" stroke-width="2.5"/>
        <circle cx="50" cy="50" r="5" fill="#34d399"/>
        <path d="M50 20 L50 30 M50 70 L50 80 M24 50 L34 50 M66 50 L76 50" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `;
    r.appendChild(brandIdentity, logoSvg);
    const brandTitles = r.createElement("div");
    const brandNameEl = r.createElement("div");
    r.setAttribute(brandNameEl, "class", "brand-name");
    brandNameEl.textContent = "JARVIS";
    const portalLabel = r.createElement("div");
    r.setAttribute(portalLabel, "class", "portal-label");
    portalLabel.textContent = "WORKSPACE";
    r.appendChild(brandTitles, brandNameEl);
    r.appendChild(brandTitles, portalLabel);
    r.appendChild(brandIdentity, brandTitles);
    r.appendChild(topBar, brandIdentity);
    const statusPill = r.createElement("div");
    r.setAttribute(statusPill, "class", "jarvis-status-badge jarvis-status-badge--success");
    const dot = r.createElement("span");
    r.setAttribute(dot, "class", "jarvis-status-dot jarvis-status-dot--pulse");
    const statusText = r.createElement("span");
    r.bindText(statusText, () => this.securityStatus());
    r.appendChild(statusPill, dot);
    r.appendChild(statusPill, statusText);
    r.appendChild(topBar, statusPill);
    r.appendChild(root, topBar);
    const heroSection = r.createElement("div");
    r.setAttribute(heroSection, "class", "brand-hero-section");
    const heading = r.createElement("h1");
    r.setAttribute(heading, "class", "brand-headline");
    r.bindText(heading, () => this.headline());
    r.appendChild(heroSection, heading);
    const desc = r.createElement("p");
    r.setAttribute(desc, "class", "brand-supporting-copy");
    r.bindText(desc, () => this.supportingCopy());
    r.appendChild(heroSection, desc);
    const illustrationWrap = r.createElement("div");
    r.setAttribute(illustrationWrap, "class", "brand-illustration-wrapper");
    illustrationWrap.innerHTML = `
      <svg width="100%" height="150" viewBox="0 0 460 150" fill="none" xmlns="http://www.w3.org/2000/svg" class="brand-illustration">
        <defs>
          <linearGradient id="gridGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.1"/>
            <stop offset="50%" stop-color="#06b6d4" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.1"/>
          </linearGradient>
          <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#162235" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#0d1522" stop-opacity="0.9"/>
          </linearGradient>
        </defs>

        <!-- Structural Grid Axis Lines -->
        <path d="M10 75 L450 75" stroke="url(#gridGlow)" stroke-width="1.5" stroke-dasharray="4 4"/>
        <path d="M70 20 L70 130 M230 15 L230 135 M390 20 L390 130" stroke="rgba(255, 255, 255, 0.05)" stroke-width="1"/>

        <!-- System Node 1: Identity & Access Gate -->
        <rect x="30" y="45" width="80" height="60" rx="8" fill="url(#cardGrad)" stroke="#10b981" stroke-width="1.2" stroke-opacity="0.4"/>
        <circle cx="70" cy="65" r="8" fill="#047857" fill-opacity="0.3" stroke="#10b981" stroke-width="1.5"/>
        <path d="M67 65 L69 67 L74 62" stroke="#34d399" stroke-width="1.5" stroke-linecap="round"/>
        <text x="70" y="93" fill="#94a3b8" font-size="9" font-family="monospace" text-anchor="middle">IAM CORE</text>

        <!-- Transit Connection 1 -> 2 -->
        <path d="M110 75 L180 75" stroke="#10b981" stroke-width="1.5" stroke-dasharray="3 3"/>
        <circle cx="145" cy="75" r="3" fill="#34d399"/>

        <!-- Central Nexus: Reactive Workspace Engine -->
        <rect x="180" y="32" width="100" height="86" rx="10" fill="url(#cardGrad)" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.6"/>
        <circle cx="230" cy="65" r="14" fill="#0284c7" fill-opacity="0.2" stroke="#38bdf8" stroke-width="1.8"/>
        <circle cx="230" cy="65" r="6" fill="#38bdf8"/>
        <path d="M230 45 L230 51 M230 79 L230 85 M210 65 L216 65 M244 65 L250 65" stroke="#38bdf8" stroke-width="1.5"/>
        <text x="230" y="103" fill="#e2e8f0" font-size="10" font-weight="600" font-family="sans-serif" text-anchor="middle">NEXUS MESH</text>

        <!-- Transit Connection 2 -> 3 -->
        <path d="M280 75 L350 75" stroke="#10b981" stroke-width="1.5" stroke-dasharray="3 3"/>
        <circle cx="315" cy="75" r="3" fill="#34d399"/>

        <!-- System Node 3: Vault & Neural State -->
        <rect x="350" y="45" width="80" height="60" rx="8" fill="url(#cardGrad)" stroke="#10b981" stroke-width="1.2" stroke-opacity="0.4"/>
        <circle cx="390" cy="65" r="8" fill="#047857" fill-opacity="0.3" stroke="#10b981" stroke-width="1.5"/>
        <rect x="386" y="62" width="8" height="6" rx="1" fill="#34d399"/>
        <path d="M388 62 L388 60 C388 58.9 388.9 58 390 58 C391.1 58 392 58.9 392 60 L392 62" stroke="#34d399" stroke-width="1.2"/>
        <text x="390" y="93" fill="#94a3b8" font-size="9" font-family="monospace" text-anchor="middle">KEY VAULT</text>
      </svg>
    `;
    r.appendChild(heroSection, illustrationWrap);
    const featureList = r.createElement("div");
    r.setAttribute(featureList, "class", "brand-feature-list");
    const features = [
      {
        icon: "pi pi-compass",
        title: "One place for your work.",
        desc: "Unified, single-pane access across enterprise apps, repositories, and engineering tooling."
      },
      {
        icon: "pi pi-shield",
        title: "Secure employee access.",
        desc: "Zero-trust cryptographic verification, hardened sessions, and real-time posture defense."
      },
      {
        icon: "pi pi-sliders-h",
        title: "A workspace designed around you.",
        desc: "Fine-grained reactive signals adapt interfaces instantly to your department and clearance."
      }
    ];
    for (const f of features) {
      const item = r.createElement("div");
      r.setAttribute(item, "class", "jarvis-feature-item");
      const iconBox = r.createElement("div");
      r.setAttribute(iconBox, "class", "jarvis-feature-icon");
      const icon = r.createElement("i");
      r.setAttribute(icon, "class", f.icon);
      r.appendChild(iconBox, icon);
      r.appendChild(item, iconBox);
      const textBox = r.createElement("div");
      r.setAttribute(textBox, "class", "feature-text-box");
      const fTitle = r.createElement("h3");
      r.setAttribute(fTitle, "class", "feature-title");
      fTitle.textContent = f.title;
      const fDesc = r.createElement("p");
      r.setAttribute(fDesc, "class", "feature-desc");
      fDesc.textContent = f.desc;
      r.appendChild(textBox, fTitle);
      r.appendChild(textBox, fDesc);
      r.appendChild(item, textBox);
      r.appendChild(featureList, item);
    }
    r.appendChild(heroSection, featureList);
    r.appendChild(root, heroSection);
    const footer = r.createElement("footer");
    r.setAttribute(footer, "class", "brand-footer");
    const compliance = r.createElement("div");
    compliance.textContent = "SOC-2 Type II Certified \xB7 Continuous Posture Evaluation";
    const version = r.createElement("div");
    version.textContent = "JARVIS Framework Core v0.1.0";
    r.appendChild(footer, compliance);
    r.appendChild(footer, version);
    r.appendChild(root, footer);
    return root;
  }
};
Component({
  selector: "jarvis-auth-brand-panel",
  templateUrl: "./auth-brand-panel.component.html",
  styleUrl: "./auth-brand-panel.component.css"
})(AuthBrandPanelComponent);

// examples/07-employee-portal/src/features/authentication/services/authentication.service.ts
var SESSION_STORAGE_KEY = "jarvis_employee_session";
var ENTERPRISE_DIRECTORY = [
  {
    id: "EMP-10001",
    employeeId: "EMP-10001",
    name: "Tony Stark",
    email: "stark@jarvis.ai",
    password: "Password@2026",
    role: "Chief Technology Architect",
    department: "Advanced Systems Engineering",
    clearanceLevel: "Level 3 - Executive Clearance",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=140&q=80",
    requiresMfa: false
  },
  {
    id: "EMP-10002",
    employeeId: "EMP-10002",
    name: "Pepper Potts",
    email: "pepper@jarvis.ai",
    password: "Password@2026",
    role: "Chief Operating Officer",
    department: "Corporate Governance",
    clearanceLevel: "Level 3 - Executive Clearance",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=140&q=80",
    requiresMfa: true
    // triggers MFA flow in tests and demo
  },
  {
    id: "EMP-10003",
    employeeId: "EMP-10003",
    name: "Bruce Banner",
    email: "banner@jarvis.ai",
    password: "Password@2026",
    role: "Principal Bio-Systems Scientist",
    department: "Applied Physics & Neural R&D",
    clearanceLevel: "Level 2 - Engineering",
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=140&q=80",
    requiresMfa: false
  }
];
var AuthenticationService = class {
  constructor() {
    this._currentUser = signal(null);
    this._isAuthenticated = signal(false);
    this._sessionInfo = signal(null);
    this._pendingMfaIdentifier = signal(null);
    this._isLoading = signal(false);
    this._lastError = signal(null);
    this.currentUser = this._currentUser;
    this.isAuthenticated = this._isAuthenticated;
    this.sessionInfo = this._sessionInfo;
    this.pendingMfaIdentifier = this._pendingMfaIdentifier;
    this.isLoading = this._isLoading;
    this.lastError = this._lastError;
    // Track simulated MFA state and users
    this.pendingMfaUser = null;
    this.users = ENTERPRISE_DIRECTORY.map((u) => ({ ...u }));
    this.restoreSession();
  }
  restoreSession() {
    try {
      let raw = null;
      if (typeof localStorage !== "undefined") {
        raw = localStorage.getItem(SESSION_STORAGE_KEY);
      }
      if (!raw && typeof sessionStorage !== "undefined") {
        raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      }
      if (raw) {
        const session = JSON.parse(raw);
        if (session && session.user && session.token) {
          this._sessionInfo.set(session);
          this._currentUser.set(session.user);
          this._isAuthenticated.set(true);
          return true;
        }
      }
    } catch (err) {
      console.warn("[AuthenticationService] Failed to parse cached session:", err);
      this.clearSession();
    }
    this._sessionInfo.set(null);
    this._currentUser.set(null);
    this._isAuthenticated.set(false);
    return false;
  }
  async login(identifier, pass, rememberMe) {
    if (this._isLoading()) {
      return { success: false, message: "Authentication is already in progress." };
    }
    this._isLoading.set(true);
    this._lastError.set(null);
    await new Promise((resolve) => setTimeout(resolve, 350));
    try {
      const cleanId = identifier.trim().toLowerCase();
      const matched = this.users.find(
        (u) => (u.email.toLowerCase() === cleanId || u.employeeId.toLowerCase() === cleanId) && u.password === pass
      );
      if (!matched) {
        const failureMsg = "Invalid credentials. Please verify your employee ID or corporate email and password.";
        this._lastError.set(failureMsg);
        this._isLoading.set(false);
        return { success: false, message: failureMsg };
      }
      if (matched.requiresMfa) {
        this.pendingMfaUser = matched;
        this._pendingMfaIdentifier.set(matched.email);
        this._isLoading.set(false);
        return {
          success: true,
          requiresMfa: true,
          mfaMethod: "authenticator",
          user: this.toSafeUser(matched)
        };
      }
      const safeUser = this.toSafeUser(matched);
      this.createSession(safeUser, rememberMe);
      this._isLoading.set(false);
      return { success: true, user: safeUser };
    } catch (err) {
      this._isLoading.set(false);
      const msg = err?.message || "A network error occurred while connecting to identity gateway.";
      this._lastError.set(msg);
      return { success: false, message: msg };
    }
  }
  async verifyMfa(code) {
    if (this._isLoading()) {
      return { success: false, message: "Verification already in progress." };
    }
    this._isLoading.set(true);
    this._lastError.set(null);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const cleanCode = code.replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      this._isLoading.set(false);
      const msg = "Please enter a valid 6-digit verification code.";
      this._lastError.set(msg);
      return { success: false, message: msg };
    }
    if (cleanCode === "000000") {
      this._isLoading.set(false);
      const msg = "Verification code has expired or is invalid. Please request a new code.";
      this._lastError.set(msg);
      return { success: false, message: msg };
    }
    if (!this.pendingMfaUser) {
      this.pendingMfaUser = this.users[0];
    }
    const safeUser = this.toSafeUser(this.pendingMfaUser);
    this.createSession(safeUser, true);
    this.pendingMfaUser = null;
    this._pendingMfaIdentifier.set(null);
    this._isLoading.set(false);
    return { success: true };
  }
  async requestPasswordReset(identifier) {
    if (this._isLoading()) {
      return { success: false, message: "Request in progress." };
    }
    this._isLoading.set(true);
    this._lastError.set(null);
    await new Promise((resolve) => setTimeout(resolve, 350));
    this._isLoading.set(false);
    return {
      success: true,
      message: "If an employee account matches the provided identifier, instructions and a secure recovery link have been dispatched to the registered address."
    };
  }
  async resetPassword(newPassword, _token) {
    if (this._isLoading()) {
      return { success: false, message: "Update in progress." };
    }
    const policy = this.validatePasswordPolicy(newPassword);
    if (!policy.minLength || !policy.hasUppercase || !policy.hasNumber || !policy.hasSpecialChar) {
      return {
        success: false,
        message: "The requested password does not meet enterprise security complexity requirements."
      };
    }
    this._isLoading.set(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const target = this._currentUser() || this.pendingMfaUser || this.users[0];
    const userInDb = this.users.find((u) => u.id === target.id);
    if (userInDb) {
      userInDb.password = newPassword;
    }
    this._isLoading.set(false);
    return {
      success: true,
      message: "Your password has been securely updated. You may now sign in with your new credentials."
    };
  }
  logout() {
    this.clearSession();
  }
  clearSession() {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
    this._sessionInfo.set(null);
    this._currentUser.set(null);
    this._isAuthenticated.set(false);
    this.pendingMfaUser = null;
    this._pendingMfaIdentifier.set(null);
    this.users = ENTERPRISE_DIRECTORY.map((u) => ({ ...u }));
  }
  validatePasswordPolicy(password, confirmPassword) {
    const minLength = (password || "").length >= 8;
    const hasUppercase = /[A-Z]/.test(password || "");
    const hasLowercase = /[a-z]/.test(password || "");
    const hasNumber = /[0-9]/.test(password || "");
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password || "");
    const passwordsMatch = confirmPassword !== void 0 ? password === confirmPassword : true;
    return {
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar,
      passwordsMatch
    };
  }
  toSafeUser(user) {
    const { password: _, ...safe } = user;
    return safe;
  }
  createSession(user, rememberMe) {
    const session = {
      token: "jwt-jarvis-" + Math.random().toString(36).substring(2, 12) + "." + Date.now(),
      user,
      loginTime: (/* @__PURE__ */ new Date()).toISOString(),
      rememberMe,
      deviceFingerprint: "DEV-" + Math.random().toString(36).substring(2, 8).toUpperCase()
    };
    if (rememberMe && typeof localStorage !== "undefined") {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
    this._sessionInfo.set(session);
    this._currentUser.set(user);
    this._isAuthenticated.set(true);
  }
};

// examples/07-employee-portal/src/features/authentication/services/organization-config.service.ts
var OrganizationConfigService = class {
  constructor(initialConfig) {
    this._config = signal(DEFAULT_ORGANIZATION_CONFIG);
    this.config = this._config;
    if (initialConfig) {
      this.updateConfig(initialConfig);
    }
  }
  updateConfig(partial) {
    this._config.set({
      ...this._config(),
      ...partial
    });
  }
  get organizationName() {
    return this._config().organizationName;
  }
  get portalTitle() {
    return this._config().portalTitle;
  }
  get identifierLabel() {
    return this._config().identifierLabel;
  }
};

// examples/07-employee-portal/src/features/authentication/components/auth-page-header/auth-page-header.component.ts
var AuthPageHeaderComponent = class {
  constructor() {
    this.badge = input("SECURE IDENTITY GATEWAY");
    this.title = input("Welcome back");
    this.subtitle = input("Access your employee workspace.");
    this.icon = input("pi pi-shield");
  }
  render(r) {
    const root = r.createElement("header");
    r.setAttribute(root, "class", "auth-header-container");
    const badgeEl = r.createElement("div");
    r.setAttribute(badgeEl, "class", "auth-badge");
    const iconEl = r.createElement("i");
    r.setAttribute(iconEl, "class", this.icon());
    const badgeText = r.createElement("span");
    r.bindText(badgeText, () => this.badge());
    r.appendChild(badgeEl, iconEl);
    r.appendChild(badgeEl, badgeText);
    r.appendChild(root, badgeEl);
    const titleEl = r.createElement("h1");
    r.setAttribute(titleEl, "class", "auth-title");
    r.bindText(titleEl, () => this.title());
    r.appendChild(root, titleEl);
    const subEl = r.createElement("p");
    r.setAttribute(subEl, "class", "auth-subtitle");
    r.bindText(subEl, () => this.subtitle());
    r.appendChild(root, subEl);
    return root;
  }
};
Component({
  selector: "jarvis-auth-page-header",
  templateUrl: "./auth-page-header.component.html",
  styleUrl: "./auth-page-header.component.css"
})(AuthPageHeaderComponent);

// examples/07-employee-portal/src/features/authentication/pages/employee-login/employee-login.page.ts
var EmployeeLoginPage = class {
  constructor(authService, orgConfig) {
    // Reactive Form State Signals
    this.identifier = signal("stark@jarvis.ai");
    this.password = signal("Password@2026");
    this.showPassword = signal(false);
    this.rememberMe = signal(true);
    // Validation & Feedback Signals
    this.identifierTouched = signal(false);
    this.passwordTouched = signal(false);
    this.failedAttempts = signal(0);
    this.isShaking = signal(false);
    this.identifierError = signal(null);
    this.passwordError = signal(null);
    this.formError = signal(null);
    this.formSuccess = signal(null);
    this.helpModalVisible = signal(false);
    // Quick Directory Presets
    this.directoryUsers = ENTERPRISE_DIRECTORY;
    this.cleanupFns = [];
    this.authService = authService || new AuthenticationService();
    this.orgConfig = orgConfig || new OrganizationConfigService();
  }
  onInit() {
    if (this.authService.isAuthenticated()) {
      const user = this.authService.currentUser();
      this.formSuccess.set(`Active workspace session restored for ${user?.name || "Employee"}.`);
    }
  }
  togglePasswordVisibility() {
    this.showPassword.set(!this.showPassword());
  }
  validateIdentifier() {
    const val = this.identifier().trim();
    if (!val) {
      this.identifierError.set("Employee ID or corporate email is required.");
      return false;
    }
    if (val.length < 3) {
      this.identifierError.set("Identifier must be at least 3 characters.");
      return false;
    }
    if (val.includes("@") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      this.identifierError.set("Please enter a valid corporate email format (e.g. user@jarvis.ai).");
      return false;
    }
    this.identifierError.set(null);
    return true;
  }
  validatePassword() {
    const val = this.password();
    if (!val) {
      this.passwordError.set("Password is required.");
      return false;
    }
    if (val.length < 6) {
      this.passwordError.set("Password must be at least 6 characters.");
      return false;
    }
    this.passwordError.set(null);
    return true;
  }
  triggerShake() {
    this.isShaking.set(true);
    setTimeout(() => this.isShaking.set(false), 450);
  }
  fillQuickUser(user) {
    this.identifier.set(user.email);
    this.password.set(user.password);
    this.identifierTouched.set(true);
    this.passwordTouched.set(true);
    this.identifierError.set(null);
    this.passwordError.set(null);
    this.formError.set(null);
  }
  async handleSignIn() {
    if (this.authService.isLoading()) {
      return false;
    }
    this.identifierTouched.set(true);
    this.passwordTouched.set(true);
    this.formError.set(null);
    this.formSuccess.set(null);
    const isIdValid = this.validateIdentifier();
    const isPassValid = this.validatePassword();
    if (!isIdValid || !isPassValid) {
      this.formError.set("Please resolve the highlighted field errors to proceed.");
      this.triggerShake();
      return false;
    }
    const idVal = this.identifier().trim();
    const passVal = this.password();
    const result = await this.authService.login(idVal, passVal, this.rememberMe());
    if (result.success) {
      this.failedAttempts.set(0);
      if (result.requiresMfa) {
        this.formSuccess.set("Primary authentication verified. Redirecting to Multi-Factor Verification...");
        if (this.router) {
          setTimeout(() => this.router?.navigate(["verify-identity"]), 400);
        }
        return true;
      }
      this.formSuccess.set(`Access authorized. Welcome, ${result.user?.name}!`);
      if (this.router) {
        setTimeout(() => this.router?.navigate(["dashboard"]), 450);
      }
      return true;
    } else {
      this.failedAttempts.update((n) => n + 1);
      const attempts = this.failedAttempts();
      if (attempts >= 2) {
        this.formError.set(`${result.message || "Authentication failed"}. Attempt ${attempts} of 5. Consecutive failures will trigger security suspension.`);
      } else {
        this.formError.set(result.message || "Authentication failed. Please verify credentials.");
      }
      this.identifierError.set("Invalid credentials.");
      this.passwordError.set("Invalid credentials.");
      this.triggerShake();
      return false;
    }
  }
  async handleSsoSignIn() {
    if (this.authService.isLoading()) return;
    this.formError.set(null);
    this.formSuccess.set("Initiating federated SAML handshake with Enterprise Identity Provider...");
    setTimeout(async () => {
      await this.authService.login("stark@jarvis.ai", "Password@2026", this.rememberMe());
      if (this.router) {
        this.router.navigate(["workspace"]);
      }
    }, 600);
  }
  openHelpModal() {
    this.helpModalVisible.set(true);
  }
  closeHelpModal() {
    this.helpModalVisible.set(false);
  }
  navigateToForgotPassword() {
    if (this.router) {
      this.router.navigate(["forgot-password"]);
    }
  }
  render(r) {
    const root = r.createElement("section");
    r.setAttribute(root, "class", "employee-login-screen");
    r.setAttribute(root, "aria-labelledby", "auth-heading");
    const headerComponent = new AuthPageHeaderComponent();
    headerComponent.title.set("Welcome back");
    headerComponent.subtitle.set("Access your employee workspace.");
    headerComponent.badge.set("SECURE IDENTITY GATEWAY");
    const headerNode = headerComponent.render(r);
    r.appendChild(root, headerNode);
    const presetsBox = r.createElement("div");
    r.setAttribute(presetsBox, "class", "quick-presets-container");
    const presetsLabel = r.createElement("span");
    r.setAttribute(presetsLabel, "class", "presets-label");
    presetsLabel.textContent = "1-Click Employee Profiles:";
    r.appendChild(presetsBox, presetsLabel);
    const presetGrid = r.createElement("div");
    r.setAttribute(presetGrid, "class", "preset-grid");
    for (const u of this.directoryUsers) {
      const pBtn = r.createElement("button");
      r.setAttribute(pBtn, "type", "button");
      r.setAttribute(pBtn, "class", "preset-chip");
      const mfaTag = u.requiresMfa ? '<span class="mfa-chip">MFA</span>' : "";
      pBtn.innerHTML = `
        <div class="preset-name">${u.name} ${mfaTag}</div>
        <div class="preset-dept">${u.department}</div>
      `;
      r.listen(pBtn, "click", () => this.fillQuickUser(u));
      r.appendChild(presetGrid, pBtn);
    }
    r.appendChild(presetsBox, presetGrid);
    r.appendChild(root, presetsBox);
    const alertBox = r.createElement("div");
    r.setAttribute(alertBox, "role", "status");
    r.setAttribute(alertBox, "aria-live", "polite");
    const alertSub = effect(() => {
      const err = this.formError();
      const succ = this.formSuccess();
      if (err) {
        r.setAttribute(alertBox, "class", "jarvis-alert-banner jarvis-alert-banner--danger");
        alertBox.innerHTML = `<i class="pi pi-exclamation-triangle" aria-hidden="true"></i> <span>${err}</span>`;
      } else if (succ) {
        r.setAttribute(alertBox, "class", "jarvis-alert-banner jarvis-alert-banner--success");
        alertBox.innerHTML = `<i class="pi pi-check-circle" aria-hidden="true"></i> <span>${succ}</span>`;
      } else {
        r.setAttribute(alertBox, "class", "jarvis-sr-only");
        alertBox.innerHTML = "";
      }
    });
    this.cleanupFns.push(alertSub);
    r.appendChild(root, alertBox);
    const form = r.createElement("form");
    r.setAttribute(form, "id", "employee-login-form");
    r.setAttribute(form, "novalidate", "true");
    r.listen(form, "submit", (e) => {
      e.preventDefault();
      this.handleSignIn();
    });
    const shakeSub = effect(() => {
      const shaking = this.isShaking();
      r.setAttribute(form, "class", shaking ? "jarvis-form--shake" : "");
    });
    this.cleanupFns.push(shakeSub);
    const lockoutNotice = r.createElement("div");
    r.setAttribute(lockoutNotice, "class", "jarvis-sr-only");
    const lockoutSub = effect(() => {
      const attempts = this.failedAttempts();
      if (attempts >= 2) {
        r.setAttribute(lockoutNotice, "class", "auth-lockout-notice");
        lockoutNotice.innerHTML = `
          <i class="pi pi-shield text-amber-600"></i>
          <span>Security Alert: Account will freeze after 5 failed attempts (${attempts}/5 used).</span>
        `;
      } else {
        r.setAttribute(lockoutNotice, "class", "jarvis-sr-only");
        lockoutNotice.innerHTML = "";
      }
    });
    this.cleanupFns.push(lockoutSub);
    r.appendChild(form, lockoutNotice);
    const idGroup = r.createElement("div");
    r.setAttribute(idGroup, "class", "jarvis-form-group");
    const idLabel = r.createElement("label");
    r.setAttribute(idLabel, "class", "jarvis-form-label");
    r.setAttribute(idLabel, "for", "employee-identifier-input");
    idLabel.textContent = this.orgConfig.identifierLabel;
    r.appendChild(idGroup, idLabel);
    const idInput = new JarvisInputText(r, {
      value: this.identifier,
      placeholder: this.orgConfig.config().identifierPlaceholder,
      invalid: () => Boolean(this.identifierError())
    });
    r.setAttribute(idInput.getElement(), "id", "employee-identifier-input");
    r.setAttribute(idInput.getElement(), "autocomplete", "username");
    r.setAttribute(idInput.getElement(), "aria-required", "true");
    r.setAttribute(idInput.getElement(), "aria-describedby", "id-error-desc");
    idInput.valueChange.subscribe((v) => {
      this.identifier.set(v);
      if (this.identifierError()) this.identifierError.set(null);
    });
    idInput.blur.subscribe(() => {
      this.identifierTouched.set(true);
      if (this.identifierTouched()) this.validateIdentifier();
    });
    r.appendChild(idGroup, idInput.getElement());
    const idErrorEl = r.createElement("div");
    r.setAttribute(idErrorEl, "id", "id-error-desc");
    r.setAttribute(idErrorEl, "class", "jarvis-sr-only");
    r.setAttribute(idErrorEl, "role", "alert");
    const idErrSub = effect(() => {
      const err = this.identifierError();
      if (err) {
        r.setAttribute(idErrorEl, "class", "jarvis-form-error");
        idErrorEl.innerHTML = `<i class="pi pi-exclamation-circle"></i> <span>${err}</span>`;
      } else {
        r.setAttribute(idErrorEl, "class", "jarvis-sr-only");
        idErrorEl.innerHTML = "";
      }
    });
    this.cleanupFns.push(idErrSub);
    r.appendChild(idGroup, idErrorEl);
    r.appendChild(form, idGroup);
    const passGroup = r.createElement("div");
    r.setAttribute(passGroup, "class", "jarvis-form-group");
    const passLabel = r.createElement("label");
    r.setAttribute(passLabel, "class", "jarvis-form-label");
    r.setAttribute(passLabel, "for", "employee-password-input");
    passLabel.textContent = "Security Password";
    r.appendChild(passGroup, passLabel);
    const passWrapper = r.createElement("div");
    r.setAttribute(passWrapper, "class", "jarvis-password-wrapper");
    const passInput = new JarvisInputText(r, {
      value: this.password,
      placeholder: "Enter your password",
      type: "password",
      invalid: () => Boolean(this.passwordError())
    });
    r.setAttribute(passInput.getElement(), "id", "employee-password-input");
    r.setAttribute(passInput.getElement(), "autocomplete", "current-password");
    r.setAttribute(passInput.getElement(), "aria-required", "true");
    r.setAttribute(passInput.getElement(), "aria-describedby", "pass-error-desc");
    passInput.valueChange.subscribe((v) => {
      this.password.set(v);
      if (this.passwordError()) this.passwordError.set(null);
    });
    passInput.blur.subscribe(() => {
      this.passwordTouched.set(true);
      if (this.passwordTouched()) this.validatePassword();
    });
    r.appendChild(passWrapper, passInput.getElement());
    const toggleBtn = r.createElement("button");
    r.setAttribute(toggleBtn, "type", "button");
    r.setAttribute(toggleBtn, "class", "jarvis-password-toggle");
    r.setAttribute(toggleBtn, "aria-label", "Toggle password visibility");
    const passToggleSub = effect(() => {
      const isVisible = this.showPassword();
      const inputEl = passInput.getElement();
      r.setAttribute(inputEl, "type", isVisible ? "text" : "password");
      toggleBtn.innerHTML = isVisible ? '<i class="pi pi-eye-slash" aria-hidden="true"></i> <span>Hide</span>' : '<i class="pi pi-eye" aria-hidden="true"></i> <span>Show</span>';
    });
    this.cleanupFns.push(passToggleSub);
    r.listen(toggleBtn, "click", () => this.togglePasswordVisibility());
    r.appendChild(passWrapper, toggleBtn);
    r.appendChild(passGroup, passWrapper);
    const passErrorEl = r.createElement("div");
    r.setAttribute(passErrorEl, "id", "pass-error-desc");
    r.setAttribute(passErrorEl, "class", "jarvis-sr-only");
    r.setAttribute(passErrorEl, "role", "alert");
    const passErrSub = effect(() => {
      const err = this.passwordError();
      if (err) {
        r.setAttribute(passErrorEl, "class", "jarvis-form-error");
        passErrorEl.innerHTML = `<i class="pi pi-exclamation-circle"></i> <span>${err}</span>`;
      } else {
        r.setAttribute(passErrorEl, "class", "jarvis-sr-only");
        passErrorEl.innerHTML = "";
      }
    });
    this.cleanupFns.push(passErrSub);
    r.appendChild(passGroup, passErrorEl);
    r.appendChild(form, passGroup);
    const auxRow = r.createElement("div");
    r.setAttribute(auxRow, "class", "auth-aux-row");
    const rememberCheckbox = new JarvisCheckbox(r, {
      label: "Remember this device",
      checked: this.rememberMe
    });
    rememberCheckbox.checkedChange.subscribe((val) => this.rememberMe.set(val));
    r.appendChild(auxRow, rememberCheckbox.getElement());
    const forgotBtn = r.createElement("button");
    r.setAttribute(forgotBtn, "type", "button");
    r.setAttribute(forgotBtn, "class", "forgot-password-link");
    forgotBtn.textContent = "Forgot password?";
    r.listen(forgotBtn, "click", () => this.navigateToForgotPassword());
    r.appendChild(auxRow, forgotBtn);
    r.appendChild(form, auxRow);
    const submitBtn = new JarvisButton(r, {
      label: "Sign In to Workspace",
      icon: "pi pi-arrow-right",
      severity: "primary",
      loading: this.authService.isLoading,
      disabled: this.authService.isLoading,
      class: "w-full submit-button-primary"
    });
    r.setAttribute(submitBtn.getElement(), "id", "btn-sign-in");
    submitBtn.clicked.subscribe(() => this.handleSignIn());
    r.appendChild(form, submitBtn.getElement());
    const divider = r.createElement("div");
    r.setAttribute(divider, "class", "jarvis-divider");
    divider.textContent = "OR SECURE SSO";
    r.appendChild(form, divider);
    if (this.orgConfig.config().ssoEnabled) {
      const ssoBtn = new JarvisButton(r, {
        label: this.orgConfig.config().ssoProviderName,
        icon: "pi pi-id-card",
        variant: "outlined",
        disabled: this.authService.isLoading,
        class: "w-full sso-button"
      });
      r.setAttribute(ssoBtn.getElement(), "id", "btn-sso");
      ssoBtn.clicked.subscribe(() => this.handleSsoSignIn());
      r.appendChild(form, ssoBtn.getElement());
    }
    r.appendChild(root, form);
    const footerNav = r.createElement("footer");
    r.setAttribute(footerNav, "class", "auth-footer-nav");
    const helpBtn = r.createElement("button");
    r.setAttribute(helpBtn, "type", "button");
    r.setAttribute(helpBtn, "class", "auth-footer-link help-link");
    helpBtn.innerHTML = '<i class="pi pi-question-circle"></i> <span>Need help signing in?</span>';
    r.listen(helpBtn, "click", () => this.openHelpModal());
    r.appendChild(footerNav, helpBtn);
    const legalLinks = r.createElement("div");
    r.setAttribute(legalLinks, "class", "legal-links");
    legalLinks.innerHTML = `
      <a href="${this.orgConfig.config().privacyPolicyUrl}" target="_blank" rel="noopener" class="auth-footer-link">Privacy Policy</a>
      <span class="bullet" aria-hidden="true">\xB7</span>
      <a href="${this.orgConfig.config().termsOfServiceUrl}" target="_blank" rel="noopener" class="auth-footer-link">Terms</a>
      <span class="bullet" aria-hidden="true">\xB7</span>
      <span class="auth-compliance-tag">${this.orgConfig.config().version}</span>
    `;
    r.appendChild(footerNav, legalLinks);
    r.appendChild(root, footerNav);
    const dialog = new JarvisDialog(r, {
      header: "Enterprise Access & Support",
      visible: this.helpModalVisible,
      width: "420px",
      modal: true,
      closable: true
    });
    dialog.visibleChange.subscribe((v) => this.helpModalVisible.set(v));
    const dialogContent = r.createElement("div");
    r.setAttribute(dialogContent, "class", "space-y-4 text-xs");
    dialogContent.innerHTML = `
      <p class="text-slate-600 leading-relaxed">
        If you encounter difficulties accessing your JARVIS employee workspace, please verify that your security token is active or contact your organization identity administrator.
      </p>
      <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
        <div class="font-semibold text-slate-800">Support Desk Contacts</div>
        <div>Email: <a href="mailto:${this.orgConfig.config().supportEmail}" class="text-emerald-600 font-medium">${this.orgConfig.config().supportEmail}</a></div>
        <div>Phone: <span class="font-mono text-slate-700">${this.orgConfig.config().supportPhone}</span></div>
      </div>
      <p class="text-slate-500 text-[11px]">
        Reference Ticket ID: <span class="font-mono text-slate-700">JARVIS-SEC-${Math.floor(1e3 + Math.random() * 9e3)}</span>
      </p>
    `;
    r.appendChild(dialog.getElement(), dialogContent);
    r.appendChild(root, dialog.getElement());
    return root;
  }
  onDestroy() {
    for (const cleanup of this.cleanupFns) {
      try {
        if (typeof cleanup === "function") {
          cleanup();
        } else if (cleanup && typeof cleanup.destroy === "function") {
          cleanup.destroy();
        }
      } catch (e) {
        console.error("[EmployeeLoginPage] Cleanup error:", e);
      }
    }
    this.cleanupFns = [];
  }
};
Component({
  selector: "app-employee-login-page",
  templateUrl: "./employee-login.page.html",
  styleUrl: "./employee-login.page.css"
})(EmployeeLoginPage);

// examples/07-employee-portal/src/features/authentication/pages/forgot-password/forgot-password.page.ts
var ForgotPasswordPage = class {
  constructor(authService, orgConfig) {
    this.identifier = signal("");
    this.identifierError = signal(null);
    this.statusMessage = signal(null);
    this.isSubmitted = signal(false);
    this.cleanupFns = [];
    this.authService = authService || new AuthenticationService();
    this.orgConfig = orgConfig || new OrganizationConfigService();
  }
  onInit() {
  }
  async handleRequestReset() {
    if (this.authService.isLoading()) return false;
    this.identifierError.set(null);
    this.statusMessage.set(null);
    const idVal = this.identifier().trim();
    if (!idVal) {
      this.identifierError.set("Employee identifier is required to dispatch instructions.");
      return false;
    }
    const result = await this.authService.requestPasswordReset(idVal);
    this.isSubmitted.set(true);
    this.statusMessage.set(result.message);
    return true;
  }
  navigateToLogin() {
    if (this.router) {
      this.router.navigate(["login"]);
    }
  }
  render(r) {
    const root = r.createElement("section");
    r.setAttribute(root, "class", "forgot-password-screen");
    r.setAttribute(root, "aria-labelledby", "forgot-password-heading");
    const header = new AuthPageHeaderComponent();
    header.title.set("Reset your password");
    header.subtitle.set("Self-service identity verification and credential recovery.");
    header.badge.set("CREDENTIAL RECOVERY");
    header.icon.set("pi pi-key");
    r.appendChild(root, header.render(r));
    const infoCallout = r.createElement("div");
    r.setAttribute(infoCallout, "class", "jarvis-alert-banner jarvis-alert-banner--info");
    infoCallout.innerHTML = `
      <i class="pi pi-info-circle" aria-hidden="true"></i>
      <span>Enter your corporate email or employee ID. A secure cryptographic reset link will be dispatched if the account is active.</span>
    `;
    r.appendChild(root, infoCallout);
    const form = r.createElement("form");
    r.setAttribute(form, "novalidate", "true");
    r.listen(form, "submit", (e) => {
      e.preventDefault();
      this.handleRequestReset();
    });
    const formGroup = r.createElement("div");
    r.setAttribute(formGroup, "class", "jarvis-form-group");
    const label = r.createElement("label");
    r.setAttribute(label, "class", "jarvis-form-label");
    r.setAttribute(label, "for", "recovery-identifier-input");
    label.textContent = this.orgConfig.identifierLabel;
    r.appendChild(formGroup, label);
    const input2 = new JarvisInputText(r, {
      value: this.identifier,
      placeholder: "e.g. stark@jarvis.ai",
      invalid: () => Boolean(this.identifierError())
    });
    r.setAttribute(input2.getElement(), "id", "recovery-identifier-input");
    r.setAttribute(input2.getElement(), "autocomplete", "email");
    input2.valueChange.subscribe((v) => {
      this.identifier.set(v);
      if (this.identifierError()) this.identifierError.set(null);
    });
    r.appendChild(formGroup, input2.getElement());
    const errorEl = r.createElement("div");
    r.setAttribute(errorEl, "class", "jarvis-sr-only");
    const errSub = effect(() => {
      const err = this.identifierError();
      if (err) {
        r.setAttribute(errorEl, "class", "jarvis-form-error");
        errorEl.innerHTML = `<i class="pi pi-exclamation-circle"></i> <span>${err}</span>`;
      } else {
        r.setAttribute(errorEl, "class", "jarvis-sr-only");
        errorEl.innerHTML = "";
      }
    });
    this.cleanupFns.push(errSub);
    r.appendChild(formGroup, errorEl);
    r.appendChild(form, formGroup);
    const statusBox = r.createElement("div");
    const statusSub = effect(() => {
      const msg = this.statusMessage();
      if (msg) {
        r.setAttribute(statusBox, "class", "jarvis-alert-banner jarvis-alert-banner--success mt-4");
        statusBox.innerHTML = `<i class="pi pi-check-circle" aria-hidden="true"></i> <span>${msg}</span>`;
      } else {
        r.setAttribute(statusBox, "class", "jarvis-sr-only");
        statusBox.innerHTML = "";
      }
    });
    this.cleanupFns.push(statusSub);
    r.appendChild(form, statusBox);
    const submitBtn = new JarvisButton(r, {
      label: "Dispatch Recovery Link",
      icon: "pi pi-send",
      severity: "primary",
      loading: this.authService.isLoading,
      class: "w-full submit-button-primary mt-2"
    });
    submitBtn.clicked.subscribe(() => this.handleRequestReset());
    r.appendChild(form, submitBtn.getElement());
    const backBtn = new JarvisButton(r, {
      label: "Back to Sign In",
      icon: "pi pi-arrow-left",
      variant: "text",
      class: "w-full mt-3 text-slate-600"
    });
    backBtn.clicked.subscribe(() => this.navigateToLogin());
    r.appendChild(form, backBtn.getElement());
    r.appendChild(root, form);
    return root;
  }
  onDestroy() {
    for (const cleanup of this.cleanupFns) {
      try {
        cleanup();
      } catch (e) {
        console.error("[ForgotPasswordPage] Cleanup error:", e);
      }
    }
    this.cleanupFns = [];
  }
};
Component({
  selector: "app-forgot-password-page",
  templateUrl: "./forgot-password.page.html",
  styleUrl: "./forgot-password.page.css"
})(ForgotPasswordPage);

// examples/07-employee-portal/src/features/authentication/pages/verify-identity/verify-identity.page.ts
var VerifyIdentityPage = class {
  constructor(authService) {
    this.mfaCode = signal("849201");
    this.codeError = signal(null);
    this.statusError = signal(null);
    this.statusSuccess = signal(null);
    this.remainingAttempts = signal(3);
    this.resendCountdown = signal(30);
    this.timerId = null;
    this.cleanupFns = [];
    this.authService = authService || new AuthenticationService();
  }
  onInit() {
    this.startResendTimer();
  }
  startResendTimer() {
    if (this.timerId) clearInterval(this.timerId);
    this.resendCountdown.set(30);
    this.timerId = setInterval(() => {
      if (this.resendCountdown() > 0) {
        this.resendCountdown.set(this.resendCountdown() - 1);
      } else {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    }, 1e3);
  }
  resendCode() {
    if (this.resendCountdown() > 0) return;
    this.mfaCode.set("849201");
    this.statusError.set(null);
    this.statusSuccess.set("New cryptographic verification code dispatched to authenticator.");
    this.startResendTimer();
  }
  async handleVerify() {
    if (this.authService.isLoading()) return false;
    this.codeError.set(null);
    this.statusError.set(null);
    const code = this.mfaCode().trim();
    if (!code || code.length !== 6) {
      this.codeError.set("A 6-digit verification code is required.");
      return false;
    }
    if (this.remainingAttempts() <= 1 && code === "000000") {
      this.remainingAttempts.set(0);
      this.statusError.set("Maximum verification attempts exceeded. Identity challenge locked.");
      return false;
    }
    const result = await this.authService.verifyMfa(code);
    if (result.success) {
      this.statusSuccess.set("Identity verified. Authorizing enterprise workspace...");
      if (this.router) {
        setTimeout(() => this.router?.navigate(["workspace"]), 450);
      }
      return true;
    } else {
      this.remainingAttempts.set(Math.max(0, this.remainingAttempts() - 1));
      this.statusError.set(
        `${result.message || "Invalid code."} (${this.remainingAttempts()} attempts remaining)`
      );
      return false;
    }
  }
  navigateToLogin() {
    if (this.router) {
      this.router.navigate(["login"]);
    }
  }
  render(r) {
    const root = r.createElement("section");
    r.setAttribute(root, "class", "verify-identity-screen");
    r.setAttribute(root, "aria-labelledby", "mfa-heading");
    const header = new AuthPageHeaderComponent();
    header.title.set("Verify your identity");
    header.subtitle.set("A 6-digit verification code has been dispatched to your authenticator app.");
    header.badge.set("TWO-FACTOR CHALLENGE");
    header.icon.set("pi pi-shield");
    r.appendChild(root, header.render(r));
    const notice = r.createElement("div");
    r.setAttribute(notice, "class", "jarvis-alert-banner jarvis-alert-banner--info");
    notice.innerHTML = `
      <i class="pi pi-mobile" aria-hidden="true"></i>
      <span>Target Identifier: <strong class="font-mono text-emerald-800">${this.authService.pendingMfaIdentifier() || "pepper@jarvis.ai"}</strong> (Mock Code: <strong>849201</strong>)</span>
    `;
    r.appendChild(root, notice);
    const form = r.createElement("form");
    r.setAttribute(form, "novalidate", "true");
    r.listen(form, "submit", (e) => {
      e.preventDefault();
      this.handleVerify();
    });
    const formGroup = r.createElement("div");
    r.setAttribute(formGroup, "class", "jarvis-form-group");
    const label = r.createElement("label");
    r.setAttribute(label, "class", "jarvis-form-label");
    r.setAttribute(label, "for", "mfa-code-input");
    label.textContent = "6-Digit Verification Code";
    r.appendChild(formGroup, label);
    const input2 = new JarvisInputText(r, {
      value: this.mfaCode,
      placeholder: "849201",
      invalid: () => Boolean(this.codeError()),
      class: "text-center font-mono tracking-widest text-lg font-bold"
    });
    r.setAttribute(input2.getElement(), "id", "mfa-code-input");
    r.setAttribute(input2.getElement(), "maxlength", "6");
    r.setAttribute(input2.getElement(), "autocomplete", "one-time-code");
    input2.valueChange.subscribe((v) => {
      this.mfaCode.set(v.replace(/\D/g, ""));
      if (this.codeError()) this.codeError.set(null);
    });
    r.appendChild(formGroup, input2.getElement());
    const errorEl = r.createElement("div");
    r.setAttribute(errorEl, "class", "jarvis-sr-only");
    const errSub = effect(() => {
      const err = this.codeError();
      if (err) {
        r.setAttribute(errorEl, "class", "jarvis-form-error");
        errorEl.innerHTML = `<i class="pi pi-exclamation-circle"></i> <span>${err}</span>`;
      } else {
        r.setAttribute(errorEl, "class", "jarvis-sr-only");
        errorEl.innerHTML = "";
      }
    });
    this.cleanupFns.push(errSub);
    r.appendChild(formGroup, errorEl);
    r.appendChild(form, formGroup);
    const statusBox = r.createElement("div");
    const statusSub = effect(() => {
      const err = this.statusError();
      const succ = this.statusSuccess();
      if (err) {
        r.setAttribute(statusBox, "class", "jarvis-alert-banner jarvis-alert-banner--danger");
        statusBox.innerHTML = `<i class="pi pi-exclamation-triangle"></i> <span>${err}</span>`;
      } else if (succ) {
        r.setAttribute(statusBox, "class", "jarvis-alert-banner jarvis-alert-banner--success");
        statusBox.innerHTML = `<i class="pi pi-check-circle"></i> <span>${succ}</span>`;
      } else {
        r.setAttribute(statusBox, "class", "jarvis-sr-only");
        statusBox.innerHTML = "";
      }
    });
    this.cleanupFns.push(statusSub);
    r.appendChild(form, statusBox);
    const timerRow = r.createElement("div");
    r.setAttribute(timerRow, "class", "mfa-timer-row");
    const timerText = r.createElement("span");
    r.setAttribute(timerText, "class", "text-xs text-slate-500");
    const timerSub = effect(() => {
      const remaining = this.resendCountdown();
      if (remaining > 0) {
        timerText.textContent = `Resend code in ${remaining}s`;
      } else {
        timerText.textContent = `Code expired. You can resend now.`;
      }
    });
    this.cleanupFns.push(timerSub);
    r.appendChild(timerRow, timerText);
    const resendBtn = r.createElement("button");
    r.setAttribute(resendBtn, "type", "button");
    r.setAttribute(resendBtn, "class", "text-xs text-emerald-600 font-semibold hover:underline disabled:opacity-50 disabled:no-underline");
    const resendSub = effect(() => {
      resendBtn.disabled = this.resendCountdown() > 0;
      resendBtn.textContent = "Resend Code";
    });
    this.cleanupFns.push(resendSub);
    r.listen(resendBtn, "click", () => this.resendCode());
    r.appendChild(timerRow, resendBtn);
    r.appendChild(form, timerRow);
    const verifyBtn = new JarvisButton(r, {
      label: "Verify & Enter Workspace",
      icon: "pi pi-check",
      severity: "primary",
      loading: this.authService.isLoading,
      disabled: () => this.remainingAttempts() === 0 || this.authService.isLoading(),
      class: "w-full submit-button-primary mt-4"
    });
    verifyBtn.clicked.subscribe(() => this.handleVerify());
    r.appendChild(form, verifyBtn.getElement());
    const backBtn = new JarvisButton(r, {
      label: "Cancel & Return to Login",
      variant: "text",
      class: "w-full mt-3 text-slate-500"
    });
    backBtn.clicked.subscribe(() => this.navigateToLogin());
    r.appendChild(form, backBtn.getElement());
    r.appendChild(root, form);
    return root;
  }
  onDestroy() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    for (const cleanup of this.cleanupFns) {
      try {
        cleanup();
      } catch (e) {
        console.error("[VerifyIdentityPage] Cleanup error:", e);
      }
    }
    this.cleanupFns = [];
  }
};
Component({
  selector: "app-verify-identity-page",
  templateUrl: "./verify-identity.page.html",
  styleUrl: "./verify-identity.page.css"
})(VerifyIdentityPage);

// examples/07-employee-portal/src/features/authentication/pages/reset-password/reset-password.page.ts
var ResetPasswordPage = class {
  constructor(authService) {
    this.newPassword = signal("StarkNew@2026");
    this.confirmPassword = signal("StarkNew@2026");
    this.showPassword = signal(false);
    this.statusError = signal(null);
    this.statusSuccess = signal(null);
    // Reactive Policy Checklist
    this.policyCheck = computed(() => {
      return this.authService.validatePasswordPolicy(this.newPassword(), this.confirmPassword());
    });
    this.isPolicySatisfied = computed(() => {
      const p = this.policyCheck();
      return p.minLength && p.hasUppercase && p.hasLowercase && p.hasNumber && p.hasSpecialChar && p.passwordsMatch;
    });
    this.cleanupFns = [];
    this.authService = authService || new AuthenticationService();
  }
  onInit() {
  }
  togglePasswordVisibility() {
    this.showPassword.set(!this.showPassword());
  }
  async handleReset() {
    if (this.authService.isLoading()) return false;
    this.statusError.set(null);
    this.statusSuccess.set(null);
    if (!this.isPolicySatisfied()) {
      this.statusError.set("Please fulfill all security requirements before updating your password.");
      return false;
    }
    const result = await this.authService.resetPassword(this.newPassword());
    if (result.success) {
      this.statusSuccess.set(result.message);
      return true;
    } else {
      this.statusError.set(result.message);
      return false;
    }
  }
  navigateToLogin() {
    if (this.router) {
      this.router.navigate(["login"]);
    }
  }
  render(r) {
    const root = r.createElement("section");
    r.setAttribute(root, "class", "reset-password-screen");
    r.setAttribute(root, "aria-labelledby", "reset-heading");
    const header = new AuthPageHeaderComponent();
    header.title.set("Set new password");
    header.subtitle.set("Choose a strong password compliant with corporate security guidelines.");
    header.badge.set("SECURITY CREDENTIALS");
    header.icon.set("pi pi-lock");
    r.appendChild(root, header.render(r));
    const form = r.createElement("form");
    r.setAttribute(form, "novalidate", "true");
    r.listen(form, "submit", (e) => {
      e.preventDefault();
      this.handleReset();
    });
    const passGroup = r.createElement("div");
    r.setAttribute(passGroup, "class", "jarvis-form-group");
    const passLabel = r.createElement("label");
    r.setAttribute(passLabel, "class", "jarvis-form-label");
    r.setAttribute(passLabel, "for", "new-password-input");
    passLabel.textContent = "New Password";
    r.appendChild(passGroup, passLabel);
    const passWrapper = r.createElement("div");
    r.setAttribute(passWrapper, "class", "jarvis-password-wrapper");
    const passInput = new JarvisInputText(r, {
      value: this.newPassword,
      placeholder: "Enter new password",
      type: "password"
    });
    r.setAttribute(passInput.getElement(), "id", "new-password-input");
    passInput.valueChange.subscribe((v) => this.newPassword.set(v));
    r.appendChild(passWrapper, passInput.getElement());
    const toggleBtn = r.createElement("button");
    r.setAttribute(toggleBtn, "type", "button");
    r.setAttribute(toggleBtn, "class", "jarvis-password-toggle");
    r.setAttribute(toggleBtn, "aria-label", "Toggle password visibility");
    const passSub = effect(() => {
      const show = this.showPassword();
      r.setAttribute(passInput.getElement(), "type", show ? "text" : "password");
      toggleBtn.innerHTML = show ? '<i class="pi pi-eye-slash"></i> <span>Hide</span>' : '<i class="pi pi-eye"></i> <span>Show</span>';
    });
    this.cleanupFns.push(passSub);
    r.listen(toggleBtn, "click", () => this.togglePasswordVisibility());
    r.appendChild(passWrapper, toggleBtn);
    r.appendChild(passGroup, passWrapper);
    r.appendChild(form, passGroup);
    const confirmGroup = r.createElement("div");
    r.setAttribute(confirmGroup, "class", "jarvis-form-group");
    const confirmLabel = r.createElement("label");
    r.setAttribute(confirmLabel, "class", "jarvis-form-label");
    r.setAttribute(confirmLabel, "for", "confirm-password-input");
    confirmLabel.textContent = "Confirm New Password";
    r.appendChild(confirmGroup, confirmLabel);
    const confirmInput = new JarvisInputText(r, {
      value: this.confirmPassword,
      placeholder: "Repeat new password",
      type: "password"
    });
    r.setAttribute(confirmInput.getElement(), "id", "confirm-password-input");
    confirmInput.valueChange.subscribe((v) => this.confirmPassword.set(v));
    r.appendChild(confirmGroup, confirmInput.getElement());
    r.appendChild(form, confirmGroup);
    const policyBox = r.createElement("div");
    r.setAttribute(policyBox, "class", "password-policy-box");
    const policyHeader = r.createElement("div");
    r.setAttribute(policyHeader, "class", "policy-header");
    policyHeader.textContent = "Enterprise Password Policy Checklist:";
    r.appendChild(policyBox, policyHeader);
    const rules = [
      { key: "minLength", text: "At least 8 characters long" },
      { key: "hasUppercase", text: "Contains uppercase letter (A-Z)" },
      { key: "hasNumber", text: "Contains a number (0-9)" },
      { key: "hasSpecialChar", text: "Contains special character (!@#$%...)" },
      { key: "passwordsMatch", text: "Passwords match identically" }
    ];
    const ruleElements = [];
    for (const rule of rules) {
      const item = r.createElement("div");
      r.setAttribute(item, "class", "jarvis-policy-rule");
      r.appendChild(policyBox, item);
      ruleElements.push(item);
    }
    const policySub = effect(() => {
      const state = this.policyCheck();
      rules.forEach((rule, idx) => {
        const isMet = state[rule.key];
        const el = ruleElements[idx];
        if (isMet) {
          el.className = "jarvis-policy-rule jarvis-policy-rule--met";
          el.innerHTML = `<i class="pi pi-check text-emerald-600"></i> <span>${rule.text}</span>`;
        } else {
          el.className = "jarvis-policy-rule";
          el.innerHTML = `<i class="pi pi-circle text-slate-400"></i> <span>${rule.text}</span>`;
        }
      });
    });
    this.cleanupFns.push(policySub);
    r.appendChild(form, policyBox);
    const statusBox = r.createElement("div");
    const statusSub = effect(() => {
      const err = this.statusError();
      const succ = this.statusSuccess();
      if (err) {
        r.setAttribute(statusBox, "class", "jarvis-alert-banner jarvis-alert-banner--danger mt-3");
        statusBox.innerHTML = `<i class="pi pi-exclamation-triangle"></i> <span>${err}</span>`;
      } else if (succ) {
        r.setAttribute(statusBox, "class", "jarvis-alert-banner jarvis-alert-banner--success mt-3");
        statusBox.innerHTML = `<i class="pi pi-check-circle"></i> <span>${succ}</span>`;
      } else {
        r.setAttribute(statusBox, "class", "jarvis-sr-only");
        statusBox.innerHTML = "";
      }
    });
    this.cleanupFns.push(statusSub);
    r.appendChild(form, statusBox);
    const submitBtn = new JarvisButton(r, {
      label: "Update Password & Continue",
      icon: "pi pi-lock-open",
      severity: "primary",
      loading: this.authService.isLoading,
      disabled: () => !this.isPolicySatisfied() || this.authService.isLoading(),
      class: "w-full submit-button-primary mt-4"
    });
    submitBtn.clicked.subscribe(() => this.handleReset());
    r.appendChild(form, submitBtn.getElement());
    const backBtn = new JarvisButton(r, {
      label: "Proceed to Sign In",
      variant: "text",
      class: "w-full mt-3 text-slate-600"
    });
    backBtn.clicked.subscribe(() => this.navigateToLogin());
    r.appendChild(form, backBtn.getElement());
    r.appendChild(root, form);
    return root;
  }
  onDestroy() {
    for (const cleanup of this.cleanupFns) {
      try {
        cleanup();
      } catch (e) {
        console.error("[ResetPasswordPage] Cleanup error:", e);
      }
    }
    this.cleanupFns = [];
  }
};
Component({
  selector: "app-reset-password-page",
  templateUrl: "./reset-password.page.html",
  styleUrl: "./reset-password.page.css"
})(ResetPasswordPage);

// examples/07-employee-portal/src/features/dashboard/services/dashboard.service.ts
var INITIAL_PROJECTS = [
  {
    id: "proj-001",
    code: "MK-85",
    title: "Mark 85 Nanotech Chassis Integration",
    department: "Advanced Engineering",
    clearance: "LEVEL 5",
    status: "ACTIVE",
    progress: 88,
    lead: "Tony Stark",
    updatedAt: "12m ago"
  },
  {
    id: "proj-002",
    code: "ARC-V4",
    title: "Arc Reactor Clean Grid Distributed Core",
    department: "Energy Systems",
    clearance: "LEVEL 5",
    status: "DEPLOYED",
    progress: 100,
    lead: "Pepper Potts",
    updatedAt: "1h ago"
  },
  {
    id: "proj-003",
    code: "NEXUS-M",
    title: "Nexus Mesh Zero-Trust IAM Protocol",
    department: "Security & DevOps",
    clearance: "LEVEL 4",
    status: "REVIEW",
    progress: 65,
    lead: "Tony Stark",
    updatedAt: "3h ago"
  },
  {
    id: "proj-004",
    code: "NANO-W",
    title: "Next-Gen Biomorphic Smart Webbing",
    department: "Material Science",
    clearance: "LEVEL 2",
    status: "ACTIVE",
    progress: 42,
    lead: "Peter Parker",
    updatedAt: "Yesterday"
  }
];
var INITIAL_KPIS = [
  {
    id: "kpi-security",
    title: "Security Compliance",
    value: "99.4%",
    subtext: "Hardware Token Synced \xB7 0 Threats",
    trend: "up",
    trendValue: "+0.6%",
    icon: "pi pi-shield",
    accentColor: "#10b981"
  },
  {
    id: "kpi-workspaces",
    title: "Active Workspaces",
    value: "4 Projects",
    subtext: "2 Deployed \xB7 1 Under Review",
    trend: "neutral",
    trendValue: "Steady",
    icon: "pi pi-box",
    accentColor: "#3b82f6"
  },
  {
    id: "kpi-leave",
    title: "Time-Off Balance",
    value: "18.5 Days",
    subtext: "Annual PTO Balance 2026",
    trend: "down",
    trendValue: "-2.0d used",
    icon: "pi pi-calendar",
    accentColor: "#8b5cf6"
  },
  {
    id: "kpi-approvals",
    title: "Pending Approvals",
    value: "3 Action Items",
    subtext: "Architecture Review & Budget Sign-off",
    trend: "up",
    trendValue: "2 Urgent",
    icon: "pi pi-bell",
    accentColor: "#f59e0b"
  }
];
var INITIAL_AUDIT_LOGS = [
  {
    id: "aud-001",
    event: "Biometric MFA Challenge Verified",
    actor: "Pepper Potts (EMP-10002)",
    timestamp: "2026-10-15 17:42:10 UTC",
    ipAddress: "192.168.10.42 (Starknet VPN)",
    status: "SUCCESS"
  },
  {
    id: "aud-002",
    event: "SAML Session Token Renewed",
    actor: "Tony Stark (EMP-10001)",
    timestamp: "2026-10-15 17:35:04 UTC",
    ipAddress: "192.168.10.15 (Direct Armor Link)",
    status: "SUCCESS"
  },
  {
    id: "aud-003",
    event: "Firmware Flash Signature Validated",
    actor: "JARVIS Automator",
    timestamp: "2026-10-15 16:15:22 UTC",
    ipAddress: "10.0.0.1 (Local Core Mesh)",
    status: "SUCCESS"
  }
];
var DashboardService = class {
  constructor() {
    this.projects = signal([...INITIAL_PROJECTS]);
    this.kpis = signal([...INITIAL_KPIS]);
    this.auditLogs = signal([...INITIAL_AUDIT_LOGS]);
    // Search & Filter State
    this.searchQuery = signal("");
    this.statusFilter = signal("ALL");
    // Filtered derivations
    this.filteredProjects = computed(() => {
      const query = this.searchQuery().toLowerCase().trim();
      const filter = this.statusFilter();
      let items = this.projects();
      if (filter !== "ALL") {
        items = items.filter((p) => p.status === filter);
      }
      if (query) {
        items = items.filter(
          (p) => p.title.toLowerCase().includes(query) || p.code.toLowerCase().includes(query) || p.department.toLowerCase().includes(query) || p.lead.toLowerCase().includes(query)
        );
      }
      return items;
    });
  }
  setSearchQuery(q) {
    this.searchQuery.set(q);
  }
  setStatusFilter(filter) {
    this.statusFilter.set(filter);
  }
  updateProjectProgress(id, progress) {
    this.projects.update(
      (list) => list.map((p) => p.id === id ? { ...p, progress: Math.min(100, Math.max(0, progress)) } : p)
    );
  }
  addProject(project) {
    const newProj = {
      ...project,
      id: `proj-${Date.now()}`,
      updatedAt: "Just now"
    };
    this.projects.update((list) => [newProj, ...list]);
  }
};

// examples/07-employee-portal/src/features/dashboard/pages/employee-dashboard/employee-dashboard.page.ts
var EmployeeDashboardPage = class {
  constructor(authService, dashboardService, router2) {
    // Profile Edit Modal State
    this.isProfileModalOpen = signal(false);
    this.editDisplayName = signal("");
    this.editPhone = signal("");
    this.editOffice = signal("");
    this.isProfileSubmitted = signal(false);
    this.profileSaveSuccess = signal(null);
    // Profile Form Field Validations
    this.nameError = computed(() => {
      if (!this.isProfileSubmitted()) return null;
      const val = this.editDisplayName().trim();
      if (!val) return "Display name is required.";
      if (val.length < 3) return "Display name must be at least 3 characters.";
      return null;
    });
    this.phoneError = computed(() => {
      if (!this.isProfileSubmitted()) return null;
      const val = this.editPhone().trim();
      if (!val) return "Emergency contact phone is required.";
      if (val.length < 8) return "Phone must be at least 8 digits.";
      return null;
    });
    this.cleanupFns = [];
    this.authService = authService || new AuthenticationService();
    this.dashboardService = dashboardService || new DashboardService();
    this.router = router2 || null;
  }
  onInit() {
    const user = this.authService.currentUser();
    if (user) {
      this.editDisplayName.set(user.name);
      this.editPhone.set("+1 (212) 555-0199");
      this.editOffice.set("Stark Tower, Executive Enclave 90");
    }
  }
  handleSearchInput(query) {
    this.dashboardService.setSearchQuery(query);
  }
  handleFilterStatus(status) {
    this.dashboardService.setStatusFilter(status);
  }
  openProfileModal() {
    const user = this.authService.currentUser();
    if (user) {
      this.editDisplayName.set(user.name);
    }
    this.isProfileSubmitted.set(false);
    this.profileSaveSuccess.set(null);
    this.isProfileModalOpen.set(true);
  }
  closeProfileModal() {
    this.isProfileModalOpen.set(false);
    this.isProfileSubmitted.set(false);
    this.profileSaveSuccess.set(null);
  }
  saveProfileChanges() {
    this.isProfileSubmitted.set(true);
    if (this.nameError() || this.phoneError()) {
      return false;
    }
    const user = this.authService.currentUser();
    if (user) {
      this.authService.currentUser.set({
        ...user,
        name: this.editDisplayName().trim()
      });
    }
    this.profileSaveSuccess.set("Profile and security contact updated successfully.");
    setTimeout(() => {
      this.closeProfileModal();
    }, 800);
    return true;
  }
  handleLogout() {
    this.authService.logout();
    if (this.router) {
      this.router.navigate(["login"]);
    }
  }
  navigateToPasswordReset() {
    if (this.router) {
      this.router.navigate(["reset-password"]);
    }
  }
  render(r) {
    const root = r.createElement("section");
    r.setAttribute(root, "class", "employee-dashboard");
    r.setAttribute(root, "aria-labelledby", "dashboard-heading");
    const topBar = r.createElement("header");
    r.setAttribute(topBar, "class", "dashboard-topbar");
    const identityBlock = r.createElement("div");
    r.setAttribute(identityBlock, "class", "employee-identity-block");
    const avatarWrap = r.createElement("div");
    r.setAttribute(avatarWrap, "class", "avatar-wrapper");
    const avatarImg = r.createElement("img");
    r.setAttribute(avatarImg, "class", "employee-avatar");
    const statusDot = r.createElement("span");
    r.setAttribute(statusDot, "class", "avatar-status-dot");
    r.appendChild(avatarWrap, avatarImg);
    r.appendChild(avatarWrap, statusDot);
    r.appendChild(identityBlock, avatarWrap);
    const userTextCol = r.createElement("div");
    const nameRow = r.createElement("div");
    r.setAttribute(nameRow, "class", "employee-name-row");
    const nameEl = r.createElement("h1");
    r.setAttribute(nameEl, "id", "dashboard-heading");
    r.setAttribute(nameEl, "class", "employee-name");
    const clearanceBadge = r.createElement("span");
    r.setAttribute(clearanceBadge, "class", "clearance-badge font-mono");
    r.appendChild(nameRow, nameEl);
    r.appendChild(nameRow, clearanceBadge);
    const metaRow = r.createElement("div");
    r.setAttribute(metaRow, "class", "employee-meta-row");
    r.appendChild(userTextCol, nameRow);
    r.appendChild(userTextCol, metaRow);
    r.appendChild(identityBlock, userTextCol);
    r.appendChild(topBar, identityBlock);
    const userEffect = effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        r.setAttribute(avatarImg, "src", user.avatar);
        r.setAttribute(avatarImg, "alt", user.name);
        nameEl.textContent = `${user.name} \u2014 Employee Workspace`;
        clearanceBadge.textContent = user.clearanceLevel;
        metaRow.innerHTML = `
          <span class="employee-role font-medium">${user.role}</span>
          <span class="meta-separator" aria-hidden="true">\xB7</span>
          <span class="employee-dept">${user.department}</span>
          <span class="meta-separator" aria-hidden="true">\xB7</span>
          <span class="employee-id font-mono text-emerald-700 font-semibold">${user.id}</span>
        `;
      } else {
        r.setAttribute(avatarImg, "src", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150");
        r.setAttribute(avatarImg, "alt", "Employee Profile");
        nameEl.textContent = "Authorized Employee Workspace";
        clearanceBadge.textContent = "LEVEL 5";
        metaRow.innerHTML = `<span class="employee-role">Identity Active</span>`;
      }
    });
    this.cleanupFns.push(userEffect);
    const actionsBlock = r.createElement("div");
    r.setAttribute(actionsBlock, "class", "dashboard-actions");
    const editBtn = new JarvisButton(r, {
      label: "Profile Settings",
      icon: "pi pi-user-edit",
      variant: "outlined",
      size: "small",
      class: "btn-profile-edit"
    });
    editBtn.clicked.subscribe(() => this.openProfileModal());
    r.appendChild(actionsBlock, editBtn.getElement());
    const logoutBtn = new JarvisButton(r, {
      label: "Sign Out",
      icon: "pi pi-power-off",
      severity: "danger",
      size: "small",
      class: "btn-sign-out"
    });
    logoutBtn.clicked.subscribe(() => this.handleLogout());
    r.appendChild(actionsBlock, logoutBtn.getElement());
    r.appendChild(topBar, actionsBlock);
    r.appendChild(root, topBar);
    const kpiGrid = r.createElement("div");
    r.setAttribute(kpiGrid, "class", "kpi-grid");
    r.setAttribute(kpiGrid, "role", "region");
    r.setAttribute(kpiGrid, "aria-label", "Executive Metrics");
    const kpis = this.dashboardService.kpis();
    for (const kpi of kpis) {
      const card = r.createElement("div");
      r.setAttribute(card, "class", "kpi-card");
      card.innerHTML = `
        <div class="kpi-card-header">
          <span class="kpi-title">${kpi.title}</span>
          <div class="kpi-icon-wrap" style="background-color: ${kpi.accentColor}18; color: ${kpi.accentColor};">
            <i class="${kpi.icon}"></i>
          </div>
        </div>
        <div class="kpi-value-row">
          <span class="kpi-value">${kpi.value}</span>
          <span class="kpi-trend kpi-trend--${kpi.trend}">${kpi.trendValue}</span>
        </div>
        <span class="kpi-subtext">${kpi.subtext}</span>
      `;
      r.appendChild(kpiGrid, card);
    }
    r.appendChild(root, kpiGrid);
    const projectsSection = r.createElement("section");
    r.setAttribute(projectsSection, "class", "dashboard-card project-workspaces-section");
    const secHeader = r.createElement("div");
    r.setAttribute(secHeader, "class", "section-header-row");
    const titleCol = r.createElement("div");
    titleCol.innerHTML = `
      <h2 class="section-title">Authorized Workspaces & Active Projects</h2>
      <p class="section-subtitle">Real-time status of assigned engineering pipelines and security enclaves.</p>
    `;
    r.appendChild(secHeader, titleCol);
    const filterControls = r.createElement("div");
    r.setAttribute(filterControls, "class", "filter-controls");
    const searchBox = r.createElement("div");
    r.setAttribute(searchBox, "class", "search-input-box");
    const searchIcon = r.createElement("i");
    r.setAttribute(searchIcon, "class", "pi pi-search search-icon");
    r.appendChild(searchBox, searchIcon);
    const searchInput = new JarvisInputText(r, {
      value: this.dashboardService.searchQuery,
      placeholder: "Search by project or code...",
      size: "small",
      class: "w-full"
    });
    r.setAttribute(searchInput.getElement(), "id", "dashboard-search-input");
    r.setAttribute(searchInput.getElement(), "aria-label", "Search workspaces and projects");
    searchInput.valueChange.subscribe((val) => this.handleSearchInput(val));
    r.appendChild(searchBox, searchInput.getElement());
    r.appendChild(filterControls, searchBox);
    const filterPills = r.createElement("div");
    r.setAttribute(filterPills, "class", "status-filter-pills");
    const filters = [
      { label: "All", key: "ALL" },
      { label: "Active", key: "ACTIVE" },
      { label: "Review", key: "REVIEW" },
      { label: "Deployed", key: "DEPLOYED" }
    ];
    const filterButtonEls = [];
    filters.forEach((f) => {
      const btn = r.createElement("button");
      r.setAttribute(btn, "type", "button");
      r.setAttribute(btn, "class", `status-pill ${f.key === "ALL" ? "active" : ""}`);
      r.setAttribute(btn, "data-filter", f.key);
      btn.textContent = f.label;
      r.listen(btn, "click", () => {
        this.handleFilterStatus(f.key);
        filterButtonEls.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
      filterButtonEls.push(btn);
      r.appendChild(filterPills, btn);
    });
    r.appendChild(filterControls, filterPills);
    r.appendChild(secHeader, filterControls);
    r.appendChild(projectsSection, secHeader);
    const tableContainer = r.createElement("div");
    r.setAttribute(tableContainer, "class", "projects-table-container");
    const table = r.createElement("table");
    r.setAttribute(table, "class", "dashboard-table");
    table.innerHTML = `
      <thead>
        <tr>
          <th scope="col">Project Code</th>
          <th scope="col">Title & Department</th>
          <th scope="col">Clearance</th>
          <th scope="col">Status</th>
          <th scope="col">Completion</th>
          <th scope="col" style="text-align: right;">Actions</th>
        </tr>
      </thead>
    `;
    const tbody = r.createElement("tbody");
    r.setAttribute(tbody, "class", "projects-table-body");
    const tableEffect = effect(() => {
      const projects = this.dashboardService.filteredProjects();
      tbody.innerHTML = "";
      if (projects.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="p-8 text-center text-slate-500">
              <i class="pi pi-filter-slash text-2xl mb-2 text-slate-400"></i>
              <p>No projects match current filter criteria.</p>
            </td>
          </tr>
        `;
        return;
      }
      for (const proj of projects) {
        const tr = r.createElement("tr");
        tr.innerHTML = `
          <td><span class="project-code-tag">${proj.code}</span></td>
          <td>
            <span class="project-title">${proj.title}</span>
            <span class="project-dept">${proj.department} \xB7 Lead: ${proj.lead}</span>
          </td>
          <td><span class="clearance-badge font-mono">${proj.clearance}</span></td>
          <td>
            <span class="status-tag status-tag--${proj.status}">
              <i class="pi pi-circle-fill text-[6px]"></i>
              <span>${proj.status}</span>
            </span>
          </td>
          <td>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${proj.progress}%;"></div>
            </div>
            <span class="font-mono text-xs font-semibold">${proj.progress}%</span>
          </td>
          <td style="text-align: right;">
            <button type="button" class="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition">
              Launch <i class="pi pi-external-link text-[10px] ml-1"></i>
            </button>
          </td>
        `;
        r.appendChild(tbody, tr);
      }
    });
    this.cleanupFns.push(tableEffect);
    r.appendChild(table, tbody);
    r.appendChild(tableContainer, table);
    r.appendChild(projectsSection, tableContainer);
    r.appendChild(root, projectsSection);
    const bottomGrid = r.createElement("div");
    r.setAttribute(bottomGrid, "class", "bottom-split-grid");
    const auditCard = r.createElement("section");
    r.setAttribute(auditCard, "class", "dashboard-card");
    auditCard.innerHTML = `
      <div class="card-header">
        <h3 class="card-title"><i class="pi pi-shield text-emerald-600"></i> Identity & Audit Trail</h3>
        <span class="audit-counter-badge font-mono">LIVE ENCLAVE</span>
      </div>
    `;
    const auditList = r.createElement("div");
    r.setAttribute(auditList, "class", "audit-list");
    const logs = this.dashboardService.auditLogs();
    for (const log of logs) {
      const item = r.createElement("div");
      r.setAttribute(item, "class", "audit-item");
      item.innerHTML = `
        <div>
          <div class="audit-event-title">${log.event}</div>
          <div class="audit-event-meta font-mono">${log.actor} \xB7 ${log.ipAddress}</div>
        </div>
        <span class="font-mono text-[11px] text-slate-500">${log.timestamp}</span>
      `;
      r.appendChild(auditList, item);
    }
    r.appendChild(auditCard, auditList);
    r.appendChild(bottomGrid, auditCard);
    const toolsCard = r.createElement("section");
    r.setAttribute(toolsCard, "class", "dashboard-card");
    toolsCard.innerHTML = `
      <div class="card-header">
        <h3 class="card-title"><i class="pi pi-th-large text-emerald-600"></i> Quick Workspace Tools</h3>
        <span class="tools-subtext text-xs text-slate-500">SSO Authenticated</span>
      </div>
      <div class="quick-tools-grid">
        <div class="quick-tool-tile">
          <i class="pi pi-code text-cyan-600 text-xl mb-2"></i>
          <span class="tool-title">Monorepo Terminal</span>
          <span class="tool-desc">v0.1.0 \xB7 Fast HMR</span>
        </div>
        <div class="quick-tool-tile">
          <i class="pi pi-server text-emerald-600 text-xl mb-2"></i>
          <span class="tool-title">Nexus Cloud Mesh</span>
          <span class="tool-desc">12 Nodes Online</span>
        </div>
        <div class="quick-tool-tile">
          <i class="pi pi-key text-amber-600 text-xl mb-2"></i>
          <span class="tool-title">Key Vault HSM</span>
          <span class="tool-desc">Zero-Knowledge RSA</span>
        </div>
        <div class="quick-tool-tile">
          <i class="pi pi-chart-line text-purple-600 text-xl mb-2"></i>
          <span class="tool-title">Telemetry Observability</span>
          <span class="tool-desc">99.99% Uptime</span>
        </div>
      </div>
    `;
    r.appendChild(bottomGrid, toolsCard);
    r.appendChild(root, bottomGrid);
    const profileDialog = new JarvisDialog(r, {
      header: "Employee Profile & Security Preferences",
      visible: this.isProfileModalOpen,
      width: "460px",
      modal: true,
      closable: true
    });
    profileDialog.visibleChange.subscribe((v) => {
      this.isProfileModalOpen.set(v);
      if (!v) this.isProfileSubmitted.set(false);
    });
    const modalBody = r.createElement("div");
    r.setAttribute(modalBody, "class", "profile-modal-form");
    const modalAlertBox = r.createElement("div");
    r.setAttribute(modalAlertBox, "class", "jarvis-sr-only");
    const modalAlertEffect = effect(() => {
      const msg = this.profileSaveSuccess();
      if (msg) {
        r.setAttribute(modalAlertBox, "class", "jarvis-alert-banner jarvis-alert-banner--success");
        modalAlertBox.innerHTML = `<i class="pi pi-check-circle"></i> <span>${msg}</span>`;
      } else {
        r.setAttribute(modalAlertBox, "class", "jarvis-sr-only");
        modalAlertBox.innerHTML = "";
      }
    });
    this.cleanupFns.push(modalAlertEffect);
    r.appendChild(modalBody, modalAlertBox);
    const nameGroup = r.createElement("div");
    r.setAttribute(nameGroup, "class", "jarvis-form-group");
    const nameLabel = r.createElement("label");
    r.setAttribute(nameLabel, "class", "jarvis-form-label");
    r.setAttribute(nameLabel, "for", "edit-name-input");
    nameLabel.textContent = "Preferred Display Name";
    r.appendChild(nameGroup, nameLabel);
    const nameInput = new JarvisInputText(r, {
      value: this.editDisplayName,
      placeholder: "Full name",
      invalid: () => Boolean(this.nameError()),
      class: "w-full"
    });
    r.setAttribute(nameInput.getElement(), "id", "edit-name-input");
    nameInput.valueChange.subscribe((val) => this.editDisplayName.set(val));
    r.appendChild(nameGroup, nameInput.getElement());
    const nameErrorEl = r.createElement("div");
    r.setAttribute(nameErrorEl, "class", "jarvis-sr-only");
    const nameErrEffect = effect(() => {
      const err = this.nameError();
      if (err) {
        r.setAttribute(nameErrorEl, "class", "jarvis-form-error mt-1");
        nameErrorEl.innerHTML = `<i class="pi pi-exclamation-circle"></i> <span>${err}</span>`;
      } else {
        r.setAttribute(nameErrorEl, "class", "jarvis-sr-only");
        nameErrorEl.innerHTML = "";
      }
    });
    this.cleanupFns.push(nameErrEffect);
    r.appendChild(nameGroup, nameErrorEl);
    r.appendChild(modalBody, nameGroup);
    const phoneGroup = r.createElement("div");
    r.setAttribute(phoneGroup, "class", "jarvis-form-group");
    const phoneLabel = r.createElement("label");
    r.setAttribute(phoneLabel, "class", "jarvis-form-label");
    r.setAttribute(phoneLabel, "for", "edit-phone-input");
    phoneLabel.textContent = "Emergency Contact / Direct Phone";
    r.appendChild(phoneGroup, phoneLabel);
    const phoneInput = new JarvisInputText(r, {
      value: this.editPhone,
      placeholder: "+1 (555) 000-0000",
      invalid: () => Boolean(this.phoneError()),
      class: "w-full"
    });
    r.setAttribute(phoneInput.getElement(), "id", "edit-phone-input");
    phoneInput.valueChange.subscribe((val) => this.editPhone.set(val));
    r.appendChild(phoneGroup, phoneInput.getElement());
    const phoneErrorEl = r.createElement("div");
    r.setAttribute(phoneErrorEl, "class", "jarvis-sr-only");
    const phoneErrEffect = effect(() => {
      const err = this.phoneError();
      if (err) {
        r.setAttribute(phoneErrorEl, "class", "jarvis-form-error mt-1");
        phoneErrorEl.innerHTML = `<i class="pi pi-exclamation-circle"></i> <span>${err}</span>`;
      } else {
        r.setAttribute(phoneErrorEl, "class", "jarvis-sr-only");
        phoneErrorEl.innerHTML = "";
      }
    });
    this.cleanupFns.push(phoneErrEffect);
    r.appendChild(phoneGroup, phoneErrorEl);
    r.appendChild(modalBody, phoneGroup);
    const officeGroup = r.createElement("div");
    r.setAttribute(officeGroup, "class", "jarvis-form-group");
    const officeLabel = r.createElement("label");
    r.setAttribute(officeLabel, "class", "jarvis-form-label");
    r.setAttribute(officeLabel, "for", "edit-office-input");
    officeLabel.textContent = "Designated Office Location";
    r.appendChild(officeGroup, officeLabel);
    const officeInput = new JarvisInputText(r, {
      value: this.editOffice,
      placeholder: "e.g. Stark Tower Suite 90",
      class: "w-full"
    });
    r.setAttribute(officeInput.getElement(), "id", "edit-office-input");
    officeInput.valueChange.subscribe((val) => this.editOffice.set(val));
    r.appendChild(officeGroup, officeInput.getElement());
    r.appendChild(modalBody, officeGroup);
    const footerActions = r.createElement("div");
    r.setAttribute(footerActions, "class", "modal-footer-actions");
    const cancelBtn = new JarvisButton(r, {
      label: "Cancel",
      variant: "text",
      size: "small",
      class: "text-slate-600"
    });
    cancelBtn.clicked.subscribe(() => this.closeProfileModal());
    r.appendChild(footerActions, cancelBtn.getElement());
    const saveBtn = new JarvisButton(r, {
      label: "Save Changes",
      icon: "pi pi-check",
      severity: "primary",
      size: "small"
    });
    saveBtn.clicked.subscribe(() => this.saveProfileChanges());
    r.appendChild(footerActions, saveBtn.getElement());
    r.appendChild(modalBody, footerActions);
    r.appendChild(profileDialog.getElement(), modalBody);
    r.appendChild(root, profileDialog.getElement());
    return root;
  }
  onDestroy() {
    for (const cleanup of this.cleanupFns) {
      try {
        if (typeof cleanup === "function") {
          cleanup();
        } else if (cleanup && typeof cleanup.destroy === "function") {
          cleanup.destroy();
        }
      } catch (e) {
        console.error("[EmployeeDashboardPage] Cleanup error:", e);
      }
    }
    this.cleanupFns = [];
  }
};
Component({
  selector: "app-employee-dashboard-page",
  templateUrl: "./employee-dashboard.page.html",
  styleUrl: "./employee-dashboard.page.css"
})(EmployeeDashboardPage);

// examples/07-employee-portal/src/features/authentication/authentication.routes.ts
var authRoutes = [
  { path: "", redirectTo: "login", pathMatch: "full" },
  {
    path: "login",
    component: EmployeeLoginPage,
    title: "JARVIS Portal \u2014 Employee Access",
    data: { screen: "login" }
  },
  {
    path: "forgot-password",
    component: ForgotPasswordPage,
    title: "JARVIS Portal \u2014 Credential Recovery",
    data: { screen: "forgot-password" }
  },
  {
    path: "verify-identity",
    component: VerifyIdentityPage,
    title: "JARVIS Portal \u2014 Two-Factor Verification",
    data: { screen: "verify-identity" }
  },
  {
    path: "reset-password",
    component: ResetPasswordPage,
    title: "JARVIS Portal \u2014 Set New Password",
    data: { screen: "reset-password" }
  },
  {
    path: "dashboard",
    component: EmployeeDashboardPage,
    title: "JARVIS Portal \u2014 Employee Dashboard",
    data: { screen: "dashboard" }
  },
  {
    path: "workspace",
    component: EmployeeDashboardPage,
    title: "JARVIS Portal \u2014 Employee Dashboard",
    data: { screen: "dashboard" }
  }
];

// examples/07-employee-portal/src/portal-app.component.ts
var PortalAppComponent = class {
  constructor(authService, orgConfig, router2) {
    this.outlet = null;
    this.cleanupFns = [];
    this.authService = authService || new AuthenticationService();
    this.orgConfig = orgConfig || new OrganizationConfigService();
    this.router = router2 || provideRouter(authRoutes, {
      initialUrl: "/login"
    });
  }
  onInit() {
    this.authService.restoreSession();
  }
  render(r) {
    const root = r.createElement("div");
    r.setAttribute(root, "class", "jarvis-auth-split");
    const brandPanel = new AuthBrandPanelComponent();
    const brandNode = brandPanel.render(r);
    r.appendChild(root, brandNode);
    const authPanel = r.createElement("main");
    r.setAttribute(authPanel, "class", "jarvis-auth-panel");
    r.setAttribute(authPanel, "id", "main-auth-content");
    const authContent = r.createElement("div");
    r.setAttribute(authContent, "class", "jarvis-auth-content");
    this.outlet = new RouterOutlet(r, this.router);
    r.appendChild(authContent, this.outlet.getElement());
    r.appendChild(authPanel, authContent);
    r.appendChild(root, authPanel);
    const routeLayoutSub = effect(() => {
      const url = this.router.currentUrl();
      const isDashboard = url.includes("dashboard") || url.includes("workspace");
      if (isDashboard) {
        r.setAttribute(root, "class", "jarvis-auth-split jarvis-auth-split--dashboard");
        r.setAttribute(authPanel, "class", "jarvis-auth-panel jarvis-auth-panel--dashboard");
        r.setAttribute(authContent, "class", "jarvis-auth-content jarvis-auth-content--dashboard");
      } else {
        r.setAttribute(root, "class", "jarvis-auth-split");
        r.setAttribute(authPanel, "class", "jarvis-auth-panel");
        r.setAttribute(authContent, "class", "jarvis-auth-content");
      }
    });
    this.cleanupFns.push(routeLayoutSub);
    return root;
  }
  onDestroy() {
    for (const cleanup of this.cleanupFns) {
      try {
        cleanup();
      } catch (e) {
        console.error("[PortalAppComponent] Cleanup error:", e);
      }
    }
    this.cleanupFns = [];
    if (this.outlet) {
      this.outlet.destroy();
      this.outlet = null;
    }
    if (this.router) {
      this.router.destroy();
    }
  }
};
Component({
  selector: "app-portal-root",
  templateUrl: "./portal-app.component.html",
  styleUrl: "./portal-app.component.css"
})(PortalAppComponent);

// examples/07-employee-portal/app.ts
providePrimeNG({
  theme: "Aura",
  ripple: true,
  cssLayer: true
});
var renderer = new DOMRenderer();
var container = document.getElementById("app-root") || document.body;
var appRef = bootstrap(PortalAppComponent, container, renderer);
var router = appRef.instance.router;
document.addEventListener("click", (event) => {
  const target = event.target;
  const anchor = target?.closest("a");
  if (!anchor) return;
  const href = anchor.getAttribute("href");
  if (href && href.startsWith("/") && !href.startsWith("//")) {
    event.preventDefault();
    const cleanPath = href.replace(/^\//, "");
    router.navigate(cleanPath ? [cleanPath] : []);
  }
});
window.addEventListener("popstate", () => {
  const path = window.location.pathname.replace(/^\//, "");
  router.navigate(path ? [path] : []);
});
console.log("\u2726 JARVIS Employee Portal Mounted Successfully with Fine-Grained Reactive Signals");
//# sourceMappingURL=bundle.js.map
