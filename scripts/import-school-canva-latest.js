'use strict';

/*
 * Imports the approved Canva school interface into the repository and splits it
 * into the seven standalone school pages it declares itself:
 *
 *   school-index.html       الرئيسية
 *   school-structure.html   الهيكل الدراسي
 *   school-teachers.html    المعلمون والمعلمات
 *   school-students.html    الطلاب والطالبات
 *   school-curriculum.html  مكتبة المناهج
 *   school-reader.html      قارئ الكتاب
 *   school-classroom.html   الصف والحصة
 *
 * Preservation rules (what this script does and does NOT touch):
 *   - The approved export is stored byte-exact (SHA-256 verified) as
 *     original-assets/school-canva/school-canva-latest-20260920.html.
 *   - Its <style> block is copied verbatim into school-app.css and the screen
 *     markup is copied verbatim into each page: the design is never redrawn.
 *   - Canva runtime SDK tags (/_sdk/*.js) are the only removals: they do not
 *     exist in this project and would only add 404s to the console. The
 *     Tailwind and Lucide CDNs the design uses are kept as-is.
 *   - The previous Canva artefacts (school-canva-original.html and
 *     school-canva-update-20260920.html) stay in git untouched.
 *
 * Usage: node scripts/import-school-canva-latest.js [sourceFile]
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DEFAULT = '/home/mohmmedali/Downloads/school-canva-latest-20260920.html';
const STORED = path.join(ROOT, 'original-assets/school-canva/school-canva-latest-20260920.html');
const CSS_OUT = path.join(ROOT, 'school-app.css');

// Fingerprint of the approved export handed over with the task.
const APPROVED = {
  bytes: 51694,
  sha256: '4e158ece50846f1b16471553f2f4da65e7beb3e290fa0b8e9a64da9d0e793bda'
};

const PAGES = [
  { page: 'index', screen: 'screen-index', file: 'school-index.html', title: 'الرئيسية' },
  { page: 'structure', screen: 'screen-collection', file: 'school-structure.html', title: 'الهيكل الدراسي' },
  { page: 'teachers', screen: 'screen-collection', file: 'school-teachers.html', title: 'المعلمون والمعلمات' },
  { page: 'students', screen: 'screen-collection', file: 'school-students.html', title: 'الطلاب والطالبات' },
  { page: 'curriculum', screen: 'screen-collection', file: 'school-curriculum.html', title: 'مكتبة المناهج' },
  { page: 'reader', screen: 'screen-reader', file: 'school-reader.html', title: 'قارئ الكتاب' },
  { page: 'classroom', screen: 'screen-classroom', file: 'school-classroom.html', title: 'الصف والحصة' }
];

// Standalone-only additions appended to the verbatim Canva CSS.
const STANDALONE_CSS = `
/* ---------------------------------------------------------------------------
 * Added by scripts/import-school-canva-latest.js for the standalone pages.
 * Nothing above this line was modified: it is the Canva export CSS verbatim.
 * ------------------------------------------------------------------------- */
.school-standalone-footer{
  border-top:1px solid rgba(20,108,112,.14);background:#fffaf2;padding:1rem 1.25rem 1.6rem;
}
.school-standalone-footer nav{
  display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.6rem;
}
.school-standalone-footer a{
  border:1px solid #cce1db;border-radius:.8rem;padding:.42rem .7rem;font-weight:800;color:#146c70;background:#fff;
}
.school-standalone-footer a[aria-current="page"]{background:#146c70;color:#fff}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.page-shell{min-height:60vh}
@media print{.school-standalone-footer{display:none}}
`;

function fail(message) {
  console.error('FAIL: ' + message);
  process.exit(1);
}

function readSource() {
  const candidate = process.argv[2] || SOURCE_DEFAULT;
  if (fs.existsSync(STORED)) return fs.readFileSync(STORED);
  if (!fs.existsSync(candidate)) fail('approved Canva export not found: ' + candidate);
  return fs.readFileSync(candidate);
}

function verify(bytes) {
  if (bytes.length !== APPROVED.bytes) fail(`approved export byte count changed: ${bytes.length} !== ${APPROVED.bytes}`);
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  if (sha !== APPROVED.sha256) fail(`approved export SHA-256 changed: ${sha}`);
}

function between(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  if (start < 0) fail('missing marker: ' + startMarker);
  const end = html.indexOf(endMarker, start);
  if (end < 0) fail('missing end marker: ' + endMarker);
  return html.slice(start, end);
}


function extractParts(html) {
  const style = between(html, '<style>', '</style>').replace(/^<style>/, '').replace(/<\/style>$/, '');
  const header = between(html, '<header data-template-id="top-header"', '</header>') + '</header>';
  const drawer = between(html, '<div id="drawer-overlay"', '</aside>') + '</aside>';
  const breadcrumb = between(html, '<div class="mb-5 flex flex-wrap', '<section id="screen-index"').trimEnd();
  const screens = {};
  for (const name of ['screen-index', 'screen-collection', 'screen-reader', 'screen-classroom']) {
    const start = html.indexOf('<section id="' + name + '"');
    if (start < 0) fail('missing screen: ' + name);
    let end = html.indexOf('<section id="screen-', start + 10);
    if (end < 0) end = html.indexOf('</main>', start);
    if (end < 0) fail('missing screen end: ' + name);
    screens[name] = html.slice(start, end).trimEnd();
  }
  const reportModal = between(html, '<div id="report-modal"', '<div id="toast"').trimEnd();
  const toast = between(html, '<div id="toast"', '\n  <script>').trimEnd();
  return { style, header, drawer, breadcrumb, screens, reportModal, toast };
}

function markActive(nav, page) {
  let out = nav;
  if (page !== 'index') out = out.replace('class="nav-link is-active" data-page="index"', 'class="nav-link" data-page="index"');
  if (page === 'index') return out;
  const needle = 'class="nav-link" data-page="' + page + '"';
  const at = out.indexOf(needle);
  if (at < 0) fail('nav button not found for page: ' + page);
  return out.slice(0, at) + 'class="nav-link is-active" data-page="' + page + '"' + out.slice(at + needle.length);
}

function standaloneFooter(page) {
  const links = PAGES.map((p) =>
    `<a href="${p.file}"${p.page === page ? ' aria-current="page"' : ''}>${p.title}</a>`).join('');
  return `<footer class="school-standalone-footer" data-template-id="standalone-footer">
  <p class="font-bold text-[#53706f]">صفحات المدرسة المستقلة — كل صفحة تعمل وحدها وترتبط بنفس واجهة المدرسة وبيانات شنو منو المؤكدة.</p>
  <nav aria-label="تنقل صفحات المدرسة المستقلة">${links}<a href="school.html">مدرسة شنو منو (الصفحة السابقة)</a><a href="school-canva.html">تصميم Canva الكامل</a><a href="taktak.html">شنو منو</a></nav>
</footer>`;
}

function buildPage(parts, spec) {
  const screen = parts.screens[spec.screen].replace(' hidden=""', '');
  const header = markActive(parts.header, spec.page);
  const breadcrumb = parts.breadcrumb.replace('id="breadcrumb-current">الرئيسية<', 'id="breadcrumb-current">' + spec.title + '<');
  return `<!doctype html>
<html lang="ar" dir="rtl"><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spec.title} | شنو منو مدرسة</title>
  <script>document.documentElement.dataset.theme=(localStorage.getItem('shno-theme')==='dark'||localStorage.getItem('taktak-theme')==='dark')?'dark':'light';</script>
  <link href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:wght@400;500;600;700;800&amp;family=Fraunces:wght@700;800&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="school-app.css?v=20260920-latest">
  <script src="https://cdn.tailwindcss.com/3.4.17" type="text/javascript"></script>
  <script src="https://cdn.jsdelivr.net/npm/lucide@0.577.0/dist/umd/lucide.min.js" type="text/javascript"></script>
  <script src="auth-guard.js?v=20260913-7"></script>
</head>
<body data-template-id="__page-root" class="w-full" style="background: radial-gradient(rgb(255, 253, 248), rgb(225, 240, 235));">
  <div class="school-shell w-full">
${header}
${parts.drawer}
   <main class="page-shell mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
${breadcrumb}
${screen}
   </main>
  </div>
${parts.reportModal}
${parts.toast}
${standaloneFooter(spec.page)}
  <script>window.__SHNO_SCHOOL_PAGE__=${JSON.stringify(spec.page)};</script>
  <script src="school-api-adapter.js?v=20260920-latest"></script>
  <script src="school-canva-ui.js?v=20260920-latest"></script>
</body></html>
`;
}


function main() {
  const bytes = readSource();
  verify(bytes);
  const html = bytes.toString('utf8');

  fs.mkdirSync(path.dirname(STORED), { recursive: true });
  if (!fs.existsSync(STORED) || !fs.readFileSync(STORED).equals(bytes)) fs.writeFileSync(STORED, bytes);

  const parts = extractParts(html);
  fs.writeFileSync(CSS_OUT, parts.style.trimEnd() + '\n' + STANDALONE_CSS);

  for (const spec of PAGES) {
    const out = path.join(ROOT, spec.file);
    fs.writeFileSync(out, buildPage(parts, spec));
    console.log('wrote ' + spec.file + ' (' + fs.statSync(out).size + ' bytes) — ' + spec.title);
  }

  console.log('PASS: school Canva latest imported — ' + bytes.length + ' bytes, sha256 ' + APPROVED.sha256.slice(0, 16) + '…');
  console.log('PASS: school-app.css written from the approved <style> block verbatim (' + fs.statSync(CSS_OUT).size + ' bytes)');
  console.log('PASS: 7 standalone school pages generated from the approved markup');
}

main();
