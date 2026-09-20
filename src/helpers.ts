/**
 * Checks if we're in a dedicated worker context
 */
export function isDedicatedWorker(): boolean {
    return typeof DedicatedWorkerGlobalScope !== 'undefined' && typeof window === "undefined" && self && self instanceof DedicatedWorkerGlobalScope;
}

/**
 * Checks if we're in a shared worker context
 */
export function isSharedWorker(): boolean {
    return typeof SharedWorkerGlobalScope !== 'undefined' && typeof window === "undefined" && self && self instanceof SharedWorkerGlobalScope;
}
