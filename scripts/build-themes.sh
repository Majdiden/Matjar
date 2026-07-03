#!/bin/bash
# Build all storefront themes to static dist files
# Usage: bash scripts/build-themes.sh

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
THEMES_DIR="$REPO_ROOT/storefront-themes"
THEMES=(modern elegance techhub freshmart starter artisan sportzone bookshelf kidsworld homedecor glowing beauxe nutreko milmaa aurum)

echo "=========================================="
echo "Building ${#THEMES[@]} storefront themes"
echo "=========================================="

# Install ONCE at the repo root: npm workspaces hoist every theme's
# dependencies (plus @matjar/theme-shared) into the root node_modules
# against the single root lockfile — there are no per-theme lockfiles
# any more. Use `npm ci --include=dev` so the build is deterministic
# AND pulls vite / @vitejs/plugin-react, which live in devDependencies —
# without --include=dev they are skipped under NODE_ENV=production
# (Render), leaving `npx vite build` to auto-download an unpinned vite
# or fail.
if [ ! -d "$REPO_ROOT/node_modules" ]; then
  echo ""
  echo "▸ Installing workspace dependencies (npm ci at repo root)..."
  (cd "$REPO_ROOT" && npm ci --include=dev --silent)
fi

FAILED=()

for theme in "${THEMES[@]}"; do
  THEME_DIR="$THEMES_DIR/$theme"

  if [ ! -d "$THEME_DIR" ]; then
    echo "⚠ Skipping $theme (directory not found)"
    continue
  fi

  echo ""
  echo "▸ Building $theme..."

  cd "$THEME_DIR"

  # Build. Capture vite's REAL exit code via PIPESTATUS — piping straight
  # into `if ... | tail` masks a failed build behind tail's exit 0, which
  # mislabels a hard build error (e.g. ERR_MODULE_NOT_FOUND) as the more
  # confusing "manifest missing".
  npx vite build 2>&1 | tail -8
  BUILD_RC=${PIPESTATUS[0]}
  if [ "$BUILD_RC" -ne 0 ]; then
    echo "✗ $theme FAILED (vite build exited $BUILD_RC)"
    FAILED+=("$theme")
  elif [ ! -f "$THEME_DIR/dist/manifest.json" ]; then
    # Every theme must emit dist/manifest.json (the backend manifest registry
    # loads these files at startup — missing artifact == broken theme).
    echo "✗ $theme built but dist/manifest.json is missing"
    FAILED+=("$theme (no manifest.json)")
  else
    echo "✓ $theme built successfully"
  fi
done

echo ""
echo "=========================================="
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "✅ All ${#THEMES[@]} themes built successfully"
else
  echo "❌ ${#FAILED[@]} theme(s) failed: ${FAILED[*]}"
  exit 1
fi
echo "=========================================="
