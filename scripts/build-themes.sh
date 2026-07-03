#!/bin/bash
# Build all storefront themes to static dist files
# Usage: bash scripts/build-themes.sh
#
# Themes are DISCOVERED by scanning storefront-themes/* (audit 2.3) —
# there is no hand-maintained theme array any more. A directory is a
# theme when it is not a shared/tooling dir (skip names starting with
# `_` or `.`, and the `create-theme` scaffolder) AND it carries the
# minimal theme contract (package.json + src/theme.manifest.ts). This
# means `npm run create-theme` → `bash scripts/build-themes.sh` picks
# the new theme up with zero edits here.
#
# After each successful build the theme's PACKAGE is linted with
# scripts/validate-theme.js (audit 2.5). A validation error FAILS the
# build for that theme.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
THEMES_DIR="$REPO_ROOT/storefront-themes"

# ─── Discover themes ─────────────────────────────────────────────
THEMES=()
for dir in "$THEMES_DIR"/*/; do
  name="$(basename "$dir")"
  # Skip shared/tooling directories and the scaffolder.
  case "$name" in
    _*|.*|create-theme) continue ;;
  esac
  # A real theme has the minimal contract: package.json + manifest entry.
  if [ -f "$dir/package.json" ] && [ -f "$dir/src/theme.manifest.ts" ]; then
    THEMES+=("$name")
  fi
done

echo "=========================================="
echo "Building ${#THEMES[@]} storefront themes (discovered)"
echo "  ${THEMES[*]}"
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
    # Package validation (audit 2.5) — lint the built theme. A validation
    # error fails the build for this theme.
    if node "$REPO_ROOT/scripts/validate-theme.js" "$theme"; then
      echo "✓ $theme built + validated successfully"
    else
      echo "✗ $theme built but FAILED package validation"
      FAILED+=("$theme (validation)")
    fi
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
