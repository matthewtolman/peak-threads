import type {ElementLayout} from "./types.ts";
import {Address, make} from "./memory.ts";

export class Mutex {
    private static unlocked = 0
    private static locked = 1
    private static contended = 2

    public static ELEMENT_LAYOUT: ElementLayout = [['int32', 2]]
    public static HYDRATION_KEY = '__threads_Mutex'

    private memory: Int32Array
    private offset: number

    constructor(address: Address<Int32Array>) {
        this.memory = address.memory()
        this.offset = address.offset()
    }

    static make() {
        return make(Mutex)
    }

    static hydrate({memory, offset}: { memory: Int32Array, offset: number }) {
        const addr = new Address(memory, offset)
        return new Mutex(addr)
    }

    static dehydrate(mux: Mutex) {
        return {
            memory: mux.memory,
            offset: mux.offset,
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
        if (Atomics.compareExchange(this.memory, this.offset, Mutex.unlocked, Mutex.locked) === Mutex.unlocked) {
            return true /* got the lock */
        }
        let lastTime = Date.now()

        while (true) {
            Atomics.compareExchange(this.memory, this.offset, Mutex.locked, Mutex.contended)
            const r = Atomics.wait(this.memory, this.offset, Mutex.contended, timeout)
            if (r === "timed-out") {
                return false
            }

            if (Atomics.compareExchange(this.memory, this.offset, Mutex.unlocked, Mutex.contended) === Mutex.unlocked) {
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
        let cur = Atomics.compareExchange(this.memory, this.offset, Mutex.unlocked, Mutex.locked)
        if (cur === Mutex.unlocked) {
            return true /* got the lock */
        }
        let lastTime = Date.now()

        while (true) {
            if (cur !== Mutex.contended) {
                Atomics.compareExchange(this.memory, this.offset, cur, Mutex.contended)
            }
            const {async, value} = (Atomics as any).waitAsync(this.memory, this.offset, Mutex.contended, timeout)
            if (async) {
                const r = await value
                if (r === 'timed-out') {
                    return false
                }
            } else if (value === 'timed-out') {
                return false
            }
            else {
                await new Promise((resolve) => resolve(null))
            }

            cur = Atomics.compareExchange(this.memory, this.offset, Mutex.unlocked, Mutex.contended)
            if (cur === Mutex.unlocked) {
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
     * Tries to get a lock without waiting. Only locks if the mutex is unlocked and not contended
     * @returns {boolean} True if it got the lock, false otherwise
     */
    public tryLock() {
        // Try to get the lock (will only lock if we're unlocked)
        let cur = Atomics.compareExchange(this.memory, this.offset, Mutex.unlocked, Mutex.locked)
        return cur === Mutex.unlocked;
    }

    /**
     * Unlocks the mutex
     */
    public unlock() {
        if (Atomics.sub(this.memory, this.offset, 1) === Mutex.contended) {
            Atomics.store(this.memory, this.offset, Mutex.unlocked)
            Atomics.notify(this.memory, this.offset, 1)
        }
    }
}