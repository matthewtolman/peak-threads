importScripts("/dist/threads.iife.js")
threads.setLogging(true)

let arrBuff = new Int32Array(new ArrayBuffer(4))

self.ontransfer = (message) => {
    arrBuff = message
}

self.onevent = async (e) => {
    postMessage(arrBuff.at(0))
}
