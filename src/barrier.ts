import type {ElementLayout} from "./types.ts";
import {Mutex} from './mutex.ts'
import {Address, make} from './memory.ts'

/**
 * A synchronization barrier that can be shared across threads.
 * Allows threads to block until some number of other threads hit the same barrier. Then all threads proceed simultaneously.
 *
 * Use @see make for creating a barrier.
 */
export class Barrier {
    private memory: Int32Array
    private mutex: Mutex
    private maxNeeded: number
    private stillNeededOffset: number
    private eventOffset: number

    public static ELEMENT_LAYOUT: ElementLayout = [['int32', 3]]
    public static HYDRATION_KEY = '__threads_Barrier'

    /**
     * Creates a new barrier. Prefer calling @see make
     * @param address The address for the barrier (must be 3 32-bit signed integers in size)
     * @param needed How many threads must hit the barrier before proceeding
     * @param initMem Whether to initialize the memory or not (only pass true on one-thread; sending a barrier will set this to false on hydration)
     */
    constructor(address: Address<Int32Array>, needed: number, initMem: boolean = true) {
        this.mutex = new Mutex(address)
        this.memory = address.memory()
        this.maxNeeded = needed
        if (address.memory().length < 3) {
            throw new Error("INVALID ADDRESS! MUST BE AT LEAST 3 INT32 WIDE!")
        }

        this.stillNeededOffset = address.offset() + 1
        this.eventOffset = address.offset() + 2

        if (initMem) {
            this.memory.set([this.maxNeeded], this.stillNeededOffset)
        }
    }

    /**
     * Makes a barrier by allocating the necessary shared memory
     * Barriers made this way can be shared with a thread through either initial data (in Thread.spawn) or
     * by calling the Thread.share method (note: in both cases you MUST await the result before running any code that uses the barrier)
     * @param needed How many threads need to hit the barrier for it to proceed
     */
    static make(needed: number): Barrier {
        return make(Barrier, needed)
    }

    /**
     * Hydrates a barrier from a dehydrated (message-passed) state
     * @param memory Memory to use
     * @param offset Offset in memory to use
     * @param maxNeeded Maximum number of threads needed (different from current number of threads needed)
     */
    static hydrate({memory, offset, maxNeeded}: { memory: Int32Array, offset: number, maxNeeded: number }) {
        const addr = new Address(memory, offset)
        return new Barrier(addr, maxNeeded, false)
    }

    /**
     * Dehydrates a barrier so it can be passed between threads
     * @param b Barrier to dehydrate
     */
    static dehydrate(b: Barrier) {
        return {
            memory: b.memory,
            offset: Mutex.dehydrate(b.mutex).offset,
            maxNeeded: b.maxNeeded
        }
    }

    /**
     * Wait for other threads to hit the barrier before continuing. Blocking
     */
    public wait() {
        this.mutex.lock()
        this.memory.set([this.memory.at(this.stillNeededOffset)!! - 1], this.stillNeededOffset)
        if (this.memory.at(this.stillNeededOffset)!! > 0) {
            const e = this.memory.at(this.eventOffset)!!
            this.mutex.unlock()
            Atomics.wait(this.memory, this.eventOffset, e)
        } else {
            Atomics.add(this.memory, this.eventOffset, 1)
            this.memory.set([this.maxNeeded], this.stillNeededOffset)
            Atomics.notify(this.memory, this.eventOffset)
            this.mutex.unlock()
        }
    }

    /**
     * Create a promise that waits for other threads to hit the barrier before continuing
     */
    public async waitAsync() {
        if (!('waitAsync' in Atomics)) {
            throw new Error("waitAsync not available!")
        }
        await this.mutex.lockAsync()
        this.memory.set([this.memory.at(this.stillNeededOffset)!! - 1], this.stillNeededOffset)
        if (this.memory.at(this.stillNeededOffset)!! > 0) {
            const e = this.memory.at(this.eventOffset)!!
            this.mutex.unlock()
            const {async, value} = (Atomics as any).waitAsync(this.memory, this.eventOffset, e)
            if (async) {
                await value
            }
            else {
                await new Promise((resolve) => resolve(null))
            }
        } else {
            Atomics.add(this.memory, this.eventOffset, 1)
            this.memory.set([this.maxNeeded], this.stillNeededOffset)
            Atomics.notify(this.memory, this.eventOffset)
            this.mutex.unlock()
        }
    }
}