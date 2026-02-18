import {Thread} from "./thread.ts";

export class ThreadPool {
    private threads: Thread[]
    private nxtThread: number = 0

    private constructor(res: any, count: number, script: string, initData: any = null) {
        if (count <= 0 || !isFinite(count)) {
            count = navigator.hardwareConcurrency || 2
        }
        this.threads = (new Array(count)).fill(null)

        this.initThreads(res, script, initData)
    }

    private async initThreads(res: any, script: string, initData: any = null) {
        for (let i = 0; i < this.threads.length; ++i) {
            this.threads[i] = await Thread.spawn(script, initData)
        }
        res()
    }

    public static spawn(script: string, numThreads: number = navigator.hardwareConcurrency || 2, initData: any = null): Promise<ThreadPool> {
        return new Promise<ThreadPool>(resolve => {
            const t = new ThreadPool(() => resolve(t), numThreads, script, initData)
        })
    }

    public async sendWork(work: any) {
        const threadId = this.nxtThread++
        if (this.nxtThread >= this.threads.length) {
            this.nxtThread -= this.threads.length
        }
        return await this.threads[threadId].sendWork(work)
    }

    public async share(item: any, message: any = undefined) {
        return await Promise.all(
            this.threads.map(t => t.share(item, message))
        )
    }
}