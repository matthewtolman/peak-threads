/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const {Barrier, ThreadPool, SharedThread, Thread, Mutex, make, ConditionVariable, WaitGroup, Semaphore} = threads

describe('Thread', () => {
    threads.setLogging(true)

    it('is setup', async function () {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        const thread = await Thread.spawn('worker1.js', {closeWhenIdle: 100})
        expect(thread).to.not.be.null
    })

    it('can create thread', async function() {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        const thread = await Thread.spawn('worker1.js', {closeWhenIdle: 100})
        expect(thread).to.not.be.null
        expect(await thread.sendWork(4)).to.equal(16)
    })

    it('event handler', async function() {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        let resolve
        const p = new Promise((res) => {
            resolve = res
        })
        const handler = (v) => {
            resolve(v.data)
        }
        const thread = await Thread.spawn('worker1.js', {initData: 45, onEventHandler: handler, closeWhenIdle: 100})
        expect(thread).to.not.be.null
        expect(await thread.sendWork(4)).to.equal(16)
        thread.sendEvent(-23)
        expect(await p).to.equal(45)
    })

    it('share handler', async function() {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        let resolve
        const p = new Promise((res) => {
            resolve = res
        })
        const handler = (v) => {
            resolve(v.data)
        }
        const thread = await Thread.spawn('worker1.js', {initData: 45, onEventHandler: handler, closeWhenIdle: 100})
        expect(thread).to.not.be.null

        await thread.share(99)
        expect(await thread.sendWork(4)).to.equal(16)
        thread.sendEvent(-23)

        // graceful shutdown
        thread.close()

        // should still be able to await for the response back
        expect(await p).to.equal(99)
    })

    it('share handler message', async function() {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        let resolve
        const p = new Promise((res) => {
            resolve = res
        })
        const handler = (v) => {
            resolve(v.data)
        }
        const thread = await Thread.spawn('worker1.js', {initData:45, onEventHandler: handler})
        expect(thread).to.not.be.null

        await thread.share(99, 55)
        expect(await thread.sendWork(4)).to.equal(16)
        thread.sendEvent(-23)
        expect(await p).to.equal(55)
    })

    it('transfer handler can be called', async function() {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        let resolve
        const p = new Promise((res) => {
            resolve = res
        })
        const handler = (v) => {
            resolve(v.data)
        }
        const thread = await Thread.spawn('worker1.js', {initData:45, onEventHandler:handler})
        expect(thread).to.not.be.null

        await thread.transfer(99, [])
        expect(await thread.sendWork(4)).to.equal(16)
        thread.sendEvent(-23)
        expect(await p).to.equal(99)
        thread.close()
    })

    it('transfer handler transfers ownership', async function() {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        let resolve
        const p = new Promise((res) => {
            resolve = res
        })
        const handler = (v) => {
            resolve(v.data)
        }
        const ab = new ArrayBuffer(64)
        const ints = new Int32Array(ab)
        ints.set([99], 0)
        const thread = await Thread.spawn('worker2.js', {initData:45, onEventHandler:handler})
        expect(thread).to.not.be.null

        await thread.transfer(ints, ints.buffer)
        thread.sendEvent(-23)
        expect(await p).to.equal(99)

        expect(() => ints.at(0)).to.throw()
        thread.kill()
    })

    it('can transfer back', async function() {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        let resolve
        let ints = new Int32Array(new ArrayBuffer(64))
        const p = new Promise((res) => {
            resolve = res
        })
        const handler = ({result, buff}) => {
            ints = buff
            console.error('HANDLER')
            resolve(result)
        }
        ints.set([99], 0)
        const thread = await Thread.spawn('worker3.js', {initData:45, onTransferHandler: handler})
        expect(thread).to.not.be.null

        await thread.transfer(ints, ints.buffer)
        expect(await p).to.equal(99)
        expect(ints.at(0)).to.equal(99)
        thread.close()
    })
})

describe('SharedThread', () => {
    threads.setLogging(true)

    it('is setup', async function () {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        const thread = await SharedThread.connect('shared-worker1.js', {closeWhenIdle: 100})
        expect(thread).to.not.be.null
    })

    it('can connect to thread', async function() {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        const thread = await SharedThread.connect('shared-worker1.js', {closeWhenIdle: 100})
        expect(thread).to.not.be.null
        expect(await thread.sendWork(4)).to.equal(16)
    })

    it('event handler', async function() {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        let resolve
        const p = new Promise((res) => {
            resolve = res
        })
        const handler = (v) => {
            resolve(v.data)
        }
        const thread = await SharedThread.connect('shared-worker1.js', {initData: 45, onEventHandler: handler, closeWhenIdle: 100})
        expect(thread).to.not.be.null
        expect(await thread.sendWork(4)).to.equal(16)
        thread.sendEvent(-23)
        expect(await p).to.equal(45)
    })

    it('share handler', async function() {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        let resolve
        const p = new Promise((res) => {
            resolve = res
        })
        const handler = (v) => {
            resolve(v.data)
        }
        const thread = await SharedThread.connect('shared-worker1.js', {initData: 45, onEventHandler: handler, closeWhenIdle: 100})
        expect(thread).to.not.be.null

        await thread.share(99)
        expect(await thread.sendWork(4)).to.equal(16)
        thread.sendEvent(-23)

        // graceful shutdown
        thread.disconnect()

        // should still be able to await for the response back
        expect(await p).to.equal(99)
    })

    it('share handler message', async function() {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        let resolve
        const p = new Promise((res) => {
            resolve = res
        })
        const handler = (v) => {
            resolve(v.data)
        }
        const thread = await SharedThread.connect('shared-worker1.js', {initData:45, onEventHandler: handler})
        expect(thread).to.not.be.null

        await thread.share(99, 55)
        expect(await thread.sendWork(4)).to.equal(16)
        thread.sendEvent(-23)
        expect(await p).to.equal(55)
    })

    it('transfer handler can be called', async function() {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        let resolve
        const p = new Promise((res) => {
            resolve = res
        })
        const handler = (v) => {
            resolve(v.data)
        }
        const thread = await SharedThread.connect('shared-worker1.js', {initData:45, onEventHandler:handler})
        expect(thread).to.not.be.null

        await thread.transfer(99, [])
        expect(await thread.sendWork(4)).to.equal(16)
        thread.sendEvent(-23)
        expect(await p).to.equal(99)
        thread.disconnect()
    })

    it('transfer handler transfers ownership', async function() {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        let resolve
        const p = new Promise((res) => {
            resolve = res
        })
        const handler = (v) => {
            resolve(v.data)
        }
        const ab = new ArrayBuffer(64)
        const ints = new Int32Array(ab)
        ints.set([99], 0)
        const thread = await SharedThread.connect('shared-worker2.js', {initData:45, onEventHandler:handler})
        expect(thread).to.not.be.null

        await thread.transfer(ints, ints.buffer)
        thread.sendEvent(-23)
        expect(await p).to.equal(99)

        expect(() => ints.at(0)).to.throw()
        thread.sever()
    })

    it('can transfer back', async function() {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        let resolve
        let ints = new Int32Array(new ArrayBuffer(64))
        const p = new Promise((res) => {
            resolve = res
        })
        const handler = ({result, buff}) => {
            ints = buff
            console.error('HANDLER')
            resolve(result)
        }
        ints.set([99], 0)
        const thread = await SharedThread.connect('shared-worker3.js', {initData:45, onTransferHandler: handler})
        expect(thread).to.not.be.null

        await thread.transfer(ints, ints.buffer)
        expect(await p).to.equal(99)
        expect(ints.at(0)).to.equal(99)
        thread.sever()
    })
})

describe('ThreadPool', () => {
    it('can create thread pool', async function() {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        const pool = await ThreadPool.spawn('worker1.js', {initData: 2})
        expect(pool).to.not.be.null
        expect(await pool.sendWork(4)).to.equal(16)
        expect(await pool.sendWork(2)).to.equal(4)
        expect(await pool.sendWork(3)).to.equal(9)
        expect(await pool.sendWork(5)).to.equal(25)
        expect(await pool.sendWork(6)).to.equal(36)
        pool.close()
    })

    it('can create dynamic thread pool', async function () {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        this.timeout(30_000)
        const pool = await ThreadPool.spawn('worker-slow.js', {initData: 2, minThreads: 0, closeThreadWhenIdle: 10})
        expect(pool).to.not.be.null

        // check that we can spin up
        expect(pool.size()).to.equal(0)

        {
            const [j1, j2, j3] = await Promise.all([
                pool.sendWork(4), pool.sendWork(2), pool.sendWork(3)
            ])
            expect(j1).to.equal(16)
            expect(j2).to.equal(4)
            expect(j3).to.equal(9)
            expect(pool.size()).to.equal(3)
        }

        // check that we can spin down
        await new Promise(r => setTimeout(() => r(null), 400))
        expect(pool.size()).to.equal(0)

        // and see if we can spin back up
        {
            const [j1, j2, j3] = await Promise.all([
                pool.sendWork(4), pool.sendWork(2), pool.sendWork(3)
            ])
            expect(j1).to.equal(16)
            expect(j2).to.equal(4)
            expect(j3).to.equal(9)
            expect(pool.size()).to.equal(3)
        }

        // see if we will spin up under really high load
        // see if we will spin up under really high load
        {
            let work = new Array(500).fill(500)
            let resPromises = work.map(w => pool.sendWork(w))
            const results = await Promise.all(resPromises)
        }
        pool.kill()
    })

    it('can create dynamic thread pool that does not shrink', async function () {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        this.timeout(30_000)
        const pool = await ThreadPool.spawn('worker-slow.js', {initData: 2, minThreads: 0})
        expect(pool).to.not.be.null

        // check that we can spin up
        expect(pool.size()).to.equal(0)

        {
            const [j1, j2, j3] = await Promise.all([
                pool.sendWork(4), pool.sendWork(2), pool.sendWork(3)
            ])
            expect(j1).to.equal(16)
            expect(j2).to.equal(4)
            expect(j3).to.equal(9)
            expect(pool.size()).to.equal(3)
        }

        // check that we can spin down
        await new Promise(r => setTimeout(() => r(null), 400))
        expect(pool.size()).to.equal(3)

        // and see if we can spin back up
        {
            const [j1, j2, j3] = await Promise.all([
                pool.sendWork(4), pool.sendWork(2), pool.sendWork(3)
            ])
            expect(j1).to.equal(16)
            expect(j2).to.equal(4)
            expect(j3).to.equal(9)
            expect(pool.size()).to.equal(3)
        }

        // see if we will spin up under really high load
        {
            let work = new Array(500).fill(500)
            let resPromises = work.map(w => pool.sendWork(w))
            const results = await Promise.all(resPromises)
        }
        pool.close()
    })

    it('can handle bad workers', async function () {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        this.timeout(30_000)
        const pool = await ThreadPool.spawn('worker-bad.js', {initData: 2, minThreads: 0, closeThreadWhenIdle: 10})
        expect(pool).to.not.be.null

        // check that we can spin up
        expect(pool.size()).to.equal(0)

        {
            const answers = await Promise.all([
                pool.sendWork(4), pool.sendWork(2), pool.sendWork(3)
            ])
            console.error(answers)
            const [j1, j2, j3] = answers
            expect(j1).to.equal(16)
            expect(j2).to.equal(4)
            expect(j3).to.equal(9)
        }

        // check that we can spin down
        await new Promise(r => setTimeout(() => r(null), 400))
        expect(pool.size()).to.equal(0)

        // and see if we can spin back up
        {
            const [j1, j2, j3] = await Promise.all([
                pool.sendWork(4), pool.sendWork(2), pool.sendWork(3)
            ])
            expect(j1).to.equal(16)
            expect(j2).to.equal(4)
            expect(j3).to.equal(9)
        }

        // see if we will spin up under really high load
        // see if we will spin up under really high load
        {
            let work = new Array(500).fill(500)
            let resPromises = work.map(w => pool.sendWork(w))

            let success = 0
            for (const p of resPromises) {
                // We should be able to hit it hard with many threads and things should still (mostly) work
                // even though our threads are crashing
                try {
                    await p
                    ++success
                } catch (e) {
                    // that said, don't fail the test if we get a few failures
                }
            }
            // We should still have successes
            expect(success).to.be.greaterThan(3)

            // let things calm down a bit
            await new Promise(r => setTimeout(() => r(null), 10))

            // verify our pool is still working
            expect(await pool.sendWork(4)).to.equal(16)
        }
        pool.kill()
    })
})

describe('ConditionVariable', async function() {
    it('can notify', async function () {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        const mux = Mutex.make()
        const cv = ConditionVariable.make()
        const mem = new Int32Array(new SharedArrayBuffer(64))

        await mux.lockAsync()

        const thread = await Thread.spawn('cond_var.js', {initData: {mux, cv, mem}})

        thread.sendWork(4)

        while (mem.at(0) === 0) {
            await cv.waitAsync(mux)
        }

        expect(mem.at(0)).to.equal(12)
        thread.close()
    })
})

describe('WaitGroup', async function() {
    it('can lock wait until tasks are done', async function () {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        const wg = WaitGroup.make()
        const mem = new Int32Array(new SharedArrayBuffer(64))
        const thread = await Thread.spawn('wait_group.js', {initData: {wg, mem}})

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
        thread.kill()
    })
})

describe('Barrier', async function() {
    it('blocks until all threads hit the barrier', async function () {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        const bar = Barrier.make(3)
        const mem = new Int32Array(new SharedArrayBuffer(64))
        const thread1 = await Thread.spawn('barrier.js', {initData: {bar, mem}, closeWhenIdle: 500})
        const thread2 = await Thread.spawn('barrier.js', {initData: {bar, mem}, closeWhenIdle: 500})

        thread1.sendWork(1)
        thread2.sendWork(1)

        await bar.waitAsync()

        expect(mem.at(0)).to.equal(2)
    })
})

describe('Semaphore', async function() {
    it('can lock when contended', async function () {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        this.timeout(30_000)

        for (let i = 0; i < 2; ++i) {
            const sem = Semaphore.make(1)
            const mem = new Int32Array(new SharedArrayBuffer(64))
            const thread1 = await Thread.spawn('semaphore.js', {initData: {sem, mem}, closeWhenIdle: 200})
            const thread2 = await Thread.spawn('semaphore.js', {initData: {sem, mem}, closeWhenIdle: 200})
            const thread3 = await Thread.spawn('semaphore.js', {initData: {sem, mem}, closeWhenIdle: 200})
            const thread4 = await Thread.spawn('semaphore.js', {initData: {sem, mem}, closeWhenIdle: 200})

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

describe('Mutex', async function() {
    it('can do basic locking', async function () {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        this.timeout(30_000)
        const w = 5
        const mux = Mutex.make()
        const mem = new Int32Array(new SharedArrayBuffer(64))

        await mux.lockAsync()
        const thread1 = await Thread.spawn('mutex.js', {initData: {mux, mem}, closeWhenIdle: 200})
        const thread2 = await Thread.spawn('mutex.js', {initData: {mux, mem}, closeWhenIdle: 200})

        const p1 = thread1.sendWork(w)
        const p2 = thread2.sendWork(w)

        mux.unlock()

        await Promise.all([p1, p2])

        expect(mem.at(0)).to.equal(w * 2)
    })

    it('can lock when contended', async function () {
        console.info(this.test.parent.title + '.`' + this.test.title + '`')
        this.timeout(30_000)
        const w = 300
        const mux = Mutex.make()
        const mem = new Int32Array(new SharedArrayBuffer(64))
        const thread1 = await Thread.spawn('mutex.js', {initData: {mux, mem}, closeWhenIdle: 200})
        const thread2 = await Thread.spawn('mutex.js', {initData: {mux, mem}, closeWhenIdle: 200})
        const thread3 = await Thread.spawn('mutex.js', {initData: {mux, mem}, closeWhenIdle: 200})

        await mux.lockAsync()

        const p1 = thread1.sendWork(w)
        const p2 = thread2.sendWork(w)
        const p3 = thread3.sendWork(w)

        mux.unlock()

        await Promise.all([p1, p2, p3])

        expect(mem.at(0)).to.equal(w * 3)
    })
})