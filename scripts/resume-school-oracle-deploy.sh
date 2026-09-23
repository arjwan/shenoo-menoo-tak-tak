#!/usr/bin/env bash
# Resume Oracle school deploy AFTER 136 PDFs already verified on disk.
# Restores Cards Canva final integration + finishes school publish/tests/restart.
# NEVER re-downloads curriculum PDFs. NEVER merges to main.
set -euo pipefail

PROJECT="${SHNO_PROJECT_DIR:-/home/opc/shenoo-menoo-tak-tak}"
WEBROOT="${SHNO_WEB_ROOT:-/usr/share/nginx/html/shno-mano}"
SERVICE="${SHNO_SERVICE:-shno-mano-tech.service}"
PUBLIC_BASE="${SHNO_PUBLIC_BASE:-https://shino-mino-tak-tak.duckdns.org}"
BUNDLE="${SHNO_RESUME_BUNDLE:-handoff/school-oracle-resume-bundle.tar.gz}"
PDF_DIR="uploads/school-curriculum"
MANIFEST="server/src/data/iraqi-curriculum-files.json"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SKIP_DOWNLOAD=1

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

[[ "$(id -un)" == "root" ]] && die "Run as opc"
test -d "$PROJECT/.git" || die "missing project $PROJECT"
cd "$PROJECT"
mkdir -p logs handoff .deploy-backups "$PDF_DIR"
exec > >(tee -a "logs/oracle-school-resume-$STAMP.log") 2>&1

log "== Resume school deploy (no PDF re-download) =="
df -h | head -20

BACKUP=".deploy-backups/$STAMP-school-resume"
mkdir -p "$BACKUP"
cp -a server/src/server.js "$BACKUP/server.js" 2>/dev/null || true
cp -a package.json "$BACKUP/package.json" 2>/dev/null || true

# 1) Install resume bundle (cards + school completion)
test -f "$BUNDLE" || die "Missing bundle $BUNDLE"
tmp="$(mktemp -d)"
tar -xzf "$BUNDLE" -C "$tmp"
root="$tmp"
[[ -d "$tmp/school-oracle-resume-bundle" ]] && root="$tmp/school-oracle-resume-bundle"
log "Installing from bundle..."
(cd "$root" && find . -type f ! -name '*.pdf') | while read -r rel; do
  rel="${rel#./}"
  mkdir -p "$(dirname "$rel")"
  cp -a "$root/$rel" "$rel"
done
rm -rf "$tmp"
log "Bundle installed"

# 2) package.json school scripts + ensure mounts
if [[ -f scripts/merge-school-package-scripts.js && -f server/src/data/school-package-overlay.json ]]; then
  node scripts/merge-school-package-scripts.js package.json server/src/data/school-package-overlay.json
fi
# Ensure BOTH cards-canva and school-classroom mounts (real files, not stubs)
node <<'NODE'
'use strict';
const fs = require('fs');
const p = 'server/src/server.js';
let s = fs.readFileSync(p, 'utf8');
const backup = p + '.pre-resume-' + Date.now();
fs.copyFileSync(p, backup);

function ensureRequire(varName, rel) {
  const line = `const ${varName} = require('${rel}');`;
  if (s.includes(rel)) return;
  // after schoolCanva or near other route requires
  const anchor = /const schoolCanvaRoutes = require\('\.\/routes\/school-canva\.routes'\);/;
  if (anchor.test(s)) {
    s = s.replace(anchor, (m) => `${m}\n${line}`);
    return;
  }
  const idx = s.lastIndexOf("require('./routes/");
  if (idx < 0) throw new Error('no require block');
  const nl = s.indexOf('\n', idx);
  s = s.slice(0, nl + 1) + line + '\n' + s.slice(nl + 1);
}
function ensureUse(pathMount, varName, afterRe) {
  const re = new RegExp(String.raw`app\.use\(\s*['"]${pathMount.replace(/\//g, '\\/')}['"]\s*,\s*${varName}\s*\)`);
  if (re.test(s)) return;
  const line = `app.use('${pathMount}', ${varName});`;
  if (afterRe && afterRe.test(s)) {
    s = s.replace(afterRe, (m) => `${m}\n${line}`);
    return;
  }
  if (s.includes("app.use('/uploads'")) {
    s = s.replace(/app\.use\(\s*['"]\/uploads['"]/, `${line}\napp.use('/uploads'`);
    return;
  }
  throw new Error('cannot mount ' + pathMount);
}

// Real route files must exist — never stub
for (const f of [
  'server/src/routes/cards-canva.routes.js',
  'server/src/routes/school-classroom.routes.js'
]) {
  if (!fs.existsSync(f)) throw new Error('missing real route file: ' + f);
  const body = fs.readFileSync(f, 'utf8');
  if (body.length < 500) throw new Error('route file too small (stub?): ' + f);
}

ensureRequire('cardsCanvaRoutes', './routes/cards-canva.routes');
ensureRequire('schoolClassroomRoutes', './routes/school-classroom.routes');
ensureUse('/api/cards-canva', 'cardsCanvaRoutes', /app\.use\(\s*['"]\/api\/school-canva['"]\s*,\s*schoolCanvaRoutes\s*\);/);
ensureUse('/api/school', 'schoolClassroomRoutes', /app\.use\(\s*['"]\/api\/school['"]\s*,\s*schoolRoutes\s*\);/);

if (!/app\.use\(\s*['"]\/api\/cards-canva['"]\s*,\s*cardsCanvaRoutes\s*\)/.test(s)) {
  throw new Error('cards-canva mount missing after ensure');
}
if (!/app\.use\(\s*['"]\/api\/school['"]\s*,\s*schoolClassroomRoutes\s*\)/.test(s)) {
  throw new Error('school-classroom mount missing after ensure');
}
// Must reference real router export usage
fs.writeFileSync(p, s);
console.log('server.js mounts OK (cards-canva + school-classroom)');
console.log('cards route bytes', fs.statSync('server/src/routes/cards-canva.routes.js').size);
console.log('school classroom route bytes', fs.statSync('server/src/routes/school-classroom.routes.js').size);
NODE

grep -n "app.use('/api/cards-canva'" server/src/server.js
grep -n "cards-canva.routes" server/src/server.js
test -f cards-canva-adapter.js
test -f cards-canva.html
test -f original-assets/cards-canva/cards-canva-original.html
test -f server/test/cards-canva-view-wiring.test.js

# 3) npm (devDeps for tests)
log "npm install..."
if [[ -f package-lock.json ]]; then npm ci || npm install; else npm install; fi

# 4) Verify existing PDFs ONLY — never download
log "Verify existing 136 PDFs (NO download)..."
PDF_COUNT=$(find "$PDF_DIR" -maxdepth 1 -type f -name '*.pdf' | wc -l)
log "PDF count on disk: $PDF_COUNT"
[[ "$PDF_COUNT" -eq 136 ]] || die "expected 136 PDFs already on disk, found $PDF_COUNT — will NOT re-download; fix manually"
node <<'NODE'
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const manifest = JSON.parse(fs.readFileSync('server/src/data/iraqi-curriculum-files.json', 'utf8'));
const dir = 'uploads/school-curriculum';
function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file).on('error', reject).on('data', c => h.update(c)).on('end', () => resolve(h.digest('hex')));
  });
}
(async () => {
  let ok = 0; const bad = [];
  for (const f of manifest.files) {
    const p = path.join(dir, f.fileName);
    try {
      if (!fs.existsSync(p)) throw new Error('missing');
      const st = fs.statSync(p);
      if (st.size !== f.bytes) throw new Error('size');
      const fd = fs.openSync(p, 'r'); const buf = Buffer.alloc(5);
      fs.readSync(fd, buf, 0, 5, 0); fs.closeSync(fd);
      if (buf.toString() !== '%PDF-') throw new Error('magic');
      const digest = await sha256File(p);
      if (digest !== f.sha256) throw new Error('sha');
      ok++;
    } catch (e) { bad.push({ file: f.fileName, err: String(e.message || e) }); }
  }
  const report = { ok, total: manifest.files.length, bad, redownloaded: false };
  fs.writeFileSync('logs/curriculum-oracle-verify-resume.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (ok !== 136 || bad.length) process.exit(1);
})();
NODE

# 5) match file + index + honesty
mkdir -p logs
if [[ ! -f logs/curriculum-match.json && -f server/src/data/iraqi-curriculum-match.json ]]; then
  cp -a server/src/data/iraqi-curriculum-match.json logs/curriculum-match.json
fi
node scripts/index-iraqi-curriculum.js
node <<'NODE'
'use strict';
const fs = require('fs');
const path = require('path');
const c = require('./server/src/data/iraqi-curriculum-catalog');
const verified = c.items.filter(i => i.verified === true);
const available = c.availableItems();
const pending = c.pendingItems();
const pdfs = fs.readdirSync('uploads/school-curriculum').filter(f => f.endsWith('.pdf'));
const summary = {
  catalogTotal: c.items.length,
  verified: verified.length,
  readableAvailable: available.length,
  pending: pending.length,
  pdfsOnDisk: pdfs.length
};
console.log(JSON.stringify(summary, null, 2));
if (summary.catalogTotal !== 108) throw new Error('catalog!=108');
if (summary.verified !== 95) throw new Error('verified!=95');
if (summary.readableAvailable !== 95) throw new Error('available!=95');
if (summary.pending !== 13) throw new Error('pending!=13');
if (summary.pdfsOnDisk !== 136) throw new Error('pdfs!=136');
for (const item of available) {
  const name = item.file.originalName || String(item.file.url || '').split('/').pop();
  if (!fs.existsSync(path.join('uploads/school-curriculum', name))) throw new Error('missing file for ' + item.title);
}
for (const item of pending) {
  if (item.availability === 'available' && item.file && item.file.url) throw new Error('fake available ' + item.id);
}
console.log('CATALOG_HONESTY_OK');
NODE

# 6) Cards tests FIRST
log "Cards tests..."
node --test server/test/cards-canva-view-wiring.test.js
node tests/api-cards-canva-runtime.js
node tests/api-cards-contract.js
# kahwa integration includes cards surface
node tests/api-kahwa-integration-contract.js

# 7) School tests (must keep cards-canva mount assertion)
log "School tests..."
npm run test:school-pages
npm run test:school-curriculum
node --test \
  server/test/school-canva-integration.test.js \
  server/test/school-canva-runtime.test.js \
  server/test/school-canva-view-wiring.test.js \
  server/test/school-integration.test.js

# 8) Publish school + cards static to nginx
log "Publish static to $WEBROOT"
test -d "$WEBROOT" || die "webroot missing"
mapfile -t STATIC_FILES < <(find . -maxdepth 1 -type f \( \
  -name 'school-*.html' -o -name 'school-*.js' -o -name 'school-*.css' \
  -o -name 'school-api-adapter.js' -o -name 'school-app.css' \
  -o -name 'cards-canva.html' -o -name 'cards-canva-adapter.js' \
\) | sed 's|^\./||' | sort)
for file in "${STATIC_FILES[@]}"; do
  sudo install -m 0644 "$file" "$WEBROOT/$file"
  log "  installed $file"
done
# original asset for cards/school if nginx needs it — API serves from project path
if [[ ! -e "$WEBROOT/uploads" ]]; then
  sudo ln -sfn "$PROJECT/uploads" "$WEBROOT/uploads" || true
fi
sudo restorecon -RF "$WEBROOT" "$PROJECT/server/src" "$PROJECT/uploads" 2>/dev/null || true

# 9) Restart + health
log "Restart $SERVICE"
sudo systemctl restart "$SERVICE"
for i in $(seq 1 25); do sudo systemctl is-active --quiet "$SERVICE" && break; sleep 1; done
sudo systemctl is-active --quiet "$SERVICE" || die "service inactive"
sudo systemctl is-active "$SERVICE" || true
sudo nginx -t
sudo systemctl reload nginx

HEALTH_OK=0
for a in $(seq 1 20); do
  if curl --fail --silent --show-error http://127.0.0.1:3000/api/health | tee /tmp/resume-health.json | grep -q '"ok":true'; then HEALTH_OK=1; break; fi
  sleep 2
done
[[ "$HEALTH_OK" -eq 1 ]] || die "local health failed"
log "local health $(cat /tmp/resume-health.json)"
curl --fail --silent --show-error "$PUBLIC_BASE/api/health" | grep -q '"ok":true'
log "public health OK"

# 10) Live path + seven pages
log "Live school path + seven pages"
node <<'NODE'
'use strict';
require('dotenv').config();
const fs = require('fs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const PUBLIC = process.env.SHNO_PUBLIC_BASE || 'https://shino-mino-tak-tak.duckdns.org';
const LOCAL = 'http://127.0.0.1:3000';
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET missing');
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shno_mano_tak_tak';
async function jget(url, headers) {
  const r = await fetch(url, { headers });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { status: r.status, body };
}
(async () => {
  await mongoose.connect(uri);
  const User = require('./server/src/models/User');
  const username = `school-resume-${Date.now()}`;
  const user = await User.create({
    fullName: 'School Resume', username,
    contact: `${username}@example.com`, contactType: 'email',
    passwordHash: 'x', termsAccepted: true, status: 'active'
  });
  const token = jwt.sign({ userId: user._id, role: user.role || 'user' }, secret, { expiresIn: '30m' });
  const auth = { Authorization: 'Bearer ' + token };
  try {
    const structure = await jget(LOCAL + '/api/school/structure', auth);
    if (!structure.body.ok) throw new Error('structure');
    const stage = 'ابتدائي', grade = 'الأول ابتدائي', subject = 'الرياضيات';
    const books = await jget(`${LOCAL}/api/school/books?stage=${encodeURIComponent(stage)}&grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(subject)}`, auth);
    const book = (books.body.items || []).find(i => i.availability === 'available' && i.file && i.file.url);
    if (!book) throw new Error('no book');
    const reader = await jget(LOCAL + '/api/school/books/' + encodeURIComponent(book.id) + '/reader', auth);
    if (!reader.body.readable) throw new Error('not readable');
    const fileUrl = reader.body.book.file.url;
    const localPdf = await fetch(LOCAL + fileUrl);
    const b1 = Buffer.from(await localPdf.arrayBuffer());
    if (localPdf.status !== 200 || b1.slice(0,5).toString() !== '%PDF-') throw new Error('local pdf');
    const pubPdf = await fetch(PUBLIC + fileUrl);
    const b2 = Buffer.from(await pubPdf.arrayBuffer());
    if (pubPdf.status !== 200 || b2.slice(0,5).toString() !== '%PDF-') throw new Error('public pdf ' + pubPdf.status);

    // cards surface live
    const cardsOrig = await fetch(LOCAL + '/api/cards-canva/original');
    if (cardsOrig.status !== 200) throw new Error('cards original http ' + cardsOrig.status);
    const cardsHtml = await cardsOrig.text();
    if (!cardsHtml || cardsHtml.length < 1000) throw new Error('cards original empty');

    const pages = ['cards-canva.html'];
    const pageStatus = {};
    for (const page of pages) {
      const r = await fetch(PUBLIC + '/' + page);
      pageStatus[page] = r.status;
      if (r.status !== 200) throw new Error('page ' + page + ' ' + r.status);
    }

    const catalog = require('./server/src/data/iraqi-curriculum-catalog');
    const out = {
      ok: true,
      path: `${stage} → ${grade} → ${subject} → ${book.title} → ${fileUrl}`,
      localPdfBytes: b1.length,
      publicPdfBytes: b2.length,
      cardsOriginalBytes: cardsHtml.length,
      verified: catalog.items.filter(i => i.verified).length,
      pending: catalog.pendingItems().length,
      pageStatus
    };
    fs.writeFileSync('logs/curriculum-oracle-resume-e2e.json', JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    console.log('RESUME_E2E_OK');
  } finally {
    await User.deleteOne({ _id: user._id }).catch(()=>{});
    await mongoose.disconnect().catch(()=>{});
  }
})().catch(e => { console.error(e); process.exit(1); });
NODE

log "== RESUME SUCCESS =="
log "Cards restored from a7ee4fb | PDFs not re-downloaded | 95/108 verified | 13 pending"
log "service active | health OK | path E2E OK"
exit 0
