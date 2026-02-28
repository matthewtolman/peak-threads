/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

importScripts("/dist/threads.iife.js")
threads.setLogging(true)

let arrBuff = new Int32Array(new ArrayBuffer(4))

self.ontransfer = (message) => {
    arrBuff = message
}

self.onevent = async (e) => {
    postMessage(arrBuff.at(0))
}
