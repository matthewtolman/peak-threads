import {useContext, useState} from 'react'
import {PoolContext} from "./poolContext.ts";
import montecarlo from "./montecarlo.ts";

export interface Props {
    usePool: boolean
}

export function Montecarlo({usePool}: Props) {
    const [result, setResult] = useState(0)
    const [running, setRunning] = useState(false)
    const pool = useContext(PoolContext)

    return <>
        <button
            disabled={running}
            onClick={
                async () => {
                    setRunning(true)
                    if (usePool) {
                        setResult(await pool.sendWork({type: 'montecarlo'}))
                    }
                    else {
                        setResult(montecarlo())
                    }
                    setRunning(false)
                }
            }
        >
            Run Monte Carlo Simulation
        </button>
        <p>
            {result}
        </p>
    </>
}
