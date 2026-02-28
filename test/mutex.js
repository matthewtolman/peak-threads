/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

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
