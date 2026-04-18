import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'

// Sentry source-map upload is gated on SENTRY_AUTH_TOKEN so forks /
// local prod-mode builds don't fail on a missing token. When the token
// is present we build WITH sourcemaps and upload them to Sentry, then
// the plugin strips them from the emitted bundle (see `sourcemaps.filesToDeleteAfterUpload`)
// so we never ship .map files to the browser.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN
const sentryOrg = process.env.SENTRY_ORG
const sentryProject = process.env.SENTRY_PROJECT

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Only active in production builds AND when credentials are present.
    // In any other case (dev, CI without secrets) this is a no-op.
    mode === 'production' && sentryAuthToken && sentryOrg && sentryProject
      ? sentryVitePlugin({
          authToken: sentryAuthToken,
          org: sentryOrg,
          project: sentryProject,
          release: process.env.VITE_SENTRY_RELEASE
            ? { name: process.env.VITE_SENTRY_RELEASE }
            : undefined,
          sourcemaps: {
            // Upload then delete so .map files are not served to browsers.
            filesToDeleteAfterUpload: ['./dist/**/*.map'],
          },
          telemetry: false,
        })
      : null,
  ].filter(Boolean),
  base: mode === 'production' ? '/dashboard/' : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Emit sourcemaps only when we plan to upload them to Sentry. They
    // are deleted post-upload so the shipped bundle still excludes them.
    sourcemap: mode === 'production' && sentryAuthToken ? true : false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // Allow access from any host (needed for subdomain testing)
    port: 5173,
    strictPort: false,
    proxy: {
      // Proxy API requests to backend in development
      '/api': {
        target: 'http://localhost:3000',
        // Keep the original Host header (e.g. "tech-hubs.localhost:5173")
        // so the backend's host-based tenant resolver picks the right
        // tenant. Rewriting it to "localhost:3000" triggers the bare-
        // localhost dev fallback that always returns the oldest tenant.
        changeOrigin: false,
      },
      // Proxy uploaded asset paths (e.g. payment-provider logos stored at
      // /uploads/logo/...) so the dashboard can render them inline during
      // development. In production these URLs are served by the backend
      // on the same origin as the dashboard.
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
}))
