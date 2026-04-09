import {registerHandler, ResponseWithTransfer} from 'peak-threads'
import {runWork} from "./imageManipulation.ts";
import montecarlo from "./montecarlo.ts";

registerHandler('work', (work: any) => {
    if (work.type === 'montecarlo') {
        return montecarlo()
    }
    else if (work.type === 'pixelate_image') {
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
})
