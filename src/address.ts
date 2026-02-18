import type {TypedArray} from "./types.ts";

export class Address<T extends TypedArray> {
    private mem: T;
    private indx: number;
    private cnt: number;
    public static HYDRATION_KEY = 'Address'

    constructor(memArray: T, memOffset: number = 0, cnt: number = 1) {
        this.mem = memArray
        this.indx = memOffset
        this.cnt = cnt
        if (memOffset + cnt > memArray.length) {
            throw new Error(`Address out of bounds!`)
        }
    }

    static hydrate({memory, offset}: { memory: Int32Array, offset: number }) {
        return new Address(memory, offset)
    }

    static dehydrate<T extends TypedArray>(addr: Address<T>) {
        return {
            __type: Address.HYDRATION_KEY,
            memory: addr.memory(),
            offset: addr.offset(),
        }
    }

    public memory(): T {
        return this.mem
    }

    public offset(): number {
        return this.indx
    }

    public count(): number {
        return this.cnt
    }
}