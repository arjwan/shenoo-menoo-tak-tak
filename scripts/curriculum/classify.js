'use strict';

/* Classify every curriculum PDF as "text" (has a real text layer) or
 * "scanned" (images only -> needs OCR). For text PDFs the full text layer is
 * extracted immediately into server/src/data/iraqi-curriculum-text/.
 * Resumable via checkpoint.json — already classified files are skipped.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  PDF_DIR, MANIFEST, TEXT_OUT_DIR, loadJson,
  loadCheckpoint, saveCheckpoint, touchFile, run
} = require('./util');

const TEXT_THRESHOLD_CHARS_PER_PAGE = 50; // below this the "text layer" is noise (scanned)

async function classifyOne(fileName) {
  const pdfPath = path.join(PDF_DIR, fileName);
  const info = await run('pdfinfo', [pdfPath]);
  const pagesMatch = /^Pages:\s+(\d+)/m.exec(info.stdout);
  const pages = pagesMatch ? Number(pagesMatch[1]) : null;

  const textOutName = fileName.replace(/\.pdf$/i, '.txt');
  const textOutPath = path.join(TEXT_OUT_DIR, textOutName);
  let textChars = 0;
  let sampleChars = 0;

  // Fast sample: first 3 + last 1 page(s)
  const sample = await run('pdftotext', ['-f', '1', '-l', String(Math.min(3, pages || 3)), '-enc', 'UTF-8', pdfPath, '-']).catch(() => ({ stdout: '' }));
  sampleChars = (sample.stdout || '').replace(/\s/g, '').length;

  let classification = sampleChars >= 3 * TEXT_THRESHOLD_CHARS_PER_PAGE * 0.3 ? 'text' : 'scanned';

  if (classification === 'text') {
    // Full extraction (also used by the index/school library)
    await run('pdftotext', ['-enc', 'UTF-8', pdfPath, textOutPath]);
    textChars = fs.readFileSync(textOutPath, 'utf8').replace(/\s/g, '').length;
    if (pages && textChars / pages < TEXT_THRESHOLD_CHARS_PER_PAGE * 0.3) {
      classification = 'scanned'; // full pass disagrees with sample
      fs.rmSync(textOutPath, { force: true });
    }
  }

  return { pages, sampleChars, textChars, classification, textPath: classification === 'text' ? path.relative(process.cwd(), textOutPath) : null };
}

async function main() {
  const manifest = loadJson(MANIFEST);
  const cp = loadCheckpoint();
  let done = 0, skipped = 0, failed = 0;

  for (const f of manifest.files) {
    const entry = cp.files[f.fileName];
    if (entry && (entry.classification === 'text' || entry.classification === 'scanned')) { skipped++; continue; }
    try {
      const result = await classifyOne(f.fileName);
      touchFile(cp, f.fileName, {
        sha256Verified: true, bytes: f.bytes, pages: result.pages,
        textLayerChars: result.textChars, sampleChars: result.sampleChars,
        classification: result.classification, textPath: result.textPath,
        status: result.classification === 'text' ? 'text_done' : 'ocr_pending'
      });
      done++;
      if (done % 10 === 0) { saveCheckpoint(cp); console.log(`classified ${done} (+${skipped} skipped)`); }
    } catch (e) {
      failed++;
      touchFile(cp, f.fileName, { status: 'classify_failed', error: String(e).slice(0, 300) });
      console.error(`FAIL ${f.fileName}: ${String(e).slice(0, 160)}`);
    }
  }
  saveCheckpoint(cp);
  const counts = { text: 0, scanned: 0, failed: 0 };
  for (const f of manifest.files) {
    const c = cp.files[f.fileName] && cp.files[f.fileName].classification;
    if (c === 'text') counts.text++; else if (c === 'scanned') counts.scanned++; else counts.failed++;
  }
  console.log(`classification complete: ${JSON.stringify(counts)} (new ${done}, skipped ${skipped}, errors ${failed})`);
}

main().catch(e => { console.error(e); process.exit(1); });
