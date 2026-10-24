/**
 * Fine-grained reactive dependency tracking graph.
 */

export interface Producer {
  subscribers: Set<Consumer>;
}

export interface Consumer {
  dependencies: Set<Producer>;
  markDirty(): void;
  cleanup?(): void;
}

let activeConsumer: Consumer | null = null;
const consumerStack: (Consumer | null)[] = [];

/**
 * Pushes a new active consumer onto the context stack.
 */
export function setActiveConsumer(consumer: Consumer | null): void {
  consumerStack.push(activeConsumer);
  activeConsumer = consumer;
}

/**
 * Pops the current active consumer from the context stack.
 */
export function restoreActiveConsumer(): void {
  activeConsumer = consumerStack.pop() ?? null;
}

/**
 * Returns the currently executing consumer, if any.
 */
export function getActiveConsumer(): Consumer | null {
  return activeConsumer;
}

/**
 * Registers a dynamic dependency edge between current active consumer and a producer.
 */
export function trackProducer(producer: Producer): void {
  if (activeConsumer) {
    producer.subscribers.add(activeConsumer);
    activeConsumer.dependencies.add(producer);
  }
}

/**
 * Clears all dependency connections for a consumer before re-computation.
 */
export function cleanupConsumer(consumer: Consumer): void {
  for (const producer of consumer.dependencies) {
    producer.subscribers.delete(consumer);
  }
  consumer.dependencies.clear();
}
