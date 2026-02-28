# Threads JS

Threads JS (or threads for short) is a JavaScript/TypeScript threading library for the browser. It allows sites to spawn threads (via the Workers API)
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

This whole process handles creating threads, initializing them with a unique id (and other initial data), creating an object dehydration/hydration framework,
setting up error handling, initializing (optional) tracing, and building a standard messaging protocol.

With this, we now have a way to easily do work in the background without blocking the main thread.

## Pool Usage

At times, we may want a maximum limit on how many threads we can have. We also may want to scale down the number of threads automatically if they're idle.
To achieve this, simply use a `ThreadPool` which handles orchestrating threads, scaling up, and scaling down automatically.

> Note: due to the asynchronous nature of spawning threads, creating a thread pool is also asynchronous

Here is an example:

```html
<!-- index.html -->
<button id="btn">Click Me!</button>
<div id="result"></div>

<script src="/public/threads.iife.js"></script>
<script>
    const {ThreadPool} = threads
    const pool = ThreadPool.spawn('worker.js', {minThreads: 2, maxThreads: 10, closeThreadWhenIdle: 200})

    async function doWork() {
        // Get the pool
        const p = await pool
        document.getElementById('btn').disabled = true
        const res = await p.sendWork({action: 'square', value: 42})
        document.getElementById('result').innerText = res
        document.getElementById('btn').disabled = false
    }
</script>
```

> Note: The worker code did not change from the general usage example. Workers don't care if they're in a pool or not. This makes it trivial to switch between the two

## Sending classes

Sometimes you want to share a class. Unfortunately, JavaScript doesn't let sending full classes or functions through message passing.
So, instead we need to "dehydrate" (or serialize) the object on one end, and then "hydrate" (or deserialize) on the other end.
Fortunately, this is built-in to the threads library! And, it happens automatically on every `postMessage` and `onmessage` on both ends!
It even works when we do `initData` on the spawn method.

> The reason it is turned on by default is for shared memory data structures (e.g. Mutex) to work

To pass classes, we first need to register a dehydrate and hydrate method for the class. We'll also need to pick a unique key for the dehydrated state.

There are two ways to create dehydrate/hydrate methods:

* Create static methods on your TypeScript classes (or the JavaScript equivalent)
* Create an "isa" method, "hydrate" method, and "dehydrate" method

Once we have those methods, we call `registerDeHydration` to register it.

Example for static methods class:

```typescript
import {registerDeHydration} from "@matttolman/threads";

interface DehydratedPerson {
    name: string,
    age: number,
}

class Person {
    private name: string
    private age: number

    constructor(name: string, age: number) {
        this.name = name
        this.age = age
    }
    
    public static dehydrate(person: Person): DehydratedPerson {
        return {
            name: person.name,
            age: person.age
        }
    }
    
    public static hydrate(person: DehydratedPersion) {
        return new Person(person.name, person.age)
    }
    
    public isAdultUs(): boolean {
        return this.age >= 18
    }
}

registerDeHydration({key: 'Person', type: Person})
```

Example for independent functions class:

```typescript
import {registerDeHydration} from "@matttolman/threads";

interface DehydratedPerson {
    name: string,
    age: number,
}

class Person {
    private name: string
    private age: number

    constructor(name: string, age: number) {
        this.name = name
        this.age = age
    }
    
    public isAdultUs(): boolean {
        return this.age >= 18
    }
    
    public getName(): string { return this.name }
    public getAge(): string { return this.age }
}

function isaPerson(obj: any) {
    return obj instanceof Person
}

function dehydratePerson(obj: Person): DehydratedPerson {
    return { name: obj.getName(), age: obj.getAge() }
}

function hydratePerson(obj: DehydratedPerson): Person {
    return new Person(obj.name, obj.age)
}

registerDeHydration({key: 'Person', isa: isaPerson, hydrate: hydratePerson, dehydrate: dehydratePerson})
```

Regardless of which approach you take, the following code would be possible:

```typescript
// main.ts
import {Thread} from '@matttolman/threads'
import {Person} from './person'

async function sendPerson() {
    const person = new Person('Bob', 44)
    const thread = await Thread.spawn('worker.js', {initData: person})
}
```

And for the worker

```typescript
// worker.ts
import '@matttolman/threads'
import {Person} from './person'

oninit = (person: Person) => {
    console.log('Is adult?', person.isAdultUs())
}
```

And just like that, we "sent" an object!

This technique is heavily used to provide shared memory synchronization primitives (like mutexes).

One thing to note about `registerDeHydration` is that the most recently registerd dehydrate method will take precedence.
This allows you to register a base class in that file, and then register child classes later on, and the child classes
will use their specific dehydration method while the base class will use it's method.

## Seeding the thread

At times, we may want to seed a thread with some sort of initial state (e.g. are we in developer mode?). To do this, we simply pass in the option `initData`
in the spawn options, and we define an `oninit` handler in our worker thread. This `oninit` handler can be async or return a promise, in which case
`Thread.spawn` will wait for it to resolve before it resolves (which is why `Thread.spawn` is async).

The great thing is that this works for both standalone threads and pooled threads! The pool guarantees every thread is initialized with 
it makes is given the same `initData` in the pool's options (though it only has a shallow copy, so be careful if you change it!).

> Note: For simplicity, in the following examples I won't show imports, requires, or destructuring for the library. All of these examples
> will assume importing and destructuring have been done.

Here's an example:

```javascript
// main.js
const mysecret = 'super-secret'

async function spawn() {
    const thread = await Thread.spawn('worker.js', {initData: {secret: mysecret}})
    const pool = await ThreadPool.spawn('worker.js', {initData: {secret: mysecret}})
    
    console.log(thread.sendWork('guess1'))
    console.log(pool.sendWork('guess2'))
        
    console.log(thread.sendWork('super-secret'))
    console.log(pool.sendWork('super-secret'))
}
```

In the worker now:

```javascript
// worker.js

let secretWord = null

oninit = ({secret}) => {
    console.log('Got my secret word!')
    secretWord = secret
}

onwork = (guess) => guess === secretWord
```

## Advanced Usage

The above examples will cover the most use cases where we're simply spinning some work off in a background thread.
However, in some cases we need more performance or control. For those use cases, this section is for you.

### Sending Messages With No Responses

So far, whenever we send a message to a background thread, we always wait for a response from that thread.
But, what if we didn't want a response? What if we just wanted to notify the thread, but didn't care if anything happened?

In those cases, we can send an "event" which will then call the thread's `onevent` handler. Here's an example:

```html
async function notify() {
    // Create a thread that will automatically close
    const thread = await Thread.spawn('worker.js', {closeWhenIdle: 100})
    // no return value
    thread.sendEvent({action: 'button_clicked'})
}
```

And for the worker thread:

```javascript
onevent = (event) => {
    // here we get the full Worker event object
    // so our action will actually be at event.data.action and not event.action
    console.log(event)
}
```

One thing to note about the `onevent` handler is it always gets the full Worker message from the browser.
So any event data that you send will be in `event.data` and not in `event`.
It's the framework's `onmessage` replacement as the framework overrides `onmessage` to handle dispatching depending
on what the protocol is.

Additionally, `sendEvent` takes in the options parameter for `postMessage`, which allows you to have full control.
It's designed-in way to bypass the framework for sending messages to workers - if you so desire.

> Why might you want to bypass the framework? Well, promises work really well for request/response, and work great
> in promise-based frameworks. However, if you need a stream of events (think Observables), then that is not provided
> in this library. Why? Simply because we're trying to have zero runtime dependencies (i.e. we use TypeScript and bundlers
> for development, but the code we ship only uses native browser APIs). If you ever need to use something other than promises,
> then this lets you bring in whatever dependencies you want to do that.

### Receiving events from the thread

We've sent events to the thread, now let's have the thread send events to us. This forms the foundation needed to have
events sent to us, and lets us setup wrappers for observables, direct DOM manipulation, etc. We could even create our own
protocol and just use the threading library for initialization!

To receive events from threads, all we need to do is register an event handler. There are two ways to do this:
* Pass it into the options object when we spawn a thread (recommended)
* call `setOnEvent` (discouraged as race conditions can cause some events to be lost)

We'll show the recommended way to do this.

```javascript
// main.js
async function customThread() {
    // our handler will also get a raw worker message
    const handler = (v) => {
        console.log(v.data)
    }
    
    // spawn our thread
    const thread = await Thread.spawn('worker.js', {initData: 45, onEventHandler: handler, closeWhenIdle: 100})
    thread.sendEvent(-23)
}
```

Worker thread:

```javascript
// worker.js
onevent = (event) => {
    // this sends a response to our custom handler
    postMessage(42)
}
```

### Transfering objects to workers

Some objects, like array buffers, are really large and expensive to send across. Web APIs provide a way to "transfer" the underlying data.
We can use this to our advantage and transfer large objects to the worker thread using the `transfer` method.
To receive transferred objects, the underlying thread will register the `ontransfer` handler.

```javascript
// main.js
async function transferExample() {
    const ab = new ArrayBuffer(64) // some "large" array buffer
    const ints = new Int32Array(ab) // our int view over it
    ints.set([99], 0) // set some data
    const thread = await Thread.spawn('worker.js')
    
    // Send the int view over and transfer the underlying buffer
    // After this line, the main thread can **never** use it again!
    await thread.transfer(ints, [ints.buffer])
}
```

And for the worker:

```javascript
// worker.js

// The transferred data (second param) is just instructions for the browser on how to manipulate memory
// Onlyl the "message" (first param) is available for the handler
ontransfer = (intView) => {
    console.log(intView.at(0))
}
```

### Transferring objects back

To transfer objects back, use the global `self.transfer` method from the worker (or just `transfer` for short).
To receive a transferred object in the main thread, set the `onTransferHandler` in the spawn method

```javascript
// main.js
async function transferExample() {
    const handler = (buff) => {
        console.log(buff.at(0))
    }
    const thread = await Thread.spawn('worker3.js', {initData:45, onTransferHandler: handler})
}
```

And for the worker:

```javascript
// worker.js

// The transferred data (second param) is just instructions for the browser on how to manipulate memory
// Onlyl the "message" (first param) is available for the handler
oninit = (intView) => {
    let resolve
    let ints = new Int32Array(new ArrayBuffer(64))
    ints.set([99], 0)
    // if a non-array item is passed as the second parameter, it will be wrapped in an array
    transfer(ints, ints.buffer)
}
```

### "Sharing" data

Sometimes after the fact we need to send more data to the thread without getting a computation result, but we also need to know when it is done receiving/processing data.
This is where "sharing" comes in to play. We can simply use the `share` method to send data to a thread and the `onshare` method to receive shared data.

> Note: sharing is not available for thread pools as threads will come and go, and the pool tries to keep a "clean" state. Any shared data must be in the `initData` for a pool.

```javascript
// main.js

async function shareExample() {
    const thread = await Thread.spawn('worker1.js')
    console.log(await thread.sendWork(10))
    
    await thread.share(99)
    console.log(await thread.sendWork(10))
    
    await thread.share(-45)
    console.log(await thread.sendWork(10))
}
```

And the worker side:

```javascript
// worker.js

let a = 0

onshare = (newA) => a = newA

onWork = b => a + b

```

Sharing is primarily meant for when we have to share shared memory-based resources (like Mutexes) - hence the name "share".

## Shared Memory

> **IMPORTANT!** Before you can use anything in this section, you MUST be in a [secure context and cross-origin isolated](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements)!

Simply doing message passing isn't all that we can do with threads. We can also share memory!

This is where the `share` and `initData` aspects of the above sections really shine. We can share our data once,
and then constantly manipulate it!

> Note: the async shared memory methods require `Atomics.waitAsync` support in your browser, which requires very up-to-date browsers (Safari and Firefox got support end of 2025).

Here is an example of what this could look like:

```javascript
// main.js
const {WaitGroup, Mutex, Thread} = threads
async function sharedMemExample() {
    const wg = WaitGroup.make()
    const mem = new Int32Array(new SharedArrayBuffer(64))
    const mux = Mutex.make()
    const thread1 = await Thread.spawn('wait_group.js', {initData: {wg, mem, mux}})
    const thread2 = await Thread.spawn('wait_group.js', {initData: {wg, mem, mux}})
    
    wg.add(1)
    thread1.sendEvent('work')
    wg.add(1)
    thread2.sendEvent('work')
    wg.add(1)
    thread1.sendEvent('work')
    wg.add(1)
    thread2.sendEvent('work')
    
    // Only place to wait for all work to be done
    await wg.waitAsync()
    console.log(mem.at(0))
}
```

And the worker:

```javascript
let waitGroup, memory, mutex
oninit = ({wg, mem, mux}) => {
    waitGroup = wg
    memory = mem
    mutex = mux
}

onevent = () => {
    mux.lock()
    try {
        memory.set([memory.at(0) + 1], 0)
    }
    finally {
        mux.unlock()
        waitGroup.done()
    }
}
```

The goal of shared memory primitives offered by the threads library is to either provide synchronization between threads
(e.g. a `Barrier` means all threads reach a point, a `WaitGroup` means all tasks are done, a `ConditionVariable` means
some condition/state has changed) or to provide safety when accessing shared resources (e.g. a `Mutex` guarantees only
one thread is accessing something at a time).

### Address

An address is a reference to a range inside a typed array (range = offset + count). All shared memory synchronization primitives use addresses
to track where their data lives inside of memory. Addresses can be specified manually (usually when you have a large buffer and are dividing
it manually), or they can be created automatically through `make` functions. The `make` function will generate a new shared array buffer backing
a new typed array. That means the synchronization primitive has it's memory isolated from all other shared memory. This isolation does provide a
lot more safety guarantees, but it also means that memory is more fragmented which could result in some performance loss.

Addresses expose non-atomic methods (e.g. `get`, `set`) as well as atomic methods (e.g. `atomicAdd`, `atomicLoad`, `atomicStore`). All of these
methods default to acting on the first element pointed to by the address. For addresses with only one element (which is common), this greatly
simplifies the interface since you can just treat it as a wrapper class to some data. For addresses pointing to an array of elements, these
methods take the array index as the last parameter (zero-based offset). So, to get the value for the 3rd element of an address, you would use
`address.get(2)` - or for an atomic load it would be `address.atomicLoad(2)`.

Example:

```javascript
import {Address} from '@matttolman/threads'

const buff = new SharedArrayBuffer(32)
const typedArr = new Int32Array(buff)

const addr1 = new Address(typedArr, 0, 1) // bytes 0-3
const addr2 = new Address(typedArr, 1, 3) // bytes 4-15
const addr3 = new Address(typedArr, 4, 4) // bytes 16-31
```

### Barrier

A barrier blocks until n threads hit the barrier. This allows threads to synchronize position in the code (we know where
all threads are since they're all at the barrier).

Barriers take in a mutex (or an address for where to make a mutex), an address for an array of two 32-bit integers
(`new Address(int32Array, offset, 2)`), and a number of threads needed. Barriers have the following methods:
* `wait` - Blocking wait, waits until the rest of the threads arrive at the barrier. Cannot be called from the main thread
* `waitAsync` - Asynchronous version of wait. Requires recent versions of browsers

Example:

```typescript
// main.ts
import {Barrier, Thread} from '@matttolman/threads'

async function spawn() {
    // Make a barrier that requires three threads to hit it before continuing
    const barrier = Barrier.make(3)

    const threads = await Promise.all([
        Thread.spawn('barrier.js', {initData: barrier}),
        Thread.spawn('barrier.js', {initData: barrier}),
    ])
    
    await barrier.waitAsync()
}

// mutex.ts
import {Mutex, Thread} from '@matttolman/threads'

let mux: Mutex

oninit = (mutex) => {
    mux = mutex

    for (let i = 0; i < 200; ++i) {
        mux.lock()
        try {
            console.log("Got the lock " + i + " times!")
        } finally {
            mux.unlock()
        }
    }
}
```

### Condition Variable

A condition variable allows a thread that has a mutex lock to yield that lock to other threads until some condition changes.
After that condition changes the thread that made the change can notify the original thread that the condition has changed.
The original locking thread will then wake up, reobtain the lock, and continue.

Because of the "yielding the lock" thing, a Condition Variable must always be paired with a Mutex. That said, a condition
variable does not _own_ a mutex. Instead, it must be passed in whenever a thread waits (but is not needed on notify).
A condition variable has the following methods:
* `wait` - Blocking wait method. Takes a mutex and unlocks it, then waits for a signal. When the signal is received, it relocks the mutex. Cannot be called from the main thread.
* `waitAsync` - Asynchronous version of wait. Must have a recent browser version.
* `notify` - Notify one or more threads that the condition has changed

Example:

```typescript
// main.ts
import {ConditionVariable, Mutex, Thread} from "./src/main";

async function cvExample() {
    const mux = Mutex.make()
    const cv = ConditionVariable.make()
    const mem = new Int32Array(new SharedArrayBuffer(4))
    
    await mux.lockAsync()
    
    const thread = await Thread.spawn('cond_var.js', {initData: {mux, cv, mem}})
    
    // wait until our memory changes
    while (mem.at(0) === 0) {
        await cv.waitAsync(mux)
    }
    
    console.log(mem.at(0))
}

// cond_var.ts
import {ConditionVariable, Mutex, Thread} from "./src/main";

oninit = async ({mux, cv, mem}) => {
    
    // simulate some work
    await new Promise(r => setTimeout(r, 20))
    
    mux.lock()
    try {
        // update our memory
        mem.set([42], 0)
        
        // notify our main thread that the memory was changed
        cv.notify()
    } finally {
        mux.unlock()
    }
}
```

### Mutex

A mutex (mutually exclusive lock) is a type of lock that only allows one thread to have the lock at any point in time.
This is useful if you need to lock some piece of shared memory or other resource shared between threads.

Mutex has a static `make` method that will allocate a shared array buffer of the right size and create the address for you if you desire.
For manual instantiation, a mutex requires an address to a single 32-bit signed integer (`Int32Array`; `new Address(int32Array, offset, 1)`).

A mutex has the following methods:
* `lock` - Locks the mutex (blocking, not callable from the main/HTML thread)
* `unlock` - Unlocks a mutex
* `tryLock` - Tries to get the lock without blocking. Returns `true` if it got the lock, `false` otherwise
* `hasLock` - checks if the current thread has the lock
* `lockAsync` - Asynchronous version of lock. Only usable in new browsers (versions after 2025)

> **Tip:** Always place the `unlock` call in a finally block so that you always unlock - even if an exception is thrown!

Example:

```typescript
// main.ts
import {Mutex, Thread} from '@matttolman/threads'

async function spawn() {
    const mux = Mutex.make()
    
    const threads = await Promise.all([
        Thread.spawn('mutex.js', {initData: mux}),
        Thread.spawn('mutex.js', {initData: mux}),
    ])
}

// mutex.ts
import {Mutex, Thread} from '@matttolman/threads'

let mux: Mutex

oninit = (mutex) => {
    mux = mutex
    
    for (let i = 0; i < 200; ++i) {
        mux.lock()
        try {
            console.log("Got the lock " + i + " times!")
        } finally {
            mux.unlock()
        }
    }
}
```

### Semaphore

A semaphore is a counter-based lock. It lets programs guard a finite number of resources.

Think of it as a library with multiple copies of the same book.
When someone wants to checkout a book, they remove one copy from the library.
When there are no copies left and someone wants to check out the book, they are forced to wait (get put on a "waitlist").
Once someone else checks in a copy, they can then checkout that copy again.

A semaphore needs one address to a 32 bit integer (`new Address(int32Array, offset, 1)`) and the maximum number of threads
that can access the semaphore at a time (think maximum number of copies or resources that can be used).
Semaphores have the following methods:
* `acquire` - Acquires a single resource. Blocks if none are available. Cannot be used from the main thread.
* `acqurieAsync` - Asynchronous acquire. Can only be used in newer browsers.
* `release` - Releases an acquired resource
* `hasAcquire` - Checks if the current thread has acquired at least one resource

Example:

```typescript
// main.ts
import {Semaphore, Thread} from '@matttolman/threads'

async function spawn() {
    // semaphore with 2 resources
    const sem = Semaphore.make(2)

    const threads = await Promise.all([
        Thread.spawn('sem.js', {initData: sem}),
        Thread.spawn('sem.js', {initData: sem}),
        Thread.spawn('sem.js', {initData: sem}),
        Thread.spawn('sem.js', {initData: sem}),
    ])
}

// mutex.ts
import {Semaphore, Thread} from '@matttolman/threads'

let sem: Semaphore

oninit = async (semaphore) => {
    sem = semaphore
    
    // get the semaphore before we do a network request
    // this lets us throttle how many requests we do at once
    sem.acquire()
    let res
    try {
        res = await fetch('http://example.com')
    } finally {
        sem.release()
    }
    
    console.log(await res.text())
}
```

### WaitGroup

A WaitGroup allows tracking how many tasks are pending, and then waiting for those tasks to complete. They are styled after Go's [WaitGroup](https://pkg.go.dev/sync#WaitGroup).
When queuing tasks, they are added to the wait group. When completing tasks, they are marked as done.

WaitGroups have the following methods:
- `add` - Add a task to the counter
- `wait` - Wait for the task counter to hit zero. Blocking. Cannot be called from the main thread
- `waitAsync` - Asynchronous wait. Can only be used in recent browser versions
- `done` - Mark a task as done (decrements task counter)

Example:

```typescript
// main.ts
import {WaitGroup, ThreadPool} from '@matttolman/threads'

async function spawn() {
    const wg = WaitGroup.make()
    const mem = new Address(new Int32Array(new SharedArrayBuffer(4)))
    
    // use a pool for load balancing
    const pool = ThreadPool.spawn('pool.js', {initData: {wg, mem}})
    
    // queue up a bunch of work
    const squareAndSumTasks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
    for (const t of squareAndSumTasks) {
        wg.add(1)
        // we don't care about the intermediate results, just the final result
        pool.sendWork(t)
    }
    
    // only one thing to await
    await wg.waitAsync()
    
    // and we have the result
    console.log(mem.get())
}

// pool.ts
import {WaitGroup, Address} from '@matttolman/threads'

let waitGroup: WaitGroup
let addr: Address

oninit = ({wg, mem}) => {
    waitGroup = wg
    addr = mem
}

onwork = v => {
    // do our part of the work
    const vSquare = v * v
    
    // atomic add so we don't have to lock
    addr.atomicAdd(vSquare)
    
    // signal that our work is done
    waitGroup.done()
}
```

## License

Copyright, Matthew Tolman 2026

This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

### Libraries distributed as part of the test code

The copies of Mocha and Chai that are distributed as in the `tests/` directory are done so under the MIT license. The licenses are at the start of the corresponding files.
These libraries are only used for testing purposes and are not part of the final executable code, or part of the source code for the threads library.
For completeness, their licenses are included in this document.

#### Chai

```text
MIT License

Copyright (c) 2017 Chai.js Assertion Library

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### Mocha

```text
(The MIT License)

Copyright (c) 2011-2024 OpenJS Foundation and contributors, https://openjsf.org

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
