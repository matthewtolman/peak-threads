import { resolve } from 'path'
import {defineConfig} from "vite";
import dts from 'unplugin-dts/vite'

export default defineConfig({
    build: {
        sourcemap: true,
        lib: {
            entry: resolve(__dirname, 'src/main.ts'),
            name: 'threads',
            formats: ['es', 'cjs', 'umd', 'iife'],
            fileName: (format) => `threads.${format}.js`
        },
    },
    plugins: [dts()]
})
