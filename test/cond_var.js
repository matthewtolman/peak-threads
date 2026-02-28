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