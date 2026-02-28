/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type {ElementLayout} from "./types.ts";
import {Address, type DehydratedAddress, make} from "./memory.ts";

export interface DehydratedSemaphore {
    addr: DehydratedAddress<Int32Array>,
    value: number
}

let held: Semaphore[] = []

/**
 * A semaphore is a counting lock mechanism where there are n "resources" and a thread can acquire one of them
 * If a "resource" is not available, then it waits and blocks
 */
export class Semaphore {
    private addr: Address<Int32Array>
    private value: number

    public static ELEMENT_LAYOUT: ElementLayout = [['int32', 1]]
    public static HYDRATION_KEY = '__threads_Semaphore'

    /**
     * Creates a new semaphore from addresses
     * @param address Addresses (2) to use
     * @param value Count of resources
     * @param initMem Should be true unless hydrating
     */
    constructor(address: Address<Int32Array>, value: number) {
        this.addr = address
        this.value = value
    }

    /**
     * Makes a new semaphore
     * @param value Initial value of the semaphore
     */
    static make(value: number) {
        return make(Semaphore, value)
    }

    /**
     * Hydrates a value from a message-passed version
     * @param memory Memory to use
     * @param value Value of the semaphore
     */
    static hydrate({addr, value}: DehydratedSemaphore) {
        return new Semaphore(Address.hydrate(addr), value)
    }

    /**
     * Dehydrates a value from a message-passed version
     * @param s Semaphore to dehydrate
     */
    static dehydrate(s: Semaphore): DehydratedSemaphore {
        return {
            addr: Address.dehydrate(s.addr),
            value: s.value
        }
    }

    /**
     * Gets a list of all semaphores currently held by the current thread
     */
    static allHeld(): Semaphore[] {
        return held
    }

    /**
     * Checks if we have acquired the semaphore
     */
    public hasAcquired(): boolean {
        return held.indexOf(this) >= 0
    }

    /**
     * Acquires a resource from a semaphore
     * @param timeout Timeout to wait for acquiring
     * @return true on success, false on timeout
     */
    public acquire(timeout: number = Infinity) {
        let lastTime = Date.now()
        do {
            const val = this.addr.atomicLoad()

            // attempt to acquire a lock
            if (val < this.value && this.addr.atomicCmpExch(val, val+1) === val) {
                return true;
            }

            // wait for it to be available
            if (this.addr.atomicWait(this.value, timeout) === 'timed-out') {
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

        } while (true);
    }

    /**
     * Acquires a resource from a semaphore through a promise
     * @param timeout Timeout to wait for acquiring
     * @return Promise<true> on success, Promise<false> on timeout
     */
    public async acquireAsync(timeout: number = Infinity) {
        if (!('waitAsync' in Atomics)) {
            throw new Error("waitAsync not available!")
        }
        let lastTime = Date.now()
        do {
            const val = this.addr.atomicLoad()

            // attempt to acquire a lock
            if (val < this.value && this.addr.atomicCmpExch(val, val + 1) === val) {
                return true;
            }

            // wait for it to be available
            if (await this.addr.atomicWaitAsync(this.value, timeout) === 'timed-out') {
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
        } while (true);
    }

    /**
     * Releases a resource
     */
    public release() {
        this.addr.atomicSub(1)
        this.addr.atomicNotifyOne()
    }
}