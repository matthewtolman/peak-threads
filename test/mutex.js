importScripts("/dist/threads.iife.js")

/**
 * @type Mutex
 */
let mutex

/**
 * @type Int32Array
 */
let memory

self.oninit = ({mux, mem}) => {
    mutex = mux
    memory = mem
}

self.onwork = async (w) => {
    for (let i = 0; i < w; ++i) {
        mutex.lock()
        try {
            const val = (memory.at(0) || 0)
            memory.set([val + 1], 0)
            const l = Atomics.load(threads.Mutex.dehydrate(mutex).memory, 0)
            if (l === 0) {
                console.error('BAD UNLOCK DETECTED!')
            }
            await new Promise((res) => {
                setTimeout(() => res(), 10)
            })
        } finally {
            mutex.unlock()
        }
    }

    return 'done'
}
