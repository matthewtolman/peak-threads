# Threads JS

Threads JS is a JavaScript/TypeScript threading library for the browser. It allows sites to spawn threads (via the Workers API)
and then easily communicate with those threads. This includes sending work, sharing or transferring resources, pooling threads,
and having locks, wait groups, condition variables, and other shared memory synchronization mechanisms (note: for the shared
memory to work, you must be in a secure context and be cross-origin isolated!).

## General Usage

Here is an example of general usage.

```html
<!-- index.html -->
<button id="btn">Click Me!</button>
<div id="result"></div>

<script src="/public/threads.iife.js"></script>
<script>
const {Thread} = threads
    
async function doWork() {
    // Create a thread that will automatically close
    const thread = await Thread.spawn('worker.js', {closeWhenIdle: 100})
    document.getElementById('btn').disabled = true
    const res = await thread.sendWork({action: 'square', value: 42})
    document.getElementById('result').innerText = res
    document.getElementById('btn').disabled = false
}
</script>
```

And for the worker thread:

```javascript
importScripts('/public/threads.iife.js')

onwork = ({action, value}) => {
    switch (action) {
        case 'square': return value * value
        case 'increment': return value + 1
        case 'cube': return value * value * value
        default:
            sendError(`Unknown action: ${action}`)
    }
}
```

This whole process handles creating threads
