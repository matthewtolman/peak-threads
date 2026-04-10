/**
 * Exception to represent that work failed due to a thread being closed/terminated
 */
export class ThreadClosedError extends Error {
  constructor(options?: ErrorOptions) {
    super("Thread Closed", options);
  }
}

/**
 * Exception to represent that work failed due to the thread pool being closed/terminated
 */
export class ThreadPoolClosedError extends Error {
  constructor() {
    super("ThreadPool Closed");
  }
}

/**
 * Thrown when a DeHydration registration request was malformed
 */
export class BadDeHydrationError extends Error {
  constructor(extra?: string) {
    super("Bad DeHydration registration!" + (extra ? " " + extra : ""));
  }
}

/**
 * Thrown when a bad response is sent by the worker thread.
 * Generally indicates a library version mismatch between threads
 * or an error in a raw postMessage call.
 */
export class BadResponseError extends Error {
  constructor() {
    super("Bad response from worker thread");
  }
}

/**
 * Thrown when a bad message is sent by the parent thread.
 * Generally indicates a library version mismatch between threads
 * or an error in a raw postMessage call.
 */
export class BadMessageError extends Error {
  constructor() {
    super("Bad message from parent thread");
  }
}

/**
 * Thrown when a thread failed to spawn
 */
export class ThreadSpawnFailedError extends Error {
  constructor(cause?: unknown) {
    super("Thread Spawn Failed!", cause ? { cause } : undefined);
  }
}

/**
 * Exception to represent that a provided address is an invalid location to store
 * a shared data structure
 */
export class InvalidAddressError extends Error {
  constructor(num: number, width: number | string) {
    super(`Invalid address! Must be at least ${num} * ${width} wide!`);
  }
}

/**
 * Exception indicating that the required browser feature Atomics.waitAsync
 * is not available
 */
export class NoWaitAsyncError extends Error {
  constructor() {
    super("Atomics.waitAsync not available!");
  }
}

/**
 * Exception to indicate an out-of-bounds error happened
 (usually related to memeory or address out of bounds accesses)
 */
export class OutOfBoundsError extends Error {
  constructor() {
    super("Out of bounds access detected!");
  }
}

/**
 * Error to indicate that the provided memory region does not support atomic operations
 */
export class MemoryNotAtomicError extends Error {
  constructor() {
    super("Invalid underlying memory for atomic operations!");
  }
}

/**
 * Thrown when a memory layout provided to 'make' is invalid
 */
export class InvalidMemoryLayoutError extends Error {
  constructor(layout: string) {
    super(layout);
  }
}

/**
 * Thrown when a worker-only method is called from the main thread
 */
export class NotInWorkerThread extends Error {
  constructor(method: string) {
    super(`Method ${method} only usable from worker thread!`);
  }
}
