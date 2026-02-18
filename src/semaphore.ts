import type {ElementLayout} from "./types.ts";
import {Address} from "./address.ts";

export class Semaphore {
    private memory: Int32Array
    private valOffset: number
    private waiterOffset: number
    private value: number

    public static ELEMENT_LAYOUT: ElementLayout = [['int32', 2]]
    public static HYDRATION_KEY = '__threads_Semaphore'

    constructor(address: Address<Int32Array>, value: number, initMem: boolean = true) {
        this.memory = address.memory()
        this.valOffset = address.offset()
        this.value = value
        this.waiterOffset = this.valOffset + 1
        if (address.memory().length < 2) {
            throw new Error("INVALID ADDRESS! MUST BE AT LEAST 2 INT32 WIDE!")
        }

        if (initMem) {
            this.memory.set([value], this.valOffset)
        }
    }

    static hydrate({memory, value}: { memory: Int32Array, value: number }) {
        const addr = new Address(memory, 0)
        return new Semaphore(addr, value, false)
    }

    static dehydrate(s: Semaphore) {
        return {
            __type: Semaphore.HYDRATION_KEY,
            memory: s.memory,
            offset: s.valOffset,
            value: s.value
        }
    }

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

    public release() {
        Atomics.add(this.memory, this.valOffset, 1)

        if (Atomics.load(this.memory, this.waiterOffset) > 0) {
            Atomics.notify(this.memory, this.valOffset, 1)
        }
    }
}