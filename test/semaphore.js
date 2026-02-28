/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

importScripts("/dist/threads.iife.js")
threads.setLogging(true)

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
