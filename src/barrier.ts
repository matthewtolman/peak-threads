import type {ElementLayout} from "./types.ts";
import {type DehydratedMutex, Mutex} from './mutex.ts'
import {Address, type DehydratedAddress, make} from './memory.ts'

export interface DehydratedBarrier{ mux: DehydratedMutex, addr: DehydratedAddress<Int32Array>, maxNeeded: number }

/**
 * A synchronization barrier that can be shared across threads.
 * Allows threads to block until some number of other threads hit the same barrier. Then all threads proceed simultaneously.
 *
 * Use @see make for creating a barrier.
 */
export class Barrier {
    private addr: Address<Int32Array>
    private mutex: Mutex
    private maxNeeded: number
    private stillNeededOffset: number = 0
    private eventOffset: number = 1

    public static ELEMENT_LAYOUT: ElementLayout = Mutex.ELEMENT_LAYOUT.concat([['int32', 2]])
    public static HYDRATION_KEY = '__threads_Barrier'

    /**
     * Creates a new barrier. Prefer calling @see make
     * @param mux The mutex (or address for the mutex) to use for the barrier
     * @param addr The address to store barrier-state into
     * @param needed How many threads must hit the barrier before proceeding
     * @param initMem Whether to initialize the memory or not (only pass true on one-thread; sending a barrier will set this to false on hydration)
     */
    constructor(mux: Address<Int32Array>|Mutex, addr: Address<Int32Array>, needed: number, initMem: boolean = true) {
        if (mux instanceof Address) {
            this.mutex = new Mutex(mux)
        }
        else {
            this.mutex = mux
        }
        this.addr = addr
        this.maxNeeded = needed
        if (addr.count() < 2) {
            throw new Error("INVALID ADDRESS! MUST BE AT LEAST 2 INT32 WIDE!")
        }

        if (initMem) {
            this.addr.set(this.maxNeeded, this.stillNeededOffset)
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
     */
    static hydrate({mux, addr, maxNeeded}: DehydratedBarrier) {
        return new Barrier(Mutex.hydrate(mux), Address.hydrate(addr), maxNeeded, false)
    }

    /**
     * Dehydrates a barrier so it can be passed between threads
     * @param b Barrier to dehydrate
     */
    static dehydrate(b: Barrier): DehydratedBarrier {
        return {
            mux: Mutex.dehydrate(b.mutex),
            addr: Address.dehydrate(b.addr),
            maxNeeded: b.maxNeeded,
        }
    }

    /**
     * Wait for other threads to hit the barrier before continuing. Blocking
     */
    public wait() {
        this.mutex.lock()
        this.addr.set(this.addr.get(this.stillNeededOffset) - 1, this.stillNeededOffset)

        if (this.addr.get(this.stillNeededOffset) > 0) {
            const e = this.addr.get(this.eventOffset)!!
            this.mutex.unlock()
            this.addr.atomicWait(e, Infinity, this.eventOffset)
        } else {
            this.addr.atomicAdd(1, this.eventOffset)
            this.addr.set(this.maxNeeded, this.stillNeededOffset)
            this.addr.atomicNotifyAll(this.eventOffset)
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
        this.addr.set(this.addr.get(this.stillNeededOffset) - 1, this.stillNeededOffset)
        if (this.addr.get(this.stillNeededOffset) > 0) {
            const e = this.addr.get(this.eventOffset)
            this.mutex.unlock()
            await this.addr.atomicWaitAsync(e, Infinity, this.eventOffset)
        } else {
            this.addr.atomicAdd(1, this.eventOffset)
            this.addr.set(this.maxNeeded, this.stillNeededOffset)
            this.addr.atomicNotifyAll(this.eventOffset)
            this.mutex.unlock()
        }
    }
}