import type {ElementLayout} from "./types.ts";
import {Address} from "./address.ts";
import {Mutex} from "./mutex.ts";

export class ConditionVariable {
    private memory: Int32Array
    private prevOffset: number
    private valOffset: number

    public static ELEMENT_LAYOUT: ElementLayout = [['int32', 2]]
    public static HYDRATION_KEY = '__threads_ConditionVariable'

    constructor(address: Address<Int32Array>) {
        if (address.count() < 2) {
            throw new Error(`Invalid address for Condition Variable! COUNT: ${address.count()}`)
        }
        this.memory = address.memory()
        this.prevOffset = address.offset()
        this.valOffset = address.offset() + 1
    }

    static hydrate({memory, offset}: { memory: Int32Array, offset: number }) {
        const addr = new Address(memory, offset, memory.length)
        return new ConditionVariable(addr)
    }

    static dehydrate(cv: ConditionVariable) {
        return {
            __type: ConditionVariable.HYDRATION_KEY,
            memory: cv.memory,
            offset: cv.prevOffset,
        }
    }

    public wait(mux: Mutex, timeout: number = Infinity) {
        const start = Date.now()
        const val = Atomics.load(this.memory, this.valOffset)
        Atomics.store(this.memory, this.prevOffset, val)

        mux.unlock()

        if (Atomics.wait(this.memory, this.valOffset, val, timeout) === 'timed-out') {
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

    public async waitAsync(mux: Mutex, timeout: number = Infinity) {
        if (!('waitAsync' in Atomics)) {
            throw new Error("waitAsync not available!")
        }
        const start = Date.now()
        const val = Atomics.load(this.memory, this.valOffset)
        Atomics.store(this.memory, this.prevOffset, val)

        mux.unlock()

        const {async, value} = (Atomics as any).waitAsync(this.memory, this.valOffset, val, timeout)
        if (async) {
            if (await value === 'timed-out') {
                return false
            }
        } else if (value === 'timed-out') {
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

    public notify(count: number = 1) {
        const val = Atomics.load(this.memory, this.prevOffset)
        Atomics.store(this.memory, this.valOffset, (val + 1) | 0)
        Atomics.notify(this.memory, this.valOffset, count)
    }
}