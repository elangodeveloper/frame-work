/**
 * Native JARVIS Event system for component outputs, router events, and UI messaging.
 * Strictly NO RxJS. Backed by high-performance Set<Listener>.
 */

export interface JarvisSubscription {
  unsubscribe(): void;
}

export class JarvisEvent<T = void> {
  private readonly listeners = new Set<(value: T) => void>();

  /**
   * Dispatches an event with the given payload to all active subscribers.
   */
  emit(value: T): void {
    const active = Array.from(this.listeners);
    for (const listener of active) {
      try {
        listener(value);
      } catch (err) {
        console.error('[JarvisEvent] Error during listener execution:', err);
      }
    }
  }

  /**
   * Subscribes a listener callback to this event.
   */
  subscribe(listener: (value: T) => void): JarvisSubscription {
    this.listeners.add(listener);
    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
      },
    };
  }

  /**
   * Returns the count of active listeners.
   */
  get listenerCount(): number {
    return this.listeners.size;
  }

  /**
   * Clears all listeners.
   */
  clear(): void {
    this.listeners.clear();
  }
}

/**
 * Factory helper for creating a JarvisEvent.
 */
export function jarvisEvent<T = void>(): JarvisEvent<T> {
  return new JarvisEvent<T>();
}
