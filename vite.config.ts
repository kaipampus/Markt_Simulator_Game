import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths, so dist/ also works when served from a subfolder on the server.
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    // Two pages: the game and the 3D test (prototype-3d.html).
    rollupOptions: {
      input: { main: 'index.html', prototype3d: 'prototype-3d.html' },
    },
    // Phaser itself is ~1 MB; don't warn about it.
    chunkSizeWarningLimit: 2000,
  },
});
