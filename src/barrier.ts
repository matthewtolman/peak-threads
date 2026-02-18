import type {ElementLayout} from "./types.ts";
import {Mutex} from './mutex.ts'
import {Address} from './address.ts'

export class Barrier {
    private memory: Int32Array
    private mutex: Mutex
    private maxNeeded: number
    private stillNeededOffset: number
    private eventOffset: number

    public static ELEMENT_LAYOUT: ElementLayout = [['int32', 3]]
    public static HYDRATION_KEY = 'Barrier'

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

    static hydrate({memory, maxNeeded}: { memory: Int32Array, maxNeeded: number }) {
        const addr = new Address(memory, 0)
        return new Barrier(addr, maxNeeded, false)
    }

    static dehydrate(b: Barrier) {
        return {
            __type: Barrier.HYDRATION_KEY,
            memory: b.memory,
            offset: Mutex.dehydrate(b.mutex).offset,
        }
    }

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
        } else {
            Atomics.add(this.memory, this.eventOffset, 1)
            this.memory.set([this.maxNeeded], this.stillNeededOffset)
            Atomics.notify(this.memory, this.eventOffset)
            this.mutex.unlock()
        }
    }
}