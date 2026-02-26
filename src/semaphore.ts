import type {ElementLayout} from "./types.ts";
import {Address, type DehydratedAddress, make} from "./memory.ts";

export interface DehydratedSemaphore {
    addr: DehydratedAddress<Int32Array>,
    value: number
}

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
    constructor(address: Address<Int32Array>, value: number, initMem: boolean = true) {
        this.addr = address
        this.value = value

        if (initMem) {
            this.addr.set(value)
        }
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
        return new Semaphore(Address.hydrate(addr), value, false)
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
     * Acquires a resource from a semaphore
     * @param timeout Timeout to wait for acquiring
     * @return true on success, false on timeout
     */
    public acquire(timeout: number = Infinity) {
        let lastTime = Date.now()
        do {
            const val = this.addr.atomicLoad()

            // attempt to acquire a lock
            if (val > 0 && this.addr.atomicCmpExch(val, val-1) === val) {
                return true;
            }

            // wait for it to be available
            if (this.addr.atomicWait(0, timeout) === 'timed-out') {
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
            if (val > 0 && this.addr.atomicCmpExch(val, val - 1) === val) {
                return true;
            }

            // wait for it to be available
            if (await this.addr.atomicWaitAsync(0, timeout) === 'timed-out') {
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
        this.addr.atomicAdd(1)
        this.addr.atomicNotifyOne()
    }
}