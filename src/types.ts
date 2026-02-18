export type TypedArray =
    | Int8Array<ArrayBufferLike>
    | Uint8Array<ArrayBufferLike>
    | Uint8ClampedArray<ArrayBufferLike>
    | Int16Array<ArrayBufferLike>
    | Uint16Array<ArrayBufferLike>
    | Int32Array<ArrayBufferLike>
    | Uint32Array<ArrayBufferLike>
    | Float32Array<ArrayBufferLike>
    | Float64Array<ArrayBufferLike>
    | BigInt64Array<ArrayBufferLike>
    | BigUint64Array<ArrayBufferLike>;

export type AtomicSyncTypedArray = Int32Array<ArrayBufferLike> | BigInt64Array<ArrayBufferLike>;

export type ElementLayoutItem =
    | 'int8'
    | 'int16'
    | 'int32'
    | 'int64'
    | 'uint8'
    | 'uint8Clamped'
    | 'uint16'
    | 'uint32'
    | 'uint64'
    | 'f32'
    | 'f64';

export type ElementLayout = Array<ElementLayoutItem | [ElementLayoutItem, number]>;
