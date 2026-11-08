import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths work both in the Wails asset server and in `vite preview`.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Local desktop app: the bundle is loaded from disk, size warnings are not useful.
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
