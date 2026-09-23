'use strict';
// Report curriculum index state. Prefer logs/curriculum-match.json; fall back to
// server/src/data/iraqi-curriculum-match.json (shipped with deploy bundle).
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
const candidates = [
  path.join(root, 'logs/curriculum-match.json'),
  path.join(root, 'server/src/data/iraqi-curriculum-match.json')
];
const matchFile = candidates.find((p) => fs.existsSync(p));
if (!matchFile) {
  console.error('Missing curriculum-match.json — run mapping first');
  process.exit(1);
}
const match = JSON.parse(fs.readFileSync(matchFile, 'utf8'));
console.log('Match file:', path.relative(root, matchFile));
console.log('Match stats:', match.stats || match);
const catalog = require(path.join(root, 'server/src/data/iraqi-curriculum-catalog'));
const available = typeof catalog.availableItems === 'function' ? catalog.availableItems().length : catalog.items.filter((i) => i.verified).length;
console.log('Catalog available:', available);
const dir = path.join(root, 'uploads/school-curriculum');
const pdfs = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.pdf')).length : 0;
console.log('PDFs on disk:', pdfs);
