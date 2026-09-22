'use strict';

const fs = require('fs');
const path = require('path');
const catalog = require('../data/iraqi-curriculum-catalog');
const manifest = require('../data/iraqi-curriculum-files.json');
const index = require('../data/iraqi-curriculum-index.json');

const root = path.resolve(__dirname, '../../..');
const textDirectory = path.resolve(root, 'server/src/data/iraqi-curriculum-text');
const indexedByName = new Map(index.files.map((entry) => [entry.fileName, entry]));

function textPath(entry) {
  if (!entry || !entry.textAvailable || !entry.textPath) return null;
  const location = path.resolve(root, entry.textPath);
  if (!location.startsWith(textDirectory + path.sep) || !fs.existsSync(location)) return null;
  return location;
}

const files = manifest.files.map((file) => {
  const entry = indexedByName.get(file.fileName);
  const verified = entry && entry.sha256 === file.sha256 && entry.driveId === file.driveId;
  const hasText = Boolean(verified && textPath(entry));
  return {
    ...file,
    catalogId: verified ? entry.catalogId : null,
    title: verified ? entry.title : '',
    stage: verified ? entry.stage : '',
    grade: verified ? entry.grade : '',
    subject: verified ? entry.subject : '',
    textAvailable: hasText,
    textUrl: hasText ? `/api/school/curriculum/indexed-text/${encodeURIComponent(file.driveId)}` : '',
    // The PDF bytes are not committed or installed with the server. Link to the
    // verified source page instead of advertising a missing /uploads file.
    url: verified && /^https:\/\/drive\.google\.com\/file\/d\//.test(file.sourceUrl || '') ? file.sourceUrl : ''
  };
});

const linkedByCatalogId = new Map(files.filter((file) => file.catalogId && file.textAvailable).map((file) => [file.catalogId, file]));
const catalogItems = catalog.items.map((item) => {
  const file = linkedByCatalogId.get(item.id);
  if (!file) return item;
  return {
    ...item,
    availability: 'indexed_text',
    indexingStatus: 'نص الكتاب مفهرس ومربوط بالمنهج',
    textAvailable: true,
    textUrl: file.textUrl,
    sourceUrl: file.sourceUrl,
    file: { url: file.url, originalName: file.fileName, mimeType: 'application/pdf', size: file.bytes }
  };
});

function indexedText(driveId) {
  const file = files.find((row) => row.driveId === driveId && row.textAvailable);
  if (!file) return null;
  const entry = indexedByName.get(file.fileName);
  const location = textPath(entry);
  if (!location) return null;
  return { file, text: fs.readFileSync(location, 'utf8') };
}

function teachingSource(grade, subject, lesson) {
  const file = files.find((row) => row.textAvailable && row.grade === grade && row.subject === subject && row.catalogId);
  if (!file) return null;
  const indexed = indexedText(file.driveId);
  if (!indexed) return null;
  const content = indexed.text.replace(/[\u202a-\u202e]/g, '').trim();
  const target = String(lesson || '').trim();
  const at = target.length >= 4 ? content.indexOf(target) : -1;
  const start = at >= 0 ? Math.max(0, at - 350) : 0;
  return { title: file.title, page: '', content: content.slice(start, start + 7000), sourceType: 'official_textbook', year: 2026, sourceUrl: file.sourceUrl };
}

module.exports = { catalog, manifest, index, files, catalogItems, indexedText, teachingSource };
