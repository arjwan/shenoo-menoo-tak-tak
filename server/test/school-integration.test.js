const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');

const originalChecksums = {
  'original-assets/school/school-enhancements.css': '155b29d5c56da57c4dd7bc1d5de57986e76e4db3217507cef1f3f38997a48322',
  'original-assets/school/school-offline-ai.js': '96f6d6a32248bd6b099fa2a1dfd551f6d5b7f12e6fba9627e768549c946884db',
  'original-assets/school/school.js': '3550b0a79fc91af4b484aba7794356278e7ad33365ab04bc9d649493e3c64752',
  'original-assets/school/server/src/models/SchoolKnowledgeSource.js': '0f08fd764437e921ac2688ced99781881cfeabe44c623910d1968621ca07fdba',
  'original-assets/school/server/src/routes/school.routes.js': 'cbdebfe9fa9da13c1b6632970d3982c2029d48350c327fde06d3529db2868a69'
};

test('school original assets are byte-identical to preserved checksums', () => {
  for (const [file, expected] of Object.entries(originalChecksums)) assert.equal(sha(file), expected, file);
});

test('school runtime still uses the preserved original client files through integration layer', () => {
  assert.equal(sha('school.js'), originalChecksums['original-assets/school/school.js']);
  assert.equal(sha('school-offline-ai.js'), originalChecksums['original-assets/school/school-offline-ai.js']);
  assert.equal(sha('school-enhancements.css'), originalChecksums['original-assets/school/school-enhancements.css']);
  const html = read('school.html');
  const offlineAt = html.indexOf('school-offline-ai.js');
  const integrationAt = html.indexOf('school-integration.js');
  const schoolAt = html.indexOf('school.js');
  assert.ok(offlineAt > 0 && integrationAt > offlineAt && schoolAt > integrationAt, 'integration loads after offline layer and before original school.js');
});

test('school offline integration preserves offline mode and queues safe sync operations', () => {
  const src = read('school-integration.js');
  for (const marker of ['student.create', 'student.permissions', 'schedule.create', 'session.complete', 'localStorage', 'indexedDB', '/api/school/sync']) assert.match(src, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(src, /API_KEY|SECRET|OPENAI|AIza|sk-/i, 'frontend integration must not contain secrets');
  assert.match(src, /window\.addEventListener\('online',\(\)=>syncNow\(\)\)/, 'sync resumes when network returns');
});

test('school sync route requires auth and never trusts client-sent userId', () => {
  const route = read('server/src/routes/school-sync.routes.js');
  assert.match(route, /router\.use\(requireAuth\)/, 'sync route must require auth');
  assert.match(route, /guardian:\s*req\.user\._id/g, 'writes are scoped to authenticated user');
  assert.doesNotMatch(route, /req\.body\.userId|payload\.userId|guardian:\s*payload|guardian:\s*req\.body/, 'client userId must not decide ownership');
  assert.match(route, /ownStudent[\s\S]*guardian:\s*user\._id/, 'student references are ownership checked');
});

test('school sync operations are idempotent to avoid duplicate progress', () => {
  const model = read('server/src/models/SchoolSyncOperation.js');
  const route = read('server/src/routes/school-sync.routes.js');
  assert.match(model, /schema\.index\(\{ guardian: 1, clientOpId: 1 \}, \{ unique: true \}\)/, 'guardian+clientOpId unique index required');
  assert.match(route, /findOne\(\{ guardian: req\.user\._id, clientOpId \}\)/, 'route checks previous operations');
  assert.match(route, /duplicate:\s*true/, 'duplicates return prior result instead of applying again');
});

test('school server is mounted without replacing existing school routes', () => {
  const server = read('server/src/server.js');
  assert.match(server, /schoolSyncRoutes/);
  assert.ok(server.indexOf("app.use('/api/school', schoolSyncRoutes)") < server.indexOf("app.use('/api/school', schoolRoutes)"), 'sync integration mounts before original school routes');
  assert.equal(sha('server/src/routes/school.routes.js'), originalChecksums['original-assets/school/server/src/routes/school.routes.js']);
  assert.equal(sha('server/src/models/SchoolKnowledgeSource.js'), originalChecksums['original-assets/school/server/src/models/SchoolKnowledgeSource.js']);
});
