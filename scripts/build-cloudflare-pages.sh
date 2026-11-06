#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf -- dist
mkdir -p dist
find . -maxdepth 1 -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.svg' -o -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.webp' -o -name '*.ico' -o -name '*.webmanifest' -o -name '*.json' -o -name '*.woff*' \) -exec cp {} dist/ \;
for directory in assets images img css js fonts icons uploads developer school; do
  if [ -d "$directory" ]; then cp -R "$directory" dist/; fi
done
if [ -f _headers ]; then cp _headers dist/; fi

# Publish the verified public Iraqi curriculum metadata as a Pages asset.
# Source is the existing 108-book catalog; do not advertise absent local PDFs.
node <<'NODE'
const fs = require('node:fs');
const catalog = require('./server/src/data/iraqi-curriculum-catalog.js');
const items = catalog.items.map(item => ({
  ...item,
  textAvailable: false,
  textUrl: '',
  file: item.file ? {
    ...item.file,
    url: /^https:\/\/drive\.google\.com\/file\/d\//.test(item.sourceUrl || '') ? item.sourceUrl : ''
  } : null
}));
if (items.length !== catalog.itemCount || items.length !== 108) {
  throw new Error('Curriculum catalog item count mismatch; refusing incomplete Pages build');
}
fs.writeFileSync('dist/school-curriculum-catalog.json', JSON.stringify({
  ok: true, version: catalog.version, items, total: items.length
}));
NODE
