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
    // Phaser itself is ~1 MB; don't warn about it.
    chunkSizeWarningLimit: 2000,
  },
});
