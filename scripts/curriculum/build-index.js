'use strict';

/* Build the complete Iraqi curriculum index:
 *   manifest (136 verified PDFs) × scraped Arabic titles × classification × OCR status
 * Joins files to the versioned catalog (iraqi-curriculum-catalog.js) by
 * normalized (grade, subject). Emits:
 *   server/src/data/iraqi-curriculum-index.json  (machine index)
 *   server/src/data/iraqi-curriculum-report.md   (human report, Arabic)
 * Read-only over existing data files — never mutates the versioned catalog.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT, TITLES, MANIFEST, INDEX_OUT, loadJson, loadCheckpoint, TEXT_OUT_DIR
} = require('./util');

/* ---- Arabic normalization ---- */
const norm = s => String(s || '')
  .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[\u064B-\u0652]/g, '') // tashkeel
  .replace(/[^\u0600-\u06FFa-zA-Z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ').trim();

const GRADE_CANON = [
  [/الاول ابتدائي/, 'الأول ابتدائي'], [/الثاني ابتدائي/, 'الثاني ابتدائي'],
  [/الثالث ابتدائي/, 'الثالث ابتدائي'], [/الرابع ابتدائي/, 'الرابع ابتدائي'],
  [/الخامس ابتدائي/, 'الخامس ابتدائي'], [/السادس ابتدائي/, 'السادس ابتدائي'],
  [/الاول متوسط/, 'الأول متوسط'], [/الثاني متوسط/, 'الثاني متوسط'], [/الثالث متوسط/, 'الثالث متوسط'],
  [/الرابع علمي/, 'الرابع العلمي'], [/الخامس علمي/, 'الخامس العلمي'], [/السادس علمي/, 'السادس العلمي'],
  [/الرابع ادبي/, 'الرابع الأدبي'], [/الخامس ادبي/, 'الخامس الأدبي'], [/السادس ادبي/, 'السادس الأدبي']
];

const SUBJECT_CANON = [
  [/قراءه|قواعد|املاء/, 'القراءة'],
  [/اخلاقيه|اسلاميه/, 'التربية الإسلامية'],
  [/رياضيات|حساب/, 'الرياضيات'],
  [/علوم/, 'العلوم'],
  [/نشاط انكليزي|انكليزي نشاط/, 'اللغة الإنكليزية (نشاط)'],
  [/انكليزي|إنكليزي/, 'اللغة الإنكليزية'],
  [/عربي|لغه عربيه/, 'اللغة العربية'],
  [/اجتماعيات/, 'الاجتماعيات'],
  [/احياء/, 'الأحياء'],
  [/فيزياء/, 'الفيزياء'],
  [/كيمياء/, 'الكيمياء'],
  [/حاسوب/, 'الحاسوب'],
  [/تاريخ/, 'التاريخ'],
  [/جغرافيه/, 'الجغرافية'],
  [/علم اجتماع/, 'علم الاجتماع'],
  [/(^| )الاجتماع( |$)/, 'علم الاجتماع'], // "كتاب الاجتماع الرابع/السادس ادبي" — نفس مادة علم الاجتماع
  [/اقتصاد/, 'الاقتصاد'],
  [/فلسفه|علم نفس/, 'الفلسفة وعلم النفس']
];

function parseTitle(title) {
  const n = norm(title);
  const gradeHit = GRADE_CANON.find(([re]) => re.test(n));
  const subjectHit = SUBJECT_CANON.find(([re]) => re.test(n));
  return {
    canonicalGrade: gradeHit ? gradeHit[1] : null,
    canonicalSubject: subjectHit ? subjectHit[1] : null
  };
}

/* ---- Load catalog robustly (CommonJS module) ---- */
const catalog = require('../../server/src/data/iraqi-curriculum-catalog');

function main() {
  const manifest = loadJson(MANIFEST);
  const titles = loadJson(TITLES, { books: {} });
  const cp = loadCheckpoint();

  // Catalog lookup by (grade, subject)
  const byKey = new Map();
  for (const item of catalog.items) byKey.set(`${item.grade}::${item.subject}`, item);

  const files = manifest.files.map(f => {
    const t = (titles.books[f.fileName] || {}).title || null;
    const parsed = parseTitle(t);
    const entry = cp.files[f.fileName] || {};
    let catalogItem = null;
    if (parsed.canonicalGrade && parsed.canonicalSubject) {
      catalogItem = byKey.get(`${parsed.canonicalGrade}::${parsed.canonicalSubject}`) || null;
      // Activity books map onto the same (grade, subject) — only claim the slot when free
      if (catalogItem && /نشاط/.test(parsed.canonicalSubject)) catalogItem = null;
    }
    const textAvailable = entry.status === 'text_done' || entry.status === 'ocr_done';
    return {
      fileName: f.fileName, driveId: f.driveId, sourcePage: f.sourcePage,
      title: t, grade: parsed.canonicalGrade, subject: parsed.canonicalSubject,
      catalogId: catalogItem ? catalogItem.id : null,
      catalogTitle: catalogItem ? catalogItem.title : null,
      pages: entry.pages ?? f.pages ?? null, bytes: f.bytes, sha256: f.sha256,
      classification: entry.classification || 'unknown',
      status: entry.status || 'unknown',
      textChars: entry.textChars ?? entry.ocrChars ?? 0,
      textPath: entry.textPath ? path.relative(ROOT, entry.textPath) : null,
      textAvailable: Boolean(textAvailable && entry.textPath)
    };
  });

  // Coverage of the versioned catalog
  const coveredIds = new Set(files.filter(x => x.catalogId).map(x => x.catalogId));
  const uncovered = catalog.items.filter(i => !coveredIds.has(i.id));
  const extras = files.filter(x => !x.catalogId);

  const stats = {
    filesTotal: files.length,
    textNative: files.filter(x => x.classification === 'text').length,
    scanned: files.filter(x => x.classification === 'scanned').length,
    ocrDone: files.filter(x => x.status === 'ocr_done').length,
    ocrFailed: files.filter(x => x.status === 'ocr_failed').length,
    ocrPending: files.filter(x => x.classification === 'scanned' && x.status !== 'ocr_done' && x.status !== 'ocr_failed').length,
    textAvailable: files.filter(x => x.textAvailable).length,
    totalPages: files.reduce((a, x) => a + (x.pages || 0), 0),
    catalogItems: catalog.items.length,
    catalogCovered: coveredIds.size,
    catalogPending: uncovered.length,
    extraFiles: extras.length
  };

  const index = {
    schemaVersion: 1,
    catalogVersion: catalog.version,
    generatedAt: new Date().toISOString(),
    source: manifest.source,
    stats,
    files,
    catalogPending: uncovered.map(i => ({ id: i.id, title: i.title, grade: i.grade, subject: i.subject })),
    extraFiles: extras.map(x => ({ fileName: x.fileName, title: x.title, pages: x.pages, status: x.status }))
  };
  fs.writeFileSync(INDEX_OUT, JSON.stringify(index, null, 2));

  /* ---- Arabic markdown report ---- */
  const R = [];
  R.push('# تقرير فهرسة مناهج المدرسة العراقية', '');
  R.push(`- التاريخ: ${index.generatedAt}`);
  R.push(`- المصدر: ${manifest.source} (روابط Google Drive موثقة بـ SHA-256)`);
  R.push(`- إجمالي الملفات: **${stats.filesTotal}** — إجمالي الصفحات: **${stats.totalPages}**`, '');
  R.push('## ملخص الحالة', '');
  R.push('| البند | العدد |', '|---|---|');
  R.push(`| PDFs بطبقة نص أصلية | ${stats.textNative} |`);
  R.push(`| PDFs مصوّرة (تحتاج OCR) | ${stats.scanned} |`);
  R.push(`| OCR مكتمل | ${stats.ocrDone} |`);
  R.push(`| OCR فشل | ${stats.ocrFailed} |`);
  R.push(`| OCR متبقٍ | ${stats.ocrPending} |`);
  R.push(`| كتب لها نص قابل للقراءة الآن | ${stats.textAvailable} |`);
  R.push(`| مواد الفهرس الرسمي (106) مغطاة بملف | ${stats.catalogCovered} |`);
  R.push(`| مواد رسمية بلا ملف (source_pending حقيقي) | ${stats.catalogPending} |`);
  R.push(`| ملفات إضافية خارج الفهرس الرسمي | ${stats.extraFiles} |`, '');

  R.push('## الكتب المصوّرة (OCR)', '');
  R.push('| الكتاب | الصفحات | حالة OCR | الأحرف |', '|---|---|---|---|');
  for (const x of files.filter(f => f.classification === 'scanned'))
    R.push(`| ${x.title || x.fileName} | ${x.pages ?? '?'} | ${x.status === 'ocr_done' ? '✅ مكتمل' : x.status === 'ocr_failed' ? '❌ فشل' : '⏳ قيد الانتظار'} | ${x.textChars || 0} |`);
  R.push('');
  R.push('## مواد الفهرس الرسمي بلا ملف مصدر (source_pending)', '');
  if (!uncovered.length) R.push('لا شيء — التغطية كاملة.');
  else { R.push('| المادة | الصف |', '|---|---|'); for (const i of uncovered) R.push(`| ${i.subject} | ${i.grade} |`); }
  R.push('');
  R.push('## ملفات إضافية غير مرتبطة بمادة رسمية', '');
  R.push('| الملف | العنوان المستخرج | الحالة |', '|---|---|---|');
  for (const x of extras) R.push(`| ${x.fileName} | ${x.title || '—'} | ${x.status} |`);
  R.push('');
  fs.writeFileSync(path.join(ROOT, 'server', 'src', 'data', 'iraqi-curriculum-report.md'), R.join('\n'));

  console.log('index written:', INDEX_OUT);
  console.log('stats:', JSON.stringify(stats));
}

main();
