importScripts("/dist/threads.iife.js")
threads.setLogging(true)

let storage = null

self.oninit = (val) => storage = val

self.onshare = ({share, message}) => storage = (message || share)

self.ontransfer = (message) => storage = message

self.onwork = (w) => w * w

self.onevent = async (e) => {
    await new Promise(res => setTimeout(res, 20))
    postMessage(storage)
}