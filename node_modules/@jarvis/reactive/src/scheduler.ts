/**
 * Fine-grained microtask batch scheduler.
 */

const pendingJobs = new Set<() => void>();
let isScheduled = false;
let batchDepth = 0;

/**
 * Enqueues a job (such as an effect or DOM update) to be run in the next microtask or batch end.
 */
export function scheduleJob(job: () => void): void {
  pendingJobs.add(job);
  if (batchDepth === 0 && !isScheduled) {
    isScheduled = true;
    queueMicrotask(flushJobs);
  }
}

/**
 * Flushes all pending jobs in the queue synchronously.
 */
export function flushJobs(): void {
  isScheduled = false;
  while (pendingJobs.size > 0) {
    const jobs = Array.from(pendingJobs);
    pendingJobs.clear();
    for (const job of jobs) {
      job();
    }
  }
}

/**
 * Groups multiple signal mutations, deferring all effect updates until the batch callback completes.
 */
export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      flushJobs();
    }
  }
}
