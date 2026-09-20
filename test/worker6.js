/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

importScripts("/dist/threads.iife.js");
threads.setLogging(true);

let storage = null;

serve({
  thread: {
    work: w => w * w,
    transfer: m => storage = m,
    share: ({share, message}) => (storage = message || share),
    event: async (e) => {
      await new Promise((res) => setTimeout(res, 20));
      postMessage(storage);
    },
    init: v => storage = v
  }
})
