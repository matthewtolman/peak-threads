/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Typed array (since TypeScript doesn't come with this)
 */
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

/**
 * Type for typed arrays that require use of the `bigint` type
 */
export type BigIntTypedArray =
    | BigInt64Array<ArrayBufferLike>
    | BigUint64Array<ArrayBufferLike>;

/**
 * Type string definitions for use with {@link make} auto-allocation.
 *
 * See also {@link ElementLayout}
 */
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

/**
 * Memory layout definitions for use with {@link make} auto-allocation.
 */
export type ElementLayout = Array<ElementLayoutItem | [ElementLayoutItem, number]>;
