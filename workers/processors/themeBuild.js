/**
 * Theme build processor.
 *
 * Shells out to `scripts/build-themes.sh` for a single theme slug.
 * Used by the dashboard when a merchant first enables a theme or when
 * an admin triggers a rebuild after editing the theme source. Running
 * off the request path matters because a full Vite build is 5-30s.
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../../utils/logger.js";
import { clearThemeCache } from "../../middlewares/storefrontServe.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const SAFE_SLUG = /^[a-z0-9_-]+$/;

export async function processThemeBuild(job) {
  const { themeSlug } = job.data || {};
  if (!themeSlug || !SAFE_SLUG.test(themeSlug)) {
    throw new Error(`Invalid theme slug: ${themeSlug}`);
  }

  const themeDir = path.join(REPO_ROOT, "storefront-themes", themeSlug);
  await new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "build"], {
      cwd: themeDir,
      // Inherit PATH etc. but not any secrets — the build shouldn't
      // need them and passing them here widens blast radius.
      env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`theme build exited ${code}: ${stderr.slice(-500)}`));
    });
  });

  // Invalidate the storefront middleware's dist path cache so the next
  // shopper request picks up the freshly built artifact.
  clearThemeCache();
  logger.info("theme built", { themeSlug, jobId: job.id });
  return { themeSlug };
}
