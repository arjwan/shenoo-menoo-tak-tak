#!/usr/bin/env bash
# =============================================================================
# ONE-SHOT Oracle deploy: completed School + Iraqi curriculum library
# =============================================================================
# - Does NOT merge to main, does NOT push to GitHub
# - Does NOT upload PDFs to git; downloads 136 from Drive via manifest only
# - Does NOT touch cards/calls/messages beyond ensuring cards-canva mount stays
# - Success criteria: 136/136 PDF OK, 95/108 verified+readable, 13 source_pending
#
# Preferred inputs (first match wins for code payload):
#   1) $BUNDLE_TAR  or handoff/school-oracle-bundle.tar.gz  (complete school tree)
#   2) GitHub branch school-iraqi-curriculum-library + the two handoff patches
#
# Usage on Oracle (as opc):
#   cd /home/opc/shenoo-menoo-tak-tak
#   bash scripts/deploy-school-curriculum-oracle.sh
#
# Or full one-liner from a machine that can SSH:
#   ssh opc@ORACLE 'bash -s' < scripts/deploy-school-curriculum-oracle.sh
# =============================================================================
set -euo pipefail

PROJECT="${SHNO_PROJECT_DIR:-/home/opc/shenoo-menoo-tak-tak}"
WEBROOT="${SHNO_WEB_ROOT:-/usr/share/nginx/html/shno-mano}"
SERVICE="${SHNO_SERVICE:-shno-mano-tech.service}"
PUBLIC_BASE="${SHNO_PUBLIC_BASE:-https://shino-mino-tak-tak.duckdns.org}"
BRANCH="${SHNO_SCHOOL_BRANCH:-school-iraqi-curriculum-library}"
WORK_BRANCH="${SHNO_WORK_BRANCH:-school-oracle-deploy-local}"
PATCH_PAGES="handoff/0001-School-seven-standalone-pages-real-classroom-API-hon.patch"
PATCH_CURRICULUM="handoff/0001-School-curriculum-download-136-real-PDFs-and-verify-.patch"
BUNDLE_TAR="${SHNO_SCHOOL_BUNDLE:-handoff/school-oracle-bundle.tar.gz}"
MANIFEST="server/src/data/iraqi-curriculum-files.json"
PDF_DIR="uploads/school-curriculum"
MIN_FREE_GB="${SHNO_MIN_FREE_GB:-4}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_DIR="logs"
REPORT=""

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

[[ "$(id -un)" == "root" ]] && die "Run as opc, not root"

test -d "$PROJECT/.git" || die "Project not found: $PROJECT"
cd "$PROJECT"
mkdir -p "$LOG_DIR" "$PDF_DIR" .deploy-backups handoff
REPORT="$LOG_DIR/oracle-school-deploy-$STAMP.log"
exec > >(tee -a "$PROJECT/$REPORT") 2>&1

log "== School + Iraqi curriculum Oracle deploy =="
log "project=$PROJECT public=$PUBLIC_BASE"

command -v git >/dev/null
command -v node >/dev/null
command -v npm >/dev/null
command -v curl >/dev/null
command -v systemctl >/dev/null
command -v python3 >/dev/null
command -v tar >/dev/null

# -----------------------------------------------------------------------------
# 0) Disk check — stop BEFORE 1.8G download if short
# -----------------------------------------------------------------------------
log "Disk free:"
df -h
FREE_KB=$(df -Pk "$PROJECT" | awk 'NR==2{print $4}')
FREE_GB=$(( FREE_KB / 1024 / 1024 ))
log "Project filesystem free: ${FREE_GB}G (need >= ${MIN_FREE_GB}G)"
if [[ "$FREE_GB" -lt "$MIN_FREE_GB" ]]; then
  log "INSUFFICIENT DISK — aborting before curriculum download."
  df -h
  exit 2
fi

BACKUP=".deploy-backups/$STAMP-school-curriculum"
mkdir -p "$BACKUP"
for f in server/src/server.js package.json \
         server/src/routes/school.routes.js \
         server/src/routes/school-canva.routes.js \
         server/src/routes/school-classroom.routes.js \
         server/src/routes/cards-canva.routes.js \
         server/src/data/iraqi-curriculum-catalog.js \
         server/src/data/iraqi-curriculum-files.json; do
  if [[ -f "$f" ]]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$f" "$BACKUP/$f"
  fi
done
# backup existing school html
find . -maxdepth 1 -type f -name 'school-*.html' -exec cp -a {} "$BACKUP/" \; 2>/dev/null || true
log "Backup: $BACKUP"

# -----------------------------------------------------------------------------
# 1) Update git refs (school branch only — never checkout main for merge)
# -----------------------------------------------------------------------------
log "Fetching origin/$BRANCH (no main merge) ..."
git fetch origin "$BRANCH" || log "WARN: fetch $BRANCH failed (bundle path may still work)"
# Stay on whatever production branch is currently checked out; only create a
# local work branch if we are dirty-safe.
CURRENT="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo detached)"
log "Current branch: $CURRENT HEAD=$(git rev-parse --short HEAD)"
# Record production HEAD for safety
git rev-parse HEAD > "$BACKUP/PREV_HEAD"

# -----------------------------------------------------------------------------
# 2) Install school code payload
# -----------------------------------------------------------------------------
install_from_bundle() {
  local tarpath="$1"
  test -f "$tarpath" || return 1
  log "Installing school tree from bundle: $tarpath"
  tar -tzf "$tarpath" | head -5 >/dev/null
  # extract into temp then rsync-like copy
  local tmp
  tmp="$(mktemp -d)"
  tar -xzf "$tarpath" -C "$tmp"
  # bundle root may be school-oracle-bundle/ or flat
  local root="$tmp"
  if [[ -d "$tmp/school-oracle-bundle" ]]; then root="$tmp/school-oracle-bundle"; fi
  # copy files preserving paths
  (cd "$root" && find . -type f ! -path './uploads/*' ! -name '*.pdf') | while read -r rel; do
    rel="${rel#./}"
    mkdir -p "$(dirname "$rel")"
    cp -a "$root/$rel" "$rel"
  done
  rm -rf "$tmp"
  log "Bundle installed"
  return 0
}

try_git_patches() {
  test -f "$PATCH_PAGES" && test -f "$PATCH_CURRICULUM" || return 1
  log "Trying ordered git apply of handoff patches ..."
  if [[ -f school-curriculum.html && -f server/src/routes/school-classroom.routes.js && -f server/src/data/iraqi-curriculum-outlines.json ]]; then
    local v
    v="$(node -e "const c=require('./server/src/data/iraqi-curriculum-catalog');process.stdout.write(String(c.items.filter(i=>i.verified).length))" 2>/dev/null || echo 0)"
    if [[ "$v" == "95" ]]; then
      log "School payload already at verified=95 — skip patches"
      return 0
    fi
  fi
  if git apply --check "$PATCH_PAGES" 2>/tmp/p1.err; then
    git apply --index "$PATCH_PAGES" || git apply "$PATCH_PAGES"
  else
    log "Pages patch does not apply cleanly:"
    cat /tmp/p1.err || true
    return 1
  fi
  if git apply --check "$PATCH_CURRICULUM" 2>/tmp/p2.err; then
    git apply --index "$PATCH_CURRICULUM" || git apply "$PATCH_CURRICULUM"
  else
    log "Curriculum patch does not apply cleanly:"
    cat /tmp/p2.err || true
    return 1
  fi
  return 0
}

fetch_bundle_from_github() {
  # Optional: if handoff bundle was pushed to the school branch
  local url="https://raw.githubusercontent.com/arjwan/shenoo-menoo-tak-tak/${BRANCH}/handoff/school-oracle-bundle.tar.gz"
  log "Attempting download of school bundle from GitHub ..."
  if curl -fsSL --retry 3 -o handoff/school-oracle-bundle.tar.gz "$url"; then
    test -s handoff/school-oracle-bundle.tar.gz
    return 0
  fi
  rm -f handoff/school-oracle-bundle.tar.gz
  return 1
}

PAYLOAD_OK=0
if [[ -f "$BUNDLE_TAR" ]] && install_from_bundle "$BUNDLE_TAR"; then
  PAYLOAD_OK=1
elif fetch_bundle_from_github && install_from_bundle handoff/school-oracle-bundle.tar.gz; then
  PAYLOAD_OK=1
elif try_git_patches; then
  PAYLOAD_OK=1
else
  die "No installable school payload (bundle missing and patches do not apply). Put handoff/school-oracle-bundle.tar.gz on the server or fix base revision."
fi
log "Payload install ok=$PAYLOAD_OK"

test -f scripts/download-iraqi-curriculum.js || die "download script missing"
test -f "$MANIFEST" || die "manifest missing"
test -f server/src/data/iraqi-curriculum-catalog.js || die "catalog missing"
test -f server/src/routes/school-classroom.routes.js || die "classroom routes missing"
test -f school-curriculum.html || die "school-curriculum.html missing"

# package.json school scripts
if [[ -f server/src/data/school-package-overlay.json && -f scripts/merge-school-package-scripts.js ]]; then
  node scripts/merge-school-package-scripts.js package.json server/src/data/school-package-overlay.json
fi

# surgical server.js mount (preserve cards)
if [[ -f scripts/ensure-school-server-mount.js ]]; then
  node scripts/ensure-school-server-mount.js server/src/server.js
else
  grep -q "school-classroom.routes" server/src/server.js || die "school-classroom not mounted and no ensure script"
fi
if grep -q 'cards-canva' "$BACKUP/server/src/server.js" 2>/dev/null; then
  grep -q 'cards-canva' server/src/server.js || die "cards-canva mount lost"
  log "cards-canva mount preserved"
fi

# -----------------------------------------------------------------------------
# 3) npm install (devDeps required for school tests)
# -----------------------------------------------------------------------------
log "npm install ..."
if [[ -f package-lock.json ]]; then
  npm ci || npm install
else
  npm install
fi

# -----------------------------------------------------------------------------
# 4) Download 136 PDFs + integrity
# -----------------------------------------------------------------------------
mkdir -p "$PDF_DIR"
log "Download curriculum PDFs (concurrency=${CURRICULUM_DOWNLOAD_CONCURRENCY:-4}) ..."
CURRICULUM_DOWNLOAD_CONCURRENCY="${CURRICULUM_DOWNLOAD_CONCURRENCY:-4}" \
  node scripts/download-iraqi-curriculum.js "$MANIFEST" "$PDF_DIR" \
  | tee "$LOG_DIR/curriculum-download-$STAMP.log"

log "Integrity %PDF- + size + sha256 ..."
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
  let ok = 0;
  const bad = [];
  for (const f of manifest.files) {
    const p = path.join(dir, f.fileName);
    try {
      if (!fs.existsSync(p)) throw new Error('missing');
      const st = fs.statSync(p);
      if (st.size !== f.bytes) throw new Error(`size ${st.size}!=${f.bytes}`);
      const fd = fs.openSync(p, 'r');
      const buf = Buffer.alloc(5);
      fs.readSync(fd, buf, 0, 5, 0);
      fs.closeSync(fd);
      if (buf.toString() !== '%PDF-') throw new Error('not PDF magic');
      const digest = await sha256File(p);
      if (digest !== f.sha256) throw new Error('sha mismatch');
      ok++;
    } catch (e) {
      bad.push({ file: f.fileName, err: String(e.message || e) });
    }
  }
  const report = { ok, total: manifest.files.length, bad };
  fs.mkdirSync('logs', { recursive: true });
  fs.writeFileSync('logs/curriculum-oracle-verify.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (ok !== 136 || bad.length) process.exit(1);
})();
NODE

# -----------------------------------------------------------------------------
# 5) Index + honesty (95 / 13 — no fake available)
# -----------------------------------------------------------------------------
log "Index + catalogue honesty ..."
node scripts/index-iraqi-curriculum.js || true
node <<'NODE'
'use strict';
const fs = require('fs');
const path = require('path');
const c = require('./server/src/data/iraqi-curriculum-catalog');
const m = require('./server/src/data/iraqi-curriculum-files.json');
const verified = c.items.filter(i => i.verified === true);
const available = c.availableItems();
const pending = c.pendingItems();
const pdfs = fs.readdirSync('uploads/school-curriculum').filter(f => f.endsWith('.pdf'));
const summary = {
  catalogTotal: c.items.length,
  verified: verified.length,
  readableAvailable: available.length,
  pending: pending.length,
  pdfsOnDisk: pdfs.length,
  manifestCount: m.fileCount || (m.files && m.files.length)
};
console.log(JSON.stringify(summary, null, 2));
fs.writeFileSync('logs/curriculum-oracle-summary.json', JSON.stringify(summary, null, 2));
if (summary.catalogTotal !== 108) throw new Error('catalog must be 108');
if (summary.verified !== 95) throw new Error(`verified want 95 got ${summary.verified}`);
if (summary.readableAvailable !== 95) throw new Error(`available want 95 got ${summary.readableAvailable}`);
if (summary.pending !== 13) throw new Error(`pending want 13 got ${summary.pending}`);
if (summary.pdfsOnDisk !== 136) throw new Error(`pdfs want 136 got ${summary.pdfsOnDisk}`);
for (const item of available) {
  const name = (item.file && (item.file.originalName || String(item.file.url || '').split('/').pop())) || '';
  if (!name || !fs.existsSync(path.join('uploads/school-curriculum', name))) {
    throw new Error('available without on-disk file: ' + item.title);
  }
}
for (const item of pending) {
  if (item.availability === 'available' && item.file && item.file.url) {
    throw new Error('pending falsely available: ' + item.id);
  }
}
console.log('CATALOG_HONESTY_OK');
NODE

# -----------------------------------------------------------------------------
# 6) Tests
# -----------------------------------------------------------------------------
log "test:school-pages"
npm run test:school-pages
log "test:school-curriculum"
npm run test:school-curriculum
log "server school tests"
node --test \
  server/test/school-canva-integration.test.js \
  server/test/school-canva-runtime.test.js \
  server/test/school-canva-view-wiring.test.js \
  server/test/school-integration.test.js

# -----------------------------------------------------------------------------
# 7) Publish school static files to nginx webroot
# -----------------------------------------------------------------------------
log "Publish school static → $WEBROOT"
test -d "$WEBROOT" || die "webroot missing"
mapfile -t SCHOOL_STATIC < <(find . -maxdepth 1 -type f \( \
  -name 'school-*.html' -o -name 'school-*.js' -o -name 'school-*.css' \
  -o -name 'school-api-adapter.js' -o -name 'school-app.css' \
\) | sed 's|^\./||' | sort)
for file in "${SCHOOL_STATIC[@]}"; do
  sudo install -m 0644 "$file" "$WEBROOT/$file"
  log "  $file"
done
if [[ ! -e "$WEBROOT/uploads" ]]; then
  sudo ln -sfn "$PROJECT/uploads" "$WEBROOT/uploads" || log "WARN: uploads symlink failed"
fi
sudo restorecon -RF "$WEBROOT" "$PROJECT/uploads" 2>/dev/null || true

# -----------------------------------------------------------------------------
# 8) Restart service + health
# -----------------------------------------------------------------------------
log "Restart $SERVICE"
sudo systemctl restart "$SERVICE"
for i in $(seq 1 25); do
  sudo systemctl is-active --quiet "$SERVICE" && break
  sleep 1
done
sudo systemctl is-active --quiet "$SERVICE" || die "$SERVICE inactive"
sudo nginx -t
sudo systemctl reload nginx

HEALTH_OK=0
for attempt in $(seq 1 20); do
  if curl --fail --silent --show-error http://127.0.0.1:3000/api/health | tee /tmp/school-health.json | grep -q '"ok":true'; then
    HEALTH_OK=1; break
  fi
  sleep 2
done
[[ "$HEALTH_OK" -eq 1 ]] || die "local /api/health failed"
log "local health $(cat /tmp/school-health.json)"

curl --fail --silent --show-error "$PUBLIC_BASE/api/health" | grep -q '"ok":true'
log "public health OK"

# -----------------------------------------------------------------------------
# 9) Domain path: مرحلة → صف → مادة → كتاب → PDF
# -----------------------------------------------------------------------------
log "Path E2E"
node <<'NODE'
'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
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
  const username = `school-e2e-${Date.now()}`;
  const user = await User.create({
    fullName: 'School E2E', username,
    contact: `${username}@example.com`, contactType: 'email',
    passwordHash: 'x', termsAccepted: true, status: 'active'
  });
  const token = jwt.sign({ userId: user._id, role: user.role || 'user' }, secret, { expiresIn: '30m' });
  const auth = { Authorization: 'Bearer ' + token };
  try {
    const structure = await jget(LOCAL + '/api/school/structure', auth);
    if (!structure.body.ok) throw new Error('structure failed');
    const stage = 'ابتدائي', grade = 'الأول ابتدائي', subject = 'الرياضيات';
    const books = await jget(
      `${LOCAL}/api/school/books?stage=${encodeURIComponent(stage)}&grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(subject)}`,
      auth
    );
    const book = (books.body.items || []).find(i => i.availability === 'available' && i.file && i.file.url);
    if (!book) throw new Error('no available book');
    const reader = await jget(LOCAL + '/api/school/books/' + encodeURIComponent(book.id) + '/reader', auth);
    if (!reader.body.ok || reader.body.readable !== true) throw new Error('not readable');
    const fileUrl = reader.body.book.file.url;
    if (!String(fileUrl).startsWith('/uploads/school-curriculum/')) throw new Error('bad url');

    const localPdf = await fetch(LOCAL + fileUrl);
    const b1 = Buffer.from(await localPdf.arrayBuffer());
    if (localPdf.status !== 200 || b1.slice(0, 5).toString() !== '%PDF-') throw new Error('local pdf bad');

    const pubPdf = await fetch(PUBLIC + fileUrl);
    const b2 = Buffer.from(await pubPdf.arrayBuffer());
    if (pubPdf.status !== 200 || b2.slice(0, 5).toString() !== '%PDF-') throw new Error('public pdf bad status=' + pubPdf.status);

    const catalog = require('./server/src/data/iraqi-curriculum-catalog');
    const pending = catalog.items.find(i => i.verified !== true || !i.file || !i.file.url);
    const pr = await jget(LOCAL + '/api/school/books/' + encodeURIComponent(pending.id) + '/reader', auth);
    if (pr.body.readable === true) throw new Error('pending became readable');

    const out = {
      ok: true,
      path: `${stage} → ${grade} → ${subject} → ${book.title} → ${fileUrl}`,
      localPdfBytes: b1.length,
      publicPdfBytes: b2.length,
      verified: catalog.items.filter(i => i.verified).length,
      pending: catalog.pendingItems().length
    };
    fs.writeFileSync('logs/curriculum-oracle-path-e2e.json', JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    console.log('PATH_E2E_OK');
  } finally {
    await User.deleteOne({ _id: user._id }).catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
})().catch(e => { console.error(e); process.exit(1); });
NODE

log "== SUCCESS =="
log "136/136 PDFs OK | 95/108 verified+readable | 13 source_pending (honest)"
log "service active | health OK | path E2E OK"
log "report: $PROJECT/$REPORT"
log "backup: $PROJECT/$BACKUP"
log "NOTE: not merged to main; PDFs only under uploads/school-curriculum"
exit 0
