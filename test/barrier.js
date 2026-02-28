/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

importScripts("/dist/threads.iife.js")
threads.setLogging(true)

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
