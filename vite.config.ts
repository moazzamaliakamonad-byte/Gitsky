import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves a project site from /<repo-name>/.
// CI sets BASE_PATH from the repository name; locally we serve from /.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    // On Windows, rapid truncate-then-write saves can be missed or read half-written by
    // the watcher, leaving the dev server serving stale code.
    watch: { awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 } },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', 'postprocessing'],
          react: ['react', 'react-dom', '@react-three/fiber', 'zustand'],
        },
      },
    },
  },
});
