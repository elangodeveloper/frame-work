import { getComponentDef } from '../../core/src/index.ts';
import type { Renderer } from '../../renderer/src/index.ts';
import { DOMRenderer } from '../../renderer/src/index.ts';
import { ComponentView, type View } from './view.ts';

export interface BootstrapOptions {
  inputs?: Record<string, any>;
  outputs?: Record<string, (val: any) => void>;
}

export interface ComponentRef<T = any> {
  instance: T;
  view: View;
  hostElement: any;
  setInput<K extends keyof T | string>(key: K, value: any): void;
  destroy(): void;
}

/**
 * Bootstraps a JARVIS component into the target container.
 * Supports templateFn (compiled), render(renderer) (OOP), and getElement() (adapters).
 */
export function bootstrap<T>(
  ComponentClass: new (...args: any[]) => T,
  container: any,
  customRenderer?: Renderer,
  options?: BootstrapOptions
): ComponentRef<T> {
  const def = getComponentDef(ComponentClass);
  const renderer = customRenderer || new DOMRenderer();

  // 1. Component Creation
  const instance = new ComponentClass();
  const subscriptions: Array<{ unsubscribe: () => void }> = [];

  // 2. Assign initial inputs before onInit lifecycle
  if (options?.inputs) {
    for (const [key, val] of Object.entries(options.inputs)) {
      const prop = (instance as any)[key];
      if (prop && typeof prop.set === 'function') {
        prop.set(val);
      } else {
        (instance as any)[key] = val;
      }
    }
  }

  // 3. Bind outputs
  if (options?.outputs) {
    for (const [key, handler] of Object.entries(options.outputs)) {
      const prop = (instance as any)[key];
      if (prop && typeof prop.subscribe === 'function') {
        subscriptions.push(prop.subscribe(handler));
      }
    }
  }

  // 4. onInit Lifecycle Hook
  if (typeof (instance as any).onInit === 'function') {
    (instance as any).onInit();
  }

  // 5. Template Execution or OOP Render Fallback
  let rootNode: any = null;
  if (def && typeof def.templateFn === 'function') {
    const templateResult = def.templateFn(renderer, instance);
    rootNode = templateResult.root;
  } else if (typeof (instance as any).render === 'function') {
    rootNode = (instance as any).render(renderer);
  } else if (typeof (instance as any).getElement === 'function') {
    rootNode = (instance as any).getElement();
  } else {
    throw new Error(
      `Cannot bootstrap '${ComponentClass.name}': Missing compiled templateFn, render() method, or getElement() method.`
    );
  }

  const view = new ComponentView(rootNode);

  // 6. Attach to Container
  if (view.root && container) {
    renderer.appendChild(container, view.root);
  }

  // 7. afterRender Lifecycle Hook
  if (typeof (instance as any).afterRender === 'function') {
    (instance as any).afterRender();
  }

  const componentRef: ComponentRef<T> = {
    instance,
    view,
    hostElement: view.root,
    setInput(key: string, value: any) {
      const prop = (instance as any)[key];
      if (prop && typeof prop.set === 'function') {
        prop.set(value);
      } else {
        (instance as any)[key] = value;
      }
    },
    destroy() {
      // Unsubscribe bound outputs
      for (const sub of subscriptions) {
        try {
          sub.unsubscribe();
        } catch (e) {
          console.error('[JARVIS] Error unsubscribing output:', e);
        }
      }
      subscriptions.length = 0;

      // onDestroy Lifecycle Hook
      if (typeof (instance as any).onDestroy === 'function') {
        (instance as any).onDestroy();
      }

      // Detach view and clean up bindings
      if (view.root && container) {
        renderer.removeChild(container, view.root);
      }
      view.destroy();
    },
  };

  return componentRef;
}
