/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

importScripts("/dist/threads.iife.js")
threads.setLogging(true)

self.ontransfer = (conn, message) => {
    conn.context = message
}

self.onevent = async (conn, e) => {
    conn.postMessage(conn.context.at(0))
}
