import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      // Two pages: the game, and the estate blockout you fly to judge scale.
      input: {
        main: resolve(__dirname, 'index.html'),
        estate: resolve(__dirname, 'estate.html'),
      },
    },
  },
});
