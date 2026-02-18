importScripts("/dist/threads.iife.js")

/**
 * @type WaitGroup
 */
let waitGroup

/**
 * @type Int32Array
 */
let memory

self.oninit = ({wg, mem}) => {
    waitGroup = wg
    memory = mem
}

self.onwork = async (w) => {
    Atomics.add(memory, 0, w)
    waitGroup.done()
}