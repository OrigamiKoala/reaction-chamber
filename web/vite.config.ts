import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  // relative asset URLs: the same build works at a site root (python3 run.py) and under a GitHub Pages project path
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    target: 'esnext',
    emptyOutDir: true,
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
