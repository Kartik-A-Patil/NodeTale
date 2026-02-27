import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(rootDir, 'electron/main.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(rootDir, 'electron/preload.ts')
        }
      }
    }
  },
  renderer: {
    root: rootDir,
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: path.resolve(rootDir, 'index.html'),
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'flow-vendor': ['reactflow'],
          }
        }
      },
      minify: 'esbuild',
      sourcemap: false,
      chunkSizeWarningLimit: 600,
    },
    define: {
      'import.meta.env.VITE_PLATFORM': JSON.stringify('electron'),
    },
    resolve: {
      alias: {
        '@': path.resolve(rootDir, 'src')
      }
    },
    plugins: [react()]
  }
})
