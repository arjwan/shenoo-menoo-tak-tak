'use strict';

/* Arabic OCR for scanned curriculum PDFs (tesseract ara).
 *
 * Checkpoint contract (never redo successful work):
 *   - every finished page  -> uploads/school-curriculum/ocr-pages/<id>/page-NNNN.txt
 *   - every finished book  -> status 'ocr_done' in index/checkpoint.json
 *   - final book text      -> server/src/data/iraqi-curriculum-text/<id>.txt
 *
 * Engine: CHUNK-page batched pdftoppm renders (unique per-chunk prefix),
 * pipelined with WORKERS parallel tesseract processes.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  PDF_DIR, OCR_PAGES_DIR, TEXT_OUT_DIR, TITLES, loadJson, MANIFEST,
  loadCheckpoint, saveCheckpoint, touchFile, run
} = require('./util');

const DPI = '200';

/* Language per book (from the scraped Arabic title):
 *   كتب الانكليزي  -> eng+ara  (English body, Arabic instructions)
 *   كتب الفرنسي    -> fra+ara
 *   كل ما عداها     -> ara
 * Books already done with the WRONG language are NOT "successful files" —
 * the queue logic below re-runs only those, in a language-suffixed page
 * directory, keeping the first pass's artifacts untouched. */
const titlesStore = loadJson(TITLES, { books: {} });
function langForBook(fileName) {
  const title = ((titlesStore.books[fileName] || {}).title) || '';
  if (/انكليزي/.test(title)) return 'eng+ara';
  if (/الفرنسي/.test(title)) return 'fra+ara';
  return 'ara';
}
const CHUNK = 20;          // pages per batched render
const WORKERS = 3;         // 2 cores; 3rd worker hides I/O gaps
const TESS_TIMEOUT = Number(process.env.OCR_PAGE_TIMEOUT_MS || 120000);
const RENDER_TIMEOUT = Number(process.env.OCR_RENDER_TIMEOUT_MS || 300000);

async function pdfPages(pdfPath) {
  const info = await run('pdfinfo', [pdfPath]);
  const m = /^Pages:\s+(\d+)/m.exec(info.stdout);
  if (!m) throw new Error('pdfinfo: no Pages');
  return Number(m[1]);
}

async function renderChunk(pdfPath, dir, chunkIdx, pages) {
  const start = pages[0], end = pages[pages.length - 1];
  const prefix = path.join(dir, `_c${chunkIdx}_`);
  // JPEG (quality 88) instead of PNG: ~1s/page of pure PNG-encode CPU saved,
  // zero effect on tesseract accuracy at this dpi.
  await run('pdftoppm', ['-f', String(start), '-l', String(end), '-r', DPI, '-gray', '-jpeg', '-jpegopt', 'quality=88,optimize=y', pdfPath, prefix], { timeout: RENDER_TIMEOUT });
  const made = fs.readdirSync(dir).filter(n => n.startsWith(`_c${chunkIdx}_-`) && n.endsWith('.jpg'));
  const byPage = new Map();
  for (const n of made) {
    const m = /_c\d+_-(\d+)\.jpg$/.exec(n);
    if (m) byPage.set(Number(m[1]), path.join(dir, n));
  }
  return { byPage, start, end };
}

async function ocrImage(imgPath, outFile, lang) {
  try {
    await run('tesseract', [imgPath, outFile.replace(/\.txt$/, ''), '-l', lang, '--psm', '3', '-c', 'preserve_interword_spaces=1'], { timeout: TESS_TIMEOUT });
  } catch (err) {
    // failed/timed-out page: leave an EMPTY txt (retried on a later run)
    fs.writeFileSync(outFile, '');
    throw Object.assign(new Error(`tesseract failed on ${path.basename(imgPath)}: ${String(err).slice(0, 120)}`), { soft: true });
  } finally {
    fs.rmSync(imgPath, { force: true });
  }
}

async function ocrBook(fileName, pages, bookTag, lang) {
  const id = fileName.replace(/\.pdf$/i, '');
  // language-suffixed dir *only* for non-Arabic passes (keeps ara artifacts intact)
  const dir = path.join(OCR_PAGES_DIR, lang === 'ara' ? id : `${id}__${lang.replace('+', '-')}`);
  fs.mkdirSync(dir, { recursive: true });
  const pdfPath = path.join(PDF_DIR, fileName);
  const t0 = Date.now();
  if (lang !== 'ara') console.log(`${bookTag} language=${lang}`);

  const pageOut = p => path.join(dir, `page-${String(p).padStart(4, '0')}.txt`);
  /* _pages.done tracks ATTEMPTED pages (one per line). A picture-only page
   * legitimately yields empty text — it is still "done" and must never be
   * retried. Pages with only an empty txt but no _pages.done entry (legacy
   * crash artifacts) are retried exactly once. */
  const doneLog = path.join(dir, '_pages.done');
  const attempted = new Set();
  if (fs.existsSync(doneLog)) {
    for (const n of fs.readFileSync(doneLog, 'utf8').split('\n')) { const v = Number(n); if (v > 0) attempted.add(v); }
  } else {
    // seed from pre-existing non-empty page txts (earlier engine versions)
    for (let p = 1; p <= pages; p++) {
      if (fs.existsSync(pageOut(p)) && fs.statSync(pageOut(p)).size > 0) {
        attempted.add(p); fs.appendFileSync(doneLog, `${p}\n`);
      }
    }
  }

  const todo = [];
  for (let p = 1; p <= pages; p++) {
    if (!attempted.has(p)) todo.push(p);
    else if (!fs.existsSync(pageOut(p))) fs.writeFileSync(pageOut(p), ''); // normalize
  }
  if (todo.length) console.log(`${bookTag} qpages=${todo.length} first=${todo[0]} last=${todo[todo.length - 1]}`);

  const chunks = [];
  for (let c = 0; c < todo.length; c += CHUNK) chunks.push(todo.slice(c, c + CHUNK));

  // Pipeline: render chunk c+1 while tesseract processes chunk c.
  let rendered = chunks.length ? renderChunk(pdfPath, dir, 0, chunks[0]) : Promise.resolve(null);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = await rendered;
    rendered = (i + 1 < chunks.length) ? renderChunk(pdfPath, dir, i + 1, chunks[i + 1]) : Promise.resolve(null);

    const chunkPages = chunks[i];
    let cursor = 0, softErrors = 0;
    async function worker() {
      while (cursor < chunkPages.length) {
        const p = chunkPages[cursor++];
        const img = chunk.byPage.get(p);
        if (!img) { fs.writeFileSync(pageOut(p), ''); softErrors++; fs.appendFileSync(doneLog, `${p}\n`); continue; }
        try { await ocrImage(img, pageOut(p), lang); } catch (e) { if (!e.soft) throw e; softErrors++; }
        fs.appendFileSync(doneLog, `${p}\n`);
      }
    }
    await Promise.all(Array.from({ length: WORKERS }, worker));
    if (chunk) for (const [, imgPath] of chunk.byPage) fs.rmSync(imgPath, { force: true });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
    const donePages = todo.filter(p => fs.existsSync(pageOut(p)) && fs.statSync(pageOut(p)).size > 0).length;
    console.log(`${bookTag} chunk ${i + 1}/${chunks.length} [pages ${chunk ? chunk.start : '?'}-${chunk ? chunk.end : '?'}] withText=${donePages}/${todo.length} softErr=${softErrors} t=${elapsed}s`);
  }

  // Concatenate in order — every page present, empty ones flagged inline
  const parts = [];
  let emptyPages = 0;
  for (let p = 1; p <= pages; p++) {
    const f = pageOut(p);
    const body = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    if (!body.trim()) emptyPages++;
    parts.push(`\n\n===== صفحة ${p} =====\n` + body);
  }
  const textPath = path.join(TEXT_OUT_DIR, `${id}.txt`);
  fs.writeFileSync(textPath, parts.join('\n'));
  // picture-only pages are a CONTENT property (activity/math books run 10-30%):
  // fail only on near-total extraction failure, always record the honest count.
  if (emptyPages > Math.max(5, pages * 0.6)) throw new Error(`extraction failure: ${emptyPages}/${pages} pages empty`);
  return { textPath, emptyPages, elapsedMs: Date.now() - t0 };
}

async function main() {
  const manifest = loadJson(MANIFEST);
  const cp = loadCheckpoint();
  const scanned = manifest.files.filter(f => {
    const e = cp.files[f.fileName];
    if (!e || e.classification !== 'scanned') return false;
    if (e.status !== 'ocr_done') return true;
    // done books: skip only when processed with the CORRECT language already
    const want = langForBook(f.fileName);
    if (e.ocrLang === want) return false;
    if (e.ocrLang === undefined && want === 'ara') return false; // legacy ara pass, correct lang
    return true; // wrong-language pass -> reprocess with the right one
  });
  console.log(`OCR queue: ${scanned.length} scanned books pending (${scanned.filter(f => langForBook(f.fileName) !== 'ara').length} non-Arabic)`);

  let idx = 0;
  for (const f of scanned) {
    idx++;
    const tag = `[${idx}/${scanned.length}]`;
    const e = cp.files[f.fileName];
    try {
      const pages = e.pages || await pdfPages(path.join(PDF_DIR, f.fileName));
      const lang = langForBook(f.fileName);
      touchFile(cp, f.fileName, { status: 'ocr_running', pages, ocrStartedAt: cp.files[f.fileName].ocrStartedAt || new Date().toISOString() });
      saveCheckpoint(cp);
      const { textPath, emptyPages } = await ocrBook(f.fileName, pages, tag, lang);
      const chars = fs.readFileSync(textPath, 'utf8').replace(/\s/g, '').length;
      touchFile(cp, f.fileName, {
        status: 'ocr_done', pages, ocrChars: chars, emptyPages, ocrLang: lang,
        textPath: path.relative(process.cwd(), textPath), ocrFinishedAt: new Date().toISOString()
      });
      saveCheckpoint(cp);
      console.log(`${tag} OCR OK ${f.fileName} pages=${pages} chars=${chars} empty=${emptyPages}`);
    } catch (err) {
      touchFile(cp, f.fileName, { status: 'ocr_failed', ocrError: String(err).slice(0, 300) });
      saveCheckpoint(cp);
      console.error(`${tag} OCR FAIL ${f.fileName}: ${String(err).slice(0, 200)}`);
    }
  }
  const summary = { ocr_done: 0, ocr_failed: 0, scanned_pending: 0 };
  for (const f of manifest.files) {
    const e = cp.files[f.fileName] || {};
    if (e.status === 'ocr_done') summary.ocr_done++;
    else if (e.status === 'ocr_failed') summary.ocr_failed++;
    else if (e.classification === 'scanned') summary.scanned_pending++;
  }
  console.log(`OCR summary: ${JSON.stringify(summary)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
