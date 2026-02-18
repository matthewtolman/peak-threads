import {Mutex, ConditionVariable} from "../src/main.ts";

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
    for (let i = 0; i < 500; ++i) {
        await mutex.lockAsync()
        try {
            memory.set([(memory.at(0) || 0) + 1], 0)
        } finally {
            mutex.unlock()
        }
    }

    return 'done'
}
