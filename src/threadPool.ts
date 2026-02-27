import {Thread} from "./thread.ts";

export interface ThreadPoolOptions {
    initData?: any,
    schedulerStrategy?: ((threads: Thread[]) => Thread),
    numThreads?: number,
    closeThreadIdle?: number
}

/**
 * Represents a pool of threads for sending and receiving work.
 * Underlying is an array of threads (@see Thread)
 *
 * This pool will select the thread with the fewest outstanding requests by default
 */
export class ThreadPool {
    private threads: Thread[]
    private schedulerStrategy: (threads: Thread[]) => Thread

    private constructor(res: any, rej: any, script: string, options?: ThreadPoolOptions) {
        let count = options?.numThreads || 0
        if (count <= 0 || !isFinite(count)) {
            count = navigator.hardwareConcurrency || 2
        }
        this.schedulerStrategy = options?.schedulerStrategy || ((threads: Thread[]) => {
            let min = threads[0].numPendingRequests()
            let minThread = threads[0]
            for (let i = 1; i < threads.length; ++i) {
                if (threads[i].numPendingRequests() < min) {
                    min = threads[i].numPendingRequests()
                    minThread = threads[i]
                }
            }
            return minThread
        })
        this.threads = (new Array(count)).fill(null)

        this.initThreads(res, rej, script, options?.initData)
    }

    private async initThreads(res: any, rej: any, script: string, initData: any = null) {
        for (let i = 0; i < this.threads.length; ++i) {
            try {
                this.threads[i] = await Thread.spawn(script, initData)
            } catch (e) {
                // if a thread fails to initialize, clean up and then fail
                for (let cleanup = 0; cleanup < i; ++cleanup) {
                    this.threads[cleanup].kill()
                }
                rej(e)
            }
        }
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
     * Sends a job to the thread pool to be scheduled
     * @param work
     */
    public async sendWork(work: any) {
        return await this.schedulerStrategy(this.threads).sendWork(work)
    }

    /**
     * Shares a shareable resource across all threads in the thread pool.
     * IMPORTANT! YOU MUST AWAIT BEFORE USING THE NEWLY SHARED RESOURCE TO AVOID POTENTIAL RACE CONDITIONS!
     * @param item The item (or array of items to share)
     * @param message Optional message to describe shared resources
     */
    public async share(item: any, message: any = undefined) {
        return await Promise.all(
            this.threads.map(t => t.share(item, message))
        )
    }
}