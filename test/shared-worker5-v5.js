/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

importScripts("/dist/threads.iife.js");
threads.setLogging(true);

console.log(self instanceof SharedWorkerGlobalScope)

serve({
    thread: {
        init: (conn, v) => {
            conn.context = v
        },
        share: (conn, {share, message}) => (conn.context = message || share),
        transfer: (conn, m) => (conn.context = m),
        work: (conn, w) => w * w,
        event: async (conn, e) => {
            await new Promise((res) => setTimeout(res, 20));
            conn.postMessage(conn.context);
        }
    }
})
