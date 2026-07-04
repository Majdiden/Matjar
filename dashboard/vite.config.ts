import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'
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
    // Installable PWA + offline tolerance (Sudan: ~90% mobile-only traffic,
    // slow/unreliable networks, periodic internet shutdowns). The dashboard
    // is served under /dashboard/, so every generated URL (SW, manifest,
    // precache, navigateFallback) is base-prefixed to match.
    VitePWA({
      registerType: 'prompt',
      // Custom service worker source (src/sw.ts) so we can host real Web
      // Push handlers (`push` + `notificationclick`) that generateSW can't.
      // The precache + navigation-fallback + runtime-caching that the old
      // generateSW config produced are replicated inside src/sw.ts, so the
      // offline behaviour does not regress.
      strategies: 'injectManifest',
      srcDir: 'src',
      // Source file name in srcDir; the emitted worker is sw.js at the dist
      // ROOT. routes/dashboard.js serves it before the SPA catch-all so the
      // SW installs at scope /dashboard/.
      filename: 'sw.ts',
      // We register + drive the update/offline UX ourselves via the
      // `virtual:pwa-register/react` hook (components/pwa/PwaManager.tsx),
      // so the plugin must NOT also inject its own registration script.
      injectRegister: false,
      manifestFilename: 'manifest.webmanifest',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Matjar',
        short_name: 'Matjar',
        description: 'Run your store from your phone — orders, products and more.',
        lang: 'ar',
        dir: 'rtl',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/dashboard',
        scope: '/dashboard/',
        id: '/dashboard',
        theme_color: '#2563EB',
        background_color: '#F8F7F4',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // injectManifest only controls WHAT gets precached; the navigation
      // fallback + runtime caching now live in src/sw.ts.
      injectManifest: {
        // Precache the built app shell + hashed assets so a cold, offline
        // launch still boots the UI.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Keep the (large, many-chunk) precache from tripping the default 2 MiB cap.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        // Keep the SW OFF in `vite dev` (avoids caching surprises while
        // developing); it is fully exercised in the production build.
        enabled: false,
      },
    }),
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
