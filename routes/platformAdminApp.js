import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Path to the built platform-admin SPA (produced by `npm run build:platform-admin`).
// Vite is configured with `base: '/platform/'` in production, so the built
// index.html references `/platform/assets/*` — which is served by the
// `/assets` mount below.
const platformAdminBuildPath = path.join(__dirname, "..", "platform-admin", "dist");

// Serve hashed static assets with long-lived caching. Vite emits content-
// hashed filenames so `immutable` is safe — a rebuild produces new names.
router.use(
  "/assets",
  express.static(path.join(platformAdminBuildPath, "assets"), {
    maxAge: "1y",
    immutable: true,
  })
);

// SPA fallback — every unknown /platform/* URL serves index.html so the
// client-side React Router can take over (e.g. /platform/tenants,
// /platform/login, /platform/queues). We intentionally do NOT gate this
// with any auth middleware: the SPA needs to load so the user can see
// the login page. All privileged data lives behind /api/platform/* which
// enforces JWT + scopes per-request.
router.get("*", (req, res) => {
  res.sendFile(path.join(platformAdminBuildPath, "index.html"), (err) => {
    if (err) {
      logger.error("Error serving platform-admin SPA", { error: err.message });
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Platform Admin Not Available</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%);
                color: #fff;
              }
              .container {
                text-align: center;
                padding: 3rem;
                background: rgba(15, 23, 42, 0.8);
                border-radius: 1rem;
                max-width: 500px;
              }
              code {
                background: rgba(255,255,255,0.1);
                padding: 0.25rem 0.5rem;
                border-radius: 0.25rem;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Platform Admin Not Built</h1>
              <p>Run <code>npm run build:platform-admin</code> to build the SPA.</p>
            </div>
          </body>
        </html>
      `);
    }
  });
});

export default router;
