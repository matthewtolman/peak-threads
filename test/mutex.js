importScripts("/dist/threads.iife.js")
threads.setLogging(true)

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
            await new Promise((res) => {
                setTimeout(() => res(), 1)
            })
        }
        finally {
            mutex.unlock()
        }
    }

    return 'done'
}
