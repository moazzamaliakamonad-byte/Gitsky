import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves a project site from /<repo-name>/.
// CI sets BASE_PATH from the repository name; locally we serve from /.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
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
