import type { Renderer } from '@jarvis/renderer';
import { bootstrap, type ComponentRef } from '@jarvis/runtime';

export interface MountOptions {
  inputs?: Record<string, any>;
  outputs?: Record<string, (val: any) => void>;
  providers?: any[];
}

/**
 * Mounts a component into a host element with lifecycle and input/output contracts.
 * Preserves component identity, enables fine-grained updates, and prevents memory leaks.
 */
export function mountComponent<T>(
  renderer: Renderer,
  ComponentClass: new (...args: any[]) => T,
  container: any,
  options?: MountOptions
): ComponentRef<T> {
  return bootstrap(ComponentClass, container, renderer, {
    inputs: options?.inputs,
    outputs: options?.outputs,
  });
}

/**
 * Safely unmounts and disposes a component reference.
 */
export function unmountComponent(ref: ComponentRef | null): void {
  if (ref) {
    try {
      ref.destroy();
    } catch (err) {
      console.error('[JARVIS Layout] Error unmounting component:', err);
    }
  }
}
