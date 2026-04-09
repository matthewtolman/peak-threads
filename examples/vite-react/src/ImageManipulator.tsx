import {useContext, useEffect, useRef, useState} from "react";
import {PoolContext} from "./poolContext.ts";
import type {ThreadPool} from "peak-threads";
import {runWork} from "./imageManipulation.ts";

async function yieldThread() {
    await new Promise(r => r(null))
}

export type Algorithm =
    | 'blur'
    | 'pixelate'
    | 'edge_right'
    | 'edge_left'
    | 'edge_up'
    | 'edge_down'
    | 'edge_all'
    | 'sharpen'
    | 'emboss'
    | 'emphasis'
    | 'original'

async function processImage(pool: ThreadPool | undefined, imageBitmap: ImageBitmap, setImageBitmap: (imb: ImageBitmap) => void, setProcessing: (_: boolean) => void,
                            modifiedCanvas: HTMLCanvasElement, algorithm: Algorithm) {
    setProcessing(true)
    try {
        console.log('processing')

        const params: any = {
            type: 'pixelate_image',
            imageBitmap,
            outWidth: 1300,
            action: algorithm
        }

        if (algorithm === 'blur') {
            params.blurSize = 6
        } else if (algorithm === 'pixelate') {
            params.pixelSize = 20
        }

        let m: ImageBitmap

        if (pool) {
            const {orig, result} = await pool.sendWork(params, {transfer: [imageBitmap]})
            m = result
            setImageBitmap(orig)
        } else {
            const {result} = runWork(params)
            m = result
        }

        console.log('receiving')

        modifiedCanvas.width = m.width
        modifiedCanvas.height = m.height

        requestAnimationFrame(() => {
            const ctx2d = modifiedCanvas.getContext('2d')!
            ctx2d.fillStyle = 'white'
            ctx2d.fillRect(0, 0, modifiedCanvas.width, modifiedCanvas.height)
            ctx2d.drawImage(m, 0, 0)
        })

    } finally {
        await yieldThread()
        setProcessing(false)
    }
}

export interface Props {
    usePool: boolean
}

export const ImageManipulator = ({usePool}: Props) => {
    const selectedImageInputRef = useRef<HTMLInputElement>(null)
    const modifiedCanvasRef = useRef<HTMLCanvasElement>(null)
    const pool = useContext(PoolContext)

    const [processing, setProcessing] = useState<boolean>(false)
    const [hasImage, setHasImage] = useState(false)
    const [action, setAction] = useState<Algorithm>('original')
    const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null)

    useEffect(() => {
        if (hasImage) {
            processImage(usePool ? pool : undefined, imageBitmap!, setImageBitmap, setProcessing, modifiedCanvasRef.current!, action)
        }
    }, [pool, hasImage, action])

    const file = {
        read: async (chosenFile: Blob) => {
            if (!chosenFile) {
                // user cancelled
                return
            }
            await new Promise(r => requestAnimationFrame(() => {
                const ctx2d = modifiedCanvasRef.current!.getContext('2d')!
                ctx2d.fillStyle = 'white'
                ctx2d.fillRect(0, 0, modifiedCanvasRef.current!.width, modifiedCanvasRef.current!.height)
                r(null)
            }))

            const bitmap = await createImageBitmap(chosenFile)
            setImageBitmap(bitmap)
            setProcessing(true)
            setHasImage(true)
            await processImage(usePool ? pool : undefined, bitmap, setImageBitmap, setProcessing, modifiedCanvasRef.current!, action)
        }
    }

    const handleFile = (event: any = {}) => {
        if (!event.target.files || !event.target.files.length) {
            return
        }
        const [source] = event.target.files
        file.read(source)
    }

    const handleImageButton = () => {
        if (selectedImageInputRef.current) {
            selectedImageInputRef.current.click()
        }
    }

    return <>
        <div style={{marginBottom: '1.5em', display: 'flex', flexDirection: 'row'}}>
            <div style={{display: 'flex', flexDirection: 'column', textAlign: "left"}}>
                <section>
                    <h3>Image</h3>
                    <input
                        disabled={processing}
                        accept={'image/*'}
                        style={{display: 'none'}}
                        onChange={handleFile}
                        ref={selectedImageInputRef}
                        type={'file'}
                    />
                    <button disabled={processing} onClick={handleImageButton}>Select Image</button>
                </section>
                <section style={{margin: "0 1em"}}>
                    <h3>Image Filter</h3>
                    <div>
                        <input disabled={processing} type={"radio"} id={'original'} checked={action === 'original'} name={"action"}
                               onChange={() => {
                                   setAction('original')
                               }}/>
                        <label htmlFor={'original'}>Original</label>
                    </div>

                    <div>
                        <input disabled={processing} type={"radio"} id={'emphasis'} checked={action === 'emphasis'} name={"action"}
                               onChange={() => {
                                   setAction('emphasis')
                               }}/>
                        <label htmlFor={'emphasis'}>Noise + Brighten</label>
                    </div>

                    <div>
                        <input disabled={processing} type={"radio"} id={'blur'} checked={action === 'blur'} name={"action"} onChange={() => {
                            setAction('blur')
                        }}/>
                        <label htmlFor={'blur'}>Blur</label>
                    </div>

                    <div>
                        <input disabled={processing} type={"radio"} id='pixelate' checked={action === 'pixelate'} name={"action"}
                               onChange={() => {
                                   setAction('pixelate')
                               }}/>
                        <label htmlFor={'pixelate'}>Pixelate</label>
                    </div>

                    <div>
                        <input disabled={processing} type={"radio"} id='emboss' checked={action === 'emboss'} name={"action"}
                               onChange={() => {
                                   setAction('emboss')
                               }}/>
                        <label htmlFor={'emboss'}>Emboss</label>
                    </div>

                    <div>
                        <input disabled={processing} type={"radio"} id='sharpen' checked={action === 'sharpen'} name={"action"}
                               onChange={() => {
                                   setAction('sharpen')
                               }}/>
                        <label htmlFor={'sharpen'}>Sharpen</label>
                    </div>
                </section>
                <section style={{margin: "0 1em"}}>
                    <h3>Edge Detection</h3>

                    <div>
                        <input disabled={processing} type={"radio"} id='edge_all' checked={action === 'edge_all'} name={"action"}
                               onChange={() => {
                                   setAction('edge_all')
                               }}/>
                        <label htmlFor={'edge_all'}>All</label>
                    </div>

                    <div>
                        <input disabled={processing} type={"radio"} id='edge_left' checked={action === 'edge_left'} name={"action"}
                               onChange={() => {
                                   setAction('edge_left')
                               }}/>
                        <label htmlFor={'edge_left'}>Left</label>
                    </div>

                    <div>
                        <input disabled={processing} type={"radio"} id='edge_right' checked={action === 'edge_right'} name={"action"}
                               onChange={() => {
                                   setAction('edge_right')
                               }}/>
                        <label htmlFor={'edge_right'}>Right</label>
                    </div>

                    <div>
                        <input disabled={processing} type={"radio"} id='edge_up' checked={action === 'edge_up'} name={"action"}
                               onChange={() => {
                                   setAction('edge_up')
                               }}/>
                        <label htmlFor={'edge_up'}>Up</label>
                    </div>

                    <div>
                        <input disabled={processing} type={"radio"} id='edge_down' checked={action === 'edge_down'} name={"action"}
                               onChange={() => {
                                   setAction('edge_down')
                               }}/>
                        <label htmlFor={'edge_down'}>Down</label>
                    </div>
                </section>
            </div>
            <div>
                <div style={{
                    display: hasImage ? 'flex' : 'none',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    width: 'calc(1300px + 4em)',
                    position: "relative"
                }}>
                    <div style={{
                        display: processing ? 'initial' : 'none',
                        fontSize: '300%',
                        color: 'white',
                        padding: '0.5em 2em',
                        background: 'black',
                        position: "absolute",
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1000
                    }}>Processing...
                    </div>
                    <div style={{width: "fit-content", margin: '0 auto'}}>
                        <canvas ref={modifiedCanvasRef}/>
                    </div>
                </div>
                <div style={{
                    display: hasImage ? 'none' : 'block', width: 'calc(1300px + 4em)'
                }}></div>
            </div>
        </div>
    </>
}
