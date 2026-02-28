/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export function RegisterHandler(handler: (_?: any) => any, type = 'event') {
    if (self) {
        switch (type) {
            case 'init':
                (self as any).oninit = handler
                break
            case 'event':
                (self as any).onevent = handler
                break
            case 'share':
                (self as any).onshare = handler
                break
            case 'transfer':
                (self as any).ontransfer = handler
                break
            case 'work':
                (self as any).onwork = handler
                break
            case 'close':
                (self as any).onclose = handler
                break
        }
    } else {
        throw new Error('RegisterHandler only usable from worker thread!')
    }
}