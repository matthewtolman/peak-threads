import {ResponseWithTransfer, Thread} from 'peak-threads'
import {type ImageWork, runWork} from "./imageManipulation.ts";
import montecarlo from "./montecarlo.ts";

const def = {
    thread: {
        work: {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            montecarlo: (_: object) => montecarlo(),
            pixelate_image: (work: ImageWork) => {
                console.log('received image')

                const {orig, result} = runWork(work)

                console.log('sending back image...')
                return new ResponseWithTransfer(
                    {
                        orig,
                        result,
                    }
                    , [orig, result])
            }
        }
    }
}

export type WorkerThread = Thread<typeof def>

Thread.serve(def)
