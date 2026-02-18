

export function RegisterHandler(handler: (_: any) => any, type = 'event') {
    if (self) {
        switch (type) {
            case 'init':
                (self as any).oninit = handler
                break
            case 'event':
                (self as any).onevent = handler
                break
            case 'share':
                (self as any).onshare = handler
                break
            case 'transfer':
                (self as any).ontransfer = handler
                break
            case 'work':
                (self as any).onwork = handler
                break
        }
    }
    else {
        throw new Error('RegisterHandler only usable from worker thread!')
    }
}

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

    static hydrate({memory, offset}: {memory: Int32Array, offset: number}) {
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

export class Mutex {
    private static unlocked = 0
    private static locked = 1
    private static contended = 2

    public static ELEMENT_LAYOUT: ElementLayout = [['int32', 2]]
    public static HYDRATION_KEY = 'Mutex'

    private memory: Int32Array
    private offset: number

    constructor(address: Address<Int32Array>) {
        this.memory = address.memory()
        this.offset = address.offset()
    }

    static hydrate({memory, offset}: {memory: Int32Array, offset: number}) {
        const addr = new Address(memory, offset)
        return new Mutex(addr)
    }

    static dehydrate(mux: Mutex) {
        return {
            __type: Mutex.HYDRATION_KEY,
            memory: mux.memory,
            offset: mux.offset,
        }
    }

    /**
     * Locks the mutex (blocking)
     *
     * If given a timeout, then it will try to lock before the timeout occurs, otherwise it will fail to lock
     *
     * @param timeout Timeout (in milliseconds) for obtaining the lock
     * @returns {boolean} True if got the lock, false if timed out
     */
    public lock (timeout: number = Infinity): boolean{
        if (Atomics.compareExchange(this.memory, this.offset, Mutex.unlocked, Mutex.locked) === Mutex.unlocked) {
            return true /* got the lock */
        }
        let lastTime = Date.now()

        while (true) {
            Atomics.compareExchange(this.memory, this.offset, Mutex.locked, Mutex.contended)
            const r = Atomics.wait(this.memory, this.offset, Mutex.contended, timeout)
            if (r === "timed-out") {
                return false
            }

            if (Atomics.compareExchange(this.memory, this.offset, Mutex.unlocked, Mutex.contended) === Mutex.unlocked) {
                return true /* got the lock */
            }

            if (Number.isFinite(timeout)) {
                let curTime = Date.now()
                let elapsed = curTime - lastTime
                timeout -= elapsed
                lastTime = curTime
                if (timeout <= 0) {
                    return false
                }
            }
        }
    }

    /**
     * Asynchronously locks a mutex.
     * Returns a promise which resolves to true if the lock was obtained, or false otherwise
     * @param timeout Timeout (in milliseconds) for obtaining the lock
     * @returns {Promise<boolean>} Promise that resolves to true if got the lock, false if timed out
     */
    public async lockAsync(timeout: number = Infinity): Promise<boolean> {
        if (!('waitAsync' in Atomics)) {
            throw new Error("waitAsync not available!")
        }
        let cur = Atomics.compareExchange(this.memory, this.offset, Mutex.unlocked, Mutex.locked)
        if (cur === Mutex.unlocked) {
            return true /* got the lock */
        }
        let lastTime = Date.now()

        while (true) {
            if (cur !== Mutex.contended) {
                Atomics.compareExchange(this.memory, this.offset, cur, Mutex.contended)
            }
            const {async, value} = (Atomics as any).waitAsync(this.memory, this.offset, Mutex.contended, timeout)
            if (async) {
                const r = await value
                if (r === 'timed-out') {
                    return false
                }
            } else if (value === 'timed-out') {
                return false
            }

            cur = Atomics.compareExchange(this.memory, this.offset, Mutex.unlocked, Mutex.contended)
            if (cur === Mutex.unlocked) {
                return true /* got the lock */
            }

            if (Number.isFinite(timeout)) {
                let curTime = Date.now()
                let elapsed = curTime - lastTime
                timeout -= elapsed
                lastTime = curTime
                if (timeout <= 0) {
                    return false
                }
            }
        }
    }

    /**
     * Tries to get a lock without waiting. Only locks if the mutex is unlocked and not contended
     * @returns {boolean} True if it got the lock, false otherwise
     */
    public tryLock() {
        // Try to get the lock (will only lock if we're unlocked)
        let cur = Atomics.compareExchange(this.memory, this.offset, Mutex.unlocked, Mutex.locked)
        return cur === Mutex.unlocked;
    }

    /**
     * Unlocks the mutex
     */
    public unlock() {
        if (Atomics.sub(this.memory, this.offset, 1) === Mutex.contended) {
            Atomics.store(this.memory, this.offset, Mutex.unlocked)
            Atomics.notify(this.memory, this.offset, 1)
        }
    }
}

export class WaitGroup {
    private memory: Int32Array
    private offset: number

    public static ELEMENT_LAYOUT: ElementLayout = ['int32']
    public static HYDRATION_KEY = 'WaitGroup'

    constructor(address: Address<Int32Array>) {
        this.memory = address.memory()
        this.offset = address.offset()
    }

    static hydrate({memory, offset}: {memory: Int32Array, offset: number}) {
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
            }
            else if (value === 'timed-out') {
                return false
            }
        }
    }
}

export class ConditionVariable {
    private memory: Int32Array
    private prevOffset: number
    private valOffset: number

    public static ELEMENT_LAYOUT: ElementLayout = [['int32', 2]]
    public static HYDRATION_KEY = 'ConditionVariable'

    constructor(address: Address<Int32Array>) {
        if (address.count() < 2) {
            throw new Error(`Invalid address for Condition Variable! COUNT: ${address.count()}`)
        }
        this.memory = address.memory()
        this.prevOffset = address.offset()
        this.valOffset = address.offset() + 1
    }

    static hydrate({memory, offset}: {memory: Int32Array, offset: number}) {
        const addr = new Address(memory, offset, memory.length)
        return new ConditionVariable(addr)
    }

    static dehydrate(cv: ConditionVariable) {
        return {
            __type:ConditionVariable.HYDRATION_KEY,
            memory: cv.memory,
            offset: cv.prevOffset,
        }
    }

    public wait(mux: Mutex, timeout: number = Infinity) {
        const start = Date.now()
        const val = Atomics.load(this.memory, this.valOffset)
        Atomics.store(this.memory, this.prevOffset, val)

        mux.unlock()

        if (Atomics.wait(this.memory, this.valOffset, val, timeout) === 'timed-out') {
            return false
        }

        if (!Number.isFinite(timeout)) {
            const end = Date.now()
            const elapsed = end - start
            timeout -= elapsed
            if (timeout <= 0) {
                return false;
            }
        }

        mux.lock(timeout)
        return true
    }

    public async waitAsync(mux: Mutex, timeout: number = Infinity) {
        if (!('waitAsync' in Atomics)) {
            throw new Error("waitAsync not available!")
        }
        const start = Date.now()
        const val = Atomics.load(this.memory, this.valOffset)
        Atomics.store(this.memory, this.prevOffset, val)

        mux.unlock()

        const {async, value} = (Atomics as any).waitAsync(this.memory, this.valOffset, val, timeout)
        if (async) {
            if (await value === 'timed-out') {
                return false
            }
        } else if (value === 'timed-out') {
            return false
        }

        if (!Number.isFinite(timeout)) {
            const end = Date.now()
            const elapsed = end - start
            timeout -= elapsed
            if (timeout <= 0) {
                return false;
            }
        }

        return await mux.lockAsync(timeout)
    }

    public notify(count: number = 1) {
        const val = Atomics.load(this.memory, this.prevOffset)
        Atomics.store(this.memory, this.valOffset, (val + 1) | 0)
        Atomics.notify(this.memory, this.valOffset, count)
    }
}

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

    static hydrate({memory, maxNeeded}: {memory: Int32Array, maxNeeded: number}) {
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
        this.memory.set([this.memory.at(this.stillNeededOffset)!!-1], this.stillNeededOffset)
        if (this.memory.at(this.stillNeededOffset)!! > 0) {
            const e = this.memory.at(this.eventOffset)!!
            this.mutex.unlock()
            Atomics.wait(this.memory, this.eventOffset, e)
        }
        else {
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
        this.memory.set([this.memory.at(this.stillNeededOffset)!!-1], this.stillNeededOffset)
        if (this.memory.at(this.stillNeededOffset)!! > 0) {
            const e = this.memory.at(this.eventOffset)!!
            this.mutex.unlock()
            const {async, value} = (Atomics as any).waitAsync(this.memory, this.eventOffset, e)
            if (async) { await value }
        }
        else {
            Atomics.add(this.memory, this.eventOffset, 1)
            this.memory.set([this.maxNeeded], this.stillNeededOffset)
            Atomics.notify(this.memory, this.eventOffset)
            this.mutex.unlock()
        }
    }
}

export class Semaphore {
    private memory: Int32Array
    private valOffset: number
    private waiterOffset: number
    private value: number

    public static ELEMENT_LAYOUT: ElementLayout = [['int32', 2]]
    public static HYDRATION_KEY = 'Semaphore'

    constructor(address: Address<Int32Array>, value: number, initMem: boolean = true) {
        this.memory = address.memory()
        this.valOffset = address.offset()
        this.value = value
        this.waiterOffset = this.valOffset + 1
        if (address.memory().length < 2) {
            throw new Error("INVALID ADDRESS! MUST BE AT LEAST 2 INT32 WIDE!")
        }

        if (initMem) {
            this.memory.set([value], this.valOffset)
        }
    }

    static hydrate({memory, value}: {memory: Int32Array, value: number}) {
        const addr = new Address(memory, 0)
        return new Semaphore(addr, value, false)
    }

    static dehydrate(s: Semaphore) {
        return {
            __type: Semaphore.HYDRATION_KEY,
            memory: s.memory,
            offset: s.valOffset,
            value: s.value
        }
    }

    public acquire(timeout: number = Infinity) {
        let lastTime = Date.now()
        do {
            const val = Atomics.load(this.memory, this.valOffset);

            // attempt to acquire a lock
            if (val > 0 && Atomics.compareExchange(this.memory, this.valOffset, val, val - 1) === val) {
                return true;
            }

            Atomics.add(this.memory, this.waiterOffset, 1);

            // wait for it to be available
            if (Atomics.wait(this.memory, this.valOffset, 0, timeout) === 'timed-out') {
                return false
            }
            Atomics.sub(this.memory, this.waiterOffset, 1);
            if (Number.isFinite(timeout)) {
                let curTime = Date.now()
                let elapsed = curTime - lastTime
                timeout -= elapsed
                lastTime = curTime
                if (timeout <= 0) {
                    return false
                }
            }

        } while (true);
    }

    public async acquireAsync(timeout: number = Infinity) {
        if (!('waitAsync' in Atomics)) {
            throw new Error("waitAsync not available!")
        }
        let lastTime = Date.now()
        do {
            const val = Atomics.load(this.memory, this.valOffset);

            // attempt to acquire a lock
            if (val > 0 && Atomics.compareExchange(this.memory, this.valOffset, val, val - 1) === val) {
                return true;
            }

            Atomics.add(this.memory, this.waiterOffset, 1);

            // wait for it to be available
            const {async, value} = (Atomics as any).waitAsync(this.memory, this.valOffset, 0)
            if (async) {
                if (await value === 'timed-out') {
                    return false
                }
            }
            else if (value === 'timed-out') {
                return false
            }
            Atomics.sub(this.memory, this.waiterOffset, 1);
            if (Number.isFinite(timeout)) {
                let curTime = Date.now()
                let elapsed = curTime - lastTime
                timeout -= elapsed
                lastTime = curTime
                if (timeout <= 0) {
                    return false
                }
            }
        } while (true);
    }

    public release() {
        Atomics.add(this.memory, this.valOffset, 1)

        if (Atomics.load(this.memory, this.waiterOffset) > 0) {
            Atomics.notify(this.memory, this.valOffset, 1)
        }
    }
}

export function make<T>(Type: T, ...args: any[]) {
    let curBytes = 0

    function alignment(alignment: number) {
        if (curBytes == 0) {
            return 0
        }
        return (curBytes + (alignment - 1)) & ~(alignment - 1) - curBytes
    }

    const layouts: Array<[{new(_: any): TypedArray}, number, number]> = []

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

export class Thread {
    private worker: Worker
    private threadId: string
    private incWorkId: number = 0
    private handler: ((_: any) => any)|undefined
    private workQueue: {
        [id: string]: {
            res: (_: any) => any,
            rej: (_: any) => any,
        }
    } = {}

    private constructor(res: any, script: string, initData: any = null, handler: ((_: any) => any)|undefined = undefined) {
        this.threadId = curThreadId + '->' + (++incThreadId)
        this.worker = new Worker(script)
        this.worker.postMessage(dehydrate({__system: true, threadId: this.threadId, init: initData}))
        this.handler = handler

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
                }
                else if (e.data.hasOwnProperty('__error')) {
                    console.error(`Received error from thread ${this.threadId}!`, 'error')
                }
                else if (e.data.hasOwnProperty('__initd')) {
                    res()
                }
                else if (e.data.hasOwnProperty('__shared')) {
                    const {res} = this.workQueue[e.data.__shared]
                    res(null)
                    delete this.workQueue[e.data.__shared]
                    return
                }
                else if (e.data.hasOwnProperty('__transferd')) {
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

    public static spawn(script: string, initData: any = null, handler: ((_: any) => any)|undefined = undefined) {
        const p = new Promise<Thread>(resolve => {
            const t = new Thread(() => resolve(t), script, initData, handler)
        })
        return p
    }

    private nextWorkId () {
        if (crypto && crypto.randomUUID) {
            return this.threadId + ':' + crypto.randomUUID()
        } else {
            return this.threadId + ':' + (this.incWorkId++)
        }
    }

    public setOnEvent(h: ((_: any) => any)|undefined) {
        this.handler = h
    }

    public sendWork(work: any) {
        const workId = this.nextWorkId()
        const promise = new Promise((res, rej) => {
            this.workQueue[workId] = {res, rej}
        })
        this.worker.postMessage(dehydrate({__system: true, workId, work}))
        return promise
    }

    public sendEvent(event: any) {
        this.worker.postMessage(dehydrate(event))
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
            this.worker.postMessage(dehydrate({__system: true, shareId, share: item, message}))
        } else {
            this.worker.postMessage(dehydrate({__system: true, shareId, share: item}))
        }
        return promise
    }

    public transfer(message: any, items: any[] = []): Promise<unknown> {
        const transferId = this.nextWorkId()
        const promise = new Promise((res, rej) => {
            console.log('queued transfer', transferId)
            this.workQueue[transferId] = {res, rej}
        })
        this.worker.postMessage(dehydrate({__system: true, transfer: transferId, message}), items)
        return promise
    }

    public close() {
        this.worker.postMessage(dehydrate({__system: true, close: true}))
    }
}

function setThreadId(threadId: string) {
    curThreadId = threadId
}

function getThreadId(): string {
    return curThreadId
}

if (typeof self !== 'undefined') {
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
            let res2: any = undefined
            const setRes = (r: any) => {
                res2 = r
            }

            if (typeof e.data === 'object' || typeof e.data === 'function') {
                if ('__system' in e.data && e.data.__system) {
                    if ('share' in e.data && 'shareId' in e.data) {
                        if ((self as any).onshare) {
                            res = (self as any).onshare({share: e.data.share, message: e.data.message}, setRes)
                        } else if ((self as any).onevent) {
                            res = (self as any).onevent(e, setRes)
                        }
                        postMessage({__system: true, __shared: e.data.shareId})
                    } else if ('transfer' in e.data) {
                        if ((self as any).ontransfer) {
                            res = (self as any).ontransfer(e.data.message, setRes)
                        } else if ((self as any).onevent) {
                            res = (self as any).onevent(e, setRes)
                        }
                        postMessage({__system: true, __transferd: e.data.transfer})
                    } else if ('workId' in e.data) {
                        if ((self as any).onwork) {
                            res = (self as any).onwork(e.data.work, setRes)
                        } else if ((self as any).onevent) {
                            res = (self as any).onevent(e, setRes)
                        }
                    } else if ('threadId' in e.data) {
                        setThreadId(e.data.threadId)
                        if ((self as any).oninit) {
                            (self as any).oninit(e.data.init)
                        }
                        postMessage({__system: true, __initd: true})
                    }
                } else if ((self as any).onevent) {
                    res = (self as any).onevent(e, setRes)
                }

                if (typeof res2 !== 'undefined') {
                    if (res2 && (res2 instanceof Promise || ((typeof res2 === 'object' || typeof res2 === 'function') && 'then' in res2 && res2?.then === 'function'))) {
                        res2 = await res2
                    }

                    if ('__system' in e.data && 'workId' in e.data) {
                        postMessage(dehydrate({
                            __system: true,
                            threadId: getThreadId(),
                            workId: e.data.workId,
                            res: res2
                        }))
                    }
                }

                if (typeof res !== 'undefined') {
                    if (res && (res instanceof Promise || ((typeof res === 'object' || typeof res === 'function') && 'then' in res && typeof res?.then === 'function'))) {
                        res = await res
                    }

                    if ('__system' in e.data && 'workId' in e.data) {
                        postMessage(dehydrate({__system: true, threadId: getThreadId(), workId: e.data.workId, res}))
                    }
                }
            } else if ((self as any).onevent) {
                (self as any).onevent(e, setRes)
            }
        } catch (err) {
            console.error('PROCESSING FAILED!', err, e.data)
            if ((typeof e.data === 'object' || typeof e.data === 'function') && '__system' in e.data && 'workId' in e.data) {
                postMessage(dehydrate({__system: true, threadId: getThreadId(), workId: e.data.workId, rej: err}))
            } else {
                throw e
            }
        }
    }
}
