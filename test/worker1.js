importScripts("/dist/threads.iife.js")

let storage = null

self.oninit = (val) => storage = val

self.onshare = ({share, message}) => storage = (message || share)

self.ontransfer = (msg) => storage = msg

self.onwork = (w) => w * w

self.onevent = (e) => {
    postMessage(storage)
}