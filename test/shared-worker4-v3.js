/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

importScripts("/dist/threads.iife.js");
threads.setLogging(true);

console.log(self instanceof SharedWorkerGlobalScope)

registerSharedHandler('init', (conn, val) => {
  conn.context = val;
})

registerSharedHandler('share', (conn, { share, message }) => (conn.context = message || share))
registerSharedHandler('transfer', (conn, message) => (conn.context = message))
registerSharedHandler('work', (conn, w) => w * w)
registerSharedHandler('event', async (conn, e) => {
  await new Promise((res) => setTimeout(res, 20));
  conn.postMessage(conn.context);
})
