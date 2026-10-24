import { signal, type Signal } from '../../reactive/src/index.ts';
import { JarvisEvent, type JarvisSubscription } from './event.ts';

export const JARVIS_INPUT_METADATA = Symbol.for('jarvis:input_metadata');
export const JARVIS_OUTPUT_METADATA = Symbol.for('jarvis:output_metadata');

export interface InputSignal<T> extends Signal<T> {
  readonly [JARVIS_INPUT_METADATA]: {
    required: boolean;
    defaultValue?: T;
  };
}

export interface OutputEmitter<T> {
  emit(value: T): void;
  subscribe(listener: (value: T) => void): JarvisSubscription;
  readonly listenerCount: number;
  readonly [JARVIS_OUTPUT_METADATA]: true;
}

/**
 * Creates an optional signal-based component input.
 *
 * @example
 * readonly title = input('Default Title');
 */
export function input<T>(initialValue?: T): InputSignal<T> {
  const innerSignal = signal<T>(initialValue as T);

  const accessor = (() => innerSignal()) as InputSignal<T>;
  accessor.get = () => innerSignal.get();
  accessor.set = (val: T) => innerSignal.set(val);
  accessor.update = (fn: (prev: T) => T) => innerSignal.update(fn);

  Object.defineProperty(accessor, JARVIS_INPUT_METADATA, {
    value: { required: false, defaultValue: initialValue },
    writable: false,
    enumerable: false,
  });

  return accessor;
}

/**
 * Creates a required signal-based component input.
 *
 * @example
 * readonly user = input.required<User>();
 */
input.required = function <T>(): InputSignal<T> {
  let isAssigned = false;
  const innerSignal = signal<T>(undefined as unknown as T);

  const accessor = (() => {
    return innerSignal();
  }) as InputSignal<T>;

  accessor.get = () => innerSignal.get();
  accessor.set = (val: T) => {
    isAssigned = true;
    innerSignal.set(val);
  };
  accessor.update = (fn: (prev: T) => T) => {
    isAssigned = true;
    innerSignal.update(fn);
  };

  Object.defineProperty(accessor, JARVIS_INPUT_METADATA, {
    value: { required: true },
    writable: false,
    enumerable: false,
  });

  return accessor;
};

/**
 * Creates a component output event emitter.
 * Strictly zero RxJS. Backed by JarvisEvent.
 *
 * @example
 * readonly selected = output<User>();
 * this.selected.emit(user);
 */
export function output<T = void>(): OutputEmitter<T> {
  const event = new JarvisEvent<T>();

  const emitter: OutputEmitter<T> = {
    emit(value: T) {
      event.emit(value);
    },
    subscribe(listener: (value: T) => void): JarvisSubscription {
      return event.subscribe(listener);
    },
    get listenerCount() {
      return event.listenerCount;
    },
    [JARVIS_OUTPUT_METADATA]: true as const,
  };

  return emitter;
}
