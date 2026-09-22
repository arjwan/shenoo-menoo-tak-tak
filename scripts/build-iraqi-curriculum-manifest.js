'use strict';

const fs = require('node:fs');
const path = require('node:path');

const [linksFile, verificationFile, outputFile] = process.argv.slice(2);
if (!linksFile || !verificationFile || !outputFile) {
  console.error('Usage: node scripts/build-iraqi-curriculum-manifest.js <links.tsv> <verification.tsv> <output.json>');
  process.exit(2);
}

const rows = fs.readFileSync(verificationFile, 'utf8').trim().split(/\r?\n/).map(line => {
  const [driveId, bytes, pages, sha256, status] = line.split('\t');
  return [driveId, { driveId, bytes: Number(bytes), pages: Number(pages), sha256, status }];
});
const verified = new Map(rows);
const sources = fs.readFileSync(linksFile, 'utf8').trim().split(/\r?\n/).map(line => {
  const [sourcePage, sourceUrl] = line.split('\t');
  const match = sourceUrl.match(/\/d\/([^/]+)/);
  if (!match) throw new Error(`Unsupported Drive URL: ${sourceUrl}`);
  const driveId = match[1];
  const check = verified.get(driveId);
  if (!check) throw new Error(`Missing verification for ${driveId}`);
  return { sourcePage, sourceUrl, ...check, fileName: `${driveId}.pdf` };
});

const uniqueFiles = [...new Map(sources.map(row => [row.driveId, row])).values()];
if (uniqueFiles.some(row => row.status !== 'ok')) throw new Error('Manifest contains invalid PDFs');

const manifest = {
  schemaVersion: 1,
  catalogVersion: '2026.09.20',
  source: 'https://book.haltaelam.com/',
  generatedAt: new Date().toISOString(),
  sourcePages: sources.length,
  fileCount: uniqueFiles.length,
  totalBytes: uniqueFiles.reduce((sum, row) => sum + row.bytes, 0),
  totalPages: uniqueFiles.reduce((sum, row) => sum + row.pages, 0),
  files: uniqueFiles.sort((a, b) => a.sourcePage.localeCompare(b.sourcePage))
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${manifest.fileCount} verified PDFs (${manifest.totalPages} pages)`);
