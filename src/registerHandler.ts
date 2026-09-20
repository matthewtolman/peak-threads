/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type {Connection} from "./thread.ts";
import {NotInWorkerThread} from "./errors.ts";
import {isDedicatedWorker, isSharedWorker} from "./helpers.ts";

export const workMappings: Record<string, ((_?: any) => any)> = {}

/**
 * Registers a global init handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 *
 * @param type 'init' for the initialization handler
 * @param handler Handler function that will be called once when the thread is being initialized
 */
export function registerHandler<T>(type: 'init', handler: (init: T) => Promise<void> | void): void
/**
 * Registers a global event handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 *
 * @param type 'event' for the event handler
 * @param handler Handler function that will be called when a raw event object is received (catch all for any unset handlers)
 */
export function registerHandler(type: 'event', handler: (e: MessageEvent) => void | Promise<void>): void
/**
 * Registers a global share handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 *
 * @param type 'share' for the share handler
 * @param handler Handler function that will be called when a share event is received
 */
export function registerHandler<S, M>(type: 'share', handler: (s: {
    share: S,
    message?: M
}) => void | Promise<void>): void
/**
 * Registers a global share handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 *
 * @param type 'share' for the share handler
 * @param handler Handler function that will be called when a share event is received
 */
export function registerHandler<S>(type: 'share', handler: (s: { share: S }) => void | Promise<void>): void
/**
 * Registers a global transfer handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 *
 * @param type 'transfer' for the share handler
 * @param handler Handler function that will be called when a transfer event is received
 */
export function registerHandler<T>(type: 'transfer', handler: (t: T) => Promise<void> | void): void
/**
 * Registers a typed work handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 * Typed work handlers are only called when the work type and work data are both passed to `sendWork`
 *
 * @param type 'work' for the typed work handler
 * @param workType String key for indicating which work handler should be dispatched to
 * @param handler Handler function that will be called when a work event is received with the `workType` key
 */
export function registerHandler<T, R>(type: 'work', workType: string, handler: (w: T) => R | Promise<R>): void
/**
 * Registers a global work handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 * Global work handlers are called when there is no workType and work passed to sendWork.
 * They can also be called when a type of work is not present (in that case, they're given the object {type: string, work: any})
 *
 * @param type 'work' for the global work handler
 * @param handler Handler function that will be called when a work event is received with the `workType` key
 */
export function registerHandler<T, R>(type: 'work', handler: (w: T) => R | Promise<R>): void
/**
 * Registers a global thread closed handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 * This handler is called when the thread is requested to close.
 *
 * @param type 'close' for the close handler
 * @param handler Handler function that will be called when a connection is closed
 */
export function registerHandler(type: 'close', handler: () => void | Promise<void>): void
export function registerHandler(
    type: "init" | "event" | "share" | "transfer" | "work" | "close",
    workTypeOrHandler: string | ((_?: any) => any),
    handlerOrUndef?: ((_?: any) => any)
) {
    if (!isDedicatedWorker()) {
        throw new Error('registerHandler can only be called from a web worker context!')
    }
    const isWorkTyped = typeof workTypeOrHandler === 'string' && !!handlerOrUndef
    const handler = (isWorkTyped ? handlerOrUndef : workTypeOrHandler) as unknown as ((_?: any) => any)

    if (self) {
        switch (type) {
            case "init":
                (self as any).oninit = handler;
                break;
            case "event":
                (self as any).onevent = handler;
                break;
            case "share":
                (self as any).onshare = handler;
                break;
            case "transfer":
                (self as any).ontransfer = handler;
                break;
            case "work": {
                if (isWorkTyped) {
                    workMappings[workTypeOrHandler as unknown as string] = handler
                } else {
                    (self as any).onwork = handler;
                }
                break;
            }
            case "close":
                (self as any).onclose = handler;
                break;
        }
    } else {
        throw new NotInWorkerThread("registerHandler");
    }
}

if (isDedicatedWorker()) {
    (self as any).registerHandler = registerHandler
}

export const sharedWorkMappings: Record<string, ((conn: Connection, _?: any) => any)> = {}

/**
 * Registers a global init handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 * Init is an event sent by the connecting thread and can contain data from that thread.
 * It is called *after* the 'connection' event is called
 *
 * @param type 'init' for the initialization handler.
 * @param handler Handler function to be called once at the start of a connection (after the 'connection' event is called)
 */
export function registerSharedHandler<I>(type: 'init', handler: (c: Connection, val: I) => void | Promise<void>): void
/**
 * Registers a global event handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 *
 * @param type 'event' for the raw event handler.
 * @param handler Handler function to be called when a raw event is received or an event is received for where there is no specifc handler specified
 */
export function registerSharedHandler(type: 'event', handler: (c: Connection, e: MessageEvent) => void | Promise<void>): void
/**
 * Registers a global share handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 *
 * @param type 'share' for the share handler.
 * @param handler Handler function to be called when a share event is received
 */
export function registerSharedHandler<S, M>(type: 'share', handler: (c: Connection, s: {
    share: S,
    message?: M
}) => void | Promise<void>): void
/**
 * Registers a global share handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 *
 * @param type 'share' for the share handler.
 * @param handler Handler function to be called when a share event is received
 */
export function registerSharedHandler<S>(type: 'share', handler: (c: Connection, s: {
    share: S
}) => void | Promise<void>): void
/**
 * Registers a global transfer handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 *
 * @param type 'transfer' for the transfer handler.
 * @param handler Handler function to be called when a transfer event is received
 */
export function registerSharedHandler<T>(type: 'transfer', handler: (c: Connection, t: T) => void | Promise<void>): void
/**
 * Registers a typed work handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 * Typed work handlers are only called when the work type and work data are both passed to `sendWork`
 *
 * @param type 'work' for the work handler.
 * @param workType String key for indicating which work handler should be dispatched to
 * @param handler Handler function to be called when a typed work event of workType is received
 */
export function registerSharedHandler<T, R>(type: 'work', workType: string, handler: (c: Connection, w: T) => R | Promise<R>): void
/**
 * Registers a global work handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 * Global work handlers are called when there is no workType and work passed to sendWork.
 * They can also be called when a type of work is not present (in that case, they're given the object {type: string, work: any})
 *
 * @param type 'work' for the work handler.
 * @param handler Handler function to be called when a work event is received
 */
export function registerSharedHandler<T, R>(type: 'work', handler: (c: Connection, w: T) => R | Promise<R>): void
/**
 * Registers a global close handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 * This is called when a connection is closed (aka. a browser context has disconnected)
 *
 * @param type 'close' for the close handler.
 * @param handler Handler function to be called when a connection close event is received
 */
export function registerSharedHandler(type: 'close', handler: (c: Connection) => void | Promise<void>): void
/**
 * Registers a global connection handler. Can only be called from a {@link Thread} that is spawned (not from the main thread).
 * This is called when a connection is openned (*before* an 'init' call) but before the parent has sent over any data.
 *
 * @param type 'connection' for the connection handler.
 * @param handler Handler function to be called when a connection event is received
 */
export function registerSharedHandler(type: 'connection', handler: (c: Connection) => void): void
/**
 * Alias handler for a 'connection' handler.
 *
 * @param type 'connect' for the connection handler.
 * @param handler Handler function to be called when a connection event is received
 */
export function registerSharedHandler(type: 'connect', handler: (c: Connection) => void): void
export function registerSharedHandler(
    type:
        | "init"
        | "event"
        | "share"
        | "transfer"
        | "work"
        | "close"
        | "connect"
        | "connection",
    workTypeOrHandler: string | ((conn: Connection, _?: any) => any),
    handlerOrUndef?: (conn: Connection, _?: any) => any,
) {
    if (!isSharedWorker()) {
        throw new Error('registerSharedHandler can only be called from a shared web worker context!')
    }
    const isWorkTyped = typeof workTypeOrHandler === 'string' && !!handlerOrUndef
    const handler = (isWorkTyped ? handlerOrUndef : workTypeOrHandler) as unknown as ((_?: any) => any)

    if (self) {
        switch (type) {
            case "connection":
            case "connect":
                (self as any).onconnection = handler;
                break;
            case "init":
                (self as any).oninit = handler;
                break;
            case "event":
                (self as any).onevent = handler;
                break;
            case "share":
                (self as any).onshare = handler;
                break;
            case "transfer":
                (self as any).ontransfer = handler;
                break;
            case "work": {
                if (isWorkTyped) {
                    workMappings[workTypeOrHandler as unknown as string] = handler()
                } else {
                    (self as any).onwork = handler;
                }
                break;
            }
            case "close":
                (self as any).onclose = handler;
                break;
        }
    } else {
        throw new NotInWorkerThread("registerSharedHandler");
    }
}

if (isSharedWorker()) {
    (self as any).registerSharedHandler = registerSharedHandler
}
