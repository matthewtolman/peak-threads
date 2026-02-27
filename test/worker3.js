importScripts("/dist/threads.iife.js")
threads.setLogging(true)

let arrBuff = new Int32Array(new ArrayBuffer(4))

self.ontransfer = (message) => {
    arrBuff = message
    postMessage({result: message.at(0), buff: message}, {transfer: [message.buffer]})
}

self.onevent = async (e) => {
    postMessage(arrBuff.at(0))
}
