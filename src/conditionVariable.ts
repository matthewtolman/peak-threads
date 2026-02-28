/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type {ElementLayout} from "./types.ts";
import {Address, type DehydratedAddress, make} from "./memory.ts";
import {Mutex} from "./mutex.ts";

export interface DehydratedConditionVariable {
    addr: DehydratedAddress<Int32Array>
}

/**
 * A condition variable that can be shared across threads.
 * Allow threads to wait for a condition to change and notify each other when the condition chanes.
 *
 * Use @see make for creating a condition variable.
 */
export class ConditionVariable {
    private addr: Address<Int32Array>
    private prevOffset: number = 0
    private valOffset: number = 1

    public static ELEMENT_LAYOUT: ElementLayout = [['int32', 2]]
    public static HYDRATION_KEY = '__threads_ConditionVariable'

    /**
     * Creates a new Condition variable. Prefer calling @see make
     * @param address The address for the barrier (must be 2 32-bit signed integers in size)
     * @param address
     */
    constructor(address: Address<Int32Array>) {
        if (address.count() < 2) {
            throw new Error(`Invalid address for Condition Variable! MUST BE AT LEAST 2 ELEMENTS WIDE!`)
        }
        this.addr = address
        this.prevOffset = address.offset()
        this.valOffset = address.offset() + 1
    }

    /**
     * Creates a new condition variable and allocates the shareable memory needed
     */
    static make(): ConditionVariable {
        return make(ConditionVariable)
    }

    /**
     * Hydrates a condition variable from a dehydrated (message-passed) state
     */
    static hydrate({addr}: DehydratedConditionVariable) {
        return new ConditionVariable(Address.hydrate(addr))
    }

    /**
     * Dehydrates a condition variable so it can be passed between threads
     * @param cv Condition variable to dehydrate
     */
    static dehydrate(cv: ConditionVariable): DehydratedConditionVariable {
        return {
            addr: Address.dehydrate(cv.addr)
        }
    }

    /**
     * Waits for a condition to change. Blocking
     *
     * Note: You will need to use in a loop because the condition may have expired/revertted by the time the lock is reacquired
     * @param mux Mutex to unlock while waiting (will reacquire before returning)
     * @param timeout Optional timeout to wait for
     * @return false if timed out, true otherwise
     */
    public wait(mux: Mutex, timeout: number = Infinity) {
        const start = Date.now()
        const val = this.addr.atomicLoad(this.valOffset)
        this.addr.atomicStore(this.prevOffset, val)

        mux.unlock()

        if (this.addr.atomicWait(val, this.valOffset, timeout) === 'timed-out') {
            return false
        }

        if (!Number.isFinite(timeout)) {
            const end = Date.now()
            const elapsed = end - start
            timeout -= elapsed
            if (timeout <= 0) {
                return false;
            }
        }

        mux.lock(timeout)
        return true
    }

    /**
     * Returns a promise which waits for a condition to change
     *
     * Note: You will need to use in a loop because the condition may have expired/revertted by the time the lock is reacquired
     *
     * @param mux Mutex to unlock while waiting (will reacquire before returning)
     * @param timeout Optional timeout to wait for
     * @return Promise<false> if timed out, Promise<true> otherwise
     */
    public async waitAsync(mux: Mutex, timeout: number = Infinity) {
        if (!('waitAsync' in Atomics)) {
            throw new Error("waitAsync not available!")
        }
        const start = Date.now()
        const val = this.addr.atomicLoad(this.valOffset)
        this.addr.atomicStore(this.prevOffset, val)

        mux.unlock()

        if (await this.addr.atomicWaitAsync(val, timeout, this.valOffset) === 'timed-out') {
            return false
        }

        if (!Number.isFinite(timeout)) {
            const end = Date.now()
            const elapsed = end - start
            timeout -= elapsed
            if (timeout <= 0) {
                return false;
            }
        }

        return await mux.lockAsync(timeout)
    }

    /**
     * Notify one or more threads that the condition has changed
     * @param count How many threads to notify (usually 1 or Infinity)
     */
    public notify(count: number = 1) {
        const val = this.addr.atomicLoad(this.prevOffset)
        this.addr.atomicStore((val + 1) | 0, this.valOffset)
        this.addr.atomicNotify(count, this.valOffset)
    }
}