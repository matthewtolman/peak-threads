let jobCount = 0
let useCache = false

console.log('started background')

onconnect = (e) => {
    const port = e.ports[0]
    port.onmessage = e => {
        if (e.data.hasOwnProperty('jobId')) {
            ++jobCount
            const job = e.data.job
            const jobId = e.data.jobId
            sendResponse(port, jobId, 23)
        }
        else if (e.data.hasOwnProperty('setting')) {
            const {settingName, settingValue} = e.data.setting
            if (settingName === 'useCache') {
                useCache = settingValue
            }
        }
    }
}


function sendResponse(port, jobId, res) {
    port.postMessage({jobId, res, jobCount})
}

function sendError(port, jobId, err) {
    port.postMessage({jobId, err, jobCount})
}
