import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'

export default defineConfig({
  plugins: [wasm()],
  server: {
    port: 5173,
    strictPort: false,
    open: false,
    host: true
  },
  optimizeDeps: {
    dedupe: ['three'],
    include: ['gsap', 'three']
  },
  build: {
    target: 'esnext',
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          gsap: ['gsap']
        }
      }
    }
  },
  preview: {
    port: 4173,
    open: false
  }
})