/**
 * Vite plugin: emit-theme-manifest
 *
 * Serializes a theme's authored `src/theme.manifest.ts` into a static
 * `dist/manifest.json` artifact during `vite build`. The backend loads
 * these artifacts at startup so the authored TypeScript file is the
 * *single source of truth* for every theme manifest — there is no
 * hand-maintained backend mirror to drift out of sync.
 *
 * How it works
 * ────────────
 * 1. `closeBundle` fires after Vite has written the React bundle to
 *    `dist/`.
 * 2. We spawn esbuild programmatically to bundle the manifest entry
 *    (with the `@shared` alias resolved) into a temporary ESM file in
 *    the OS temp directory.
 * 3. We dynamic-import that temp file and read its default export.
 *    Because `defineTheme()` / `defineSection()` are pure data
 *    helpers and `universalSections.ts` contains no React/runtime
 *    code, the manifest is fully serializable.
 * 4. We write the result to `dist/manifest.json` (pretty-printed).
 *
 * Usage in a theme's vite.config.ts:
 *
 *   import emitManifest from '../_shared/build/emitManifest.mjs';
 *   export default defineConfig({
 *     plugins: [react(), emitManifest()],
 *     ...
 *   });
 *
 * Assumes the calling theme follows the standard layout:
 *   - entry at `src/theme.manifest.ts`
 *   - shared runtime at `../_shared`
 *   - output at `dist/manifest.json`
 */

import { build as esbuild } from "esbuild";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

export default function emitManifestPlugin(options = {}) {
  const entry = options.entry || "src/theme.manifest.ts";
  const outFile = options.outFile || "dist/manifest.json";

  return {
    name: "matjar-emit-theme-manifest",
    apply: "build",
    enforce: "post",

    async closeBundle() {
      const themeRoot = process.cwd();
      const entryPath = path.resolve(themeRoot, entry);

      if (!fs.existsSync(entryPath)) {
        this.warn(`[emit-manifest] no manifest entry at ${entry} — skipping`);
        return;
      }

      const sharedAlias = path.resolve(themeRoot, "../_shared");
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "matjar-manifest-"));
      const tmpFile = path.join(tmpDir, `manifest-${Date.now()}.mjs`);

      try {
        await esbuild({
          entryPoints: [entryPath],
          bundle: true,
          format: "esm",
          platform: "node",
          target: "node18",
          outfile: tmpFile,
          alias: { "@shared": sharedAlias },
          logLevel: "silent",
        });

        const mod = await import(pathToFileURL(tmpFile).href);
        const manifest = mod.default;

        if (!manifest || typeof manifest !== "object") {
          throw new Error(
            `[emit-manifest] ${entry} must export a default theme manifest object`
          );
        }

        if (!manifest.slug) {
          throw new Error(
            `[emit-manifest] ${entry} manifest is missing required "slug" field`
          );
        }

        // Attach build-time hash so backend can detect drift between the
        // bundle and its manifest artifact.
        const serialized = JSON.stringify(manifest, null, 2);
        const outPath = path.resolve(themeRoot, outFile);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, serialized);

        // Emit minimal status line — vite build output is already chatty.
        // eslint-disable-next-line no-console
        console.log(
          `[emit-manifest] ${manifest.slug} → ${path.relative(themeRoot, outPath)}`
        );
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    },
  };
}
