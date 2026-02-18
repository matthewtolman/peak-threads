importScripts("/dist/threads.iife.js")

/**
 * @type Semaphore
 */
let semaphore

/**
 * @type Int32Array
 */
let memory

self.oninit = ({sem, mem}) => {
    semaphore = sem
    memory = mem
}

self.onwork = async (w) => {
    for (let i = 0; i < 200; ++i) {
        semaphore.acquire()
        try {
            memory.set([(memory.at(0) || 0) + 1], 0)
        } finally {
            semaphore.release()
        }
    }

    return 'done'
}
