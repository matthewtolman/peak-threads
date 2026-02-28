/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

importScripts("/dist/threads.iife.js")
threads.setLogging(true)

let storage = null

self.oninit = (val) => storage = val

self.onshare = ({share, message}) => storage = (message || share)

self.ontransfer = (message) => storage = message

self.onwork = async (w) => {
    try {
        return w * w
    }
    finally {
        new Promise(r => setTimeout(r, 0)).then(close)
    }
}

self.onevent = async (e) => {
    await new Promise(res => setTimeout(res, 20))
    postMessage(storage)
}