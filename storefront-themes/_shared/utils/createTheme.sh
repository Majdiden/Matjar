#!/bin/bash
# Usage: ./createTheme.sh <theme-name>
# Creates a new theme by copying the modern theme and updating the name

THEME_NAME=$1
THEME_DIR="$(dirname "$0")/../../$THEME_NAME"

if [ -z "$THEME_NAME" ]; then
  echo "Usage: ./createTheme.sh <theme-name>"
  exit 1
fi

if [ -d "$THEME_DIR" ]; then
  echo "Theme '$THEME_NAME' already exists"
  exit 1
fi

cp -r "$(dirname "$0")/../../modern" "$THEME_DIR"
# Update package name
sed -i '' "s/@matjar\/theme-modern/@matjar\/theme-$THEME_NAME/g" "$THEME_DIR/package.json"

echo "Theme '$THEME_NAME' created at $THEME_DIR"
echo "Customize: tailwind.config.js, src/index.css, src/components/Layout.tsx, src/pages/Home.tsx"
