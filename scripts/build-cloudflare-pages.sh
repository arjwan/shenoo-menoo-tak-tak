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

# Apply the common native-scroll shell to every exported site page.
# This changes only generated HTML; original page behavior remains testable and
# the runtime activates its rules only for recognized layout structures.
node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const pages = fs.readdirSync('dist').filter(name => name.endsWith('.html')).map(name => path.join('dist',name));
for (const folder of ['developer','school']) {
 const index = path.join('dist', folder, 'index.html');
 if (fs.existsSync(index)) pages.push(index);
}
const css = '<link rel="stylesheet" href="/shinomino-scroll-layout.css?v=20261107-1">';
const js = '<script defer src="/shinomino-scroll-layout.js?v=20261107-1"></script>';
for (const file of pages) {
 let html = fs.readFileSync(file,'utf8');
 if (!/<\/head>/i.test(html) || !/<\/body>/i.test(html)) continue;
 if (!html.includes('shinomino-scroll-layout.css')) html = html.replace(/<\/head>/i, css + '\n</head>');
 if (!html.includes('shinomino-scroll-layout.js')) html = html.replace(/<\/body>/i, js + '\n</body>');
 fs.writeFileSync(file, html);
}
NODE

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
