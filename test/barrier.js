importScripts("/dist/threads.iife.js")

/**
 * @type Barrier
 */
let barrier

/**
 * @type Int32Array
 */
let memory

self.oninit = ({bar, mem}) => {
    barrier = bar
    memory = mem
}

self.onwork = async (w) => {
    Atomics.add(memory, 0, w)
    barrier.wait()
}
