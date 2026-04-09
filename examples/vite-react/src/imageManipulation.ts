import type {Algorithm} from "./ImageManipulator.tsx";

const redOffset = 0
const greenOffset = 1
const blueOffset = 2
const alphaOffset = 3

export function downscale(imageData: Uint8ClampedArray, width: number, height: number, colorSpace: PredefinedColorSpace, maxWidth: number): ImageData {
    if (width < maxWidth) {
        return new ImageData(imageData.map(e => e), width, height, {colorSpace: colorSpace})
    }

    const inWidth = width
    const inHeight = height

    const ratio = width / maxWidth
    height = Math.round(height / ratio)
    width = maxWidth

    const buff = new Uint8ClampedArray(new ArrayBuffer(width * height * Uint8ClampedArray.BYTES_PER_ELEMENT * 4))

    for (let x = 0; x < width; ++x) {
        let xMin = Math.floor(x * ratio - ratio / 2);
        let xMax = Math.ceil(xMin + (ratio / 22))
        if (xMax > inWidth) {
            xMax = inWidth
        }
        if (xMin < 0) {
            xMin = 0
        }

        if (xMax < xMin + 1) {
            xMax = xMin + 1
        }

        for (let y = 0; y < height; ++y) {
            let yMin = Math.floor(y * ratio - (ratio / 2));
            let yMax = Math.ceil(yMin + (ratio / 2))
            if (yMax > inHeight) {
                yMax = inHeight
            }
            if (yMin < 0) {
                yMin = 0
            }
            if (yMax < yMin + 1) {
                yMax = yMin + 1
            }


            let count = 0
            let red = 0, green = 0, blue = 0, alpha = 0

            for (let ix = xMin; ix < xMax; ++ix) {
                for (let iy = yMin; iy < yMax; ++iy) {
                    const pixelIndex = (iy) * (inWidth * 4) + (ix) * 4
                    red += imageData[pixelIndex + redOffset]
                    green += imageData[pixelIndex + greenOffset]
                    blue += imageData[pixelIndex + blueOffset]
                    alpha += imageData[pixelIndex + alphaOffset]
                    ++count
                }
            }

            red = Math.floor(red/count)
            green = Math.floor(green/count)
            blue = Math.floor(blue/count)
            alpha = Math.floor(alpha/count)

            const pixelIndex = (y) * (width * 4) + (x) * 4
            buff[pixelIndex + redOffset] = red
            buff[pixelIndex + greenOffset] = green
            buff[pixelIndex + blueOffset] = blue
            buff[pixelIndex + alphaOffset] = alpha
        }
    }

    const newData = new ImageData(buff, width, height, {colorSpace})
    return newData
}

export function pixelate(imageData: ImageData, blockSize: number) {
    const {width, height} = imageData
    for (let y = 0; y < height; y += blockSize) {
        for (let x = 0; x < width; x += blockSize) {
            const remainingX = width - x
            const remainingY = height - y

            const blockX = remainingX > blockSize ? blockSize : remainingX
            const blockY = remainingY > blockSize ? blockSize : remainingY

            // copy into our buffer
            let counter = 0, redSum = 0, blueSum = 0, greenSum = 0, alphaSum = 0
            for (let cx = 0; cx < blockX; ++cx) {
                for (let cy = 0; cy < blockY; ++cy) {
                    const pixelIndex = ((cy + y) * (imageData.width) + (cx + x)) * 4
                    redSum += imageData.data[pixelIndex + redOffset]
                    greenSum += imageData.data[pixelIndex + greenOffset]
                    blueSum += imageData.data[pixelIndex + blueOffset]
                    alphaSum += imageData.data[pixelIndex + alphaOffset]
                    ++counter
                }
            }

            const averageColor =  {
                red: Math.floor(redSum / counter),
                green: Math.floor(greenSum / counter),
                blue: Math.floor(blueSum / counter),
                alpha: Math.floor(alphaSum / counter),
            }

            if (x < 60)
            console.log([x,y], [blockX,blockY], averageColor, counter, [remainingX, remainingY])

            // copy the color into our data
            for (let cx = 0; cx < blockX; ++cx) {
                for (let cy = 0; cy < blockY; ++cy) {
                    const pixelIndex = ((cy + y) * (imageData.width) + (cx + x)) * 4

                    imageData.data[pixelIndex + redOffset] = averageColor.red
                    imageData.data[pixelIndex + greenOffset] = averageColor.green
                    imageData.data[pixelIndex + blueOffset] = averageColor.blue
                    imageData.data[pixelIndex + alphaOffset] = averageColor.alpha
                }
            }
        }
    }

}

export type BoundaryResolve = 'undefined'|'zero'|'cur-pixel'

export interface WindowOptions {
    windowSize?: number
    boundaryResolve?: BoundaryResolve
}

export const blurKernel = (window: number) => {
    const w2 = window ** 2
    const arr = new Array(window).fill(new Array(window).fill(1 / w2))
    return arr
}

export interface ImageWork {
    type: string,
    imageBitmap: ImageBitmap,
    outWidth: number,
    action: Algorithm,
    blurSize?: number,
    pixelSize?: number
}

export function runWork(work: ImageWork) {
    // type: 'pixelate_image', buff: imagedata.data, height, width, algorithm
    const {imageBitmap, outWidth} = work

    const width = imageBitmap.width
    const height = imageBitmap.height

    const canvas = new OffscreenCanvas(width, height)
    const ctx2d = canvas.getContext('2d', { alpha: false })!
    ctx2d.drawImage(imageBitmap, 0, 0)
    const imageData = ctx2d.getImageData(0, 0, width, height)!

    const b = imageData.data

    console.log('processing image...')
    const orig = new ImageData(b.map(e => e), width, height, {colorSpace: imageData.colorSpace})
    const origScaled = downscale(orig.data, orig.width, orig.height, orig.colorSpace, outWidth || 500)

    let modified: ImageData

    const action: Algorithm = work.action
    if (action === "pixelate") {
        modified = downscale(origScaled.data, origScaled.width, origScaled.height, origScaled.colorSpace, outWidth || 500)
        pixelate(modified, work.pixelSize || 50)
    }
    else if (action === 'blur') {
        const blurSize = work.blurSize || 7
        const {buff: mbuff, width: mw, height: mh} = applyKernel(origScaled.data, origScaled.width, origScaled.height, blurKernel(blurSize + (blurSize % 2 === 0 ? 1 : 0)))
        modified = new ImageData(mbuff as ImageDataArray, mw, mh, {colorSpace: imageData.colorSpace})
    }
    else if (action === 'edge_all') {
        const kernel: number[][] = [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]]
        const {buff: mbuff, width: mw, height: mh} = applyKernel(origScaled.data, origScaled.width, origScaled.height, kernel)
        modified = new ImageData(mbuff as ImageDataArray, mw, mh, {colorSpace: imageData.colorSpace})
    }
    else if (action === 'edge_right') {
        const kernel: number[][] = [[1, 0, -1],[1, 0, -1], [1, 0, -1]]
        const {buff: mbuff, width: mw, height: mh} = applyKernel(origScaled.data, origScaled.width, origScaled.height, kernel)
        modified = new ImageData(mbuff as ImageDataArray, mw, mh, {colorSpace: imageData.colorSpace})
    }
    else if (action === 'edge_left') {
        const kernel: number[][] = [[-1, 0, 1],[-1, 0, 1], [-1, 0, 1]]
        const {buff: mbuff, width: mw, height: mh} = applyKernel(origScaled.data, origScaled.width, origScaled.height, kernel)
        modified = new ImageData(mbuff as ImageDataArray, mw, mh, {colorSpace: imageData.colorSpace})
    }
    else if (action === 'edge_up') {
        const kernel: number[][] = [[-1, -1, -1],[0, 0, 0], [1, 1, 1]]
        const {buff: mbuff, width: mw, height: mh} = applyKernel(origScaled.data, origScaled.width, origScaled.height, kernel)
        modified = new ImageData(mbuff as ImageDataArray, mw, mh, {colorSpace: imageData.colorSpace})
    }
    else if (action === 'edge_down') {
        const kernel: number[][] = [[1, 1, 1],[0, 0, 0], [-1, -1, -1]]
        const {buff: mbuff, width: mw, height: mh} = applyKernel(origScaled.data, origScaled.width, origScaled.height, kernel)
        modified = new ImageData(mbuff as ImageDataArray, mw, mh, {colorSpace: imageData.colorSpace})
    }
    else if (action === 'sharpen') {
        const kernel: number[][] = [[0, -1, 0], [-1, 5, -1], [0, -1, 0]]
        const {buff: mbuff, width: mw, height: mh} = applyKernel(origScaled.data, origScaled.width, origScaled.height, kernel)
        modified = new ImageData(mbuff as ImageDataArray, mw, mh, {colorSpace: imageData.colorSpace})
    }
    else if (action === 'emboss') {
        const kernel: number[][] = [[-2, -1, 0], [-1, 1, 1], [0, 1, 2]]
        const {buff: mbuff, width: mw, height: mh} = applyKernel(origScaled.data, origScaled.width, origScaled.height, kernel)
        modified = new ImageData(mbuff as ImageDataArray, mw, mh, {colorSpace: imageData.colorSpace})
    }
    else if (action === 'emphasis') {
        const kernel: number[][] = [[-0.75, -0.75, -0.75], [-0.75, 7.5, -0.75], [-0.75, -0.75, -0.75]]
        const {buff: mbuff, width: mw, height: mh} = applyKernel(origScaled.data, origScaled.width, origScaled.height, kernel)
        modified = new ImageData(mbuff as ImageDataArray, mw, mh, {colorSpace: imageData.colorSpace})
    }
    else if (action === 'original') {
        modified = origScaled
    }
    else {
        throw new Error('UNKNOWN action ON IMAGE!', action)
    }

    const resCanvas = new OffscreenCanvas(modified.width, modified.height)
    const resCtx = resCanvas.getContext('2d', { alpha: false })!
    resCtx.putImageData(modified, 0, 0)
    const newBitmap = resCanvas.transferToImageBitmap()

    return {
        orig: imageBitmap,
        result: newBitmap
    }
}

export interface Pixel {
    r: number
    g: number
    b: number
    a: number
}

export type EdgeHandling = 'wrap'|'mirror'|'crop'|'grey'|'black'|'white'|'custom'|'clamp'

export interface KernelOptions {
    boundaryResolve?: EdgeHandling
    custom?: Pixel
}

export type Kernel = Array<Array<number>> | Array<Array<Pixel>>

export function applyKernel(data: Uint8ClampedArray, width: number, height: number, kernel: Kernel, options?: KernelOptions) {
    const edgeHandling = options?.boundaryResolve || "grey"
    if (kernel.length % 2 === 0 || kernel[0].length % 2 === 0) {
        console.error('INVALIID KERNEL! MUST BE ODD SIZE')
        return {buff: data, width, height}
    }

    let offX = Math.floor(kernel.length / 2)
    let offY = Math.floor(kernel.length / 2)

    let outWidth = width
    if (edgeHandling === 'crop') {
        outWidth -= offX * 2
        offX = 0
    }

    let outHeight = height
    if (edgeHandling === 'crop') {
        outHeight -= offY * 2
        offY = 0
    }

    for (let ky = 0; ky < kernel.length; ++ky) {
        for (let kx = 0; kx < kernel.length; ++kx) {
            if (typeof kernel[ky][kx] === 'number') {
                const n: number = kernel[ky][kx] as any
                kernel[ky][kx] = {r: n, g: n, b: n, a: n}
            }
        }
    }
    kernel = (kernel as any) as Array<Array<Pixel>>

    const out = new Uint8ClampedArray(new ArrayBuffer(outWidth * outHeight * Uint8ClampedArray.BYTES_PER_ELEMENT * 4))

    for (let y = 0; y < outHeight; ++y) {
        for (let x = 0; x < outWidth; ++x) {
            const outIndex = y * (width * 4) + x * 4

            let r = 0, g = 0, b = 0, a = 0
            for (let ky = 0; ky < kernel.length; ++ky) {
                for (let kx = 0; kx < kernel[ky].length; ++kx) {
                    let xIndx = x + kx - offX
                    let yIndx = y + ky - offY

                    if (xIndx < 0 || yIndx < 0 || xIndx >= width || yIndx >= height) {
                        switch (edgeHandling) {
                            case "wrap": {
                                if (xIndx < 0) {
                                    xIndx += width
                                }
                                if (xIndx >= width) {
                                    xIndx -= width
                                }
                                if (yIndx < 0) {
                                    yIndx += height
                                }
                                if (yIndx >= height) {
                                    yIndx -= height
                                }

                                const inIndex = yIndx * (width * 4) + xIndx * 4
                                r += kernel[ky][kx].r * data[inIndex + redOffset]
                                g += kernel[ky][kx].g * data[inIndex + greenOffset]
                                b += kernel[ky][kx].b * data[inIndex + blueOffset]
                                a += kernel[ky][kx].a * data[inIndex + alphaOffset]
                                break;
                            }
                            case "mirror": {
                                if (xIndx < 0) {
                                    xIndx = -xIndx
                                }
                                if (xIndx >= width) {
                                    xIndx = width - (xIndx - width)
                                }
                                if (yIndx < 0) {
                                    yIndx = -yIndx
                                }
                                if (yIndx >= width) {
                                    yIndx = width - (yIndx - width)
                                }

                                const inIndex = yIndx * (width * 4) + xIndx * 4
                                r += kernel[ky][kx].r * data[inIndex + redOffset]
                                g += kernel[ky][kx].g * data[inIndex + greenOffset]
                                b += kernel[ky][kx].b * data[inIndex + blueOffset]
                                a += kernel[ky][kx].a * data[inIndex + alphaOffset]
                                break;
                            }
                            case "grey":
                                r += kernel[ky][kx].r * 128
                                g += kernel[ky][kx].g * 128
                                b += kernel[ky][kx].b * 128
                                a += kernel[ky][kx].a * 255
                                break;
                            case "black":
                                r += 0
                                g += 0
                                b += 0
                                a += kernel[ky][kx].a * 255
                                break;
                            case "white":
                                r += kernel[ky][kx].r * 255
                                g += kernel[ky][kx].g * 255
                                b += kernel[ky][kx].b * 255
                                a += kernel[ky][kx].a * 255
                                break;
                            case "custom":
                                r += kernel[ky][kx].r * (options?.custom?.r || 128)
                                g += kernel[ky][kx].g * (options?.custom?.g || 128)
                                b += kernel[ky][kx].b * (options?.custom?.b || 128)
                                a += kernel[ky][kx].a * (options?.custom?.a || 128)
                                break;
                            case "clamp": {
                                xIndx = Math.min(Math.max(xIndx, 0), 255)
                                yIndx = Math.min(Math.max(yIndx, 0), 255)

                                const inIndex = yIndx * (width * 4) + xIndx * 4
                                r += kernel[ky][kx].r * data[inIndex + redOffset]
                                g += kernel[ky][kx].g * data[inIndex + greenOffset]
                                b += kernel[ky][kx].b * data[inIndex + blueOffset]
                                a += kernel[ky][kx].a * data[inIndex + alphaOffset]
                                break;
                            }
                        }
                    }
                    else {
                        const inIndex = yIndx * (width * 4) + xIndx * 4
                        r += kernel[ky][kx].r * data[inIndex + redOffset]
                        g += kernel[ky][kx].g * data[inIndex + greenOffset]
                        b += kernel[ky][kx].b * data[inIndex + blueOffset]
                        a += kernel[ky][kx].a * data[inIndex + alphaOffset]
                    }
                }
            }

            out[outIndex + redOffset] += Math.floor( r)
            out[outIndex + greenOffset] += Math.floor( g)
            out[outIndex + blueOffset] += Math.floor( b)
            out[outIndex + alphaOffset] = 255
        }
    }

    return {buff: out, width: outWidth, height: outHeight}
}

export function iterateWindow(imageData: Uint8ClampedArray, width: number, height: number, callback: (window: Array<Array<Pixel>>) => Pixel, options?: WindowOptions) {
    const winSize = options?.windowSize || 1
    const boundaryResolve = options?.boundaryResolve || 'zero'

    const window = (new Array(winSize * 2 + 1)).fill(0).map(() => (new Array(winSize * 2 + 1)).fill(0).map(() => ({r: 0, g: 0, b: 0, a: 0})))
    const copy = imageData.map(e => e)

    for (let x = 0; x < width; ++x) {
        for (let y = 0; y < height; ++y) {
            const pixelIndex = (y) * (width * 4) + (x) * 4

            for (let wx = -winSize; wx <= winSize; ++wx) {
                const wix = winSize + wx
                const ox = wx + x

                for (let wy = -winSize; wy <= winSize; ++wy) {
                    const oy = wy + y

                    const wiy = winSize + wy

                    let pixel: Pixel = {r:0, g:0, b:0, a:0}
                    if (ox < 0 || ox >= width || oy < 0 || oy >= height) {
                        if (boundaryResolve === 'zero') {
                            // already zero
                        }
                        else if (boundaryResolve === 'undefined') {
                            pixel = (undefined as any)
                        }
                        else if (boundaryResolve === 'cur-pixel') {
                            pixel.r = imageData[pixelIndex + redOffset]
                            pixel.g = imageData[pixelIndex + greenOffset]
                            pixel.b = imageData[pixelIndex + blueOffset]
                            pixel.a = imageData[pixelIndex + alphaOffset]
                        }
                    }
                    else {
                        const oPixelIndex = (oy) * (width * 4) * ox * 4
                        pixel.r = imageData[oPixelIndex + redOffset]
                        pixel.g = imageData[oPixelIndex + greenOffset]
                        pixel.b = imageData[oPixelIndex + blueOffset]
                        pixel.a = imageData[oPixelIndex + alphaOffset]
                    }
                    window[wiy][wix] = pixel
                }
            }

            const p = callback(window)
            copy[pixelIndex + redOffset] = Math.max(Math.min(Math.floor(p.r), 255), 0)
            copy[pixelIndex + greenOffset] = Math.max(Math.min(Math.floor(p.g), 255), 0)
            copy[pixelIndex + blueOffset] = Math.max(Math.min(Math.floor(p.b), 255), 0)
            copy[pixelIndex + alphaOffset] = Math.max(Math.min(Math.floor(p.a), 255), 0)
        }
    }
}
