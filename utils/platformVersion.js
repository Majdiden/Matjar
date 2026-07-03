/**
 * Platform version
 * ────────────────
 *
 * The current Matjar platform version, single-sourced from the root
 * `package.json`. A theme manifest may declare `minPlatformVersion`
 * (audit 2.4/2.5); the package linter (`scripts/validate-theme.js`)
 * checks it against this value so a theme that needs a newer platform
 * fails the build instead of silently mis-rendering at runtime.
 *
 * Kept dependency-free (no config/env import) so the CLI validator can
 * pull it in without booting the backend.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_PKG = path.resolve(__dirname, "..", "package.json");

let version = "1.0.0";
try {
  const pkg = JSON.parse(fs.readFileSync(ROOT_PKG, "utf8"));
  if (pkg && typeof pkg.version === "string" && pkg.version.trim()) {
    version = pkg.version.trim();
  }
} catch {
  // Fall back to the default above — a missing/broken package.json must
  // not take down anything that imports the platform version.
}

export const PLATFORM_VERSION = version;

/**
 * Compare two dotted semver-ish version strings (e.g. "1.2.0").
 * Returns -1 if a<b, 0 if equal, 1 if a>b. Missing segments count as 0.
 * Non-numeric segments are treated as 0 (best-effort — theme manifests
 * are first-party and expected to use plain numeric versions).
 */
export function compareVersions(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/**
 * True when the running platform satisfies a theme's declared
 * `minPlatformVersion` (i.e. PLATFORM_VERSION >= min).
 */
export function platformSatisfies(minVersion) {
  if (!minVersion || typeof minVersion !== "string") return true;
  return compareVersions(PLATFORM_VERSION, minVersion) >= 0;
}
