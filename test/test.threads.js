const {Barrier, ThreadPool, Thread, Mutex, make, ConditionVariable, WaitGroup, Semaphore} = threads

describe('Thread', () => {
    it('is setup', async () => {
        const thread = await Thread.spawn('worker1.js')
        expect(thread).to.not.be.null
    })

    it('can create thread', async () => {
        const thread = await Thread.spawn('worker1.js')
        expect(thread).to.not.be.null
        expect(await thread.sendWork(4)).to.equal(16)
    })

    it('event handler', async () => {
        let resolve
        const p = new Promise((res) => {
            resolve = res
        })
        const handler = (v) => {
            resolve(v.data)
        }
        const thread = await Thread.spawn('worker1.js', 45, handler)
        expect(thread).to.not.be.null
        expect(await thread.sendWork(4)).to.equal(16)
        thread.sendEvent(-23)
        expect(await p).to.equal(45)
    })

    it('share handler', async () => {
        let resolve
        const p = new Promise((res) => {
            resolve = res
        })
        const handler = (v) => {
            resolve(v.data)
        }
        const thread = await Thread.spawn('worker1.js', 45, handler)
        expect(thread).to.not.be.null

        await thread.share(99)
        expect(await thread.sendWork(4)).to.equal(16)
        thread.sendEvent(-23)
        expect(await p).to.equal(99)
    })

    it('share handler message', async () => {
        let resolve
        const p = new Promise((res) => {
            resolve = res
        })
        const handler = (v) => {
            resolve(v.data)
        }
        const thread = await Thread.spawn('worker1.js', 45, handler)
        expect(thread).to.not.be.null

        await thread.share(99, 55)
        expect(await thread.sendWork(4)).to.equal(16)
        thread.sendEvent(-23)
        expect(await p).to.equal(55)
    })

    it('transfer handler', async () => {
        let resolve
        const p = new Promise((res) => {
            resolve = res
        })
        const handler = (v) => {
            resolve(v.data)
        }
        const thread = await Thread.spawn('worker1.js', 45, handler)
        expect(thread).to.not.be.null

        await thread.transfer(99, [])
        expect(await thread.sendWork(4)).to.equal(16)
        thread.sendEvent(-23)
        expect(await p).to.equal(99)
    })
})

describe('ThreadPool', () => {
    it('can create thread pool', async () => {
        const thread = await ThreadPool.spawn('worker1.js', 2)
        expect(thread).to.not.be.null
        expect(await thread.sendWork(4)).to.equal(16)
        expect(await thread.sendWork(2)).to.equal(4)
        expect(await thread.sendWork(3)).to.equal(9)
        expect(await thread.sendWork(5)).to.equal(25)
        expect(await thread.sendWork(6)).to.equal(36)
    })
})

describe('ConditionVariable', async () => {
    it('can notify', async function () {
        const mux = make(Mutex)
        const cv = make(ConditionVariable)
        const mem = new Int32Array(new SharedArrayBuffer(64))

        await mux.lockAsync()

        const thread = await Thread.spawn('cond_var.js', {mux, cv, mem})

        thread.sendWork(4)

        while (mem.at(0) === 0) {
            await cv.waitAsync(mux)
        }

        expect(mem.at(0)).to.equal(12)
    })
})

describe('WaitGroup', async () => {
    it('can lock wait until tasks are done', async function () {
        const wg = make(WaitGroup)
        const mem = new Int32Array(new SharedArrayBuffer(64))
        const thread = await Thread.spawn('wait_group.js', {wg, mem})

        wg.add(1)
        thread.sendWork(4)

        wg.add(1)
        thread.sendWork(5)

        wg.add(1)
        thread.sendWork(6)

        wg.add(1)
        thread.sendWork(7)

        await wg.waitAsync()

        expect(mem.at(0)).to.equal(4 + 5 + 6 + 7)
    })
})

describe('Barrier', async () => {
    it('blocks until all threads hit the barrier', async function () {
        const bar = make(Barrier, 3)
        const mem = new Int32Array(new SharedArrayBuffer(64))
        const thread1 = await Thread.spawn('barrier.js', {bar, mem})
        const thread2 = await Thread.spawn('barrier.js', {bar, mem})

        thread1.sendWork(1)
        thread2.sendWork(1)

        await bar.waitAsync()

        expect(mem.at(0)).to.equal(2)
    })
})

describe('Semaphore', async () => {
    it('can lock when contended', async function () {
        this.timeout(30_000)

        for (let i = 0; i < 2; ++i) {
            const sem = make(Semaphore, 1)
            const mem = new Int32Array(new SharedArrayBuffer(64))
            const thread1 = await Thread.spawn('semaphore.js', {sem, mem})
            const thread2 = await Thread.spawn('semaphore.js', {sem, mem})
            const thread3 = await Thread.spawn('semaphore.js', {sem, mem})
            const thread4 = await Thread.spawn('semaphore.js', {sem, mem})

            await Promise.all([
                thread1.sendWork(1),
                thread2.sendWork(1),
                thread3.sendWork(1),
                thread4.sendWork(1),
            ])

            expect(mem.at(0)).to.equal(800)
            if (mem.at(0) !== 800) {
                console.error("BAD RESULT: ", mem.at(0))
            }
        }
    })
})

describe('Mutex', async () => {
    it('can do basic locking', async function () {
        this.timeout(30_000)
        const w = 5
        const mux = make(Mutex)
        const mem = new Int32Array(new SharedArrayBuffer(64))

        await mux.lockAsync()
        const thread1 = await Thread.spawn('mutex.js', {mux, mem})
        const thread2 = await Thread.spawn('mutex.js', {mux, mem})

        const p1 = thread1.sendWork(w)
        const p2 = thread2.sendWork(w)

        mux.unlock()

        await Promise.all([p1, p2])

        expect(mem.at(0)).to.equal(w * 2)
    })

    it('can lock when contended', async function () {
        this.timeout(30_000)
        const w = 500
        const mux = make(Mutex)
        const mem = new Int32Array(new SharedArrayBuffer(64))
        const thread1 = await Thread.spawn('mutex.js', {mux, mem})
        const thread2 = await Thread.spawn('mutex.js', {mux, mem})
        const thread3 = await Thread.spawn('mutex.js', {mux, mem})

        await mux.lockAsync()

        const p1 = thread1.sendWork(w)
        const p2 = thread2.sendWork(w)
        const p3 = thread3.sendWork(w)

        mux.unlock()

        await Promise.all([p1, p2, p3])

        expect(mem.at(0)).to.equal(w * 3)
    })
})
