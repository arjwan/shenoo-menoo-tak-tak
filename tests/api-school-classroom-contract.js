'use strict';

/*
 * Contract for the backend of the seven standalone school pages
 * (server/src/routes/school-classroom.routes.js). The DOM test-suite drives the
 * pages with exactly these response shapes, so this file pins them.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const routes = read('server/src/routes/school-classroom.routes.js');
const server = read('server/src/server.js');
const studentModel = read('server/src/models/SchoolStudent.js');

// 1) The six endpoints the standalone pages need exist, and all of them are
//    behind the real JWT middleware.
assert.ok(routes.includes('router.use(requireAuth)'), 'every standalone school endpoint must require auth');
for (const endpoint of ["router.get('/dashboard'", "router.get('/structure'", "router.get('/books'", "router.get('/books/:id/reader'", "router.get('/classroom/options'", "router.post('/classroom/actions'"]) {
  assert.ok(routes.includes(endpoint), 'missing endpoint: ' + endpoint);
}

// 2) Real project data only: the real models, the real catalogue, the real
//    manifest and the real AI teacher — no fixtures in the route file.
for (const source of ["require('../models/SchoolStudent')", "require('../models/SchoolSession')", "require('../models/SchoolLearningRecord')", "require('../models/SchoolSchedule')", "require('../models/SchoolKnowledgeSource')", "require('../services/school-ai')", "require('../data/iraqi-curriculum-catalog')", "require('../data/iraqi-curriculum-files.json')"]) {
  assert.ok(routes.includes(source), 'the backend must use real project data: ' + source);
}
assert.ok(!/Math\.random\(\)/.test(routes), 'the backend must not generate records randomly');

// 3) Ownership: everything is scoped to the authenticated guardian and the
//    client can never name the owner.
assert.ok(routes.includes('guardian: req.user._id'), 'queries must be scoped to the authenticated guardian');
assert.ok(routes.includes('uploadedBy: req.user._id'), 'personal curriculum rows must be scoped to the guardian');
assert.ok(!/req\.body\.guardian|body\.guardian|guardian:\s*req\.body/.test(routes), 'client-sent guardian ids must never decide ownership');
assert.ok(!/req\.query\.guardian/.test(routes), 'client-sent guardian ids must never decide ownership');

// 4) Response contract used by the pages (SchoolKnowledgeSource drives lessons).
assert.ok(routes.includes("type: 'lesson'"), 'structure/classroom must type lesson rows');
assert.ok(routes.includes('content: row.content'), 'lesson rows must carry the real SchoolKnowledgeSource text'); 
assert.ok(routes.includes('indexingStatus'), 'book rows must report their indexing status');
assert.ok(routes.includes('pageCount'), 'the reader must report the real page count');
assert.ok(routes.includes('canDownload'), 'the reader must state whether the file is downloadable');
assert.ok(routes.includes("'knowledge:' + row._id"), 'knowledge records must be addressable by the reader');
assert.ok(routes.includes("'file:' + item.driveId"), 'verified curriculum PDFs must be addressable by the reader');
assert.ok(routes.includes('CLASS_ACTIONS'), 'classroom actions must be an explicit, closed list');
assert.ok(routes.includes('LearningRecord.create'), 'classroom actions must land in the real learning records');
assert.ok(routes.includes('schoolAI.ask'), 'the question action must use the real AI teacher');
assert.ok(routes.includes("action === 'end'") && routes.includes('Session.findOne'), 'ending a class must close the real study session');

// 5) The student section field the structure page cascades on is part of the
//    real model (optional, so existing documents keep working).
assert.ok(studentModel.includes("section:{type:String,default:'',trim:true}"), 'SchoolStudent must carry the real section field');

// 6) Mounted last, so it can only add paths.
const schoolAt = server.indexOf("app.use('/api/school', schoolRoutes)");
const classroomAt = server.indexOf("app.use('/api/school', schoolClassroomRoutes)");
assert.ok(schoolAt > -1 && classroomAt > schoolAt, 'the standalone backend must mount after the existing school routes');
assert.ok(server.includes("require('./routes/school-classroom.routes')"));

// 7) No secrets in the new backend or the new client layers.
for (const file of ['server/src/routes/school-classroom.routes.js', 'school-api-adapter.js', 'school-canva-ui.js']) {
  assert.doesNotMatch(read(file), /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{30,}|AKIA[0-9A-Z]{16}/, file + ' must not contain secrets');
}

console.log('PASS: school standalone backend contract (real models, guardian scoping, real curriculum data)');
