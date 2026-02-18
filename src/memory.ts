import type {TypedArray} from "./types.ts";
import {Address} from "./address.ts";

export function make<T>(Type: T, ...args: any[]) {
    let curBytes = 0

    function alignment(alignment: number) {
        if (curBytes == 0) {
            return 0
        }
        return (curBytes + (alignment - 1)) & ~(alignment - 1) - curBytes
    }

    const layouts: Array<[{ new(_: any): TypedArray }, number, number]> = []

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

    let buff: SharedArrayBuffer = new SharedArrayBuffer(curBytes)

    // @ts-ignore
    return new Type(...layouts.map(([t, align, bytes]) => {
        if (align > 0) {
            buff = buff.slice(align)
        }
        const s = buff.slice(0, bytes)
        buff = buff.slice(bytes)

        const view = new t(s)
        return new Address(view, 0, view.length)
    }), ...args)
}