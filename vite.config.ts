import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Local mirror of the Vercel rewrite in vercel.json:
 * /psx/* is forwarded to the PSX Data Portal so the app is same-origin in dev
 * and preview too. Purely a development convenience — there is no server code.
 */
const psxProxy = {
  '/psx': {
    target: 'https://dps.psx.com.pk',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/psx/, ''),
    headers: {
      Referer: 'https://dps.psx.com.pk/',
    },
  },
};

// PSXEdge is a static, browser-only application.
// No backend, no server-side rendering, no environment secrets.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: psxProxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
    proxy: psxProxy,
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
