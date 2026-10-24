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
        const isLoading2 = unwrap(this.props.loading);
        const icon = unwrap(this.props.icon);
        if (isLoading2) {
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
      (isLoading2) => {
        this.renderer.setProperty(
          this.loadingOverlayEl,
          "style",
          isLoading2 ? "position: absolute; inset: 0; background: rgba(255,255,255,0.7); display: flex; align-items: center; justify-content: center;" : "display: none;"
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

// examples/02-primeng-showcase/app.ts
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
  { id: "EMP005", name: "Liam O'Connor", role: "Systems Developer", dept: "Engineering", salary: 135e3, status: "Active" },
  { id: "EMP006", name: "Chloe Dubois", role: "Brand Strategist", dept: "Marketing", salary: 11e4, status: "Inactive" },
  { id: "EMP007", name: "Tariq Al-Mansoor", role: "DevOps Architect", dept: "Engineering", salary: 148e3, status: "Active" }
];
var employees = signal(initialEmployees);
var searchQuery = signal("");
var selectedDept = signal("All");
var activeOnly = signal(false);
var isLoading = signal(false);
var isModalVisible = signal(false);
var formName = signal("");
var formRole = signal("");
var formDept = signal("Engineering");
var formSalary = signal("120000");
var formInvalid = signal(false);
var filteredEmployees = computed(() => {
  const query = searchQuery().toLowerCase().trim();
  const dept = selectedDept();
  const isActiveOnly = activeOnly();
  return employees().filter((emp) => {
    const matchesSearch = !query || emp.name.toLowerCase().includes(query) || emp.role.toLowerCase().includes(query);
    const matchesDept = dept === "All" || emp.dept === dept;
    const matchesActive = !isActiveOnly || emp.status === "Active";
    return matchesSearch && matchesDept && matchesActive;
  });
});
var headerActionsEl = document.getElementById("header-actions");
if (headerActionsEl) {
  const addBtn = new JarvisButton(renderer, {
    label: "Add Member",
    icon: "pi pi-user-plus",
    severity: "primary"
  });
  addBtn.clicked.subscribe(() => {
    formName.set("");
    formRole.set("");
    formDept.set("Engineering");
    formSalary.set("120000");
    formInvalid.set(false);
    isModalVisible.set(true);
  });
  renderer.appendChild(headerActionsEl, addBtn.getElement());
  const refreshBtn = new JarvisButton(renderer, {
    label: "Refresh Data",
    icon: "pi pi-refresh",
    variant: "outlined",
    loading: isLoading
  });
  refreshBtn.clicked.subscribe(() => {
    isLoading.set(true);
    setTimeout(() => {
      isLoading.set(false);
    }, 600);
  });
  renderer.appendChild(headerActionsEl, refreshBtn.getElement());
}
var searchContainer = document.getElementById("search-container");
if (searchContainer) {
  const searchInput = new JarvisInputText(renderer, {
    placeholder: "Search name or role...",
    value: searchQuery
  });
  searchInput.valueChange.subscribe((val) => {
    searchQuery.set(val);
  });
  renderer.appendChild(searchContainer, searchInput.getElement());
}
var deptContainer = document.getElementById("filter-dept-container");
if (deptContainer) {
  const deptSelect = new JarvisSelect(renderer, {
    options: ["All", "Engineering", "Design", "Product", "Marketing"],
    value: selectedDept,
    placeholder: "Filter Department"
  });
  deptSelect.valueChange.subscribe((val) => {
    selectedDept.set(val);
  });
  renderer.appendChild(deptContainer, deptSelect.getElement());
}
var checkboxContainer = document.getElementById("checkbox-container");
if (checkboxContainer) {
  const activeCheckbox = new JarvisCheckbox(renderer, {
    label: "Active Personel Only",
    checked: activeOnly
  });
  activeCheckbox.checkedChange.subscribe((checked) => {
    activeOnly.set(checked);
  });
  renderer.appendChild(checkboxContainer, activeCheckbox.getElement());
}
var statsContainer = document.getElementById("stats-container");
if (statsContainer) {
  effect(() => {
    const total = employees().length;
    const current = filteredEmployees().length;
    statsContainer.textContent = `Showing ${current} of ${total} personnel`;
  });
}
var tableContainer = document.getElementById("table-container");
if (tableContainer) {
  const table = new JarvisTable(renderer, {
    value: filteredEmployees,
    loading: isLoading,
    paginator: true,
    rows: 5,
    columns: [
      { field: "id", header: "ID", sortable: true },
      { field: "name", header: "Employee Name", sortable: true },
      { field: "role", header: "Role", sortable: true },
      { field: "dept", header: "Department", sortable: true },
      {
        field: "salary",
        header: "Compensation",
        sortable: true,
        formatter: (val) => `$${Number(val).toLocaleString()}`
      },
      {
        field: "status",
        header: "Status",
        sortable: true,
        formatter: (val) => `[${val}]`
      }
    ]
  });
  renderer.appendChild(tableContainer, table.getElement());
}
var dialogHost = document.getElementById("dialog-host");
if (dialogHost) {
  const dialog = new JarvisDialog(renderer, {
    header: "Add Team Member",
    visible: isModalVisible,
    width: "480px"
  });
  dialog.visibleChange.subscribe((visible) => {
    isModalVisible.set(visible);
  });
  const dialogContent = dialog.getContentContainer();
  const formWrapper = renderer.createElement("div");
  renderer.setAttribute(formWrapper, "class", "space-y-4");
  const nameRow = renderer.createElement("div");
  renderer.setAttribute(nameRow, "class", "flex flex-col gap-1.5");
  const nameLabel = renderer.createElement("label");
  renderer.setAttribute(nameLabel, "class", "text-xs font-semibold text-slate-600");
  renderer.appendChild(nameLabel, renderer.createText("Full Name *"));
  const nameInput = new JarvisInputText(renderer, {
    placeholder: "e.g. Jane Doe",
    value: formName,
    invalid: formInvalid
  });
  nameInput.valueChange.subscribe((val) => formName.set(val));
  renderer.appendChild(nameRow, nameLabel);
  renderer.appendChild(nameRow, nameInput.getElement());
  renderer.appendChild(formWrapper, nameRow);
  const roleRow = renderer.createElement("div");
  renderer.setAttribute(roleRow, "class", "flex flex-col gap-1.5");
  const roleLabel = renderer.createElement("label");
  renderer.setAttribute(roleLabel, "class", "text-xs font-semibold text-slate-600");
  renderer.appendChild(roleLabel, renderer.createText("Job Role *"));
  const roleInput = new JarvisInputText(renderer, {
    placeholder: "e.g. Senior Architect",
    value: formRole
  });
  roleInput.valueChange.subscribe((val) => formRole.set(val));
  renderer.appendChild(roleRow, roleLabel);
  renderer.appendChild(roleRow, roleInput.getElement());
  renderer.appendChild(formWrapper, roleRow);
  const deptRow = renderer.createElement("div");
  renderer.setAttribute(deptRow, "class", "flex flex-col gap-1.5");
  const deptLabel = renderer.createElement("label");
  renderer.setAttribute(deptLabel, "class", "text-xs font-semibold text-slate-600");
  renderer.appendChild(deptLabel, renderer.createText("Department"));
  const modalDeptSelect = new JarvisSelect(renderer, {
    options: ["Engineering", "Design", "Product", "Marketing"],
    value: formDept
  });
  modalDeptSelect.valueChange.subscribe((val) => formDept.set(val));
  renderer.appendChild(deptRow, deptLabel);
  renderer.appendChild(deptRow, modalDeptSelect.getElement());
  renderer.appendChild(formWrapper, deptRow);
  const actionsRow = renderer.createElement("div");
  renderer.setAttribute(actionsRow, "class", "flex justify-end gap-3 pt-4 border-t border-slate-100");
  const cancelBtn = new JarvisButton(renderer, {
    label: "Cancel",
    variant: "text"
  });
  cancelBtn.clicked.subscribe(() => {
    isModalVisible.set(false);
  });
  const saveBtn = new JarvisButton(renderer, {
    label: "Save Member",
    severity: "primary"
  });
  saveBtn.clicked.subscribe(() => {
    const name = formName().trim();
    const role = formRole().trim();
    if (!name || !role) {
      formInvalid.set(true);
      return;
    }
    const newEmp = {
      id: `EMP${String(employees().length + 1).padStart(3, "0")}`,
      name,
      role,
      dept: formDept(),
      salary: Number(formSalary()) || 1e5,
      status: "Active"
    };
    employees.set([...employees(), newEmp]);
    isModalVisible.set(false);
  });
  renderer.appendChild(actionsRow, cancelBtn.getElement());
  renderer.appendChild(actionsRow, saveBtn.getElement());
  renderer.appendChild(formWrapper, actionsRow);
  renderer.appendChild(dialogContent, formWrapper);
  renderer.appendChild(dialogHost, dialog.getElement());
}
console.log("[Jarvis] PrimeNG v20 showcase application running successfully with fine-grained signals!");
//# sourceMappingURL=bundle.js.map
