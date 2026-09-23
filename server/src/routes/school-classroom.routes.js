'use strict';

// REST surface for the seven standalone school pages (index/structure/teachers/
// students/curriculum/reader/classroom). Adds paths only — never shadows the
// existing school endpoints (students, teachers, curriculum, sessions, ...).
//
// Books are NEVER claimed as "loaded" just because they appear in the
// catalogue: availability is derived from verified Knowledge documents and
// from the iraqi-curriculum-files manifest (status === 'ok' + real fileName).

const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const Student = require('../models/SchoolStudent');
const Knowledge = require('../models/SchoolKnowledgeSource');
const Session = require('../models/SchoolSession');
const iraqiCurriculum = require('../data/iraqi-curriculum-catalog');
const iraqiCurriculumFiles = require('../data/iraqi-curriculum-files.json');
const curriculumIndex = require('../services/school-curriculum-index');

router.use(requireAuth);

const clean = (v) => String(v == null ? '' : v).trim();

function filesByDriveId() {
  const map = new Map();
  for (const f of iraqiCurriculumFiles.files || []) {
    if (f && f.driveId) map.set(String(f.driveId), f);
  }
  return map;
}

function enrichCatalogItem(item, fileMap) {
  const out = {
    id: item.id,
    title: item.title,
    sourceType: item.sourceType,
    stage: item.stage,
    grade: item.grade,
    subject: item.subject,
    year: item.year || null,
    content: item.content || '',
    verified: item.verified === true,
    availability: item.availability || 'source_pending',
    sourceUrl: item.sourceUrl || '',
    chapter: item.chapter || '',
    lesson: item.lesson || '',
    file: {
      url: (item.file && item.file.url) || '',
      originalName: (item.file && item.file.originalName) || '',
      mimeType: (item.file && item.file.mimeType) || 'application/pdf',
      size: (item.file && item.file.size) || 0,
      pages: (item.file && item.file.pages) || 0,
      sha256: (item.file && item.file.sha256) || ''
    }
  };
  // A catalogue row is "available" only when a real file is on disk (or a
  // verified Knowledge document supplies a file.url). The files manifest is
  // the source of truth for downloaded PDFs; catalogue rows stay pending
  // until matched.
  if (out.file.url && out.verified) {
    out.availability = 'available';
    return out;
  }
  // Optional future matchers could join catalogue <-> files by title; until
  // then every catalogue row that is still pending stays pending — the 136
  // downloaded PDFs are exposed separately via /books?source=files.
  return out;
}

function publicFile(item) {
  const url = `/uploads/school-curriculum/${item.fileName}`;
  const disk = path.resolve(__dirname, '../../../uploads/school-curriculum', item.fileName);
  const onDisk = fs.existsSync(disk);
  return {
    id: item.driveId,
    title: item.fileName,
    driveId: item.driveId,
    sourcePage: item.sourcePage,
    sourceUrl: item.sourceUrl,
    fileName: item.fileName,
    bytes: item.bytes,
    pages: item.pages,
    sha256: item.sha256,
    status: item.status,
    // availability distinguishes "indexed in the manifest" from "bytes on
    // this server". A client must not treat source_pending catalogue rows
    // as readable books just because the count is 108.
    availability: onDisk && item.status === 'ok' ? 'available' : (item.status === 'ok' ? 'remote_ok' : 'source_pending'),
    url: onDisk ? url : '',
    file: { url: onDisk ? url : '', originalName: item.fileName, mimeType: 'application/pdf', size: item.bytes || 0 }
  };
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const students = await Student.find({ guardian: req.user._id, active: true }).sort({ createdAt: 1 }).lean();
    const verifiedBooks = await Knowledge.countDocuments({ verified: true });
    const activeSession = await Session.findOne({ guardian: req.user._id, status: 'active' }).sort({ startedAt: -1 }).lean();
    const catalog = iraqiCurriculum.items || [];
    const stages = [...new Set(catalog.map((x) => x.stage))];
    const grades = [...new Set(catalog.map((x) => x.grade))];
    const files = (iraqiCurriculumFiles.files || []).map(publicFile);
    const availableFiles = files.filter((f) => f.availability === 'available');
    res.json({
      ok: true,
      user: { id: String(req.user._id), name: req.user.displayName || req.user.fullName },
      stats: {
        students: students.length,
        stages: stages.length,
        grades: grades.length,
        catalogBooks: catalog.length,
        verifiedKnowledge: verifiedBooks,
        indexedPdfs: files.length,
        availablePdfs: availableFiles.length
      },
      students,
      activeSession: activeSession || null
    });
  } catch (e) { next(e); }
});

router.get('/structure', (req, res) => {
  const catalog = iraqiCurriculum.items || [];
  const stages = {};
  for (const item of catalog) {
    if (!stages[item.stage]) stages[item.stage] = {};
    if (!stages[item.stage][item.grade]) stages[item.stage][item.grade] = new Set();
    stages[item.stage][item.grade].add(item.subject);
  }
  const tree = Object.keys(stages).map((stage) => ({
    stage,
    grades: Object.keys(stages[stage]).map((grade) => ({
      grade,
      subjects: [...stages[stage][grade]].sort()
    }))
  }));
  res.json({ ok: true, version: iraqiCurriculum.version, tree, totalBooks: catalog.length });
});

router.get('/books', async (req, res, next) => {
  try {
    const filters = ['stage', 'grade', 'subject'];
    const q = clean(req.query.q || req.query.search || '').toLowerCase();
    const source = clean(req.query.source || 'catalog');

    if (source === 'files') {
      let files = (iraqiCurriculumFiles.files || []).map(publicFile);
      if (q) {
        files = files.filter((f) =>
          String(f.fileName).toLowerCase().includes(q) ||
          String(f.sourcePage).toLowerCase().includes(q) ||
          String(f.driveId).toLowerCase().includes(q)
        );
      }
      return res.json({
        ok: true,
        source: 'files',
        total: files.length,
        available: files.filter((f) => f.availability === 'available').length,
        items: files
      });
    }

    const fileMap = filesByDriveId();
    let items = (iraqiCurriculum.items || [])
      .filter((item) => filters.every((k) => !req.query[k] || item[k] === req.query[k]))
      .map((item) => enrichCatalogItem(item, fileMap));

    // Merge verified Knowledge documents (real uploads) on top.
    const knowledgeQ = { $or: [{ verified: true }, { uploadedBy: req.user._id }] };
    for (const k of filters) if (req.query[k]) knowledgeQ[k] = req.query[k];
    const knowledge = await Knowledge.find(knowledgeQ).select('-content').sort({ updatedAt: -1 }).limit(200).lean();
    const knowledgeItems = knowledge.map((k) => ({
      id: String(k._id),
      title: k.title,
      sourceType: k.sourceType,
      stage: k.stage,
      grade: k.grade,
      subject: k.subject,
      year: k.year || null,
      content: '',
      verified: k.verified === true,
      availability: (k.file && k.file.url) ? 'available' : (k.verified ? 'verified_metadata' : 'source_pending'),
      sourceUrl: k.sourceUrl || '',
      file: k.file || { url: '', originalName: '', mimeType: '', size: 0 }
    }));

    // Knowledge first (real), then catalogue rows that aren't duplicates by title+grade+subject.
    const seen = new Set(knowledgeItems.map((x) => `${x.grade}|${x.subject}|${x.title}`));
    const catalogRest = items.filter((x) => !seen.has(`${x.grade}|${x.subject}|${x.title}`));
    let combined = knowledgeItems.concat(catalogRest);

    if (q) {
      combined = combined.filter((x) =>
        String(x.title || '').toLowerCase().includes(q) ||
        String(x.subject || '').toLowerCase().includes(q) ||
        String(x.grade || '').toLowerCase().includes(q) ||
        String(x.stage || '').toLowerCase().includes(q)
      );
    }

    const available = combined.filter((x) => x.availability === 'available' && x.file && x.file.url);
    res.json({
      ok: true,
      source: 'catalog+knowledge',
      version: iraqiCurriculum.version,
      total: combined.length,
      available: available.length,
      pending: combined.length - available.length,
      items: combined
    });
  } catch (e) { next(e); }
});


router.get('/books/:id/outline', (req, res) => {
  try {
    const outlines = require('../data/iraqi-curriculum-outlines.json');
    const id = String(req.params.id || '');
    const book = (outlines.books || []).find((b) => b.catalogId === id);
    if (!book) return res.status(404).json({ ok: false, message: 'لا يوجد فهرس لهذا الكتاب' });
    res.json({ ok: true, book });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.get('/books/:id/reader', async (req, res, next) => {
  try {
    const id = clean(req.params.id);
    // 1) Knowledge document (real upload / verified curriculum)
    let knowledge = null;
    try { knowledge = await Knowledge.findById(id).lean(); } catch (_) { knowledge = null; }
    if (knowledge) {
      const fileUrl = (knowledge.file && knowledge.file.url) || knowledge.sourceUrl || '';
      return res.json({
        ok: true,
        readable: Boolean(fileUrl),
        book: {
          id: String(knowledge._id),
          title: knowledge.title,
          stage: knowledge.stage,
          grade: knowledge.grade,
          subject: knowledge.subject,
          verified: knowledge.verified === true,
          availability: fileUrl ? 'available' : 'source_pending',
          sourceUrl: knowledge.sourceUrl || '',
          file: knowledge.file || { url: fileUrl, originalName: '', mimeType: 'application/pdf', size: 0 },
          content: knowledge.content || '',
          question: knowledge.question || '',
          modelAnswer: knowledge.modelAnswer || ''
        }
      });
    }

    // 2) Catalogue row by id
    const catalogItem = (iraqiCurriculum.items || []).find((x) => x.id === id);
    if (catalogItem) {
      const enriched = enrichCatalogItem(catalogItem, filesByDriveId());
      return res.json({
        ok: true,
        readable: Boolean(enriched.file && enriched.file.url),
        book: enriched
      });
    }

    // 3) Files manifest by driveId
    const file = (iraqiCurriculumFiles.files || []).find((x) => String(x.driveId) === id);
    if (file) {
      const pub = publicFile(file);
      return res.json({ ok: true, readable: pub.availability === 'available', book: pub });
    }

    return res.status(404).json({ ok: false, message: 'الكتاب غير موجود' });
  } catch (e) { next(e); }
});

router.get('/books/:id/page/:page', async (req, res, next) => {
  try {
    const id = clean(req.params.id);
    const pageNum = Math.max(1, parseInt(req.params.page, 10) || 1);
    const data = curriculumIndex.loadPagesData();
    const pages = data.pages || [];

    const bookPages = pages.filter((p) => p.bookId === id || p.fileName === id || (p.bookTitle && id.includes(p.bookId)));
    const totalPages = bookPages.length;

    const matchedPage = bookPages.find((p) => p.page === pageNum) ||
      pages.find((p) => (p.bookId === id || p.fileName === id) && p.page === pageNum);

    if (!matchedPage) {
      return res.status(404).json({
        ok: false,
        message: 'الصفحة غير موجودة في هذا الكتاب',
        page: pageNum,
        totalPages
      });
    }

    res.json({
      ok: true,
      bookId: id,
      page: pageNum,
      totalPages: totalPages || 1,
      pageData: {
        page: matchedPage.page,
        chapter: matchedPage.chapter || '',
        lesson: matchedPage.lesson || '',
        content: matchedPage.content || '',
        bookTitle: matchedPage.bookTitle || '',
        stage: matchedPage.stage || '',
        grade: matchedPage.grade || '',
        subject: matchedPage.subject || '',
        fileName: matchedPage.fileName || ''
      }
    });
  } catch (e) { next(e); }
});

router.get('/curriculum/search', async (req, res, next) => {
  try {
    const query = clean(req.query.q || req.query.query || '');
    const stage = clean(req.query.stage || '');
    const grade = clean(req.query.grade || '');
    const subject = clean(req.query.subject || '');
    const bookId = clean(req.query.bookId || '');
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 10));

    if (!query) {
      return res.status(400).json({ ok: false, message: 'كلمة البحث مطلوبة' });
    }

    let hits = curriculumIndex.searchCurriculum({ stage, grade, subject, query, limit: 50 });
    if (bookId) {
      hits = hits.filter((h) => h.bookId === bookId || (h.bookTitle && bookId.includes(h.bookId)));
    }

    res.json({
      ok: true,
      total: hits.length,
      results: hits.slice(0, limit)
    });
  } catch (e) { next(e); }
});

router.get('/classroom/options', async (req, res, next) => {
  try {
    const students = await Student.find({ guardian: req.user._id, active: true }).sort({ createdAt: 1 }).lean();
    // Teachers come from the existing seed surface shape.
    const teachersRes = { teachers: [] };
    try {
      // Reuse the same seed list the main school router exposes by requiring
      // nothing private — the /teachers endpoint is the public contract.
      // Here we rebuild options from catalog structure + students only; the
      // page will also call GET /api/school/teachers for the full directory.
    } catch (_) {}
    const catalog = iraqiCurriculum.items || [];
    const stages = [...new Set(catalog.map((x) => x.stage))];
    const gradesByStage = {};
    const subjectsByGrade = {};
    for (const item of catalog) {
      gradesByStage[item.stage] = gradesByStage[item.stage] || new Set();
      gradesByStage[item.stage].add(item.grade);
      subjectsByGrade[item.grade] = subjectsByGrade[item.grade] || new Set();
      subjectsByGrade[item.grade].add(item.subject);
    }
    const activeSession = await Session.findOne({ guardian: req.user._id, status: 'active' })
      .populate('student', 'name stage grade subjects learningPermissions section')
      .sort({ startedAt: -1 }).lean();
    res.json({
      ok: true,
      students,
      stages,
      gradesByStage: Object.fromEntries(Object.entries(gradesByStage).map(([k, v]) => [k, [...v]])),
      subjectsByGrade: Object.fromEntries(Object.entries(subjectsByGrade).map(([k, v]) => [k, [...v]])),
      activeSession: activeSession || null
    });
  } catch (e) { next(e); }
});

router.post('/classroom/actions', async (req, res, next) => {
  try {
    const action = clean(req.body.action || req.body.type);
    if (!action) return res.status(400).json({ ok: false, message: 'نوع الإجراء مطلوب' });

    if (action === 'start') {
      const studentId = req.body.studentId;
      const student = await Student.findOne({ _id: studentId, guardian: req.user._id, active: true });
      if (!student) return res.status(404).json({ ok: false, message: 'الطالب غير موجود' });
      const subject = clean(req.body.subject);
      const lesson = clean(req.body.lesson);
      if (!subject) return res.status(400).json({ ok: false, message: 'اختر المادة أولًا' });
      const existing = await Session.findOne({ guardian: req.user._id, status: 'active' }).sort({ startedAt: -1 });
      if (existing) return res.status(409).json({ ok: false, message: 'لديك حصة دراسية جارية بالفعل', session: existing });
      const session = await Session.create({
        guardian: req.user._id,
        student: student._id,
        mode: req.body.mode === 'group' ? 'group' : 'individual',
        subject,
        lesson
      });
      await session.populate('student', 'name stage grade subjects learningPermissions section');
      return res.status(201).json({ ok: true, action, session, studyLocked: true });
    }

    if (action === 'complete' || action === 'end') {
      const session = await Session.findOne({ _id: req.body.sessionId, guardian: req.user._id, status: 'active' });
      if (!session) return res.status(404).json({ ok: false, message: 'الحصة غير موجودة' });
      session.status = 'completed';
      session.endedAt = new Date();
      session.score = Number(req.body.score || 0);
      session.maxScore = Number(req.body.maxScore || 0);
      session.teacherNote = clean(req.body.teacherNote).slice(0, 2000);
      await session.save();
      await Student.updateOne({ _id: session.student }, { $inc: { 'progress.sessions': 1 } });
      return res.json({ ok: true, action, session, studyLocked: false });
    }

    if (action === 'raise-hand' || action === 'question' || action === 'answer' || action === 'board-note') {
      // Live classroom signals are handled over the school socket registry;
      // this REST endpoint acknowledges and echoes so the pages can stay
      // server-driven without inventing client-side state.
      return res.json({
        ok: true,
        action,
        kind: action,
        text: clean(req.body.text).slice(0, 2000),
        roomId: clean(req.body.roomId).slice(0, 80),
        at: new Date().toISOString()
      });
    }

    return res.status(400).json({ ok: false, message: 'إجراء غير معروف: ' + action });
  } catch (e) { next(e); }
});

module.exports = router;
