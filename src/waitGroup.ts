/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type {ElementLayout} from "./types.ts";
import {Address, type DehydratedAddress, make} from "./memory.ts";

export interface DehydratedWaitGroup {
    addr: DehydratedAddress<Int32Array>
}

/**
 * Defines a Go-style wait group where tasks are "added" by the scheduler and then marked "done" by a worker.
 * Another thread can wait until all the tasks are done
 */
export class WaitGroup {
    private addr: Address<Int32Array>

    public static ELEMENT_LAYOUT: ElementLayout = ['int32']
    public static HYDRATION_KEY = '__threads_WaitGroup'

    /**
     * Creates a new WaitGroup from an address
     * Recommended to use @see make
     * @param address
     */
    constructor(address: Address<Int32Array>) {
        this.addr = address
    }

    /**
     * Makes a new wait group and handles all allocations (recommended)
     */
    public static make() {
        return make(WaitGroup)
    }

    /**
     * Hydrates a WaitGroup from a dehydrated state
     * @param memory Memory for the hydration
     * @param offset Offset of waitgroup address
     */
    static hydrate({addr}: DehydratedWaitGroup) {
        return new WaitGroup(Address.hydrate(addr))
    }

    /**
     * Dehydrates a WaitGroup into a sendable format
     * @param wg wait group to dehydrate
     */
    static dehydrate(wg: WaitGroup): DehydratedWaitGroup {
        return {
            addr: Address.dehydrate(wg.addr)
        }
    }

    /**
     * Adds n tasks to the task counter
     * @param count Number of tasks to add (defaults to 1)
     */
    public add(count: number = 1) {
        this.addr.atomicAdd(count)
    }

    /**
     * Marks a single task as done
     */
    public done() {
        if (this.addr.atomicSub(1) <= 1) {
            this.addr.atomicNotifyAll()
        }
    }

    /**
     * Waits until all tasks are done
     * Note: you MUST add all tasks prior to calling wait
     * @param timeout Timeout to wait for
     * @return true on success, false on timeout
     */
    public wait(timeout: number = Infinity) {
        let lastTime = Date.now()
        while (true) {
            const cur = this.addr.atomicLoad()
            if (cur == 0) {
                return true;
            }

            if (this.addr.atomicWait(cur, timeout) === 'timed-out') {
                return false
            }

            if (Number.isFinite(timeout)) {
                let curTime = Date.now()
                let elapsed = curTime - lastTime
                timeout -= elapsed
                lastTime = curTime
                if (timeout <= 0) {
                    return false
                }
            }
        }
    }

    /**
     * Returns a promise that waits until all tasks are done
     * @param timeout Timeout to wait for
     * @return Promise<true> on success, Promise<false> on timeout
     */
    public async waitAsync(timeout: number = Infinity) {
        if (!('waitAsync' in Atomics)) {
            throw new Error("waitAsync not available!")
        }

        let lastTime = Date.now()
        while (true) {
            const cur = this.addr.atomicLoad()
            if (cur === 0) {
                return true;
            }

            if (await this.addr.atomicWaitAsync(cur, timeout) === 'timed-out') {
                return false
            }

            if (Number.isFinite(timeout)) {
                let curTime = Date.now()
                let elapsed = curTime - lastTime
                timeout -= elapsed
                lastTime = curTime
                if (timeout <= 0) {
                    return false
                }
            }
        }
    }
}