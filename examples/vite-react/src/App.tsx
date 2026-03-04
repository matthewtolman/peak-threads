import './App.css'
import {ThreadPool} from "./ThreadPool.tsx";
import {Animation} from "./Animation.tsx";
import {Montecarlo} from "./Montecarlo.tsx";
import {ImageManipulator} from "./ImageManipulator.tsx";
import {useState} from "react";

function App() {
    const [usePool, setUsePool] = useState(false)
    return (
            <ThreadPool>
                <div>
                    <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-evenly'}}>
                        <div>
                            <Animation/>
                        </div>
                        <div>
                            <Montecarlo usePool={usePool} />
                        </div>
                        <div>
                            <input type='checkbox' checked={usePool} id='threading' onClick={() => setUsePool(!usePool)} />
                            <label htmlFor='threading'>Use Threads?</label>
                        </div>
                    </div>
                    <ImageManipulator usePool={usePool} />
                </div>
            </ThreadPool>
        )
}

export default App
