/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5773,
    proxy: {
      '/api': {
        target: 'http://localhost:5779',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['@monaco-editor/react'],
          vendor: ['react', 'react-dom', 'lucide-react', '@visx/shape'],
          'terminal-vendor': [
            '@xterm/xterm', '@xterm/addon-canvas', '@xterm/addon-fit',
            '@xterm/addon-webgl', '@xterm/addon-image', '@xterm/addon-search',
            '@xterm/addon-unicode11', '@xterm/addon-web-links'
          ]
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts'
  }
});
