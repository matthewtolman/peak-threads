import type {BigIntTypedArray, TypedArray} from "./types.ts";

export interface DehydratedAddress<T extends TypedArray> {
    memory: T,
    offset: number,
    cnt: number
}

/**
 * Represents an address to some typed data (e.g. 32-bit integer) or an array of the same typed data.
 * This address can be shared to read/modify the same value across a program.
 * If backed by a SharedArrayBuffer, it can also be used to share data between threads.
 *
 * Generally, any class which needs "shared memory" will use an Address to wrap it.
 */
export class Address<T extends TypedArray, R = T extends BigIntTypedArray ? bigint : number> {
    private mem: T;
    private indx: number;
    private cnt: number;
    public static HYDRATION_KEY = '__threads_Address'

    /**
     * Creates a new "address" backed by some piece of memory
     * @param memArray
     * @param memOffset
     * @param cnt
     */
    constructor(memArray: T, memOffset: number = 0, cnt: number = 1) {
        this.mem = memArray
        this.indx = memOffset
        this.cnt = cnt
        if (memOffset + cnt > memArray.length) {
            throw new Error(`Address out of bounds!`)
        }
    }

    /**
     * Hydrates an Address from a dehydrated (message-passed) state
     * @param memory Memory to use
     * @param offset Maximum number of threads needed (different from current number of threads needed)
     * @param cnt Number of elements to hydrate from
     */
    static hydrate<T extends TypedArray>({memory, offset, cnt}: DehydratedAddress<T>) {
        return new Address<T>(memory as T, offset, cnt)
    }

    /**
     * Dehydrate an address for message passing
     * @param addr Address to dehydrate
     */
    static dehydrate<T extends TypedArray>(addr: Address<T>): DehydratedAddress<T> {
        return {
            memory: addr.memory(),
            offset: addr.offset(),
            cnt: addr.count(),
        }
    }

    /**
     * Gets the value at the provided index (default is to dereference at index 0)
     * @param index Value to get
     * @return Value
     */
    public get(index: number = 0): R {
        if (index < this.cnt) {
            return this.mem.at(this.indx + index)!! as R
        }
        throw new Error("Out of bounds access detected!")
    }

    /**
     * Sets the value at an index (default is to set at index 0)
     * @param value The value to set
     * @param index The index to set at
     */
    public set(value: R, index: number = 0): void {
        if (index < this.cnt) {
            return this.mem.set([value as any], this.indx + index)!!
        }
        throw new Error("Out of bounds access detected!")
    }

    /**
     * Gets the raw underlying memory
     * CAUTION! THIS MEMORY MAY BE SHARED BETWEEN MULTIPLE ADDRESSES! iT'S UP TO YOU (THE DEVELOPER) TO ENFORCE BOUNDARIES BETWEEN ADDRESSES WHEN YOU USE THIS METHOD!
     */
    public memory(): T {
        return this.mem
    }

    /**
     * Gets the raw underlying offset of the address
     * CAUTION! THIS MEMORY MAY BE SHARED BETWEEN MULTIPLE ADDRESSES! iT'S UP TO YOU (THE DEVELOPER) TO ENFORCE BOUNDARIES BETWEEN ADDRESSES WHEN YOU USE THIS METHOD!
     */
    public offset(): number {
        return this.indx
    }

    /**
     * Gets the raw underlying length of the typed array slice owned by the address
     * CAUTION! THIS MEMORY MAY BE SHARED BETWEEN MULTIPLE ADDRESSES! iT'S UP TO YOU (THE DEVELOPER) TO ENFORCE BOUNDARIES BETWEEN ADDRESSES WHEN YOU USE THIS METHOD!
     */
    public count(): number {
        return this.cnt
    }

    public atomicAdd(amt?: R, index = 0): R {
        if (index >= this.cnt) {
            throw new Error('OUT OF BOUNDS!')
        }
        if (typeof amt === 'undefined') {
            if (this.mem instanceof BigUint64Array || this.mem instanceof BigInt64Array) {
                (amt as any) = 1n
            }
            else {
                (amt as any) = 1
            }
        }
        if (!(this.mem instanceof Int32Array || this.mem instanceof BigInt64Array || this.mem instanceof Int16Array
            || this.mem instanceof Int8Array || this.mem instanceof Uint32Array || this.mem instanceof Uint16Array
            || this.mem instanceof Uint8Array || this.mem instanceof BigUint64Array)) {
            throw new Error('INVALID UNDERLYING MEMORY FOR ATOMIC OPERATIONS!')
        }
        return Atomics.add(this.mem as any, this.indx + index, amt as any) as R
    }

    public atomicSub(amt?: R, index = 0): R {
        if (index >= this.cnt) {
            throw new Error('OUT OF BOUNDS!')
        }
        if (typeof amt === 'undefined') {
            if (this.mem instanceof BigUint64Array || this.mem instanceof BigInt64Array) {
                (amt as any) = 1n
            }
            else {
                (amt as any) = 1
            }
        }
        if (!(this.mem instanceof Int32Array || this.mem instanceof BigInt64Array || this.mem instanceof Int16Array
            || this.mem instanceof Int8Array || this.mem instanceof Uint32Array || this.mem instanceof Uint16Array
            || this.mem instanceof Uint8Array || this.mem instanceof BigUint64Array)) {
            throw new Error('INVALID UNDERLYING MEMORY FOR ATOMIC OPERATIONS!')
        }
        return Atomics.sub(this.mem as any, this.indx + index, amt as any) as R
    }

    public atomicAnd(amt?: R, index = 0): R {
        if (index >= this.cnt) {
            throw new Error('OUT OF BOUNDS!')
        }
        if (typeof amt === 'undefined') {
            if (this.mem instanceof BigUint64Array || this.mem instanceof BigInt64Array) {
                (amt as any) = 1n
            }
            else {
                (amt as any) = 1
            }
        }
        if (!(this.mem instanceof Int32Array || this.mem instanceof BigInt64Array || this.mem instanceof Int16Array
            || this.mem instanceof Int8Array || this.mem instanceof Uint32Array || this.mem instanceof Uint16Array
            || this.mem instanceof Uint8Array || this.mem instanceof BigUint64Array)) {
            throw new Error('INVALID UNDERLYING MEMORY FOR ATOMIC OPERATIONS!')
        }
        return Atomics.and(this.mem as any, this.indx + index, amt as any) as R
    }

    public atomicOr(val?: R, index = 0): R {
        if (index >= this.cnt) {
            throw new Error('OUT OF BOUNDS!')
        }
        if (!(this.mem instanceof Int32Array || this.mem instanceof BigInt64Array || this.mem instanceof Int16Array
            || this.mem instanceof Int8Array || this.mem instanceof Uint32Array || this.mem instanceof Uint16Array
            || this.mem instanceof Uint8Array || this.mem instanceof BigUint64Array)) {
            throw new Error('INVALID UNDERLYING MEMORY FOR ATOMIC OPERATIONS!')
        }
        return Atomics.or(this.mem as any, this.indx + index, val as any) as R
    }

    public atomicXor(val?: R, index = 0): R {
        if (index >= this.cnt) {
            throw new Error('OUT OF BOUNDS!')
        }
        if (!(this.mem instanceof Int32Array || this.mem instanceof BigInt64Array || this.mem instanceof Int16Array
            || this.mem instanceof Int8Array || this.mem instanceof Uint32Array || this.mem instanceof Uint16Array
            || this.mem instanceof Uint8Array || this.mem instanceof BigUint64Array)) {
            throw new Error('INVALID UNDERLYING MEMORY FOR ATOMIC OPERATIONS!')
        }
        return Atomics.or(this.mem as any, this.indx + index, val as any) as R
    }

    public atomicCmpExch(expected: R, replacement: R, index = 0): R {
        if (index >= this.cnt) {
            throw new Error('OUT OF BOUNDS!')
        }
        if (!(this.mem instanceof Int32Array || this.mem instanceof BigInt64Array || this.mem instanceof Int16Array
            || this.mem instanceof Int8Array || this.mem instanceof Uint32Array || this.mem instanceof Uint16Array
            || this.mem instanceof Uint8Array || this.mem instanceof BigUint64Array)) {
            throw new Error('INVALID UNDERLYING MEMORY FOR ATOMIC OPERATIONS!')
        }
        return Atomics.compareExchange(this.mem as any, this.indx + index, expected as any, replacement as any) as R
    }

    public atomicExchange(replacement: R, index = 0): R {
        if (index >= this.cnt) {
            throw new Error('OUT OF BOUNDS!')
        }
        if (!(this.mem instanceof Int32Array || this.mem instanceof BigInt64Array || this.mem instanceof Int16Array
            || this.mem instanceof Int8Array || this.mem instanceof Uint32Array || this.mem instanceof Uint16Array
            || this.mem instanceof Uint8Array || this.mem instanceof BigUint64Array)) {
            throw new Error('INVALID UNDERLYING MEMORY FOR ATOMIC OPERATIONS!')
        }
        return Atomics.exchange(this.mem as any, this.indx + index, replacement as any) as R
    }

    public atomicStore(replacement: R, index = 0): void {
        if (index >= this.cnt) {
            throw new Error('OUT OF BOUNDS!')
        }
        if (!(this.mem instanceof Int32Array || this.mem instanceof BigInt64Array || this.mem instanceof Int16Array
            || this.mem instanceof Int8Array || this.mem instanceof Uint32Array || this.mem instanceof Uint16Array
            || this.mem instanceof Uint8Array || this.mem instanceof BigUint64Array)) {
            throw new Error('INVALID UNDERLYING MEMORY FOR ATOMIC OPERATIONS!')
        }
        Atomics.store(this.mem as any, this.indx + index, replacement as any) as R
    }

    public atomicLoad(index = 0): R {
        if (index >= this.cnt) {
            throw new Error('OUT OF BOUNDS!')
        }
        if (!(this.mem instanceof Int32Array || this.mem instanceof BigInt64Array || this.mem instanceof Int16Array
            || this.mem instanceof Int8Array || this.mem instanceof Uint32Array || this.mem instanceof Uint16Array
            || this.mem instanceof Uint8Array || this.mem instanceof BigUint64Array)) {
            throw new Error('INVALID UNDERLYING MEMORY FOR ATOMIC OPERATIONS!')
        }
        return Atomics.load(this.mem as any, this.indx + index) as R
    }

    public atomicNotify(cnt: number = Infinity, index = 0): number {
        if (index >= this.cnt) {
            throw new Error('OUT OF BOUNDS!')
        }
        if (!(this.mem instanceof Int32Array || this.mem instanceof BigInt64Array || this.mem instanceof Int16Array
            || this.mem instanceof Int8Array || this.mem instanceof Uint32Array || this.mem instanceof Uint16Array
            || this.mem instanceof Uint8Array || this.mem instanceof BigUint64Array)) {
            throw new Error('INVALID UNDERLYING MEMORY FOR ATOMIC OPERATIONS!')
        }
        return Atomics.notify(this.mem as any, this.indx + index, cnt)
    }

    public atomicNotifyOne(index = 0): number {
        return this.atomicNotify(1, index)
    }

    public atomicNotifyAll(index = 0): number {
        return this.atomicNotify(Infinity, index)
    }

    public atomicWait(value: R, timeout = Infinity, index = 0): 'ok'|'not-equal'|'timed-out' {
        if (index >= this.cnt) {
            throw new Error('OUT OF BOUNDS!')
        }
        if (!(this.mem instanceof Int32Array || this.mem instanceof BigInt64Array || this.mem instanceof Int16Array
            || this.mem instanceof Int8Array || this.mem instanceof Uint32Array || this.mem instanceof Uint16Array
            || this.mem instanceof Uint8Array || this.mem instanceof BigUint64Array)) {
            throw new Error('INVALID UNDERLYING MEMORY FOR ATOMIC OPERATIONS!')
        }
        return Atomics.wait(this.mem as any, this.indx + index, value as any, timeout)
    }

    public async atomicWaitAsync(val: R, timeout = Infinity, index = 0): Promise<'ok'|'not-equal'|'timed-out'> {
        if (!('waitAsync' in Atomics)) {
            throw new Error("waitAsync not available!")
        }
        if (index >= this.cnt) {
            throw new Error('OUT OF BOUNDS!')
        }
        if (!(this.mem instanceof Int32Array || this.mem instanceof BigInt64Array || this.mem instanceof Int16Array
            || this.mem instanceof Int8Array || this.mem instanceof Uint32Array || this.mem instanceof Uint16Array
            || this.mem instanceof Uint8Array || this.mem instanceof BigUint64Array)) {
            throw new Error('INVALID UNDERLYING MEMORY FOR ATOMIC OPERATIONS!')
        }
        let {async, value} = (Atomics as any).waitAsync(this.mem as any, this.indx + index, val, timeout)
        if (async) {
            value = await value
        }
        return value
    }
}

/**
 * Makes a new "makeable" type that has shared memory
 *
 * The makeable type must have the following static types defined:
 * - ELEMENT_LAYOUT
 *      - An array of either element types (e.g. 'int8', 'uint8', 'f64'; @see ElementLayoutItem) or a tuple of element type and a numeric count (e.g. `['int8', 3]`)
 *
 * Additionally, a makeable type MUST take in a series of @see Address constructor parameters corresponding to each element layout item.
 * If a tuple with numeric count was defined, then a single address with a numeric count will be provided corresponding to that tuple.
 *
 * Furthermore, all Address constructor parameters MUST come first in the constructor list. All other parameters must follow.
 *
 * With those conditions in-place, we can now use "make" to make a new instance with those memory addresses backed by a SharedArrayBuffer.
 * To use make, simply pass in the Type and any additional arguments for the constructor (e.g. `make(Semaphore, 4)`)
 *
 * @param Type
 * @param args
 */
export function make<T>(Type: T, ...args: any[]) {
    let curBytes = 0

    function alignment(alignment: number) {
        if (curBytes == 0) {
            return 0
        }
        return (curBytes + (alignment - 1)) & ~(alignment - 1) - curBytes
    }

    const layouts: Array<[{ new(_: any, _1?: number, _2?: number): TypedArray, BYTES_PER_ELEMENT: number }, number, number]> = []

    for (const l of (Type as any).ELEMENT_LAYOUT || []) {
        const layout = Array.isArray(l) ? l[0] : l
        const cnt = Array.isArray(l) ? l[1] : 1

        let t;
        switch (layout) {
            case "int8":
                t = Int8Array
                break
            case "int16":
                t = Int16Array
                break;
            case "int32":
                t = Int32Array
                break;
            case "int64":
                t = BigInt64Array
                break;
            case "uint8":
                t = Uint8Array
                break;
            case "uint8Clamped":
                t = Uint8ClampedArray
                break;
            case "uint16":
                t = Uint16Array
                break;
            case "uint32":
                t = Uint32Array
                break;
            case "uint64":
                t = BigUint64Array
                break;
            case "f32":
                t = Float32Array
                break;
            case "f64":
                t = Float64Array
                break;
            default:
                throw new Error("Invalid layout " + layout)
        }

        const byte = t.BYTES_PER_ELEMENT
        const align = alignment(t.BYTES_PER_ELEMENT)

        layouts.push([t, align, byte * cnt])

        curBytes += align + byte * cnt
    }

    // single allocation for all memory
    let buff: SharedArrayBuffer = new SharedArrayBuffer(curBytes)
    let byteOffset: number = 0

    // @ts-ignore
    return new Type(...layouts.map(([t, align, bytes]) => {
        // Adjust alignment so we don't slow down/cause issues
        byteOffset += align

        // Get our view into this sequence of bytes
        const len = Math.floor(bytes / t.BYTES_PER_ELEMENT)
        const view = new t(buff, byteOffset, len)

        // move our offset for next time
        byteOffset += bytes

        // Return the "address" for the memory
        return new Address(view, 0, len)
    }), ...args)
}