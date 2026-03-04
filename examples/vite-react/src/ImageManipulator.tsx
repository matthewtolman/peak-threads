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

async function processImage(pool: ThreadPool|undefined, loadCanvas: HTMLCanvasElement, setProcessing: (_: boolean) => void,
                            modifiedCanvas: HTMLCanvasElement, algorithm: Algorithm) {
    setProcessing(true)
    const width = loadCanvas.width
    const height = loadCanvas.height
    try {
        const buff = new Uint8ClampedArray(new ArrayBuffer(width * height * Uint8ClampedArray.BYTES_PER_ELEMENT * 4))

        await yieldThread()

        let colorSpace

        const yieldEveryNRows = 3

        const loadCanvasContext = loadCanvas.getContext('2d', {alpha: false})!

        for (let row = 0; row < height; row++) {
            const rowData = loadCanvasContext.getImageData(0, row, width, 1)
            colorSpace = rowData.colorSpace

            if (row % yieldEveryNRows === yieldEveryNRows - 1) {
                await yieldThread()
            }
            const rowIndex = (row) * (width * Uint8ClampedArray.BYTES_PER_ELEMENT * 4)
            for (let col = 0; col < width; col++) {
                const colOffset = col * Uint8ClampedArray.BYTES_PER_ELEMENT * 4
                buff[rowIndex + colOffset + 0] = rowData.data[colOffset + 0]
                buff[rowIndex + colOffset + 1] = rowData.data[colOffset + 1]
                buff[rowIndex + colOffset + 2] = rowData.data[colOffset + 2]
                buff[rowIndex + colOffset + 3] = rowData.data[colOffset + 3]
            }
        }
        console.log('processing')

        const params: any = {
            type: 'pixelate_image',
            buff: buff.buffer,
            height,
            width,
            colorSpace: colorSpace,
            outWidth: 1300,
            action: algorithm
        }

        if (algorithm === 'blur') {
            params.blurSize = 6
        } else if (algorithm === 'pixelate') {
            params.pixelSize = 20
        }

        let m: any

        if (pool) {
            m = await pool.sendWork(params, {transfer: [buff.buffer]})
        }
        else {
            m = runWork(params)
        }

        const modifiedData = new Uint8ClampedArray(m.data)

        console.log('receiving')

        const mImage = new ImageData(modifiedData, m.width, m.height, {colorSpace: colorSpace})
        await yieldThread()

        console.log('rendering')

        await yieldThread()

        modifiedCanvas.width = mImage.width
        modifiedCanvas.height = mImage.height
        const modifiedContext = modifiedCanvas.getContext('2d', {alpha: false})!
        modifiedContext.putImageData(mImage, 0, 0)

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
    const fileRef = useRef<Blob>(null)
    const blobRef = useRef<string | ArrayBuffer | null | undefined>(null)
    const loadCanvasRef = useRef<HTMLCanvasElement>(null)
    const modifiedCanvasRef = useRef<HTMLCanvasElement>(null)
    const loadCanvasContextRef = useRef<CanvasRenderingContext2D>(null)
    const imageRef = useRef<HTMLImageElement>(null)
    const pool = useContext(PoolContext)

    const [processing, setProcessing] = useState<boolean>(false)
    const [hasImage, setHasImage] = useState(false)
    const [action, setAction] = useState<Algorithm>('original')

    const image = {
        create: (src: string | ArrayBuffer | null | undefined) => {
            const source = !src ? imageRef!.current!.src : src;
            const newImage = new Image()
            newImage.src = source as string
            newImage.onload = async () => {
                setProcessing(true)
                imageRef.current = newImage

                const {width, height} = newImage

                loadCanvasRef.current!.width = width
                loadCanvasRef.current!.height = height

                console.log('loading')
                loadCanvasContextRef.current = loadCanvasRef.current!.getContext('2d', {
                    alpha: false,
                    willReadFrequently: true
                })
                loadCanvasContextRef.current!.drawImage(newImage, 0, 0)

                setHasImage(true)
                processImage(usePool ? pool : undefined, loadCanvasRef.current!, setProcessing, modifiedCanvasRef.current!, action)
            }
        }
    }

    useEffect(() => {
        if (hasImage) {
            processImage(usePool ? pool : undefined, loadCanvasRef.current!, setProcessing, modifiedCanvasRef.current!, action)
        }
    }, [pool, hasImage, action])

    const file = {
        read: (chosenFile: Blob) => {
            const fileReader = new FileReader()
            fileReader.onloadend = event => {
                fileRef.current = chosenFile
                blobRef.current = event.target?.result
                image.create(blobRef.current)
            }
            try {
                fileReader.readAsDataURL(chosenFile)
            } catch {
                // No file
            }
        }
    }

    const handleFile = (event: any = {}) => {
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
                        <input type={"radio"} id={'original'} checked={action === 'original'} name={"action"}
                               onChange={() => {
                                   setAction('original')
                               }}/>
                        <label htmlFor={'original'}>Original</label>
                    </div>

                    <div>
                        <input type={"radio"} id={'emphasis'} checked={action === 'emphasis'} name={"action"}
                               onChange={() => {
                                   setAction('emphasis')
                               }}/>
                        <label htmlFor={'emphasis'}>Noise + Brighten</label>
                    </div>

                    <div>
                        <input type={"radio"} id={'blur'} checked={action === 'blur'} name={"action"} onChange={() => {
                            setAction('blur')
                        }}/>
                        <label htmlFor={'blur'}>Blur</label>
                    </div>

                    <div>
                        <input type={"radio"} id='pixelate' checked={action === 'pixelate'} name={"action"}
                               onChange={() => {
                                   setAction('pixelate')
                               }}/>
                        <label htmlFor={'pixelate'}>Pixelate</label>
                    </div>

                    <div>
                        <input type={"radio"} id='emboss' checked={action === 'emboss'} name={"action"}
                               onChange={() => {
                                   setAction('emboss')
                               }}/>
                        <label htmlFor={'emboss'}>Emboss</label>
                    </div>

                    <div>
                        <input type={"radio"} id='sharpen' checked={action === 'sharpen'} name={"action"}
                               onChange={() => {
                                   setAction('sharpen')
                               }}/>
                        <label htmlFor={'sharpen'}>Sharpen</label>
                    </div>
                </section>
                <section style={{margin: "0 1em"}}>
                    <h3>Edge Detection</h3>

                    <div>
                        <input type={"radio"} id='edge_all' checked={action === 'edge_all'} name={"action"}
                               onChange={() => {
                                   setAction('edge_all')
                               }}/>
                        <label htmlFor={'edge_all'}>All</label>
                    </div>

                    <div>
                        <input type={"radio"} id='edge_left' checked={action === 'edge_left'} name={"action"}
                               onChange={() => {
                                   setAction('edge_left')
                               }}/>
                        <label htmlFor={'edge_left'}>Left</label>
                    </div>

                    <div>
                        <input type={"radio"} id='edge_right' checked={action === 'edge_right'} name={"action"}
                               onChange={() => {
                                   setAction('edge_right')
                               }}/>
                        <label htmlFor={'edge_right'}>Right</label>
                    </div>

                    <div>
                        <input type={"radio"} id='edge_up' checked={action === 'edge_up'} name={"action"}
                               onChange={() => {
                                   setAction('edge_up')
                               }}/>
                        <label htmlFor={'edge_up'}>Up</label>
                    </div>

                    <div>
                        <input type={"radio"} id='edge_down' checked={action === 'edge_down'} name={"action"}
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
        <canvas style={{display: 'none'}} ref={loadCanvasRef}/>
    </>
}
