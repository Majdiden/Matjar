import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Get the dashboard build directory
const dashboardBuildPath = path.join(__dirname, "..", "dashboard", "dist");

// All dashboard routes require authentication AND a merchant role.
// A customer token must not load the dashboard SPA — that shell ships
// admin UI code and fetches admin endpoints, so gate at the shell.
router.use(authenticate, requirePermission("dashboard.read"));

// Serve dashboard static assets (CSS, JS, images)
router.use(
  "/assets",
  express.static(path.join(dashboardBuildPath, "assets"), {
    maxAge: "1y",
    immutable: true,
  })
);

// Serve dashboard HTML for all dashboard routes (SPA fallback)
router.get("*", (req, res) => {
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
