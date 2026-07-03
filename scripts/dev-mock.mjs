#!/usr/bin/env node
/**
 * dev-mock.mjs — theme dev with a mock backend (audit 2.6)
 * ────────────────────────────────────────────────────────
 *
 * Boots the standalone storefront mock server
 * (`storefront-themes/_shared/dev/mockServer.mjs`) and then starts
 * `vite dev` for the target theme. The theme's existing vite proxy
 * (`/api` + `/storefront` → http://localhost:3000) points at the mock,
 * so NO vite.config change is needed on any theme.
 *
 * Because the mock listens on the same port the proxy targets (3000 by
 * default), you must stop the real backend first:
 *
 *     lsof -ti tcp:3000 | xargs kill -9
 *
 * The mock is NOT the backend — it has no Mongo/Redis and never touches a
 * database; it only replays static demo fixtures.
 *
 * Usage:
 *   node scripts/dev-mock.mjs <slug>
 *   npm run dev:mock --workspace @matjar/theme-<slug>   (per-theme wrapper)
 *
 * Env:
 *   MOCK_PORT   mock/proxy-target port (default 3000)
 */

import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const THEMES_ROOT = path.join(REPO_ROOT, "storefront-themes");
const MOCK_SERVER = path.join(THEMES_ROOT, "_shared", "dev", "mockServer.mjs");

const slug = (process.argv[2] || process.env.THEME_SLUG || "").replace(/\/+$/, "");
if (!slug) {
  console.error("Usage: node scripts/dev-mock.mjs <slug>");
  process.exit(2);
}
const themeDir = path.join(THEMES_ROOT, path.basename(slug));
if (!fs.existsSync(path.join(themeDir, "package.json"))) {
  console.error(`[dev-mock] no theme at storefront-themes/${slug}`);
  process.exit(2);
}

const MOCK_PORT = process.env.MOCK_PORT || "3000";

// 1. Boot the mock server.
const mock = spawn("node", [MOCK_SERVER], {
  stdio: "inherit",
  env: { ...process.env, THEME_SLUG: path.basename(slug), MOCK_PORT },
});

// 2. Start vite for the theme (its proxy already targets localhost:MOCK_PORT
//    when MOCK_PORT is 3000; otherwise pass VITE_PROXY_TARGET for themes
//    whose config honours it).
const vite = spawn("npx", ["vite"], {
  cwd: themeDir,
  stdio: "inherit",
  env: { ...process.env, VITE_PROXY_TARGET: `http://localhost:${MOCK_PORT}` },
});

function shutdown() {
  for (const child of [mock, vite]) {
    if (child && !child.killed) child.kill("SIGTERM");
  }
}
process.on("SIGINT", () => { shutdown(); process.exit(0); });
process.on("SIGTERM", () => { shutdown(); process.exit(0); });
mock.on("exit", (code) => { if (code) { shutdown(); process.exit(code || 1); } });
vite.on("exit", (code) => { shutdown(); process.exit(code || 0); });
