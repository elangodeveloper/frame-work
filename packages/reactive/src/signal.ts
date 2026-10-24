import type { Consumer, Producer } from './graph.ts';
import {
  cleanupConsumer,
  restoreActiveConsumer,
  setActiveConsumer,
  trackProducer,
} from './graph.ts';
import { scheduleJob } from './scheduler.ts';

export interface Signal<T> {
  (): T;
  get(): T;
  set(value: T): void;
  update(fn: (prev: T) => T): void;
}

class SignalNode<T> implements Producer {
  subscribers = new Set<Consumer>();
  private value: T;

  constructor(value: T) {
    this.value = value;
  }

  get(): T {
    trackProducer(this);
    return this.value;
  }

  set(newValue: T): void {
    if (!Object.is(this.value, newValue)) {
      this.value = newValue;
      this.notify();
    }
  }

  update(fn: (prev: T) => T): void {
    this.set(fn(this.value));
  }

  private notify(): void {
    const subs = Array.from(this.subscribers);
    for (const sub of subs) {
      sub.markDirty();
    }
  }
}

/**
 * Creates a reactive read-write signal.
 */
export function signal<T>(initialValue: T): Signal<T> {
  const node = new SignalNode(initialValue);

  const accessor = (() => node.get()) as Signal<T>;
  accessor.get = () => node.get();
  accessor.set = (val: T) => node.set(val);
  accessor.update = (fn: (prev: T) => T) => node.update(fn);

  return accessor;
}

export interface Computed<T> {
  (): T;
  get(): T;
}

class ComputedNode<T> implements Producer, Consumer {
  subscribers = new Set<Consumer>();
  dependencies = new Set<Producer>();
  private dirty = true;
  private cachedValue!: T;
  private readonly computeFn: () => T;

  constructor(computeFn: () => T) {
    this.computeFn = computeFn;
  }

  get(): T {
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

  markDirty(): void {
    if (!this.dirty) {
      this.dirty = true;
      const subs = Array.from(this.subscribers);
      for (const sub of subs) {
        sub.markDirty();
      }
    }
  }
}

/**
 * Creates a memoized reactive derivation that recomputes lazily.
 */
export function computed<T>(fn: () => T): Computed<T> {
  const node = new ComputedNode(fn);
  const accessor = (() => node.get()) as Computed<T>;
  accessor.get = () => node.get();
  return accessor;
}

class EffectNode implements Consumer {
  dependencies = new Set<Producer>();
  private disposed = false;
  private scheduled = false;
  private cleanupFn?: () => void;
  private readonly effectFn: () => void | (() => void);

  constructor(effectFn: () => void | (() => void)) {
    this.effectFn = effectFn;
    this.run();
  }

  run(): void {
    if (this.disposed) return;
    this.scheduled = false;

    if (this.cleanupFn) {
      try {
        this.cleanupFn();
      } catch (err) {
        console.error('Error during effect cleanup:', err);
      }
      this.cleanupFn = undefined;
    }

    cleanupConsumer(this);
    setActiveConsumer(this);
    try {
      const res = this.effectFn();
      if (typeof res === 'function') {
        this.cleanupFn = res;
      }
    } finally {
      restoreActiveConsumer();
    }
  }

  markDirty(): void {
    if (!this.disposed && !this.scheduled) {
      this.scheduled = true;
      scheduleJob(() => this.run());
    }
  }

  dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      if (this.cleanupFn) {
        this.cleanupFn();
        this.cleanupFn = undefined;
      }
      cleanupConsumer(this);
    }
  }
}

/**
 * Creates a reactive side-effect that executes immediately and re-runs on dependency changes.
 */
export function effect(fn: () => void | (() => void)): () => void {
  const node = new EffectNode(fn);
  return () => node.dispose();
}

/**
 * Runs a function without subscribing the surrounding active consumer.
 */
export function untracked<T>(fn: () => T): T {
  setActiveConsumer(null);
  try {
    return fn();
  } finally {
    restoreActiveConsumer();
  }
}

export interface ResourceOptions<T, P> {
  loader: (params: { params: P; signal: AbortSignal }) => Promise<T>;
}

export interface ResourceRef<T> {
  value: Signal<T | undefined>;
  loading: Signal<boolean>;
  error: Signal<Error | null>;
  reload: () => Promise<void>;
}

/**
 * Creates an asynchronous data resource bound to signals and AbortSignal cancellation.
 * Automatically triggers reload whenever dependencies inside the source accessor change.
 */
export function resource<T, P = void>(
  source: () => P,
  options: ResourceOptions<T, P>
): ResourceRef<T> {
  const value = signal<T | undefined>(undefined);
  const loading = signal<boolean>(true);
  const error = signal<Error | null>(null);

  let currentController: AbortController | null = null;

  const runFetch = async (p: P) => {
    if (currentController) {
      currentController.abort();
    }
    currentController = new AbortController();
    const abortSignal = currentController.signal;

    loading.set(true);
    error.set(null);

    try {
      const result = await options.loader({ params: p, signal: abortSignal });
      if (!abortSignal.aborted) {
        value.set(result);
        loading.set(false);
      }
    } catch (err: any) {
      if (!abortSignal.aborted) {
        error.set(err instanceof Error ? err : new Error(String(err)));
        loading.set(false);
      }
    }
  };

  effect(() => {
    const p = source();
    loading.set(true);
    untracked(() => {
      runFetch(p);
    });
    return () => {
      if (currentController) {
        currentController.abort();
      }
    };
  });

  return {
    value,
    loading,
    error,
    reload: async () => {
      const p = untracked(() => source());
      await runFetch(p);
    },
  };
}
