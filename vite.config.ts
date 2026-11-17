import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// PSXEdge is a static, browser-only application.
// No backend, no server-side rendering, no environment secrets.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    // ExcelJS is deliberately lazy-loaded as its own chunk on first export.
    chunkSizeWarningLimit: 1100,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
