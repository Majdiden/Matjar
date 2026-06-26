import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Get the dashboard build directory
const dashboardBuildPath = path.join(__dirname, "..", "dashboard", "dist");

// The dashboard SPA shell (index.html + content-hashed JS/CSS) is served
// PUBLICLY and unauthenticated. It carries no tenant data, and a browser
// navigating to the page cannot attach the `Authorization: Bearer` header
// the API requires (the JWT lives in localStorage and is only sent on
// /api calls). Auth is enforced where it matters — every /api route runs
// `authenticate`, and the SPA itself redirects to the login screen when
// no valid token is present. Gating the static shell here previously made
// the dashboard unreachable: a 401 on the very page that performs login.

// Serve dashboard static assets (CSS, JS, images)
router.use(
  "/assets",
  express.static(path.join(dashboardBuildPath, "assets"), {
    maxAge: "1y",
    immutable: true,
  })
);

// Serve dashboard HTML for all dashboard routes (SPA fallback).
// index.html is NOT content-hashed, so it must revalidate on every load —
// otherwise a cached shell keeps referencing stale asset hashes after a
// deploy. The hashed files under /assets stay immutable (cached above).
router.get("*", (req, res) => {
  res.set("Cache-Control", "no-cache");
  res.sendFile(path.join(dashboardBuildPath, "index.html"), (err) => {
    if (err) {
      logger.error("Error serving dashboard", { error: err.message });
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Dashboard Not Available</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                text-align: center;
                padding: 3rem;
                background: white;
                border-radius: 1rem;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                max-width: 500px;
              }
              h1 {
                color: #333;
                margin: 0 0 1rem 0;
                font-size: 2rem;
              }
              p {
                color: #666;
                margin: 0 0 1rem 0;
                line-height: 1.6;
              }
              code {
                background: #f3f4f6;
                padding: 0.25rem 0.5rem;
                border-radius: 0.25rem;
                font-size: 0.9rem;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>📦 Dashboard Not Built</h1>
              <p>The dashboard needs to be built before it can be served in production mode.</p>
              <p>Run this command to build the dashboard:</p>
              <p><code>npm run build:dashboard</code></p>
              <p style="margin-top: 2rem; font-size: 0.9rem;">For development, run the dashboard separately with <code>npm run dev</code> in the dashboard directory.</p>
            </div>
          </body>
        </html>
      `);
    }
  });
});

export default router;
