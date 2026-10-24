import type { Signal } from '../../../../packages/reactive/src/index.ts';
import { effect } from '../../../../packages/reactive/src/index.ts';
import type { Renderer } from '../../../../packages/renderer/src/index.ts';

/**
 * Checks if a value is an Jarvis Signal accessor.
 */
export function isSignal<T>(val: any): val is Signal<T> {
  return typeof val === 'function';
}

/**
 * Unwraps a value or a Signal into its current raw value.
 */
export function unwrap<T>(val: Signal<T> | T | undefined): T | undefined {
  if (isSignal<T>(val)) {
    return val();
  }
  return val;
}

/**
 * OOAD Base class for Jarvis-PrimeNG component adapters.
 * Manages fine-grained effect lifecycles, host node binding, and cleanup.
 */
export abstract class JarvisPrimeComponent<TElement = any> {
  protected readonly renderer: Renderer;
  protected hostElement: TElement | null = null;
  private readonly disposers: (() => void)[] = [];

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  /**
   * Binds a reactive computation to a side-effect, ensuring cleanup on destroy.
   */
  protected bindReactive<V>(compute: () => V, apply: (value: V) => void): void {
    const dispose = effect(() => {
      const val = compute();
      apply(val);
    });
    this.disposers.push(dispose);
  }

  /**
   * Destroys all active subscriptions and effects.
   */
  destroy(): void {
    for (const dispose of this.disposers) {
      try {
        dispose();
      } catch (err) {
        console.error('[JarvisPrimeComponent] Error during teardown:', err);
      }
    }
    this.disposers.length = 0;
    this.hostElement = null;
  }

  getElement(): TElement | null {
    return this.hostElement;
  }
}

// Backwards-compatible alias
