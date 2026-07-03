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
 *    (with `@matjar/theme-shared` aliased to the workspace package's
 *    source directory) into a temporary ESM file in the OS temp
 *    directory.
 * 3. We dynamic-import that temp file and read its default export.
 *    Because `defineTheme()` / `defineSection()` are pure data
 *    helpers and `universalSections.ts` contains no React/runtime
 *    code, the manifest is fully serializable.
 * 4. We write the result to `dist/manifest.json` (pretty-printed).
 *
 * Usage in a theme's vite.config.ts:
 *
 *   import emitManifest from '@matjar/theme-shared/build/emitManifest.mjs';
 *   export default defineConfig({
 *     plugins: [react(), emitManifest()],
 *     ...
 *   });
 *
 * Assumes the calling theme follows the standard layout:
 *   - entry at `src/theme.manifest.ts`
 *   - `@matjar/theme-shared` resolvable from the theme (npm workspace)
 *   - output at `dist/manifest.json`
 */

import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import crypto from "node:crypto";
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

      // Locate the shared SDK package as the theme resolves it (npm
      // workspace symlink → storefront-themes/_shared). Aliasing the bare
      // package name to the source DIRECTORY lets esbuild path-resolve
      // extensionless deep imports (e.g. `@matjar/theme-shared/theme/
      // defineTheme` → `defineTheme.ts`) without consulting the package's
      // `exports` map, which maps subpaths verbatim (no extension guessing).
      const workspaceRequire = createRequire(path.join(themeRoot, "package.json"));
      let sharedAlias;
      try {
        sharedAlias = path.dirname(
          workspaceRequire.resolve("@matjar/theme-shared/package.json")
        );
      } catch {
        // Fallback for a theme built outside the workspace (legacy layout).
        sharedAlias = path.resolve(themeRoot, "../_shared");
      }
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "matjar-manifest-"));
      const tmpFile = path.join(tmpDir, `manifest-${Date.now()}.mjs`);

      try {
        // Resolve esbuild from the THEME being built, not from _shared/.
        // _shared is never `npm install`ed in CI, but every theme installs
        // vite — which declares esbuild as a direct dependency — so esbuild
        // is always present in the theme's dependency tree. A static
        // top-level `import ... from "esbuild"` resolves against _shared/
        // and dies with ERR_MODULE_NOT_FOUND on a clean checkout (Render).
        const themeRequire = createRequire(path.join(themeRoot, "package.json"));
        let esbuildEntry;
        try {
          esbuildEntry = themeRequire.resolve("esbuild");
        } catch {
          // esbuild not hoisted to the theme root — resolve it through
          // vite, which always has it as a direct dependency.
          esbuildEntry = createRequire(themeRequire.resolve("vite")).resolve("esbuild");
        }
        const { build: esbuild } = await import(pathToFileURL(esbuildEntry).href);

        await esbuild({
          entryPoints: [entryPath],
          bundle: true,
          format: "esm",
          platform: "node",
          target: "node18",
          outfile: tmpFile,
          alias: { "@matjar/theme-shared": sharedAlias },
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

        // Attach build-time metadata so the backend can detect drift
        // between a deployed bundle and its manifest artifact and expose
        // freshness (audit 1.6). `buildHash` is a content hash of the
        // manifest payload itself (excluding the metadata keys so it's
        // stable across rebuilds of identical authored content);
        // `builtAt` is the wall-clock build timestamp.
        const buildHash = crypto
          .createHash("sha256")
          .update(JSON.stringify(manifest))
          .digest("hex")
          .slice(0, 16);
        manifest.buildHash = buildHash;
        manifest.builtAt = new Date().toISOString();

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
