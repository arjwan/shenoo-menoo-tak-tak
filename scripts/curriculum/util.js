'use strict';

/* Shared helpers for the Iraqi curriculum indexing/OCR pipeline.
 * Checkpoint design: a single JSON file records per-file progress so any
 * interruption can resume without re-processing successful files.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PDF_DIR = path.join(ROOT, 'uploads', 'school-curriculum');
const INDEX_DIR = path.join(PDF_DIR, 'index');
const CHECKPOINT = path.join(INDEX_DIR, 'checkpoint.json');
const TITLES = path.join(INDEX_DIR, 'titles.json');
const OCR_PAGES_DIR = path.join(PDF_DIR, 'ocr-pages');
const TEXT_OUT_DIR = path.join(ROOT, 'server', 'src', 'data', 'iraqi-curriculum-text');
const MANIFEST = path.join(ROOT, 'server', 'src', 'data', 'iraqi-curriculum-files.json');
const INDEX_OUT = path.join(ROOT, 'server', 'src', 'data', 'iraqi-curriculum-index.json');

fs.mkdirSync(INDEX_DIR, { recursive: true });
fs.mkdirSync(OCR_PAGES_DIR, { recursive: true });
fs.mkdirSync(TEXT_OUT_DIR, { recursive: true });

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function saveJson(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file); // atomic-ish: never leave a half-written checkpoint
}

function loadCheckpoint() {
  return loadJson(CHECKPOINT, { version: 1, createdAt: new Date().toISOString(), files: {} });
}

function saveCheckpoint(cp) {
  cp.updatedAt = new Date().toISOString();
  saveJson(CHECKPOINT, cp);
}

function touchFile(cp, fileName, patch) {
  const cur = cp.files[fileName] || {};
  cp.files[fileName] = Object.assign(cur, patch, { updatedAt: new Date().toISOString() });
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      if (err) { err.stderr = stderr; return reject(err); }
      resolve({ stdout, stderr });
    });
  });
}

module.exports = {
  ROOT, PDF_DIR, INDEX_DIR, CHECKPOINT, TITLES, OCR_PAGES_DIR, TEXT_OUT_DIR,
  MANIFEST, INDEX_OUT, loadJson, saveJson, loadCheckpoint, saveCheckpoint, touchFile, run
};
