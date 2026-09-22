'use strict';

/*
 * Real backend surface for the seven standalone school pages
 * (school-index / school-structure / school-teachers / school-students /
 *  school-curriculum / school-reader / school-classroom).
 *
 * Everything here is derived from live project data:
 *   - SchoolStudent / SchoolSession / SchoolLearningRecord / SchoolSchedule
 *   - SchoolKnowledgeSource (verified curriculum content + uploaded lessons)
 *   - server/src/data/iraqi-curriculum-catalog.js (108 Iraqi titles)
 *   - server/src/data/iraqi-curriculum-files.json (136 verified PDFs)
 *   - the platform teacher directory served by the existing /api/school/teachers
 *
 * No demo rows are generated: when the project has no confirmed record the
 * response says so and the UI shows that answer.
 *
 * Mounted under /api/school AFTER the existing school routers, so it can only
 * add new paths (/dashboard, /structure, /books, /classroom/*) and never
 * shadows an existing endpoint.
 */

const router = require('express').Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Student = require('../models/SchoolStudent');
const Session = require('../models/SchoolSession');
const Knowledge = require('../models/SchoolKnowledgeSource');
const LearningRecord = require('../models/SchoolLearningRecord');
const Schedule = require('../models/SchoolSchedule');
const schoolAI = require('../services/school-ai');
const catalog = require('../data/iraqi-curriculum-catalog');
const manifest = require('../data/iraqi-curriculum-files.json');
const linkedCurriculum = require('../services/iraqi-curriculum-linked');

router.use(requireAuth);

const clean = (value) => String(value == null ? '' : value).trim();
const curriculumUrl = (item) => `/uploads/school-curriculum/${item.fileName}`;

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function knowledgeScope(req) {
  return { $or: [{ verified: true }, { uploadedBy: req.user._id }] };
}

async function guardianStudents(req) {
  return Student.find({ guardian: req.user._id, active: true })
    .select('name stage grade section subjects scores notes progress learningPermissions')
    .sort({ createdAt: 1 })
    .lean();
}

function uniquePush(list, seen, row) {
  const key = [row.type, row.name, row.stage || '', row.grade || '', row.subject || '', row.unit || ''].join('|');
  if (!row.name || seen[key]) return;
  seen[key] = true;
  list.push(row);
}

/**
 * The structure of the real school: stages/grades/subjects come from the
 * versioned catalogue, sections from student records, units/lessons from
 * SchoolKnowledgeSource. Rows are typed so the UI can cascade them.
 */
function buildStructure(params, students, knowledge) {
  const items = [];
  const seen = {};
  const stageFilter = clean(params.stage);
  const gradeFilter = clean(params.grade);
  const subjectFilter = clean(params.subject);
  const unitFilter = clean(params.unit);
  const query = clean(params.query).toLowerCase();

  const catalogue = catalog.items.filter((item) =>
    (!stageFilter || item.stage === stageFilter) &&
    (!gradeFilter || item.grade === gradeFilter) &&
    (!subjectFilter || item.subject === subjectFilter));

  for (const item of catalogue) {
    uniquePush(items, seen, { type: 'stage', id: item.stage, name: item.stage, stage: item.stage });
    if (stageFilter) uniquePush(items, seen, { type: 'grade', id: item.grade, name: item.grade, stage: item.stage, grade: item.grade });
  }
  for (const student of students) {
    uniquePush(items, seen, { type: 'stage', id: student.stage, name: student.stage, stage: student.stage });
    uniquePush(items, seen, { type: 'grade', id: student.grade, name: student.grade, stage: student.stage, grade: student.grade });
    if (student.section) uniquePush(items, seen, { type: 'section', id: student.section, name: student.section, stage: student.stage, grade: student.grade, section: student.section });
  }
  for (const row of knowledge) {
    uniquePush(items, seen, { type: 'stage', id: row.stage, name: row.stage, stage: row.stage });
    if (stageFilter) uniquePush(items, seen, { type: 'grade', id: row.grade, name: row.grade, stage: row.stage, grade: row.grade });
    if (stageFilter && gradeFilter) uniquePush(items, seen, { type: 'subject', id: row.subject, name: row.subject, stage: row.stage, grade: row.grade, subject: row.subject });
    if (gradeFilter && row.chapter) uniquePush(items, seen, { type: 'unit', id: row.chapter, name: row.chapter, stage: row.stage, grade: row.grade, subject: row.subject, unit: row.chapter });
    if (subjectFilter && row.lesson) {
      uniquePush(items, seen, {
        type: 'lesson', id: String(row._id), name: row.lesson, stage: row.stage, grade: row.grade,
        subject: row.subject, unit: row.chapter || '', year: row.year || null,
        status: row.verified ? 'موثّق في المنصة' : 'بانتظار الاعتماد'
      });
    }
  }
  return (query ? items.filter((row) => [row.name, row.subject, row.stage, row.grade].join(' ').toLowerCase().includes(query)) : items).slice(0, 300);
}


router.get('/dashboard', async (req, res, next) => {
  try {
    const [students, activeSessions, completedSessions, verifiedKnowledge, schedules] = await Promise.all([
      guardianStudents(req),
      Session.countDocuments({ guardian: req.user._id, status: 'active' }),
      Session.countDocuments({ guardian: req.user._id, status: 'completed' }),
      Knowledge.countDocuments({ verified: true }),
      Schedule.countDocuments({ guardian: req.user._id })
    ]);
    const subjects = new Set();
    const stages = new Set();
    let scores = 0;
    let notes = 0;
    for (const student of students) {
      stages.add(student.stage);
      for (const subject of student.subjects || []) subjects.add(subject);
      for (const score of student.scores || []) if (score.subject) subjects.add(score.subject);
      for (const note of student.notes || []) if (note.subject) subjects.add(note.subject);
      scores += (student.scores || []).length;
      notes += (student.notes || []).length;
    }
    const metrics = [
      { label: 'الطلاب المسجلون', value: students.length },
      { label: 'المراحل الدراسية', value: stages.size },
      { label: 'المواد المتابعة', value: subjects.size },
      { label: 'الحصص المكتملة', value: completedSessions },
      { label: 'الحصص الجارية', value: activeSessions },
      { label: 'دروس المنهج المؤكدة', value: verifiedKnowledge },
      { label: 'عناوين المنهج العراقي', value: catalog.items.length },
      { label: 'ملفات PDF موثقة', value: manifest.fileCount },
      { label: 'صفحات المنهج الموثقة', value: manifest.totalPages },
      { label: 'الدرجات المسجلة', value: scores },
      { label: 'ملاحظات المعلم', value: notes },
      { label: 'المواعيد المجدولة', value: schedules }
    ];
    res.json({ ok: true, metrics, account: { role: req.user.role }, generatedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.get('/structure', async (req, res, next) => {
  try {
    const filter = knowledgeScope(req);
    for (const key of ['stage', 'grade', 'subject']) if (clean(req.query[key])) filter[key] = clean(req.query[key]);
    if (clean(req.query.unit)) filter.chapter = clean(req.query.unit);
    const [students, knowledge] = await Promise.all([
      guardianStudents(req),
      Knowledge.find(filter).select('title stage grade subject chapter lesson year page verified').sort({ stage: 1, grade: 1, subject: 1, chapter: 1, lesson: 1 }).limit(400).lean()
    ]);
    const items = buildStructure(req.query, students, knowledge);
    res.json({ ok: true, items, total: items.length, catalogVersion: catalog.version, generatedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});


/**
 * The real curriculum library: verified Iraqi PDF files, the versioned
 * catalogue of official titles and the platform's own SchoolKnowledgeSource
 * records — every row labelled with the source it came from.
 */
router.get('/books', async (req, res, next) => {
  try {
    const stage = clean(req.query.stage);
    const grade = clean(req.query.grade);
    const subject = clean(req.query.subject);
    const unit = clean(req.query.unit);
    const query = clean(req.query.query).toLowerCase();
    const narrow = Boolean(stage || grade || subject || unit);
    const items = [];
    const seen = {};

    for (const item of linkedCurriculum.files) {
      if (stage && item.stage !== stage) continue;
      if (grade && item.grade !== grade) continue;
      if (subject && item.subject !== subject) continue;
      let host = item.sourcePage;
      try { host = new URL(item.sourcePage).hostname; } catch (error) { /* keep the raw page as the label */ }
      const title = item.title || 'كتاب المنهج العراقي — ' + host;
      if (query && title.toLowerCase().indexOf(query) === -1 && item.driveId.indexOf(query) === -1) continue;
      if (narrow && !item.catalogId) continue;
      if (seen[item.driveId]) continue;
      seen[item.driveId] = true;
      items.push({
        id: 'file:' + item.driveId, fileId: 'file:' + item.driveId, title,
        sourcePage: item.sourcePage, url: item.url, textUrl: item.textUrl,
        stage: item.stage, grade: item.grade, subject: item.subject,
        pages: item.pages, bytes: item.bytes,
        year: manifest.catalogVersion, status: item.textAvailable ? 'نص مفهرس' : 'بانتظار النص', sourceType: 'official_textbook',
        indexingStatus: item.textAvailable ? 'نص الكتاب مفهرس ومربوط بالمنهج' : 'ملف موثّق SHA-256'
      });
    }

    for (const item of linkedCurriculum.catalogItems) {
      if (stage && item.stage !== stage) continue;
      if (grade && item.grade !== grade) continue;
      if (subject && item.subject !== subject) continue;
      if (query && item.title.toLowerCase().indexOf(query) === -1) continue;
      const key = 'catalog:' + item.id;
      if (seen[key]) continue;
      seen[key] = true;
      items.push({
        id: key, fileId: key, title: item.title, stage: item.stage, grade: item.grade,
        subject: item.subject, year: item.year, content: item.content, status: item.availability,
        url: item.file && item.file.url, textUrl: item.textUrl,
        sourceType: item.sourceType,
        indexingStatus: item.indexingStatus || 'العنوان مفهرس والملف قيد التوفير'
      });
    }

    const filter = knowledgeScope(req);
    for (const key of ['stage', 'grade', 'subject']) if (clean(req.query[key])) filter[key] = clean(req.query[key]);
    if (unit) filter.chapter = unit;
    const knowledge = await Knowledge.find(filter)
      .select('title stage grade subject chapter lesson year page verified file sourceUrl sourceType')
      .sort({ stage: 1, grade: 1, subject: 1, chapter: 1, lesson: 1 })
      .limit(400)
      .lean();
    for (const row of knowledge) {
      const haystack = String(row.title || '') + ' ' + String(row.lesson || '');
      if (query && haystack.toLowerCase().indexOf(query) === -1) continue;
      items.push({
        id: 'knowledge:' + row._id, fileId: 'knowledge:' + row._id, title: row.title, stage: row.stage,
        grade: row.grade, subject: row.subject, unit: row.chapter || '', lesson: row.lesson || '',
        content: row.content, year: row.year, page: row.page,
        pages: /^\d+$/.test(String(row.page || '')) ? Number(row.page) : undefined,
        status: row.verified ? 'موثّق في المنصة' : 'بانتظار الاعتماد',
        sourceType: row.sourceType, indexingStatus: row.verified ? 'موثّق في المنصة' : 'بانتظار الاعتماد',
        url: (row.file && row.file.url) || row.sourceUrl || ''
      });
    }

    res.json({ ok: true, items: items.slice(0, 300), total: items.length, catalogVersion: manifest.catalogVersion, generatedAt: new Date().toISOString() });
  } catch (error) {
    next(error);

/**
 * Authorised reader URL for the قارئ الكتاب page. Only ids that really exist
 * in the platform are readable: a verified manifest PDF or a
 * SchoolKnowledgeSource record the guardian may read. Anything else answers
 * 404 with an explicit message instead of a placeholder file.
 */
router.get('/books/:id/reader', async (req, res, next) => {
  try {
    const id = clean(req.params.id);
    if (id.indexOf('file:') === 0) {
      const driveId = id.slice(5);
      const item = linkedCurriculum.files.find((file) => file.driveId === driveId);
      if (!item) return res.status(404).json({ ok: false, message: 'ملف المنهج غير موجود في فهرس المنصة' });
      if (!item.url) return res.status(404).json({ ok: false, message: 'مصدر قراءة الكتاب غير متوفر' });
      let host = item.sourcePage;
      try { host = new URL(item.sourcePage).hostname; } catch (error) { /* keep raw */ }
      const url = item.url;
      return res.json({
        ok: true, url, downloadUrl: '', canDownload: false,
        title: item.title || 'كتاب المنهج العراقي — ' + host, pageCount: item.pages,
        textUrl: item.textUrl, year: manifest.catalogVersion, indexingStatus: 'نص الكتاب مفهرس ومربوط بالمنهج'
      });
    }

    if (id.indexOf('knowledge:') === 0 || isObjectId(id)) {
      const key = id.indexOf('knowledge:') === 0 ? id.slice(10) : id;
      if (!isObjectId(key)) return res.status(404).json({ ok: false, message: 'معرف الملف غير معروف' });
      const row = await Knowledge.findOne({ _id: key, ...knowledgeScope(req) }).lean();
      if (!row) return res.status(404).json({ ok: false, message: 'لا تملك صلاحية قراءة هذا السجل' });
      const url = (row.file && row.file.url) || row.sourceUrl || '';
      if (!url) return res.status(404).json({ ok: false, message: 'لم يُرفع ملف هذا السجل إلى المنصة بعد' });
      return res.json({
        ok: true, url, downloadUrl: url, canDownload: Boolean(row.file && row.file.url),
        title: row.title, year: row.year || null,
        pageCount: /^\d+$/.test(String(row.page || '')) ? Number(row.page) : null,
        indexingStatus: row.verified ? 'موثّق في المنصة' : 'بانتظار الاعتماد'
      });
    }

    if (id.indexOf('catalog:') === 0) {
      const item = linkedCurriculum.catalogItems.find((row) => 'catalog:' + row.id === id);
      if (!item) return res.status(404).json({ ok: false, message: 'العنوان غير موجود في فهرس المنهج' });
      const file = linkedCurriculum.files.find((row) => row.catalogId === item.id);
      if (file && file.url) return res.json({ ok: true, url: file.url, downloadUrl: '', canDownload: false,
        title: item.title, pageCount: file.pages, textUrl: file.textUrl,
        year: manifest.catalogVersion, indexingStatus: 'نص الكتاب مفهرس ومربوط بالمنهج' });
      return res.status(404).json({ ok: false, message: 'العنوان مفهرس في المنصة وملف الكتاب قيد التوفير' });
    }

    res.status(404).json({ ok: false, message: 'معرف الملف غير معروف' });
  } catch (error) {
    next(error);
  }
});

/**
 * Classroom cascade: grades for a stage, then sections/subjects for a grade,
 * then lessons (with their real SchoolKnowledgeSource text) for a subject.
 * The teacher row is composed on the client from /api/school/teachers.
 */
router.get('/classroom/options', async (req, res, next) => {
  try {
    const stage = clean(req.query.stage);
    const grade = clean(req.query.grade);
    const section = clean(req.query.section);
    const subject = clean(req.query.subject);
    const items = [];
    const seen = {};

    if (stage) {
      for (const item of catalog.items) {
        if (item.stage !== stage) continue;
        if (grade && item.grade !== grade) continue;
        if (!grade) uniquePush(items, seen, { type: 'grade', id: item.grade, name: item.grade, stage: item.stage, grade: item.grade });
      }
    }

    const students = await guardianStudents(req);
    if (grade) {
      for (const student of students) {
        if (student.stage !== stage || student.grade !== grade) continue;
        if (student.section && (!section || student.section === section)) {
          uniquePush(items, seen, { type: 'section', id: student.section, name: student.section, stage: student.stage, grade: student.grade, section: student.section });
        }
      }
      for (const item of catalog.items) {
        if (item.stage !== stage || item.grade !== grade) continue;
        if (subject && item.subject !== subject) continue;
        uniquePush(items, seen, { type: 'subject', id: item.subject, name: item.subject, stage: item.stage, grade: item.grade, subject: item.subject });
      }
    }

    if (grade && subject) {
      const knowledge = await Knowledge.find({ ...knowledgeScope(req), stage: stage, grade: grade, subject: subject })
        .select('title lesson chapter year content question modelAnswer verified')
        .sort({ chapter: 1, lesson: 1 })
        .limit(60)
        .lean();
      if (!knowledge.length) return res.json({ ok: true, items, total: items.length, message: 'لا يوجد درس مؤكد لهذه المادة بعد' });
      for (const row of knowledge) {
        uniquePush(items, seen, {
          type: 'lesson', kind: 'lesson', id: String(row._id),
          name: row.lesson || row.title, stage, grade, subject, unit: row.chapter || '',
          year: row.year || null, content: row.content || '',
          status: row.verified ? 'موثّق في المنصة' : 'بانتظار الاعتماد'
        });
      }
    }

    res.json({ ok: true, items, total: items.length, generatedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

  }
});


const CLASS_ACTIONS = {
  attendance: 'تسجيل الحضور',
  participation: 'تسجيل المشاركة',
  hand: 'رفع اليد',
  question: 'إرسال سؤال'
};

async function resolveStudent(req) {
  const grade = clean(req.body.grade);
  const section = clean(req.body.section);
  const students = await guardianStudents(req);
  if (grade) {
    const match = students.find((student) => student.grade === grade && (!section || (student.section || '') === section));
    if (match) return match;
  }
  return students.length === 1 ? students[0] : null;
}

/** Real classroom actions: they land in SchoolLearningRecord / SchoolSession. */
router.post('/classroom/actions', async (req, res, next) => {
  try {
    const action = clean(req.body.action);
    if (!CLASS_ACTIONS[action] && action !== 'end') return res.status(400).json({ ok: false, message: 'إجراء الحصة غير معروف' });
    const at = new Date(req.body.at || Date.now());
    const when = Number.isNaN(at.getTime()) ? new Date() : at;
    const subject = clean(req.body.subject);
    const lesson = clean(req.body.lesson);

    if (action === 'end') {
      const session = await Session.findOne({ guardian: req.user._id, status: 'active' }).sort({ startedAt: -1 });
      if (!session) return res.status(409).json({ ok: false, message: 'لا توجد حصة جارية لإنهائها' });
      session.status = 'completed';
      session.endedAt = when;
      if (Number.isFinite(Number(req.body.score))) session.score = Math.max(0, Number(req.body.score));
      if (Number.isFinite(Number(req.body.maxScore))) session.maxScore = Math.max(0, Number(req.body.maxScore));
      if (clean(req.body.note)) session.teacherNote = clean(req.body.note).slice(0, 2000);
      await session.save();
      await Student.updateOne({ _id: session.student }, { $inc: { 'progress.sessions': 1 } });
      return res.json({ ok: true, action, studyLocked: false, session: { id: String(session._id), status: session.status, endedAt: session.endedAt } });
    }

    const student = await resolveStudent(req);
    if (!student) return res.status(404).json({ ok: false, message: 'لا يوجد طالب مطابق للصف والشعبة المختارة' });
    const question = clean(req.body.question);

    if (action === 'question' && question) {
      const sources = await Knowledge.find({ verified: true, stage: student.stage, grade: student.grade, ...(subject ? { subject } : {}) }).limit(6).lean();
      const result = await schoolAI.ask({ student, subject, lesson, sources }, [{ role: 'user', content: question.slice(0, 4000) }]);
      if (!result || !result.answer) return res.status(502).json({ ok: false, message: 'لم يصل جواب من المعلم' });
      const record = await LearningRecord.create({
        guardian: req.user._id, student: student._id, subject, lesson,
        question: question.slice(0, 4000), answer: clean(result.answer).slice(0, 12000),
        provider: result.provider || '', model: result.model || '',
        sources: sources.map((source) => ({ source: source._id, title: source.title, page: source.page || '', sourceType: source.sourceType, year: source.year || null }))
      });
      return res.status(201).json({ ok: true, action, student: { id: String(student._id), name: student.name }, record: { id: String(record._id), answer: record.answer } });
    }

    const record = await LearningRecord.create({
      guardian: req.user._id, student: student._id, subject, lesson,
      question: CLASS_ACTIONS[action],
      answer: clean(req.body.note) || ('تم التسجيل من صفحة الصف والحصة في ' + when.toISOString()),
      provider: 'school-classroom'
    });
    res.status(201).json({ ok: true, action, student: { id: String(student._id), name: student.name }, record: { id: String(record._id) }, at: when.toISOString() });
  } catch (error) {
    if (error && error.status) return res.status(error.status).json({ ok: false, message: error.message });
    next(error);
  }
});

module.exports = router;
module.exports.buildStructure = buildStructure;
