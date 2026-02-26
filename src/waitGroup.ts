import type {ElementLayout} from "./types.ts";
import {Address, make} from "./memory.ts";

/**
 * Defines a Go-style wait group where tasks are "added" by the scheduler and then marked "done" by a worker.
 * Another thread can wait until all the tasks are done
 */
export class WaitGroup {
    private memory: Int32Array
    private offset: number

    public static ELEMENT_LAYOUT: ElementLayout = ['int32']
    public static HYDRATION_KEY = '__threads_WaitGroup'

    /**
     * Creates a new WaitGroup from an address
     * Recommended to use @see make
     * @param address
     */
    constructor(address: Address<Int32Array>) {
        this.memory = address.memory()
        this.offset = address.offset()
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
    static hydrate({memory, offset}: { memory: Int32Array, offset: number }) {
        const addr = new Address(memory, offset, 1)
        return new WaitGroup(addr)
    }

    /**
     * Dehydrates a WaitGroup into a sendable format
     * @param wg wait group to dehydrate
     */
    static dehydrate(wg: WaitGroup) {
        return {
            memory: wg.memory,
            offset: wg.offset,
        }
    }

    /**
     * Adds n tasks to the task counter
     * @param count Number of tasks to add (defaults to 1)
     */
    public add(count: number = 1) {
        Atomics.add(this.memory, this.offset, count)
    }

    /**
     * Marks a single task as done
     */
    public done() {
        if (Atomics.sub(this.memory, this.offset, 1) <= 1) {
            Atomics.notify(this.memory, this.offset)
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
            const cur = Atomics.load(this.memory, this.offset);
            if (cur == 0) {
                return true;
            }

            if (Atomics.wait(this.memory, this.offset, cur, timeout) === 'timed-out') {
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
            const cur = Atomics.load(this.memory, this.offset);
            if (cur === 0) {
                return true;
            }

            const {async, value} = (Atomics as any).waitAsync(this.memory, this.offset, cur, timeout)
            if (async) {
                if (await value === 'timed-out') {
                    return false
                }
            } else if (value === 'timed-out') {
                return false
            }
            else {
                await new Promise((resolve) => resolve(null))
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