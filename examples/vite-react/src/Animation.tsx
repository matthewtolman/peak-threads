import {useRef, useState, useEffect} from 'react';

export function Animation() {
    const width = 300, height = 100

    const canvasRef = useRef(null);
    const [context, setContext] = useState<CanvasRenderingContext2D>(null as any);
    const [frame, setFrame] = useState(0);

    const draw = ((frame: number) => {
        if (!context) return;

        context.clearRect(0, 0, width, height)
        context.fillStyle = '#ee2211'
        context.beginPath()
        context.arc(150 + Math.sin(frame * 0.013) * 100, 50 + 25 * Math.cos(frame * 0.013), 5 + 5 * Math.sin(frame * 0.013) ** 2, 0 , 2 * Math.PI)
        context.fill()

        context.fillStyle = '#0011bb'
        context.beginPath()
        context.arc(150 - Math.sin(frame * 0.013) * 100, 50 - 25 * Math.cos(frame * 0.013), 5 + 5 * Math.sin(frame * 0.013) ** 2, 0 , 2 * Math.PI)
        context.fill()
    })

    useEffect(() => {
        //i.e. value other than null or undefined
        if (canvasRef.current) {
            const canvas: HTMLCanvasElement = canvasRef.current;
            const ctx = canvas.getContext("2d")!;
            setContext(ctx);
        }
    }, []);

    useEffect(() => {
        if (!context) {
            return
        }

        let animationFrameId: number

        const render = () => {
            draw(frame);
            animationFrameId = window.requestAnimationFrame(render);

            // update the animation after a delay
            new Promise(r => {
                setFrame(frame + 0.06)
                r(null)
            })
        };
        render();
        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [draw, context, setFrame, frame]);

    return <canvas ref={canvasRef} width={width} height={height} style={{border: '1px solid black'}}></canvas>
}