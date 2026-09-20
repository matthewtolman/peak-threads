type Equals<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends
        (<T>() => T extends Y ? 1 : 2) ? true : false;

type Expect<T extends true> = T

type NotEquals<X, Y> = Equals<X, Y> extends true ? false : true

import {Connection, SharedThread, Thread} from "../../src/main.ts";

const threadDefault = Thread.spawn('test.js').then(t => t)
type ThreadDefault = Awaited<typeof threadDefault>

const sharedThreadDefault = SharedThread.connect('test.js').then(t => t)
type SharedThreadDefault = Awaited<typeof sharedThreadDefault>

export type Checks = [
    Expect<NotEquals<Parameters<ThreadDefault['sendWork']>[0], never>>,
    Expect<Equals<ReturnType<ThreadDefault['sendWork']>, Promise<any>>>,

    Expect<NotEquals<Parameters<SharedThreadDefault['sendWork']>[0], never>>,
    Expect<Equals<ReturnType<SharedThreadDefault['sendWork']>, Promise<any>>>,
]

const defThread1 = {
    path: 'test.js',
    parent: {
        onTransferHandler: (_msg: ImageData) => {}
    },
    thread: {
        work: (a: number) => a + a,
        init: (_: number) => {},
    }
};

type DefThread1 = Thread<typeof defThread1>

const defThread2 = {
    parent: {
        onTransferHandler: (_msg: ImageData) => {}
    },
    thread: {
        work: (a: number) => a + a,
        init: (_?: number) => {},
        close: () => {},
        event: (_: MessageEvent) => {},
        share: (_: SharedArrayBuffer) => {},
        transfer: (_: ImageData) => {}
    }
};
type DefThread2 = Thread<typeof defThread2>

const defThread3 = {
    parent: {
        onTransferHandler: (_msg: ImageData) => {}
    },
    thread: {
        work: (a: number) => a + a,
        init: (_?: number) => {},
        share: (_: SharedArrayBuffer, _1?: number) => {},
    }
};
type DefThread3 = Thread<typeof defThread3>

export type Checks2 = [
    Expect<Equals<Parameters<DefThread1['sendWork']>[1], number>>,
    Expect<Equals<ReturnType<DefThread1['sendWork']>, Promise<number>>>,
    Expect<Equals<Parameters<DefThread1['sendEvent']>[0], never>>,
    Expect<Equals<Parameters<DefThread1['transfer']>[0], never>>,
    Expect<Equals<Parameters<DefThread1['share']>[0], never>>,
    Expect<Equals<Parameters<DefThread1['share']>[1], never | undefined>>,

    Expect<Equals<Parameters<DefThread2['sendWork']>[1], number>>,
    Expect<Equals<ReturnType<DefThread2['sendWork']>, Promise<number>>>,
    Expect<Equals<Parameters<DefThread2['sendEvent']>[0], MessageEvent>>,
    Expect<Equals<Parameters<DefThread2['transfer']>[0], ImageData>>,
    Expect<Equals<Parameters<DefThread2['share']>[0], SharedArrayBuffer>>,
    Expect<Equals<Parameters<DefThread2['share']>[1], never | undefined>>,

    Expect<Equals<Parameters<DefThread3['sendWork']>[1], number>>,
    Expect<Equals<ReturnType<DefThread3['sendWork']>, Promise<number>>>,
    Expect<Equals<Parameters<DefThread3['sendEvent']>[0], never>>,
    Expect<Equals<Parameters<DefThread3['transfer']>[0], never>>,
    Expect<Equals<Parameters<DefThread3['share']>[0], SharedArrayBuffer>>,
    Expect<Equals<Parameters<DefThread3['share']>[1], number | undefined>>,
]

/*
Shared Types
 */

const defSharedThread1 = {
    path: 'test.js',
    parent: {
        onTransferHandler: (_msg: ImageData) => {}
    },
    thread: {
        work: (_: Connection, a: number) => a + a,
        init: (_c: Connection, _: number) => {},
    }
};

type DefSharedThread1 = SharedThread<typeof defSharedThread1>

const defSharedThread2 = {
    parent: {
        onTransferHandler: (_msg: ImageData) => {}
    },
    thread: {
        work: (_c: Connection, a: number) => a + a,
        init: (_c: Connection, _?: number) => {},
        close: (_c: Connection) => {},
        event: (_c: Connection, _: MessageEvent) => {},
        share: (_c: Connection, _: SharedArrayBuffer) => {},
        transfer: (_c: Connection, _: ImageData) => {}
    }
};
type DefSharedThread2 = SharedThread<typeof defSharedThread2>

const defSharedThread3 = {
    parent: {
        onTransferHandler: (_msg: ImageData) => {}
    },
    thread: {
        work: (_c: Connection, a: number) => a + a,
        init: (_c: Connection, _?: number) => {},
        share: (_c: Connection, _: SharedArrayBuffer, _1?: number) => {},
    }
};
type DefSharedThread3 = SharedThread<typeof defSharedThread3>

export type Checks4 = [
    Expect<Equals<Parameters<DefSharedThread1['sendWork']>[1], number>>,
    Expect<Equals<ReturnType<DefSharedThread1['sendWork']>, Promise<number>>>,
    Expect<Equals<Parameters<DefSharedThread1['sendEvent']>[0], never>>,
    Expect<Equals<Parameters<DefSharedThread1['transfer']>[0], never>>,
    Expect<Equals<Parameters<DefSharedThread1['share']>[0], never>>,
    Expect<Equals<Parameters<DefSharedThread1['share']>[1], never | undefined>>,

    Expect<Equals<Parameters<DefSharedThread2['sendWork']>[1], number>>,
    Expect<Equals<ReturnType<DefSharedThread2['sendWork']>, Promise<number>>>,
    Expect<Equals<Parameters<DefSharedThread2['sendEvent']>[0], MessageEvent>>,
    Expect<Equals<Parameters<DefSharedThread2['transfer']>[0], ImageData>>,
    Expect<Equals<Parameters<DefSharedThread2['share']>[0], SharedArrayBuffer>>,
    Expect<Equals<Parameters<DefSharedThread2['share']>[1], never | undefined>>,

    Expect<Equals<Parameters<DefSharedThread3['sendWork']>[1], number>>,
    Expect<Equals<ReturnType<DefSharedThread3['sendWork']>, Promise<number>>>,
    Expect<Equals<Parameters<DefSharedThread3['sendEvent']>[0], never>>,
    Expect<Equals<Parameters<DefSharedThread3['transfer']>[0], never>>,
    Expect<Equals<Parameters<DefSharedThread3['share']>[0], SharedArrayBuffer>>,
    Expect<Equals<Parameters<DefSharedThread3['share']>[1], number | undefined>>,
]
