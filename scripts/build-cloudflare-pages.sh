#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf -- dist
mkdir -p dist
find . -maxdepth 1 -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.svg' -o -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.webp' -o -name '*.ico' -o -name '*.webmanifest' -o -name '*.json' -o -name '*.woff*' \) -exec cp {} dist/ \;
for directory in assets images img css js fonts icons uploads developer; do
  if [ -d "$directory" ]; then cp -R "$directory" dist/; fi
done
if [ -f _headers ]; then cp _headers dist/; fi
