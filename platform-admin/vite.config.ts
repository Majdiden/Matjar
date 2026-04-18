import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';

// Platform admin is hosted on the canonical platform host (no subdomain),
// so we don't need the Host-preserving proxy the dashboard uses. Still,
// keep `changeOrigin: false` for parity — the backend's platform routes
// are mounted before the tenant resolver so host doesn't matter.

// Sentry source-map upload, gated on SENTRY_AUTH_TOKEN + org + project so
// forks / local prod-mode builds don't fail on missing secrets. We read
// `SENTRY_PROJECT_PLATFORM_ADMIN` first (documented in .env.example as
// the platform-admin-specific project slug) and fall back to SENTRY_PROJECT
// for single-project installs. Same "emit → upload → delete" pattern as
// dashboard/vite.config.ts so the shipped bundle never carries .map files.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject =
  process.env.SENTRY_PROJECT_PLATFORM_ADMIN || process.env.SENTRY_PROJECT;

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'production' && sentryAuthToken && sentryOrg && sentryProject
      ? sentryVitePlugin({
          authToken: sentryAuthToken,
          org: sentryOrg,
          project: sentryProject,
          release: process.env.VITE_SENTRY_RELEASE
            ? { name: process.env.VITE_SENTRY_RELEASE }
            : undefined,
          sourcemaps: {
            filesToDeleteAfterUpload: ['./dist/**/*.map'],
          },
          telemetry: false,
        })
      : null,
  ].filter(Boolean),
  base: mode === 'production' ? '/platform/' : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Emit sourcemaps only when we plan to upload them to Sentry. They
    // are deleted post-upload so the shipped bundle still excludes them.
    sourcemap: mode === 'production' && sentryAuthToken ? true : false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5174,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
}));
