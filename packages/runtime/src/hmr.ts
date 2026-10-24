/**
 * Jarvis Fine-Grained Dev-Only HMR Runtime
 * Stripped in production builds.
 */

export interface PatchOp {
  type: 'set_text' | 'set_attribute' | 'update_binding' | 'replace_subtree';
  path: string;
  content?: string;
  name?: string;
  value?: string;
  binding_id?: string;
  property?: string;
  expression_js?: string;
  html?: string;
}

export interface ActiveComponentInstance {
  instance: any;
  view: any;
  renderer: any;
  container: any;
  bindingDisposers: Map<string, () => void>;
}

export class JarvisHmrRuntime {
  private componentRegistry = new Map<string, { ComponentClass: any; metadata?: any }>();
  private activeInstances = new Map<string, Set<ActiveComponentInstance>>();
  private styleTags = new Map<string, HTMLStyleElement>();

  registerComponent(id: string, ComponentClass: any, metadata?: any): void {
    this.componentRegistry.set(id, { ComponentClass, metadata });
    if (!this.activeInstances.has(id)) {
      this.activeInstances.set(id, new Set());
    }
  }

  trackInstance(id: string, instanceEntry: ActiveComponentInstance): () => void {
    if (!this.activeInstances.has(id)) {
      this.activeInstances.set(id, new Set());
    }
    const set = this.activeInstances.get(id)!;
    set.add(instanceEntry);

    return () => {
      set.delete(instanceEntry);
    };
  }

  getActiveInstanceCount(id?: string): number {
    if (id) {
      return this.activeInstances.get(id)?.size ?? 0;
    }
    let total = 0;
    for (const set of this.activeInstances.values()) {
      total += set.size;
    }
    return total;
  }

  swapStyles(id: string, css: string): boolean {
    if (typeof document === 'undefined') {
      return false;
    }

    let styleEl = this.styleTags.get(id);
    if (!styleEl) {
      styleEl = document.querySelector(`style[data-jarvis-style="${id}"]`) as HTMLStyleElement;
    }

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.setAttribute('data-jarvis-style', id);
      document.head.appendChild(styleEl);
      this.styleTags.set(id, styleEl);
    }

    styleEl.textContent = css;
    return true;
  }

  swapTemplate(id: string, newTemplateFn: (renderer: any, ctx: any) => { root: any }): boolean {
    const instances = this.activeInstances.get(id);
    if (!instances || instances.size === 0) {
      return true;
    }

    for (const entry of Array.from(instances)) {
      const { instance, view, renderer, container, bindingDisposers } = entry;
      const oldRoot = view.root;

      // 1. Dispose all previous view bindings & effects cleanly to prevent leaks
      for (const disposer of bindingDisposers.values()) {
        try {
          disposer();
        } catch {}
      }
      bindingDisposers.clear();

      if (typeof view.destroy === 'function') {
        view.destroy();
      }

      // 2. Instantiate new view with the SAME instance state
      const result = newTemplateFn(renderer, instance);
      const newRoot = result.root;

      // 3. Swap in DOM
      if (oldRoot && newRoot && container) {
        if (typeof renderer.insertBefore === 'function') {
          renderer.insertBefore(container, newRoot, oldRoot);
          renderer.removeChild(container, oldRoot);
        } else if (container.replaceChild) {
          container.replaceChild(newRoot, oldRoot);
        }
      }

      view.root = newRoot;
    }

    return true;
  }

  patchTemplate(id: string, patches: PatchOp[]): boolean {
    const instances = this.activeInstances.get(id);
    if (!instances || instances.size === 0) {
      return true;
    }

    for (const entry of Array.from(instances)) {
      const { instance, view, renderer, bindingDisposers } = entry;
      const root = view.root;
      if (!root) continue;

      for (const patch of patches) {
        const targetNode = this.resolvePath(root, patch.path);
        if (!targetNode) {
          // Cannot safely locate node; fall back to swap or reload
          return false;
        }

        switch (patch.type) {
          case 'set_text': {
            if (typeof renderer.setText === 'function') {
              renderer.setText(targetNode, patch.content ?? '');
            } else {
              targetNode.textContent = patch.content ?? '';
            }
            break;
          }
          case 'set_attribute': {
            if (patch.name) {
              if (typeof renderer.setAttribute === 'function') {
                renderer.setAttribute(targetNode, patch.name, patch.value ?? '');
              } else if (targetNode.setAttribute) {
                targetNode.setAttribute(patch.name, patch.value ?? '');
              }
            }
            break;
          }
          case 'update_binding': {
            const bindingId = patch.binding_id || `b:${patch.path}`;
            // Cleanly dispose existing binding effect
            const oldDisposer = bindingDisposers.get(bindingId);
            if (oldDisposer) {
              try {
                oldDisposer();
              } catch {}
              bindingDisposers.delete(bindingId);
            }

            // Create new binding with updated expression
            if (patch.expression_js) {
              try {
                const exprFn = new Function('ctx', `return (${patch.expression_js})`);
                if (patch.property && patch.property.startsWith('event:')) {
                  const eventName = patch.property.replace('event:', '');
                  const disposer = renderer.listen(targetNode, eventName, ($event: any) => {
                    const handlerFn = new Function('ctx', '$event', `return (${patch.expression_js})`);
                    handlerFn(instance, $event);
                  });
                  bindingDisposers.set(bindingId, disposer);
                } else if (patch.property) {
                  const disposer = renderer.bindProperty(targetNode, patch.property, () => exprFn(instance));
                  bindingDisposers.set(bindingId, disposer);
                } else {
                  const disposer = renderer.bindText(targetNode, () => exprFn(instance));
                  bindingDisposers.set(bindingId, disposer);
                }
              } catch (e) {
                console.error(`[JARVIS HMR] Error updating binding ${bindingId}:`, e);
                return false;
              }
            }
            break;
          }
          default:
            return false;
        }
      }
    }

    return true;
  }

  swapScript(id: string, NewClass: any): boolean {
    const instances = this.activeInstances.get(id);
    if (!instances || instances.size === 0) {
      return true;
    }

    // Inspect fields / signals
    for (const entry of Array.from(instances)) {
      const oldInst = entry.instance;
      const testInst = new NewClass();

      // Check field compatibility
      const oldKeys = Object.keys(oldInst).sort();
      const newKeys = Object.keys(testInst).sort();

      const compatible = oldKeys.length === newKeys.length && oldKeys.every((k, i) => k === newKeys[i]);

      if (compatible) {
        // Swap prototype so new methods take effect
        Object.setPrototypeOf(oldInst, NewClass.prototype);
      } else {
        console.warn(`[JARVIS HMR] Incompatible script shape: fields changed (${oldKeys.join(',')} vs ${newKeys.join(',')}), recreating component instance`);
        // Recreate instance
        const newInst = new NewClass();
        for (const k of oldKeys) {
          if (k in newInst) {
            const oldVal = oldInst[k];
            if (oldVal && typeof oldVal.set === 'function') {
              try {
                newInst[k].set(oldVal());
              } catch {
                newInst[k] = oldVal;
              }
            } else {
              newInst[k] = oldVal;
            }
          }
        }
        entry.instance = newInst;
        // Re-execute template
        if (typeof NewClass.template === 'function') {
          this.swapTemplate(id, NewClass.template);
        }
      }
    }

    return true;
  }

  private resolvePath(root: any, path: string): any {
    if (!root) return null;
    const parts = path.split('.');
    let curr = root;

    for (let i = 1; i < parts.length; i++) {
      const idx = parseInt(parts[i], 10);
      const children = curr.childNodes || curr.children;
      if (!children || idx >= children.length) {
        return null;
      }
      curr = children[idx];
    }

    return curr;
  }

  fullReload(reason: string): void {
    console.warn(`[JARVIS HMR] reload (reason: ${reason})`);
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  }
}

// Global shared HMR runtime singleton
export const hmrRuntime = new JarvisHmrRuntime();

export function registerComponent(id: string, ComponentClass: any, metadata?: any): void {
  hmrRuntime.registerComponent(id, ComponentClass, metadata);
}

export function swapTemplate(id: string, newTemplateFn: (renderer: any, ctx: any) => { root: any }): boolean {
  return hmrRuntime.swapTemplate(id, newTemplateFn);
}

export function swapStyles(id: string, css: string): boolean {
  return hmrRuntime.swapStyles(id, css);
}

export function swapScript(id: string, NewClass: any): boolean {
  return hmrRuntime.swapScript(id, NewClass);
}

export function patchTemplate(id: string, patch: PatchOp | PatchOp[]): boolean {
  const patches = Array.isArray(patch) ? patch : [patch];
  return hmrRuntime.patchTemplate(id, patches);
}
