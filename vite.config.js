import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  base: '/SAE-402/',
  plugins: [basicSsl()],
  server: {
    https: true,
    host: '0.0.0.0',
    port: 5173
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: './index.html',
        game: './game.html'
      },
      output: {
        manualChunks: undefined
      }
    },
    terserOptions: {
      compress: {
        drop_console: false
      },
      format: {
        comments: false
      }
    }
  }
})
