import {ThreadPool as Pool} from "peak-threads";
import WorkerUrl from "./worker.ts?worker&url";
import {useEffect, useState} from "react";
import {PoolContext} from "./poolContext.ts";

export function ThreadPool({children}: any) {
    const [pool, setPool] = useState<Pool>(undefined as any)

    useEffect(() => {
        Pool.spawn(WorkerUrl, {type: 'module'}).then(p => setPool(p))
    }, [])

    return (
        <PoolContext value={pool}>
            {pool ? children : <><div>Initializing...</div></>}
        </PoolContext>
    )
}
