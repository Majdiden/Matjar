#!/bin/bash
# Build all storefront themes to static dist files
# Usage: bash scripts/build-themes.sh

set -e

THEMES_DIR="$(cd "$(dirname "$0")/../storefront-themes" && pwd)"
THEMES=(modern elegance techhub freshmart starter artisan sportzone bookshelf kidsworld homedecor glowing beauxe nutreko milmaa)

echo "=========================================="
echo "Building ${#THEMES[@]} storefront themes"
echo "=========================================="

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

  # Install deps if needed. Use `npm ci --include=dev` so the build is
  # deterministic (matches the committed lockfile) AND pulls vite /
  # @vitejs/plugin-react, which live in devDependencies — without
  # --include=dev they are skipped under NODE_ENV=production (Render),
  # leaving `npx vite build` to auto-download an unpinned vite or fail.
  if [ ! -d "node_modules" ]; then
    npm ci --include=dev --silent
  fi

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
