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
        changeOrigin: true
      }
    }
  }
});
