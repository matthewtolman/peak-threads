/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

importScripts("/dist/threads.iife.js")
threads.setLogging(true)

self.oninit = (conn, val) => {
    conn.context = val
}

self.onshare = (conn, {share, message}) => conn.context = (message || share)

self.ontransfer = (conn, message) => conn.context = message

self.onwork = (conn, w) => w * w

self.onevent = async (conn, e) => {
    await new Promise(res => setTimeout(res, 20))
    conn.postMessage(conn.context)
}