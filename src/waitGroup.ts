import type {ElementLayout} from "./types.ts";
import {Address} from "./address.ts";

export class WaitGroup {
    private memory: Int32Array
    private offset: number

    public static ELEMENT_LAYOUT: ElementLayout = ['int32']
    public static HYDRATION_KEY = 'WaitGroup'

    constructor(address: Address<Int32Array>) {
        this.memory = address.memory()
        this.offset = address.offset()
    }

    static hydrate({memory, offset}: { memory: Int32Array, offset: number }) {
        const addr = new Address(memory, offset)
        return new WaitGroup(addr)
    }

    static dehydrate(wg: WaitGroup) {
        return {
            __type: WaitGroup.HYDRATION_KEY,
            memory: wg.memory,
            offset: wg.offset,
        }
    }

    public add(count: number = 1) {
        Atomics.add(this.memory, this.offset, count)
    }

    public done() {
        if (Atomics.sub(this.memory, this.offset, 1) <= 1) {
            Atomics.notify(this.memory, this.offset)
        }
    }

    public wait(timeout: number = Infinity) {
        while (true) {
            const cur = Atomics.load(this.memory, this.offset);
            if (cur == 0) {
                return true;
            }

            if (Atomics.wait(this.memory, this.offset, cur, timeout) === 'timed-out') {
                return false
            }
        }
    }

    public async waitAsync(timeout: number = Infinity) {
        if (!('waitAsync' in Atomics)) {
            throw new Error("waitAsync not available!")
        }
        while (true) {
            const cur = Atomics.load(this.memory, this.offset);
            if (cur == 0) {
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
        }
    }
}