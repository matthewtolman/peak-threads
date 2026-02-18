importScripts("/dist/threads.iife.js")

/**
 * @type Mutex
 */
let mutex

/**
 * @type ConditionVariable
 */
let condVar

/**
 * @type Int32Array
 */
let memory

self.oninit = ({mux, cv, mem}) => {
    mutex = mux
    condVar = cv
    memory = mem
}

self.onwork = async (w) => {
    await mutex.lockAsync()
    try {
        memory.set([12], 0)
        condVar.notify()
    }
    finally {
        mutex.unlock()
    }
}