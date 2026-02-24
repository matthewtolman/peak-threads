import { resolve } from 'path'
import {defineConfig} from "vite";

export default defineConfig({
    build: {
        sourcemap: true,
        lib: {
            entry: resolve(__dirname, 'src/main.ts'),
            name: 'threads',
            formats: ['es', 'cjs', 'umd', 'iife'],
            fileName: (format) => `threads.${format}.js`
        }
    }
})
