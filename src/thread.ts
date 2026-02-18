import {Mutex} from "./mutex.ts";
import {ConditionVariable} from "./conditionVariable.ts";
import {Address} from "./address.ts";
import {WaitGroup} from "./waitGroup.ts";
import {Barrier} from "./barrier.ts";
import {Semaphore} from "./semaphore.ts";

let curThreadId = 'main'
let incThreadId = 0

function dehydrate(obj: any): any {
    if (obj && Array.isArray(obj)) {
        return obj.map(dehydrate)
    }
    else if (typeof obj === 'object' && obj) {
        const v: any = {
            __dehydrated: true,
            __value: null
        }
        if (obj instanceof Address) {
            v.__value = Address.dehydrate(obj)
        }
        else if (obj instanceof Mutex) {
            v.__value = Mutex.dehydrate(obj)
        }
        else if (obj instanceof ConditionVariable) {
            v.__value = ConditionVariable.dehydrate(obj)
        }
        else if (obj instanceof WaitGroup) {
            v.__value = WaitGroup.dehydrate(obj)
        }
        else if (obj instanceof Barrier) {
            v.__value = Barrier.dehydrate(obj)
        }
        else if (obj instanceof Semaphore) {
            v.__value = Semaphore.dehydrate(obj)
        }
        else {
            for (const k of Object.keys(obj)) {
                obj[k] = dehydrate(obj[k])
            }
            return obj
        }
        return v
    }
    else {
        return obj
    }
}

function hydrate(obj: any): any {
    if (typeof obj === 'object' && obj !== null && '__dehydrated' in obj && obj.__dehydrated) {
        const type: string|null|undefined = obj?.__value?.__type
        if (!type) {
            return obj
        }
        const val = obj.__value
        switch (type) {
            case Mutex.HYDRATION_KEY: return Mutex.hydrate(val)
            case ConditionVariable.HYDRATION_KEY: return ConditionVariable.hydrate(val)
            case Address.HYDRATION_KEY: return Address.hydrate(val)
            case WaitGroup.HYDRATION_KEY: return WaitGroup.hydrate(val)
            case Barrier.HYDRATION_KEY: return Barrier.hydrate(val)
            case Semaphore.HYDRATION_KEY: return Semaphore.hydrate(val)
        }
        return obj
    }
    else if (obj && Array.isArray(obj)) {
        return obj.map(hydrate)
    }
    else if (typeof obj === 'object' && obj) {
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

export class Thread {
    private worker: Worker
    private threadId: string
    private incWorkId: number = 0
    private handler: ((_: any) => any) | undefined
    private workQueue: {
        [id: string]: {
            res: (_: any) => any,
            rej: (_: any) => any,
        }
    } = {}

    private constructor(res: any, script: string, initData: any = null, onEventHandler: ((_: any) => any) | undefined = undefined) {
        this.threadId = curThreadId + '->' + (++incThreadId)
        this.worker = new Worker(script)
        const oldPostMessage = this.worker.postMessage.bind(this.worker)
        this.worker.postMessage = (function(message: any, ...args: any[]) {
            return oldPostMessage(dehydrate(message), ...args)
        } as any).bind(this.worker)
        this.worker.postMessage({__system: true, threadId: this.threadId, init: initData})
        this.handler = onEventHandler

        this.worker.onmessage = (e) => {
            e = {...e, data: hydrate(e.data)}
            if (e.data.hasOwnProperty('__system') && e.data.__system) {
                if (e.data.hasOwnProperty('workId') && (e.data.hasOwnProperty('res') || e.data.hasOwnProperty('rej'))) {
                    if (!this.workQueue.hasOwnProperty(e.data.workId)) {
                        console.error("UNKNOWN JOB ", e.data.workId)
                    } else {
                        const {res, rej} = this.workQueue[e.data.workId]
                        try {
                            if (e.data.hasOwnProperty('res')) {
                                res(e.data.res)
                            } else {
                                rej(e.data.rej || new Error('Bad response from worker thread'))
                            }
                        } finally {
                            delete this.workQueue[e.data.workId]
                        }
                        return
                    }
                } else if (e.data.hasOwnProperty('__error')) {
                    console.error(`Received error from thread ${this.threadId}!`, 'error')
                } else if (e.data.hasOwnProperty('__initd')) {
                    res()
                } else if (e.data.hasOwnProperty('__shared')) {
                    const {res} = this.workQueue[e.data.__shared]
                    res(null)
                    delete this.workQueue[e.data.__shared]
                    return
                } else if (e.data.hasOwnProperty('__transferd')) {
                    const {res} = this.workQueue[e.data.__transferd]
                    res(null)
                    delete this.workQueue[e.data.__transferd]
                    return
                }
                return
            }

            if (this.handler) {
                this.handler(e)
            }
        }

        this.worker.onerror = (e) => {
            console.error(`Thread ${this.threadId} had an error!`, e)
        }

        this.worker.onmessageerror = (e) => {
            console.error(`Cound not send message to thread ${this.threadId}!`, e)
        }
    }

    public static spawn(script: string, initData: any = null, handler: ((_: any) => any) | undefined = undefined) {
        return new Promise<Thread>(resolve => {
            const t = new Thread(() => resolve(t), script, initData, handler)
        })
    }

    private nextWorkId() {
        if (crypto && crypto.randomUUID) {
            return this.threadId + ':' + crypto.randomUUID()
        } else {
            return this.threadId + ':' + (this.incWorkId++)
        }
    }

    public setOnEvent(h: ((_: any) => any) | undefined) {
        this.handler = h
    }

    public sendWork(work: any) {
        const workId = this.nextWorkId()
        const promise = new Promise((res, rej) => {
            this.workQueue[workId] = {res, rej}
        })
        this.worker.postMessage({__system: true, workId, work})
        return promise
    }

    public sendEvent(event: any) {
        this.worker.postMessage(event)
    }

    public raw() {
        return this.worker
    }

    public share(item: any, message: any = undefined): Promise<unknown> {
        const shareId = this.nextWorkId()
        const promise = new Promise((res, rej) => {
            console.log('queued share', shareId)
            this.workQueue[shareId] = {res, rej}
        })
        if (typeof message != 'undefined') {
            this.worker.postMessage({__system: true, shareId, share: item, message})
        } else {
            this.worker.postMessage({__system: true, shareId, share: item})
        }
        return promise
    }

    public transfer(message: any, items: any[] = []): Promise<unknown> {
        const transferId = this.nextWorkId()
        const promise = new Promise((res, rej) => {
            console.log('queued transfer', transferId)
            this.workQueue[transferId] = {res, rej}
        })
        this.worker.postMessage({__system: true, transfer: transferId, message}, items)
        return promise
    }

    public close() {
        this.worker.postMessage({__system: true, close: true})
    }
}

function promiseLike(p: any) {
    return p && (p instanceof Promise || ((typeof p === 'object' || typeof p === 'function') && 'then' in p && typeof p?.then === 'function'))
}

if (typeof self !== 'undefined') {
    const oldPostMessage = self.postMessage
    self.postMessage = (function(message: any, ...args: any[]) {
        return oldPostMessage(dehydrate(message), ...args)
    }.bind(self) as any)
    self.onmessage = async (e: MessageEvent) => {
        try {
            e = {...e, data: hydrate(e.data)}
        }
        catch (err) {
            console.error('HYDRATION FAILED!', err, e.data)
            e = {...e, data: hydrate(e.data)}
        }
        try {
            let res: any = undefined

            if (typeof e.data === 'object' || typeof e.data === 'function') {
                if ('__system' in e.data && e.data.__system) {
                    if ('share' in e.data && 'shareId' in e.data) {
                        if ((self as any).onshare) {
                            res = (self as any).onshare({share: e.data.share, message: e.data.message})
                        } else if ((self as any).onevent) {
                            res = (self as any).onevent(e)
                        }

                        if (promiseLike(res)) {
                            res = await res
                        }
                        postMessage({__system: true, __shared: e.data.shareId})
                    } else if ('transfer' in e.data) {
                        if ((self as any).ontransfer) {
                            res = (self as any).ontransfer(e.data.message)
                        } else if ((self as any).onevent) {
                            res = (self as any).onevent(e)
                        }

                        if (promiseLike(res)) {
                            res = await res
                        }
                        postMessage({__system: true, __transferd: e.data.transfer})
                    } else if ('workId' in e.data) {
                        if ((self as any).onwork) {
                            res = (self as any).onwork(e.data.work)
                        } else if ((self as any).onevent) {
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
                    } else if ('threadId' in e.data) {
                        setThreadId(e.data.threadId)
                        if ((self as any).oninit) {
                            (self as any).oninit(e.data.init)
                        }
                        if (promiseLike(res)) {
                            res = await res
                        }
                        postMessage({__system: true, __initd: true})
                    }
                } else if ((self as any).onevent) {
                    (self as any).onevent(e)
                }
            } else if ((self as any).onevent) {
                (self as any).onevent(e)
            }
        } catch (err) {
            if ((typeof e.data === 'object' || typeof e.data === 'function') && '__system' in e.data && 'workId' in e.data) {
                postMessage({__system: true, threadId: getThreadId(), workId: e.data.workId, rej: err})
            } else {
                throw e
            }
        }
    }
}
