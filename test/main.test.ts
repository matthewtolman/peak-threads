import {Thread, make, Mutex, ConditionVariable, WaitGroup, Barrier} from '../src/main'
import {test, expect} from "vitest";
import path from 'path'

test('can create thread', async () => {
    const thread = new Thread(path.join(__dirname, 'worker1.mjs'))
    expect(thread).not.toBeNull()
    expect(await thread.sendWork(4)).toBe(16)
})

test('mutex test', async () => {
    const mux: Mutex = make(Mutex)
    const mem = new Int32Array(new SharedArrayBuffer(64))
    const thread1 = new Thread(path.join(__dirname, 'mutex.mjs'), {mux, mem})
    const thread2 = new Thread(path.join(__dirname, 'mutex.mjs'), {mux, mem})

    await mux.lockAsync()

    const p1: Promise<unknown> = thread1.sendWork(4)
    const p2: Promise<unknown> = thread2.sendWork(4)

    mux.unlock()

    await Promise.all([p1, p2])

    expect(mem.at(0)).toBe(1000)
})

test('cond var test', async () => {
    const mux: Mutex = make(Mutex)
    const cv: ConditionVariable = make(ConditionVariable)
    const mem = new Int32Array(new SharedArrayBuffer(64))
    const thread = new Thread(path.join(__dirname, 'cond_var.mjs'), {mux, cv, mem})

    await mux.lockAsync()

    thread.sendWork(4)

    while (mem.at(0) === 0) {}
    expect(thread).not.toBeNull()
})

test('waitgroup', async () => {
    const wg: WaitGroup = make(WaitGroup)
    const mem = new Int32Array(new SharedArrayBuffer(64))
    const thread = new Thread(path.join(__dirname, 'wait_group.mjs'), {wg, mem})

    wg.add(1)
    thread.sendWork(4)

    wg.add(1)
    thread.sendWork(5)

    wg.add(1)
    thread.sendWork(6)

    wg.add(1)
    thread.sendWork(7)

    await wg.waitAsync()

    expect(mem.at(0)).toBe(4 + 5 + 6 + 7)
})

test('barrier', async () => {
    const bar: Barrier = make(Barrier, 3)
    const mem = new Int32Array(new SharedArrayBuffer(64))
    const thread1 = new Thread(path.join(__dirname, 'barrier.mjs'), {bar, mem})
    const thread2 = new Thread(path.join(__dirname, 'barrier.mjs'), {bar, mem})

    thread1.sendWork(1)
    thread2.sendWork(1)

    await bar.waitAsync()

    expect(mem.at(0)).toBe(2)
})

