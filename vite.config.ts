import { defineConfig } from 'vite';

export default defineConfig({
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 300 },
  esbuild: { drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [] },
});
