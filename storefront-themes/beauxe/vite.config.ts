import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import emitManifest from '../_shared/build/emitManifest.mjs';

export default defineConfig({
  plugins: [react(), emitManifest()],
  resolve: {
    alias: { '@shared': path.resolve(__dirname, '../_shared') },
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 4000,
    proxy: { '/api': 'http://localhost:3000', '/storefront': 'http://localhost:3000' },
  },
});
