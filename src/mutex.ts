/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type {ElementLayout} from "./types.ts";
import {Address, type DehydratedAddress, make} from "./memory.ts";

export interface DehydratedMutex {
    addr: DehydratedAddress<Int32Array>
}

let held: Mutex[] = []

export class Mutex {
    private static unlocked = 0
    private static locked = 1
    private static contended = 2

    public static ELEMENT_LAYOUT: ElementLayout = [['int32', 2]]
    public static HYDRATION_KEY = '__threads_Mutex'

    private addr: Address<Int32Array>

    /**
     * Creates a new Mutex (recommended to use the static @see make function)
     * @param address
     */
    constructor(address: Address<Int32Array>) {
        this.addr = address
    }

    /**
     * Makes a new Mutex (handles allocating shared array buffers)
     */
    static make() {
        return make(Mutex)
    }

    /**
     * Hydreates a mutex from a dehydrated (message passed) state
     * @param addr Dehydrated address
     */
    static hydrate({addr}: DehydratedMutex) {
        return new Mutex(Address.hydrate(addr))
    }

    /**
     * Dehydrates a mutex (prepares it for message passsing)
     * @param mux Mutex to dehydrate
     */
    static dehydrate(mux: Mutex): DehydratedMutex {
        return {
            addr: Address.dehydrate(mux.addr)
        }
    }

    /**
     * Gets a list of all held mutexes
     */
    static allHeld(): Mutex[] {
        return held
    }

    /**
     * Locks the mutex (blocking)
     *
     * If given a timeout, then it will try to lock before the timeout occurs, otherwise it will fail to lock
     *
     * @param timeout Timeout (in milliseconds) for obtaining the lock
     * @returns {boolean} True if got the lock, false if timed out
     */
    public lock(timeout: number = Infinity): boolean {
        if (this.addr.atomicCmpExch(Mutex.unlocked, Mutex.locked) === Mutex.unlocked) {
            held.push(this)
            return true; /* got the lock */
        }

        let lastTime = Date.now()

        while (true) {
            this.addr.atomicCmpExch(Mutex.locked, Mutex.contended)

            const r = this.addr.atomicWait(Mutex.contended, timeout)
            if (r === "timed-out") {
                return false
            }

            if (this.addr.atomicCmpExch(Mutex.unlocked, Mutex.contended) === Mutex.unlocked) {
                held.push(this)
                return true /* got the lock */
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
     * Checks if we have a lock on the mutex
     */
    public hasLock(): boolean {
        return held.indexOf(this) >= 0
    }

    /**
     * Asynchronously locks a mutex.
     * Returns a promise which resolves to true if the lock was obtained, or false otherwise
     * @param timeout Timeout (in milliseconds) for obtaining the lock
     * @returns {Promise<boolean>} Promise that resolves to true if got the lock, false if timed out
     */
    public async lockAsync(timeout: number = Infinity): Promise<boolean> {
        if (!('waitAsync' in Atomics)) {
            throw new Error("waitAsync not available!")
        }
        if (this.addr.atomicCmpExch(Mutex.unlocked, Mutex.locked) === Mutex.unlocked) {
            held.push(this)
            return true; /* got the lock */
        }

        let lastTime = Date.now()

        while (true) {
            this.addr.atomicCmpExch(Mutex.locked, Mutex.contended)

            const r = await this.addr.atomicWaitAsync(Mutex.contended, timeout)
            if (r === 'timed-out') {
                return false
            }

            if (this.addr.atomicCmpExch(Mutex.unlocked, Mutex.contended) === Mutex.unlocked) {
                held.push(this)
                return true; /* got the lock */
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
     * Tries to get a lock without waiting. Only locks if the mutex is unlocked and not contended
     * @returns {boolean} True if it got the lock, false otherwise
     */
    public tryLock() {
        // Try to get the lock (will only lock if we're unlocked)
        const r = this.addr.atomicCmpExch(Mutex.unlocked, Mutex.locked) === Mutex.unlocked
        if (r) {
            held.push(this)
        }
        return r
    }

    /**
     * Unlocks the mutex
     */
    public unlock() {
        if (this.addr.atomicSub() !== Mutex.locked) {
            this.addr.atomicStore(Mutex.unlocked)
            this.addr.atomicNotifyOne()
        }
        held.splice(held.indexOf(this), 1)
    }
}