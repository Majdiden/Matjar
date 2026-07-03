import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import emitManifest from '@matjar/theme-shared/build/emitManifest.mjs';

export default defineConfig({
  plugins: [react(), emitManifest()],
  resolve: {
    // dedupe is still REQUIRED under npm workspaces: the dashboard (react 19)
    // wins the root hoist, so themes keep a nested react 18 while hoisted
    // packages (react-i18next, @matjar/theme-shared peers) would resolve the
    // root copy — bundling two Reacts. dedupe forces every import to resolve
    // from this theme's own tree, guaranteeing a single React per bundle.
    dedupe: ['react', 'react-dom', 'react-router-dom', 'i18next', 'react-i18next', 'i18next-browser-languagedetector'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 4000,
    proxy: {
      '/api': 'http://localhost:3000',
      '/storefront': 'http://localhost:3000',
    },
  },
});
