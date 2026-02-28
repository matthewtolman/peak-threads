/*
    Copyright Matthew Tolman, 2026

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {Thread} from "./thread.ts";

export interface ThreadPoolOptions {
    initData?: any,
    schedulerStrategy?: ((threads: Thread[], canGrow: boolean) => Thread),
    maxThreads?: number,
    minThreads?: number,
    closeThreadWhenIdle?: number,
}

interface ThreadInfo {
    initPromise: Promise<Thread>|undefined,
    live: boolean,
    indx: number,
    thread: Thread,
}

/**
 * Represents a pool of threads for sending and receiving work.
 * Underlying is an array of threads ({@link Thread}) that can grow and shrink.
 * When a pool is closed (e.g. idle timeout, {@link Thread.close}, etc.) then that thread will automatically be removed from the pool.
 * This pool will try to keep a minimum pool of threads alive (if told to).
 *
 * By default, uses a load-balanced mechanism where it picks a thread based on the least scheduled work.
 * However, this can be overridden by providing a scheduler strategy.
 * A scheduler strategy is given a list of threads, and a bool indicating if the pool is able to grow.
 * The scheduler strategy then can return a thread to use, 'grow' to grow (only return this if canGrow is true), or null
 * to indicate wait and try again. If 'grow' is returned and the pool cannot grow, it will wait and try again.
 *
 * The default strategy guarantees that a thread will always be chosen - even if all threads are overloaded.
 * Using `null` as a return value in a custom strategy allows for throttling of background threads, which may be desired.
 * However, after 5 attempts (with backoff), the pool will fail queueing the work and throw an error instead.
 *
 */
export class ThreadPool {
    private threads: ThreadInfo[]
    private maxThreads: number
    private minThreads: number
    private lastLive: number
    private options: ThreadPoolOptions
    private script: string
    private schedulerStrategy: (threads: Thread[], canGrow: boolean) => Thread|'grow'|null

    private constructor(res: any, rej: any, script: string, options?: ThreadPoolOptions) {
        let maxCount = options?.maxThreads || 0
        if (maxCount <= 0 || !isFinite(maxCount)) {
            maxCount = navigator.hardwareConcurrency || 2
        }
        this.maxThreads = maxCount
        if (typeof options?.minThreads === 'undefined' || options?.minThreads === null || options?.minThreads > maxCount) {
            this.minThreads = this.maxThreads
        }
        else {
            this.minThreads = options?.minThreads
        }
        this.lastLive = -1 // indicates none alive
        this.options = options || {}
        this.script = script

        this.schedulerStrategy = options?.schedulerStrategy || ((threads: Thread[], canGrow) => {
            if (threads.length === 0) {
                return canGrow ? 'grow' : null
            }

            const numIters = threads.length

            let min = threads[0].numPendingRequests()
            let minThread = threads[0]

            for (let i = 1; i < numIters; ++i) {
                if (threads[i].numPendingRequests() < min) {
                    min = threads[i].numPendingRequests()
                    minThread = threads[i]
                }
            }

            // if we're all busy, grow
            if (canGrow && min > 0) {
                return 'grow'
            }
            return minThread
        })
        this.threads = (new Array(maxCount)).fill(null)

        this.initThreads(res, rej, script, options?.initData)
    }

    private async initThreads(res: any, rej: any, script: string, initData: any = null) {
        for (let i = 0; i < this.minThreads; ++i) {
            try {
                const threadObj =  {
                    initPromise: undefined,
                    live: true,
                    indx: i,
                    thread: null as any,
                }
                // respawn the required threads if they ever fail
                const close = async () => {
                    this.threads[threadObj.indx].live = false
                    this.threads[threadObj.indx].initPromise = Thread.spawn(script, {initData, closeHandler: close})
                    this.threads[threadObj.indx].thread = await this.threads[i].initPromise!!
                    this.threads[threadObj.indx].live = true
                    this.threads[threadObj.indx].initPromise = undefined
                }
                threadObj.thread = await Thread.spawn(script, {initData, closeHandler: close})
                this.threads[threadObj.indx] = threadObj
                this.lastLive = i + 1
            } catch (e) {
                // if a required thread fails to initialize, clean up and then fail
                for (let cleanup = 0; cleanup < i; ++cleanup) {
                    this.threads[cleanup].thread.kill()
                    this.threads[cleanup].live = false
                }
                rej(e)
            }
        }
        await new Promise(r => r(null))
        res()
    }

    /**
     * Spawns a thread pool and initializes all the threads in that pool
     * @param script The script string to run in each of the worker threads
     * @param options The options for spawning a thread pool
     */
    public static spawn(script: string, options?: ThreadPoolOptions): Promise<ThreadPool> {
        return new Promise<ThreadPool>((resolve, reject) => {
            const t = new ThreadPool(() => resolve(t), (err: any) => reject(err), script, options)
        })
    }

    /**
     * Gets the maximum thread capacity of the pool
     */
    public capacity() {
        return this.maxThreads
    }

    /**
     * Gets the current size (number of active threads) in the pool
     */
    public size() {
        let s = 0
        for (const t of this.threads.slice(0, this.lastLive + 1)) {
            if (t.live) {
                ++s
            }
        }
        return s
    }

    private async selectThread(): Promise<Thread> {
        let attempt = 0
        let skipWait = false
        const maxAttempts = 5
        while (attempt++ < maxAttempts) {
            if (attempt !== 1 && !skipWait) {
                await new Promise((w) => setTimeout(() => w(null), 2 * attempt))
            }
            skipWait = false
            try {
                const canGrow = this.lastLive < this.maxThreads
                let readyThreads = []
                let initializing = 0

                for (const t of this.threads.slice(0, this.lastLive + 1)) {
                    if (t.live) {
                        readyThreads.push(t.thread)
                    }
                    else if (t.initPromise) {
                        initializing++
                    }
                }

                if (readyThreads.length === 0) {
                    if (readyThreads.length === 0 && canGrow) {
                        return await this.growPool()
                    }
                }

                const action = this.schedulerStrategy(readyThreads, canGrow)
                if (action === 'grow' && canGrow) {
                    return await this.growPool()
                }
                else if (action === null || !action || !(action instanceof Thread)) {
                    continue
                }
                else {
                    action.poolClaim()
                    return action
                }
            } catch (e) {
                console.error('Encountered error when trying to queue work', e)
                if (attempt >= maxAttempts) {
                    throw new Error(`Could not find an available thread after ${maxAttempts} attempts!`, {cause: e})
                }
            }
        }
        throw new Error(`Could not find an available thread after ${maxAttempts} attempts!`)
    }

    /**
     * Sends a job to the thread pool to be scheduled. May grow the pool if needed.
     * @param work Work to send
     */
    public async sendWork(work: any) {
        const thread = (await this.selectThread())
        try {
            return await thread.sendWork(work)
        }
        finally {
            thread.poolRelease()
        }
    }

    private async growPool() {
        const i = ++this.lastLive
        const threadObj: ThreadInfo = {
            initPromise: undefined,
            indx: i,
            thread: undefined as any,
            live: false
        }
        this.threads[i] = threadObj
        // respawn the required threads if they ever fail
        const close = () => {
            this.threads[threadObj.indx] = this.threads[this.lastLive]
            this.threads[threadObj.indx].indx = threadObj.indx
            this.threads[this.lastLive] = null as any
            --this.lastLive
        }
        try {
            this.threads[i] = threadObj
            this.threads[threadObj.indx].live = false
            this.threads[threadObj.indx].initPromise = Thread.spawn(
                this.script,
                {
                    initData: this.options.initData,
                    closeHandler: close,
                    closeWhenIdle: this.options.closeThreadWhenIdle
                }
            )
            this.threads[threadObj.indx].thread = await this.threads[i].initPromise!!
            this.threads[threadObj.indx].initPromise = undefined
            this.threads[threadObj.indx].live = true
            return this.threads[threadObj.indx].thread
        } catch (e) {
            close()
            throw new Error('COULD NOT SPAWN THREAD', {cause: e})
        }
    }
}