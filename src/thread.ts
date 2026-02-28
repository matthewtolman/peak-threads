/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {Mutex} from "./mutex.ts";
import {ConditionVariable} from "./conditionVariable.ts";
import {Address} from "./memory.ts";
import {WaitGroup} from "./waitGroup.ts";
import {Barrier} from "./barrier.ts";
import {Semaphore} from "./semaphore.ts";

let curThreadId = 'main'
let incThreadId = 0

let doLogs = false

export function setLogging(logging: boolean) {
    doLogs = logging
}

/**
 * Definition of a class-based dehydration registration where the dehydration information is on the class.
 *
 * Dehydration information on a class requires the following static methods:
 * - A static method `dehydrate` which takes the class instance and returns a dehydrated form
 * - A static method `hydrate` which takes the dehydrated form and returns an instance of the class
 *
 * All "is-a" checks are done with the `instanceof` operator based on the inverse-order items are registered,
 * such that newer registrations will take precedence over older registrations. This allows registering a base class
 * first, and then registering the child-classes later to have child-classes take precedence.
 */
export interface DehydrationClass {
    /**
     * The key by which the dehydrated object will be identified when hydrating. MUST BE UNIQUE
     */
    key: string,
    /**
     * The class type (e.g. for the class "Mutex" this would be `Mutex`)
     */
    type: any
}

/**
 * Definition of a function-based dehydration registration where the dehydration information is cleaned from functions.
 */
export interface DehydrationFunctions {
    /**
     * The key by which the dehydrated object will be identified when hydrating. MUST BE UNIQUE
     */
    key: string,
    /**
     * Function to determine if this dehydration mechanism applies to a value. Return true if it does, false otherwise
     * @param _object
     */
    isa: (object: any) => boolean,
    /**
     * Function to perform the dehydration of an object. Return the dehydrated form which can be passed as a message.
     *
     * Note: This MUST be synchronous and cannot be a Promise!
     * @param _object Object to dehydrate
     */
    dehydrate: (object: any) => any,

    /**
     * Take a dehydrated form, and turn it back into the original value (as closely as possible)
     * @param _value Dehydrated value
     * @param _type The key for the dehydrated value (allows reusing a hydrate function across multiple registrations)
     */
    hydrate: (value: any, type?: string) => any,
}

const dehydrationKeys: Set<string> = new Set<string>([
    Address.HYDRATION_KEY,
    Mutex.HYDRATION_KEY,
    ConditionVariable.HYDRATION_KEY,
    WaitGroup.HYDRATION_KEY,
    Barrier.HYDRATION_KEY,
    Semaphore.HYDRATION_KEY,
    '__ERROR',
])
const dehydrationList: Array<DehydrationClass | DehydrationFunctions> = [
    {
        key: '__ERROR',
        isa: object => {
            return object instanceof Error
        },
        dehydrate: (object: Error) => {
            return {
                name: object.name,
                stack: object.stack,
                message: object.message,
                cause: dehydrate(object.cause)
            }
        },
        hydrate: (value: { name: string, stack: string, message: string, cause: unknown | undefined }) => {
            value.cause = hydrate(value.cause)

            if (typeof window !== 'undefined' && value.name in window) {
                try {
                    const res = new (window[value.name as any] as any)(value.message, value.cause)
                    res.stack = value.stack
                    return res
                } catch (e) {
                }
            } else if (typeof self !== 'undefined' && value.name in self) {
                try {
                    const res = new (self[value.name as any] as any)(value.message, value.cause)
                    res.stack = value.stack
                    return res
                } catch (e) {
                }
            }

            const res = new Error(value.message, value.cause as any)
            try {
                res.name = value.name
                res.stack = value.stack
            } catch (e) {
            }

            return res
        }
    }
]

/**
 * Registers a new (De)Hydration ruleset. For the rulesets, @see DehydrationFunctions and @see DehydrationClass.
 * Throws if the dehydration ruleset is invalid or if it is not unique
 *
 * These new rulsets will be executed automatically when using a Thread class to send/receive messages between threads.
 *
 * @param ruleset The dehydration ruleset
 */
export function registerDeHydration(ruleset: DehydrationFunctions | DehydrationClass) {
    if (!ruleset || !(typeof ruleset === 'object' || typeof ruleset === 'function') || !('key' in ruleset) || !('type' in ruleset || ('isa' in ruleset && 'dehydrate' in ruleset && 'hydrate in ruleset'))) {
        throw new Error('Bad DeHydration registration!')
    }

    if ('type' in ruleset) {
        if (!('dehydrate' in ruleset.type && 'hydrate' in ruleset.type)) {
            throw new Error('Missing static methods "dehydrate" and "hydrate" on type! ' + ruleset.type)
        }
    } else if (!ruleset.isa || !ruleset.dehydrate || !ruleset.hydrate) {
        throw new Error('Need to have the fields "isa", "dehydrate" and "hydrate" all defined')
    }

    if (dehydrationKeys.has(ruleset.key)) {
        throw new Error(`DeHydration with key '${ruleset}' already registered!`)
    }

    dehydrationKeys.add(ruleset.key)
    dehydrationList.push(ruleset)
}

function dehydrate(obj: any): any {
    if (obj && Array.isArray(obj)) {
        return obj.map(dehydrate)
    } else if (typeof obj === 'object' && obj) {
        const v: any = {
            __dehydrated: true,
            __value: null
        }
        if (obj instanceof Address) {
            v.__value = Address.dehydrate(obj)
            v.__type = Address.HYDRATION_KEY
        } else if (obj instanceof Mutex) {
            v.__value = Mutex.dehydrate(obj)
            v.__type = Mutex.HYDRATION_KEY
        } else if (obj instanceof ConditionVariable) {
            v.__value = ConditionVariable.dehydrate(obj)
            v.__type = ConditionVariable.HYDRATION_KEY
        } else if (obj instanceof WaitGroup) {
            v.__value = WaitGroup.dehydrate(obj)
            v.__type = WaitGroup.HYDRATION_KEY
        } else if (obj instanceof Barrier) {
            v.__value = Barrier.dehydrate(obj)
            v.__type = Barrier.HYDRATION_KEY
        } else if (obj instanceof Semaphore) {
            v.__value = Semaphore.dehydrate(obj)
            v.__type = Semaphore.HYDRATION_KEY
        } else {
            for (let i = dehydrationList.length; i > 0; i--) {
                const de = dehydrationList[i - 1];
                if ('type' in de) {
                    if (obj instanceof de.type && de.type.dehydrate && de.type.hydrate) {
                        v.__value = de.type.dehydrate(obj)
                        v.__type = de.key
                        return v
                    }
                } else if ('isa' in de) {
                    if (de.isa(obj)) {
                        v.__value = de.dehydrate(obj)
                        v.__type = de.key
                        return v
                    }
                }
            }
            for (const k of Object.keys(obj)) {
                obj[k] = dehydrate(obj[k])
            }
            return obj
        }
        return v
    } else {
        return obj
    }
}

function hydrate(obj: any): any {
    if (typeof obj === 'object' && obj !== null && '__dehydrated' in obj && obj.__dehydrated) {
        const type: string | null | undefined = obj?.__type
        if (!type) {
            return obj
        }
        const val = obj.__value
        switch (type) {
            case Mutex.HYDRATION_KEY:
                return Mutex.hydrate(val)
            case ConditionVariable.HYDRATION_KEY:
                return ConditionVariable.hydrate(val)
            case Address.HYDRATION_KEY:
                return Address.hydrate(val)
            case WaitGroup.HYDRATION_KEY:
                return WaitGroup.hydrate(val)
            case Barrier.HYDRATION_KEY:
                return Barrier.hydrate(val)
            case Semaphore.HYDRATION_KEY:
                return Semaphore.hydrate(val)
        }

        if (!dehydrationKeys.has(type)) {
            console.error(`Unknown DeHydration '${type}! Unable to hydrate! Returning dehydrated object`)
            return obj
        } else {
            for (const de of dehydrationList) {
                if ('type' in de) {
                    return de.type.hydrate(obj, type)
                } else if ('isa' in de) {
                    return de.hydrate(obj, type)
                }
            }
        }
    } else if (obj && Array.isArray(obj)) {
        return obj.map(hydrate)
    } else if (typeof obj === 'object' && obj) {
        for (const k of Object.keys(obj)) {
            obj[k] = hydrate(obj[k])
        }
    }
    return obj
}

function setThreadId(threadId: string) {
    curThreadId = threadId
}

function getThreadId(): string {
    return curThreadId
}

/**
 * Options for creating a thread
 */
export interface ThreadOptions {
    /** Initial data for the thread (passed to `oninit`) */
    initData?: any,
    /** Custom onEventHandler for when a custom message is received from the thread */
    onEventHandler?: ((event: any) => any),
    /** Custom onEventHandler for when a custom message is received from the thread */
    onTransferHandler?: ((transferEvent: any) => any),
    /** Custom onErrorHandler for when an error is received from the thread */
    onErrorHandler?: ((err: any) => any),
    /**
     * If set, then the thread will automatically close if it has not received a message after so many milliseconds
     *
     * **IMPORTANT!** This only works for threads that receive communication _exclusively_ through message passing!
     * If you are sharing memory and using condition variables/wait groups, then this could cause the thread to die
     * while it is holding shared resources!
     */
    closeWhenIdle?: number,
    /**
     * Custom handler for when a thread is closed/killed
     */
    closeHandler?: (thread: Thread) => any
}

/**
 * Encapsulates another thread running and provides an interface for cooperating with said thread.
 *
 * For creating another thread, use @see spawn and await on the promise it returns.
 * The reason for the await is that the spawn method handles initialization of the thread for first use.
 * Using the thread before the promise resolves is undefined behavior
 *
 * This class provides a base protocol to help service basic communication (e.g. send/receive work, share data, etc.).
 * Core to this protocol are "system events" which all have the key/value pair of `__system: true`.
 * Any event with that key/value pair at the top level of the data object will be considered a "system event" and will
 * NOT get passed to any custom handlers you have registered.
 *
 * > This means that for custom events/protocols, you'll either need to ommit the `__system` key (recommended) or set it to false.
 *
 * If the `__system: true` key/value pair is set to true, then the following determination for processing is used:
 *  - If there is a `__error` field, then the result is an error object
 *  - If there is a `workId` field and either a `res` or `rej` field, then it is a work result object that should get dispatched to the associated promise
 *  - If there is a `workId` field and a `work` field, then it is a work request object that should get dispatched to the `onwork` handler (or `onevent` if `onwork` does not exist)
 *  - If there is an `__initd` field, then it indicates that it is an "initialization finished" event and the spawn promise should be resolved
 *  - If there is a `__shared` field, then it indicates that it is a "share finished" event and the associated share promise should be resolved
 *  - If there is a `__transferd` field, then it indicates that it is a "transfer finished" event and the associated transfer promise should be resolved
 *  - If there is both a `share` and `shareId` field, then it is a share request. The `onshare` method will be called if it exists, or `onevent` will be called
 *  - If there is `transfer` field, then it indicates a transfer request. The `ontransfer` method will be called if it exists, or `onevent` will be called
 *  - If there is both a `threadId` and an `init` field, then it is an initialization event. The `oninit` handler will be called if it is set
 *  - If there is a `__channel` field, then it indicates it is a "channel control" event (e.g. make, send, close). When a channel is made, `onchannel` is called
 *  - If there is a `__close` field, then it indicates the worker stopped running (aka. close() was called)
 *  - Otherwise, it is considered an "invalid system event" and an error is thrown
 *
 * The `onshare`, `oninit`, `ontransfer`, and `onwork` handlers can return promises. In those cases the promise will be awaited prior to sending the response event.
 * In the case that `onevent` is called due to one of the aforementioned handlers, then if `onevent` returns a promise it will be awaited.
 * Only in the case of `onwork` (or `onevent` called when there is no `onwork`) will the return value be sent back to the main thread.
 * Otherwise, it is ignored (outside of waiting a promise).
 *
 * One note about the `onevent` method is that it is always given the full raw event - even when called in stead of a system event handler.
 * This means that if system event handlers are not defined, then the `onevent` function may need to distinguish between system events and non-system events itself.
 *
 * If an event is not a system event (aka. it does NOT have the key/value pair `__system: true`), then it is a custom/user-defined event.
 * In that case, the `onevent` method is called. If a promsie is returned from `onevent` it will be awaited to track "in-flight" events (used for graceful shutdown).
 * However, the return value of `onevent` will not be retransmitted. It is up to the developer to call `postMessage` to send any information across (if desired).
 *
 */
export class Thread {
    private worker: Worker
    private threadId: string
    private incWorkId: number = 0
    private handler: ((_: any) => any) | undefined
    private transferHandler: ((_: any) => any) | undefined
    private errHandler: ((_: any) => any) | undefined
    private closeHandler: ((_: Thread) => any) | undefined

    private workQueue: {
        [id: string]: {
            res: (_: any) => any,
            rej: (_: any) => any,
        }
    } = {}
    private killed: boolean = false
    private pending: number = 0;

    private constructor(res: any, rej: any, script: string, options?: ThreadOptions) {
        this.threadId = curThreadId + '->' + (++incThreadId)
        const threadId = this.threadId
        doLogs && console.log(curThreadId, 'Spawning thread' + this.threadId)

        this.worker = new Worker(script)

        const oldPostMessage = this.worker.postMessage.bind(this.worker)
        this.worker.postMessage = (function (message: any, ...args: any[]) {
            doLogs && console.log(curThreadId, 'Sending message to ' + threadId, message)
            message = dehydrate(message)
            doLogs && console.log(curThreadId, 'Dehydrated message to ' + threadId, message)
            return oldPostMessage(message, ...args)
        } as any).bind(this.worker)

        this.worker.postMessage({__system: true, threadId: this.threadId, init: options?.initData || null, closeWhenIdle: options?.closeWhenIdle || Infinity})
        this.handler = options?.onEventHandler
        this.errHandler = options?.onErrorHandler
        this.closeHandler = options?.closeHandler
        this.transferHandler = options?.onTransferHandler

        this.worker.onmessage = (e) => {
            doLogs && console.log(curThreadId, 'Received message from ' + this.threadId, e)
            e = {...e, data: hydrate(e.data)}

            doLogs && console.log(curThreadId, 'Hydrated message from ' + this.threadId, e)
            if (e.data && typeof e.data === 'object' && e.data.hasOwnProperty('__system') && e.data.__system) {
                doLogs && console.log(curThreadId, 'System message from ' + this.threadId, e)
                if (e.data.hasOwnProperty('__error')) {
                    if (this.errHandler) {
                        this.errHandler((e.data.__error))
                    } else {
                        console.error(`Received error from thread ${this.threadId}!`, e.data.__error)
                        throw new Error(e.data.__error)
                    }
                }
                else if (e.data.hasOwnProperty('__close')) {
                    doLogs && console.log(curThreadId, 'Thread ' + this.threadId + ' stopped running!', e)
                    this.closeThread()
                }
                else if (e.data.hasOwnProperty('workId') && (e.data.hasOwnProperty('res') || e.data.hasOwnProperty('rej'))) {
                    if (!this.workQueue.hasOwnProperty(e.data.workId)) {
                        console.error("UNKNOWN JOB " + e.data.workId + ' FROM THREAD ' + this.threadId)
                    } else {
                        const {res, rej} = this.workQueue[e.data.workId]
                        try {
                            if (e.data.hasOwnProperty('res')) {
                                doLogs && console.log(curThreadId, 'Thread ' + this.threadId + ' finished work ' + e.data.workId)
                                res(e.data.res)
                            } else {
                                rej(e.data.rej || new Error('Bad response from worker thread'))
                            }
                        } finally {
                            delete this.workQueue[e.data.workId]
                            --this.pending
                        }
                        return
                    }
                }
                else if (e.data.hasOwnProperty('__initd')) {
                    if (e.data.__initd) {
                        res()
                    }
                    else {
                        rej(e.data.__error || new Error('Initialization Failed!'))
                        this.worker.terminate()
                        this.killed = true
                    }
                    doLogs && console.log(curThreadId, 'Spawned thread ' + this.threadId)
                }
                else if (e.data.hasOwnProperty('__shared')) {
                    const {res, rej} = this.workQueue[e.data.__shared]
                    try {
                        if (e.data.hasOwnProperty(`__error`)) {
                            rej(e.data.__error)
                        } else {
                            res(null)
                        }
                    }
                    finally {
                        delete this.workQueue[e.data.__shared]
                        --this.pending
                    }
                    return
                }
                else if (e.data.hasOwnProperty('__transferd')) {
                    const {res, rej} = this.workQueue[e.data.__transferd]
                    try {
                        if (e.data.hasOwnProperty(`__error`)) {
                            rej(e.data.__error)
                        } else {
                            res(null)
                        }
                    } finally {
                        delete this.workQueue[e.data.__transferd]
                        --this.pending
                    }
                    return
                }
                else if (e.data.hasOwnProperty('transfer')) {
                    if (this.transferHandler) {
                        this.transferHandler(e.data.message)
                    }
                    else if (this.handler) {
                        this.handler(e)
                    }
                    return
                }
                else {
                    throw new Error('INVALID SYSTEM EVENT!')
                }
            }
            else if (this.handler) {
                doLogs && console.log(curThreadId, 'Custom message from ' + this.threadId + ' dispatched to handler')
                this.handler(e)
            }
            else {
                doLogs && console.log(curThreadId, 'Unknown message from ' + this.threadId + ' and no handler registered!')
            }
        }

        this.worker.onerror = (e) => {
            console.error(`Thread ${this.threadId} had an error!`, e)
        }

        this.worker.onmessageerror = (e) => {
            console.error(`Cound not send message to thread ${this.threadId}!`, e)
        }
    }

    /**
     * Spawns and initializes a new thread for consumption.
     * @param script URI for the script that will be run by the thread (should include this library)
     * @param options Options for initializing the thread
     * @return A promise for when the thread is initialized (important to await the promise before using shared memory in any thread to avoid potential race conditions). Promise may reject if there was an initialization error.
     */
    public static spawn(script: string, options?: ThreadOptions): Promise<Thread> {
        return new Promise<Thread>((resolve, reject) => {
            const t = new Thread(() => resolve(t), (err: any) => reject(err), script, options)
        })
    }

    private nextWorkId() {
        if (crypto && crypto.randomUUID) {
            return this.threadId + ':' + crypto.randomUUID()
        } else {
            return this.threadId + ':' + (this.incWorkId++)
        }
    }

    /**
     * Set the handler for receiving custom `postMessage` events from the thread
     * @param h Handler for when an event is sent back from the event
     */
    public setOnEvent(h: ((_: any) => any) | undefined) {
        this.handler = h
    }

    /**
     * Set the handler for receiving transferred objects from the thread
     * @param h Handler for when ownership transferred
     */
    public setOnTransfer(h: ((_: any) => any) | undefined) {
        this.transferHandler = h
    }

    /**
     * Set the handler for receiving custom `postMessage` events from the thread
     * @param h Handler for when there is an error from the thread
     */
    public setOnError(h: ((_: any) => any) | undefined) {
        this.errHandler = h
    }

    /**
     * Helper method for thread pools to claim a thread temporarily while waiting for a micro-tick to happen
     * (usually necessary when a pool can scale up as spawning threads is asynchronous, so pool scaling must be asynchronous
     *  which means that thread claiming must be asynchronous as well)
     */
    public poolClaim() { ++this.pending }
    /**
     * Helper method for thread pools to release a temporary claim on a thread
     */
    public poolRelease() { --this.pending }

    /**
     * Set the handler for when a thread is closed/killed
     * @param h Handler for when a thread is closed/killed
     */
    public setOnClose(h: ((t: Thread) => any) | undefined) {
        this.closeHandler = h
    }

    /**
     * Sends some piece of work off to a thread and returns a promise waiting for a response
     * @param work The work to send to the thread (passed to your `onwork` handler)
     * @return Promise with the result object from doing the work
     */
    public sendWork<R = any>(work: any): Promise<R> {
        if (this.killed) {
            throw new Error("Invalid Operation! Thread is stopped!")
        }
        const workId = this.nextWorkId()
        doLogs && console.log(curThreadId, `Sending work ${workId} to thread ${this.threadId}`, work)
        ++this.pending
        const promise = new Promise((res, rej) => {
            this.workQueue[workId] = {res, rej}
            this.worker.postMessage({__system: true, workId, work})
        })
        return promise as Promise<R>
    }

    /**
     * Gets the number of pending requests that have a system-defined response for a thread
     * This helps indicate how busy a thread is
     */
    public numPendingRequests(): number {
        return this.pending
    }

    /**
     * Send a custom event to the thread
     * @param event Event to send
     * @param options Options for sending an event
     */
    public sendEvent(event: any, options?: StructuredSerializeOptions): void {
        if (this.killed) {
            throw new Error("Invalid Operation! Thread is stopped!")
        }
        doLogs && console.log(curThreadId, `Sending custom event to thread ${this.threadId}`, event)
        this.worker.postMessage(event, options)
    }

    /**
     * Gets the underlying worker from the thread.
     * USE CAUTION WHEN USING THIS METHOD!
     */
    public raw() {
        if (this.killed) {
            throw new Error("Invalid Operation! Thread is stopped!")
        }
        return this.worker
    }

    /**
     * Share an item (or items) with another thread.
     * Often used when needing to pass synchronization primitives outside the initialization method
     * @param item Item (or an array of items) that will be shared
     * @param message Any additional message information to pass along
     * @return A promise for when the share is complete (important to await the promise before using shared memory in any thread to avoid potential race conditions).
     */
    public share(item: any, message: any = undefined): Promise<void> {
        if (this.killed) {
            throw new Error("Invalid Operation! Thread is stopped!")
        }
        const shareId = this.nextWorkId()
        ++this.pending
        const promise = new Promise((res, rej) => {
            doLogs && console.log(curThreadId, 'queued share', shareId)
            this.workQueue[shareId] = {res, rej}
        })
        doLogs && console.log(curThreadId, `Sharing item with thread ${this.threadId}`, item, message)
        if (typeof message != 'undefined') {
            this.worker.postMessage({__system: true, shareId, share: item, message})
        } else {
            this.worker.postMessage({__system: true, shareId, share: item})
        }
        return promise as Promise<void>
    }

    /**
     * Transfer ownership of data to a thread
     * @param message Message to send indicating transfer information (should contain how the transferred object is accessed, like the TypedArray)
     * @param items The items to transfer ownership of (often an underlying piece of the accessed objects, liek the TypedArray's buffer)
     */
    public transfer(message: any, items: any[]): Promise<void> {
        if (this.killed) {
            throw new Error("Invalid Operation! Thread is stopped!")
        }
        if (!Array.isArray(items)) {
            if (!items) {
                items = []
            } else {
                items = [items]
            }
        }
        const transferId = this.nextWorkId()
        ++this.pending
        const promise = new Promise((res, rej) => {
            doLogs && console.log(curThreadId, 'queued transfer', transferId)
            this.workQueue[transferId] = {res, rej}
        })
        doLogs && console.log(curThreadId, `Transferring items to thread ${this.threadId}`, items, message)
        this.worker.postMessage({__system: true, transfer: transferId, message, items}, {transfer: items})
        return promise as Promise<void>
    }

    /**
     * Kills a thread (force stops it)
     * NOTE: USE THIS WITH CAUTION SINCE IT WILL TERMINATE A THREAD WITHOUT ANY CLEANUP! THIS CAN LEAD TO DEADLOCKS, LIVELOCKS, AND OTHER ISSUES!
     */
    public kill() {
        doLogs && console.log(curThreadId, `Killing thread ${this.threadId}`)
        this.worker.terminate()
        this.closeThread()
    }

    public close() {
        doLogs && console.log(curThreadId, `Gracefully shutting down thread ${this.threadId}`)
        this.killed = true
        this.worker.postMessage({__system: true, __close: true})
    }

    private closeThread() {
        this.killed = true
        for (const {rej} of Object.values(this.workQueue)) {
            rej(new Error('Thread stopped running!'))
        }
        if (this.closeHandler) {
            this.closeHandler(this)
        }
    }
}

function promiseLike(p: any) {
    return p && (p instanceof Promise || ((typeof p === 'object' || typeof p === 'function') && 'then' in p && typeof p?.then === 'function'))
}

if (typeof self !== 'undefined') {
    const oldPostMessage = self.postMessage
    self.postMessage = (function (message: any, ...args: any[]) {
        return oldPostMessage(dehydrate(message), ...args)
    }.bind(self) as any)

    let closing = false
    const oldClose = self.close
    self.close = (function () {
        closing = true
        doLogs && console.log(curThreadId, 'Closing thread')
        postMessage({__system: true, __close: true})
        doLogs && console.log(curThreadId, 'Closed thread')
        oldClose()
    })

    let threadIdleTimeout: any = null
    let threadIdle: number = 0
    let messagesProcessing: number = 0

    function sendError(err: any) {
        postMessage({__system: true, __error: err})
    }

    /**
     * Gets the number of messages currently being processed
     */
    (self as any).numMessagesProcessing = () => messagesProcessing;

    /**
     * Gets the current thread id
     */
    (self as any).curThread = () => curThreadId;

    (self as any).transfer = (message: any, items: any[]) => {
        if (!Array.isArray(items)) {
            if (!items) {
                items = []
            } else {
                items = [items]
            }
        }
        postMessage({__system: true, transfer: true, message, items}, {transfer: items})
    };

    (self as any).sendError = sendError
    self.onmessage = async (e: MessageEvent) => {
        if (closing) {
            sendError(new Error(`Thread ${curThreadId} is shutting down!`))
        }

        if (threadIdleTimeout) {
            doLogs && console.log(curThreadId, 'Pausing idle timer for thread ' + curThreadId)
            clearTimeout(threadIdleTimeout)
            threadIdleTimeout = null
        }
        ++messagesProcessing

        doLogs && console.log(curThreadId, "Received message", e, `Num messages active: ${messagesProcessing}`)

        try {
            try {
                e = {...e, data: hydrate(e.data)}
            } catch (err) {
                console.error('HYDRATION FAILED!', err, e.data)
                e = {...e, data: hydrate(e.data)}
            }

            doLogs && console.log(curThreadId, "Hydrated message", e)

            try {
                let res: any = undefined

                if (typeof e.data === 'object' || typeof e.data === 'function') {
                    if ('__system' in e.data && e.data.__system) {
                        doLogs && console.log(curThreadId, "Message is a system event!")
                        if ('share' in e.data && 'shareId' in e.data) {
                            if ((self as any).onshare) {
                                res = (self as any).onshare({share: e.data.share, message: e.data.message})
                            } else if ((self as any).onevent) {
                                doLogs && console.log(curThreadId, "onshare not found, falling back to onevent");
                                res = (self as any).onevent(e)
                            }

                            if (promiseLike(res)) {
                                await res
                            }
                            postMessage({__system: true, __shared: e.data.shareId})
                        } else if ('transfer' in e.data) {
                            if ((self as any).ontransfer) {
                                res = (self as any).ontransfer(e.data.message)
                            } else if ((self as any).onevent) {
                                doLogs && console.log(curThreadId, "ontransfer not found, falling back to onevent");
                                res = (self as any).onevent(e)
                            }

                            if (promiseLike(res)) {
                                await res
                            }
                            postMessage({__system: true, __transferd: e.data.transfer})
                        }
                        else if ('workId' in e.data && 'work' in e.data) {
                            if ((self as any).onwork) {
                                res = (self as any).onwork(e.data.work)
                            } else if ((self as any).onevent) {
                                doLogs && console.log(curThreadId, "onwork not found, falling back to onevent");
                                res = (self as any).onevent(e)
                            }
                            if (promiseLike(res)) {
                                res = await res
                            }
                            postMessage({
                                __system: true,
                                threadId: getThreadId(),
                                workId: e.data.workId,
                                res: res
                            })
                        } else if ('threadId' in e.data && 'init' in e.data) {
                            setThreadId(e.data.threadId)
                            if ((self as any).oninit) {
                                (self as any).oninit(e.data.init)
                            }
                            else {
                                doLogs && console.log(curThreadId, "oninit not found, skipping custom initialization");
                            }

                            if (promiseLike(res)) {
                                await res
                            }

                            if ('closeWhenIdle' in e.data && isFinite(e.data.closeWhenIdle)) {
                                doLogs && console.log(curThreadId, "idle timeout found! Creating idle timeout");
                                threadIdle = e.data.closeWhenIdle
                            }
                            postMessage({__system: true, __initd: true})
                            doLogs && console.log(curThreadId, 'Thread ready!')
                        } else if ('__close' in e.data) {
                            closing = true
                            try {
                                doLogs && console.log(curThreadId, 'Attempting graceful shutdown...')
                                // exclude this message from "processing" temporarily to make the onclose handler easier to write
                                // We don't want to confuse devs who are waiting for all messages to finish processing
                                --messagesProcessing
                                if ((self as any).onclose) {
                                    doLogs && console.log(curThreadId, 'Calling onclose')
                                    const res = (self as any).onclose()
                                    if (promiseLike(res)) {
                                        await res
                                    }
                                }

                                let attempt = 0
                                const maxAttempts = 10
                                doLogs && console.log(curThreadId, 'Outstanding events: ', messagesProcessing)
                                while (messagesProcessing && attempt++ < maxAttempts) {
                                    doLogs && console.log(curThreadId, `Detected messages in-flight, pausing for 100ms while waiting for messages to complete. Attempt ${attempt}/${maxAttempts}`)
                                    await new Promise(res => {
                                        setTimeout(() => res(null), 100)
                                    })
                                }

                                if (messagesProcessing) {
                                    console.error(curThreadId, `Failed to wait for in-flight messages to finish! Potential deadlock! Force killing thread!`)
                                }

                                self.close()
                            }
                            finally {
                                ++messagesProcessing
                            }
                        }
                        else {
                            throw new Error('INVALID SYSTEM EVENT!')
                        }
                    } else if ((self as any).onevent) {
                        doLogs && console.log(curThreadId, "Message is a custom event!");
                        const res = (self as any).onevent(e)
                        if (promiseLike(res)) {
                            await res
                        }
                    }
                } else if ((self as any).onevent) {
                    doLogs && console.log(curThreadId, "Message is a custom event!");
                    const res = (self as any).onevent(e)
                    if (promiseLike(res)) {
                        await res
                    }
                }
            } catch (err) {
                if (e.data && typeof e.data === 'object' && '__system' in e.data) {
                    if ('workId' in e.data) {
                        postMessage({__system: true, threadId: getThreadId(), workId: e.data.workId, rej: err})
                    } else if ('transfer' in e.data) {
                        postMessage({
                            __system: true,
                            threadId: getThreadId(),
                            __transferd: e.data.transfer,
                            __error: err
                        })
                    } else if ('share' in e.data) {
                        postMessage({__system: true, threadId: getThreadId(), __shared: e.data.transfer, rej: err})
                    } else if ('init' in e.data) {
                        postMessage({__system: true, threadId: getThreadId(), __initd: false, __error: err})
                        self.close()
                    } else if ('__close' in e.data) {
                        sendError(err)
                        self.close()
                    }
                } else {
                    sendError(err)
                }
            }
        }
        finally {
            --messagesProcessing
            if (messagesProcessing === 0 && threadIdle > 0 && isFinite(threadIdle)) {
                threadIdleTimeout = setTimeout(() => self.close(), threadIdle)
            }
        }
    }
}
