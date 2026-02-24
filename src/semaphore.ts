import type {ElementLayout} from "./types.ts";
import {Address, make} from "./memory.ts";

/**
 * A semaphore is a counting lock mechanism where there are n "resources" and a thread can acquire one of them
 * If a "resource" is not available, then it waits and blocks
 */
export class Semaphore {
    private memory: Int32Array
    private valOffset: number
    private waiterOffset: number
    private value: number

    public static ELEMENT_LAYOUT: ElementLayout = [['int32', 2]]
    public static HYDRATION_KEY = '__threads_Semaphore'

    /**
     * Creates a new semaphore from addresses
     * @param address Addresses (2) to use
     * @param value Count of resources
     * @param initMem Should be true unless hydrating
     */
    constructor(address: Address<Int32Array>, value: number, initMem: boolean = true) {
        this.memory = address.memory()
        this.valOffset = address.offset()
        this.value = value
        this.waiterOffset = this.valOffset + 1
        if (address.count() < 2) {
            throw new Error("INVALID ADDRESS! MUST BE AT LEAST 2 ELEMENTS WIDE!")
        }

        if (initMem) {
            this.memory.set([value], this.valOffset)
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
    static hydrate({memory, value, cnt}: { memory: Int32Array, value: number, cnt: number }) {
        const addr = new Address(memory, 0, cnt)
        return new Semaphore(addr, value, false)
    }

    /**
     * Dehydrates a value from a message-passed version
     * @param s Semaphore to dehydrate
     */
    static dehydrate(s: Semaphore) {
        return {
            memory: s.memory,
            offset: s.valOffset,
            value: s.value,
            cnt: 2
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
            const val = Atomics.load(this.memory, this.valOffset);

            // attempt to acquire a lock
            if (val > 0 && Atomics.compareExchange(this.memory, this.valOffset, val, val - 1) === val) {
                return true;
            }

            Atomics.add(this.memory, this.waiterOffset, 1);

            // wait for it to be available
            if (Atomics.wait(this.memory, this.valOffset, 0, timeout) === 'timed-out') {
                return false
            }
            Atomics.sub(this.memory, this.waiterOffset, 1);
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
            const val = Atomics.load(this.memory, this.valOffset);

            // attempt to acquire a lock
            if (val > 0 && Atomics.compareExchange(this.memory, this.valOffset, val, val - 1) === val) {
                return true;
            }

            Atomics.add(this.memory, this.waiterOffset, 1);

            // wait for it to be available
            const {async, value} = (Atomics as any).waitAsync(this.memory, this.valOffset, 0)
            if (async) {
                if (await value === 'timed-out') {
                    return false
                }
            } else if (value === 'timed-out') {
                return false
            }
            Atomics.sub(this.memory, this.waiterOffset, 1);
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
        Atomics.add(this.memory, this.valOffset, 1)

        if (Atomics.load(this.memory, this.waiterOffset) > 0) {
            Atomics.notify(this.memory, this.valOffset, 1)
        }
    }
}