import type {ElementLayout} from "./types.ts";
import {Address, type DehydratedAddress, make} from "./memory.ts";

export interface DehydratedMutex {
    addr: DehydratedAddress<Int32Array>
}

export class Mutex {
    private static unlocked = 0
    private static locked = 1
    private static contended = 2

    public static ELEMENT_LAYOUT: ElementLayout = [['int32', 2]]
    public static HYDRATION_KEY = '__threads_Mutex'

    private addr: Address<Int32Array>

    constructor(address: Address<Int32Array>) {
        this.addr = address
    }

    static make() {
        return make(Mutex)
    }

    static hydrate({addr}: DehydratedMutex) {
        return new Mutex(Address.hydrate(addr))
    }

    static dehydrate(mux: Mutex): DehydratedMutex {
        return {
            addr: Address.dehydrate(mux.addr)
        }
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
        return this.addr.atomicCmpExch(Mutex.unlocked, Mutex.locked) === Mutex.unlocked
    }

    /**
     * Unlocks the mutex
     */
    public unlock() {
        if (this.addr.atomicSub() !== Mutex.locked) {
            this.addr.atomicStore(Mutex.unlocked)
            this.addr.atomicNotifyOne()
        }
    }
}