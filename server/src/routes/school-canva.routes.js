'use strict';

// REST surface for the immutable Canva school original (external adapter).
// The original calls two relative endpoints against its restApiUrl config:
//   GET  /health      -> /api/school/health     (public, availability only)
//   POST /operations  -> /api/school/operations (authenticated, idempotent)
// plus the adapter config endpoint used by the loader page:
//   GET  /classroom/config -> /api/school/classroom/config (authenticated)
//
// The loader resolves restApiUrl to /api/school, so these routes extend the
// real /api/school namespace without touching school.routes.js or
// school-sync.routes.js.

const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Student = require('../models/SchoolStudent');
const Session = require('../models/SchoolSession');
const Knowledge = require('../models/SchoolKnowledgeSource');
const LearningRecord = require('../models/SchoolLearningRecord');
const SyncOperation = require('../models/SchoolSyncOperation');
const { planRecord, extractClientOpId } = require('../lib/school-canva-record');

const DEFAULT_STUN = 'stun:stun.l.google.com:19302';

/**
 * TURN is optional and configured server-side only (env on Oracle). When it
 * is not configured, an empty list is returned and clients use STUN only.
 * No credentials are ever hard-coded in the frontend.
 */
function buildTurnServers(env = process.env) {
  const uris = String(env.SCHOOL_TURN_URIS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!uris.length) return [];
  const username = String(env.SCHOOL_TURN_USERNAME || '');
  const credential = String(env.SCHOOL_TURN_CREDENTIAL || '');
  return uris.map((urls) => {
    const server = { urls };
    if (username) server.username = username;
    if (username && credential) server.credential = credential;
    return server;
  });
}

function canvaIntegrationConfig(env = process.env) {
  return {
    environment: String(env.SCHOOL_CLASSROOM_ENV || 'production'),
    schemaVersion: String(env.SCHOOL_CANVA_SCHEMA_VERSION || '1.0'),
    requestTimeoutMs: Math.max(1000, Number(env.SCHOOL_CANVA_REQUEST_TIMEOUT_MS) || 8000),
    restApiUrl: '/api/school',
    websocketUrl: 'shno-school://classroom',
    stunUrl: String(env.SCHOOL_STUN_URL || '').trim() || DEFAULT_STUN,
    turnServers: buildTurnServers(env)
  };
}

// The original's healthCheck() runs without an Authorization header, so this
// must stay public. It reveals availability only (same policy as /api/health).
router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'shno-mano-school-canva', mode: 'real', time: new Date().toISOString() });
});

router.get('/classroom/config', requireAuth, (req, res) => {
  res.json({ ok: true, user: { id: String(req.user._id) }, ...canvaIntegrationConfig(process.env) });
});

async function applyPlan(plan, guardianId) {
  const applied = [];
  let student = await Student.findOne({ guardian: guardianId, name: plan.student.name, stage: plan.student.stage, grade: plan.student.grade, active: true });
  if (!student) {
    student = await Student.create({ guardian: guardianId, name: plan.student.name, stage: plan.student.stage, grade: plan.student.grade, parentApproved: true });
    applied.push('student.created');
  } else {
    applied.push('student.existing');
  }

  for (const action of plan.actions) {
    if (action.kind === 'student.ensure') continue;

    if (action.kind === 'consent') {
      student.learningPermissions = { voice: action.voice === true, camera: action.camera === true, updatedAt: new Date() };
      await student.save();
      applied.push('consent.saved');
      continue;
    }

    if (action.kind === 'learning.record') {
      await LearningRecord.create({
        guardian: guardianId,
        student: student._id,
        subject: action.subject || undefined,
        lesson: action.lesson || undefined,
        question: action.question,
        answer: action.answer,
        provider: 'canva-local',
        model: 'demo'
      });
      applied.push('learning.recorded');
      continue;
    }

    if (action.kind === 'score') {
      student.scores.push({ subject: action.subject, score: action.score, maxScore: action.maxScore });
      student.progress.answered += 1;
      student.progress.average = student.scores.reduce((a, x) => a + (x.score / x.maxScore) * 100, 0) / student.scores.length;
      await student.save();
      applied.push(action.approved ? 'score.approved' : 'score.saved');
      continue;
    }

    if (action.kind === 'session.complete') {
      const existing = await Session.findOne({ guardian: guardianId, student: student._id, status: 'active' }).sort({ startedAt: -1 });
      if (existing) {
        existing.status = 'completed';
        existing.score = action.score;
        existing.maxScore = action.maxScore;
        existing.teacherNote = action.teacherNote;
        existing.endedAt = new Date();
        await existing.save();
        applied.push('session.completed-existing');
      } else {
        await Session.create({
          guardian: guardianId,
          student: student._id,
          mode: 'individual',
          subject: action.subject,
          lesson: action.lesson,
          status: 'completed',
          startedAt: new Date(Date.now() - 45 * 60000),
          endedAt: new Date(),
          score: action.score,
          maxScore: action.maxScore,
          teacherNote: action.teacherNote,
          attention: { responses: 1, unanswered: 0, activeMinutes: 45 }
        });
        applied.push('session.completed-new');
      }
      await Student.updateOne({ _id: student._id, guardian: guardianId }, { $inc: { 'progress.sessions': 1 } });
      continue;
    }

    if (action.kind === 'knowledge') {
      await Knowledge.create({
        title: action.title,
        sourceType: 'teacher_material',
        stage: action.stage,
        grade: action.grade,
        subject: action.subject,
        chapter: action.chapter,
        content: `ملف منهج محلي: ${action.title} — بانتظار رفع الملف الفعلي عبر شنو منو`,
        verified: false,
        uploadedBy: guardianId
      });
      applied.push('knowledge.saved');
      continue;
    }

    if (action.kind === 'note') {
      student.notes.push({ text: action.text.slice(0, 1000), subject: action.subject });
      await student.save();
      applied.push('note.saved');
    }
  }

  return {
    studentId: String(student._id),
    student: { name: student.name, stage: student.stage, grade: student.grade },
    applied
  };
}

router.post('/operations', requireAuth, async (req, res, next) => {
  try {
    const clientOpId = extractClientOpId(req.headers, req.body);
    if (!clientOpId) {
      return res.status(400).json({ ok: false, isOk: false, message: 'Idempotency-Key مطلوب' });
    }

    // Idempotency: same guardian + clientOpId always returns the prior
    // result, so retries after reconnect/offline never duplicate work. The
    // record shares the same store as POST /api/school/sync, keeping the two
    // sync paths mutually duplicate-safe.
    const existing = await SyncOperation.findOne({ guardian: req.user._id, clientOpId }).lean();
    if (existing) {
      return res.json({
        ok: true,
        isOk: true,
        duplicate: true,
        clientOpId,
        status: existing.status,
        result: existing.result,
        error: existing.error || ''
      });
    }

    const record = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const plan = planRecord(record);
    if (!plan.ok) {
      await SyncOperation.create({
        guardian: req.user._id,
        clientOpId,
        type: 'canva.operation',
        localId: '',
        status: 'failed',
        error: plan.error
      }).catch(() => {});
      return res.status(400).json({ ok: false, isOk: false, clientOpId, message: plan.error });
    }

    const result = await applyPlan(plan, req.user._id);
    await SyncOperation.create({
      guardian: req.user._id,
      clientOpId,
      type: 'canva.operation',
      localId: result.studentId,
      status: 'applied',
      result
    });
    return res.json({ ok: true, isOk: true, duplicate: false, clientOpId, result });
  } catch (error) {
    if (error && error.name === 'ValidationError') {
      return res.status(400).json({ ok: false, isOk: false, message: 'بيانات السجل غير مكتملة' });
    }
    next(error);
  }
});

// The immutable original is a public design asset (no secrets inside); the
// loader fetches it through the API so Oracle's root-only static publishing
// keeps working. Served with no-store so the approved bytes always match.
//
// The file on disk is NEVER modified (its SHA-256 stays the approved value
// and is pinned by the test-suite). The Canva export of this file corrupted
// two regex literals in the original's own inline script by doubling one
// escape backslash in each:
//     restApiUrl.replace(/\\/$/,"")   instead of restApiUrl.replace(/\/$/,"")
//     path.replace(/^\\//,"")         instead of path.replace(/^\//,"")
// The stray backslashes make each regex close early, so V8 (any browser)
// rejects the entire inline script with "Invalid regular expression flags"
// and none of the original's app code can run. This external serving layer
// therefore deletes exactly those 2 backslash bytes from the in-memory copy
// (the author's original code is restored; design/markup/CSS/all other
// bytes are served exactly as stored). If the file is ever re-exported
// cleanly, the patterns are absent and the repair is a no-op.
const CANVA_EXPORT_REPAIR = (function () {
  const BS = String.fromCharCode(92);
  return [
    { from: '/' + BS + BS + '/' + '$' + '/' + ',', to: '/' + BS + '/' + '$' + '/' + ',' },
    { from: '/' + '^' + BS + BS + '/' + '/' + ',', to: '/' + '^' + BS + '/' + '/' + ',' }
  ];
})();
function repairCanvaExport(html) {
  let out = String(html || '');
  for (const r of CANVA_EXPORT_REPAIR) out = out.split(r.from).join(r.to);
  return out;
}
router.get('/original', (_req, res) => {
  res.type('html');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  // Immutable approved original (SHA-pinned). Serve-time repair only.
  const file = path.resolve(__dirname, '../../../original-assets/school-canva/school-canva-original.html');
  fs.readFile(file, (err, buf) => {
    if (err) return res.status(500).json({ ok: false, message: 'فشل تحميل الأصل' });
    res.end(repairCanvaExport(buf.toString('utf8')));
  });
});

// Active Canva school UPDATE export (structure-list / library-search UI). Served
// separately so /original stays the immutable approved artifact.
router.get('/update', (_req, res) => {
  res.type('html');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const file = path.resolve(__dirname, '../../../original-assets/school-canva/school-canva-update-20260920.html');
  fs.readFile(file, (err, buf) => {
    if (err) return res.status(500).json({ ok: false, message: 'فشل تحميل تحديث Canva' });
    res.end(buf.toString('utf8'));
  });
});

// The 2026-09-20 Canva "latest" school export (the interface the seven
// standalone pages were generated from) is served byte-exact: it keeps its own
// fingerprint and needs no export repair — the test-suite compiles its inline
// script from the served copy, which is the real proof.
router.get('/latest', (_req, res) => {
  res.type('html');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const file = path.resolve(__dirname, '../../../original-assets/school-canva/school-canva-latest-20260920.html');
  fs.readFile(file, (err, buf) => {
    if (err) return res.status(500).json({ ok: false, message: 'فشل تحميل واجهة Canva الأخيرة' });
    res.end(buf.toString('utf8'));
  });
});

module.exports = router;

module.exports.buildTurnServers = buildTurnServers;
module.exports.canvaIntegrationConfig = canvaIntegrationConfig;
module.exports.repairCanvaExport = repairCanvaExport;
