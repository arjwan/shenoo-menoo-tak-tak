'use strict';

// REST API for AI Virtual Teacher Classroom (Virtual Classroom V1).
// Paths are mounted under /api/school/virtual, completely disjoint from
// existing school and school-live routes.
//
// Authentication: all endpoints use requireAuth.
// Roles: students cannot become teachers; only host/admin/developer can end sessions.
// Curriculum: real catalog sources only.
// AI: honest 503 if provider is not configured.
const router = require('express').Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const VirtualSession = require('../models/VirtualClassroomSession');
const VirtualProfile = require('../models/VirtualTeacherProfile');
const VirtualMessage = require('../models/VirtualClassroomMessage');
const Student = require('../models/SchoolStudent');
const Knowledge = require('../models/SchoolKnowledgeSource');
const vsvc = require('../services/school-virtual-classroom');
const curriculumIndex = require('../services/school-curriculum-index');
const schoolAI = require('../services/school-ai');

function io(req) {
  return req.app.get('io') || null;
}

function roomName(code) {
  return `virtual:${vsvc.normalizeCode(code)}`;
}

function emitVirtual(req, code, event, data) {
  const socketServer = io(req);
  if (!socketServer) return;
  socketServer.to(roomName(code)).emit(event, data);
}

async function loadSessionByCode(code, req, res) {
  const normalized = vsvc.normalizeCode(code);
  if (!normalized) {
    res.status(404).json({ ok: false, message: 'رمز الحصة الافتراضية غير صالح' });
    return null;
  }
  const session = await VirtualSession.findOne({ code: normalized });
  if (!session) {
    res.status(404).json({ ok: false, message: 'لا توجد حصة بهذا الرمز' });
    return null;
  }
  return session;
}

async function generateUniqueSessionCode() {
  for (let i = 0; i < 10; i += 1) {
    const code = vsvc.generateCode(6);
    // eslint-disable-next-line no-await-in-loop
    const exists = await VirtualSession.exists({ code });
    if (!exists) return code;
  }
  throw new Error('تعذر إنشاء رمز فريد للحصة');
}

router.use(requireAuth);

/** 1. GET /profiles: Available AI Virtual Teacher Personas */
router.get('/profiles', async (_req, res, next) => {
  try {
    const builtin = VirtualProfile.getBuiltinProfiles();
    const dbProfiles = await VirtualProfile.find({ active: true }).lean();
    const mergedMap = new Map();
    for (const p of builtin) mergedMap.set(p.profileId, p);
    for (const p of dbProfiles) mergedMap.set(p.profileId, p);
    res.json({ ok: true, profiles: Array.from(mergedMap.values()) });
  } catch (e) { next(e); }
});

/** 2. POST /sessions: Create a Virtual Classroom Session */
router.post('/sessions', async (req, res, next) => {
  try {
    // Permission check: Real teacher/admin/developer/guardian can create
    const role = String(req.user.role || '').toLowerCase();
    const isPrivileged = ['admin', 'developer', 'teacher'].includes(role) ||
      Boolean(req.user.isTeacher) ||
      Boolean(req.user.profile?.profession && /معلم|مدرس|أستاذ/.test(req.user.profile.profession));

    // Also allow any authenticated account that is a guardian of students
    const studentCount = await Student.countDocuments({ guardian: req.user._id, active: true });
    if (!isPrivileged && studentCount === 0) {
      // Must be teacher, admin, developer, or have registered student profiles
      return res.status(403).json({
        ok: false,
        message: 'إنشاء الحصة الافتراضية متاح للمعلم أو مدير المدرسة أو ولي الأمر المشرف فقط.'
      });
    }

    // Curriculum verification against real sources
    const curResult = await vsvc.validateCurriculumSource(req.body);
    if (!curResult.ok) {
      return res.status(400).json({ ok: false, message: curResult.error });
    }

    // Persona selection
    const profileId = String(req.body.profileId || 'sarah-smart').trim().toLowerCase();
    const profile = await VirtualProfile.findProfile(profileId);
    if (!profile) {
      return res.status(400).json({ ok: false, message: 'شخصية المعلم الافتراضي المحددة غير موجودة' });
    }

    const dialect = ['ar-standard', 'ar-iraqi', 'en'].includes(req.body.dialect) ? req.body.dialect : 'ar-standard';
    const code = await generateUniqueSessionCode();
    const now = new Date();

    const initialWhiteboard = vsvc.buildInitialWhiteboard(
      curResult.value.stage,
      curResult.value.grade,
      curResult.value.subject,
      curResult.value.lesson,
      curResult.value
    );

    const session = await VirtualSession.create({
      code,
      hostUser: req.user._id,
      hostName: vsvc.accountName(req.user),
      hostRole: isPrivileged ? 'teacher' : 'guardian',
      virtualTeacher: {
        profileId: profile.profileId,
        name: profile.name,
        label: 'معلم افتراضي / AI',
        title: profile.title,
        avatar: profile.avatar || '',
        dialect,
        voiceEnabled: true
      },
      ...curResult.value,
      whiteboardData: initialWhiteboard,
      status: 'active',
      startedAt: now,
      participants: [
        {
          user: req.user._id,
          name: vsvc.accountName(req.user),
          role: 'host',
          permissions: { camera: true, voice: true },
          joinedAt: now,
          leftAt: null,
          online: true,
          handRaised: false,
          media: { camera: false, mic: false },
          attendance: [{ joinedAt: now, leftAt: null }]
        }
      ]
    });

    // Save initial greeting message from the virtual teacher
    const greetingText = profile.introGreeting || `أهلاً بكم في درس ${curResult.value.lesson}. أنا ${profile.name} (${profile.label}).`;
    await VirtualMessage.create({
      session: session._id,
      code: session.code,
      senderType: 'teacher_ai',
      senderName: profile.name,
      type: 'speech_bubble',
      text: greetingText,
      timestamp: now
    });

    res.status(201).json({
      ok: true,
      code: session.code,
      session: vsvc.publicSession(session, { roster: true }),
      room: roomName(session.code)
    });
  } catch (e) { next(e); }
});

/** 3. GET /sessions/active: Active Virtual Sessions */
router.get('/sessions/active', async (req, res, next) => {
  try {
    const q = { status: 'active' };
    if (req.query.stage) q.stage = String(req.query.stage).trim();
    if (req.query.grade) q.grade = String(req.query.grade).trim();
    if (req.query.subject) q.subject = String(req.query.subject).trim();
    const sessions = await VirtualSession.find(q).sort({ startedAt: -1 }).limit(50);
    res.json({ ok: true, sessions: sessions.map((s) => vsvc.publicSession(s)) });
  } catch (e) { next(e); }
});

/** 4. GET /sessions/mine: My Sessions */
router.get('/sessions/mine', async (req, res, next) => {
  try {
    const hosting = await VirtualSession.findOne({ hostUser: req.user._id, status: 'active' });
    const attending = await VirtualSession.findOne({
      status: 'active',
      participants: { $elemMatch: { user: req.user._id, role: 'student', leftAt: null } }
    });
    res.json({
      ok: true,
      hosting: hosting ? vsvc.publicSession(hosting, { roster: true }) : null,
      attending: attending ? vsvc.publicSession(attending, { roster: true }) : null
    });
  } catch (e) { next(e); }
});

/** 5. GET /sessions/:code: Get Session Info */
router.get('/sessions/:code', async (req, res, next) => {
  try {
    const session = await loadSessionByCode(req.params.code, req, res);
    if (!session) return;
    res.json({
      ok: true,
      session: vsvc.publicSession(session, { roster: true }),
      room: roomName(session.code)
    });
  } catch (e) { next(e); }
});

/** 6. POST /sessions/:code/join: Join Session */
router.post('/sessions/:code/join', async (req, res, next) => {
  try {
    const session = await loadSessionByCode(req.params.code, req, res);
    if (!session) return;

    let realStudent = null;
    if (req.body.studentId) {
      if (!mongoose.Types.ObjectId.isValid(String(req.body.studentId))) {
        return res.status(400).json({ ok: false, message: 'معرف الطالب غير صالح' });
      }
      realStudent = await Student.findOne({
        _id: req.body.studentId,
        guardian: req.user._id,
        active: true
      });
      if (!realStudent) {
        return res.status(404).json({ ok: false, message: 'الطالب غير موجود ضمن ملفات حسابك' });
      }
      // Grade check: student grade must match session grade
      const stdGrade = String(realStudent.grade || '').replace(/\s+/g, '');
      const sessGrade = String(session.grade || '').replace(/\s+/g, '');
      if (stdGrade && sessGrade && !stdGrade.includes(sessGrade) && !sessGrade.includes(stdGrade)) {
        return res.status(400).json({
          ok: false,
          message: `صف الطالب (${realStudent.grade}) لا يطابق صف الحصة (${session.grade})`
        });
      }
    }

    const joinResult = vsvc.joinParticipant(session, {
      user: req.user,
      student: realStudent
    });

    if (!joinResult.ok) {
      return res.status(joinResult.status || 400).json({ ok: false, message: joinResult.error });
    }

    await session.save();

    emitVirtual(req, session.code, 'school:virtual:update', {
      code: session.code,
      session: vsvc.publicSession(session, { roster: true })
    });

    res.status(joinResult.isNew ? 201 : 200).json({
      ok: true,
      participant: vsvc.publicParticipant(joinResult.participant),
      session: vsvc.publicSession(session, { roster: true }),
      room: roomName(session.code)
    });
  } catch (e) { next(e); }
});

/** 7. POST /sessions/:code/leave: Leave Session */
router.post('/sessions/:code/leave', async (req, res, next) => {
  try {
    const session = await loadSessionByCode(req.params.code, req, res);
    if (!session) return;
    const result = vsvc.leaveParticipant(session, req.user._id);
    if (!result.ok) {
      return res.status(result.status || 400).json({ ok: false, message: result.error });
    }
    await session.save();

    emitVirtual(req, session.code, 'school:virtual:update', {
      code: session.code,
      session: vsvc.publicSession(session, { roster: true })
    });

    res.json({ ok: true, code: session.code });
  } catch (e) { next(e); }
});

/** 8. POST /sessions/:code/hand: Raise / Lower Hand */
router.post('/sessions/:code/hand', async (req, res, next) => {
  try {
    const session = await loadSessionByCode(req.params.code, req, res);
    if (!session) return;
    const raised = req.body.raised !== undefined ? Boolean(req.body.raised) : true;
    const targetId = req.body.userId || req.user._id;

    const result = vsvc.setHand(session, req.user._id, targetId, raised);
    if (!result.ok) {
      return res.status(result.status || 400).json({ ok: false, message: result.error });
    }

    await session.save();

    emitVirtual(req, session.code, 'school:virtual:hand', {
      code: session.code,
      userId: vsvc.idOf(targetId),
      handRaised: raised
    });
    emitVirtual(req, session.code, 'school:virtual:update', {
      code: session.code,
      session: vsvc.publicSession(session, { roster: true })
    });

    res.json({ ok: true, participant: vsvc.publicParticipant(result.participant) });
  } catch (e) { next(e); }
});

/** 9. POST /sessions/:code/media: Update Device State */
router.post('/sessions/:code/media', async (req, res, next) => {
  try {
    const session = await loadSessionByCode(req.params.code, req, res);
    if (!session) return;

    const result = vsvc.setMedia(session, req.user._id, {
      camera: req.body.camera,
      mic: req.body.mic
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ ok: false, message: result.error });
    }

    await session.save();

    emitVirtual(req, session.code, 'school:virtual:update', {
      code: session.code,
      session: vsvc.publicSession(session, { roster: true })
    });

    res.json({ ok: true, media: result.media, forced: result.forced });
  } catch (e) { next(e); }
});

/** 10. POST /sessions/:code/whiteboard: Update Whiteboard (Host only) */
router.post('/sessions/:code/whiteboard', async (req, res, next) => {
  try {
    const session = await loadSessionByCode(req.params.code, req, res);
    if (!session) return;
    if (!vsvc.canManage(session, req.user)) {
      return res.status(403).json({ ok: false, message: 'تعديل السبورة متاح للمعلم المشرف فقط' });
    }

    const { currentSlide, drawing } = req.body;
    if (session.whiteboardData) {
      if (typeof currentSlide === 'number' && currentSlide >= 0) {
        session.whiteboardData.currentSlide = currentSlide;
      }
      if (typeof drawing === 'string') {
        const slideIdx = session.whiteboardData.currentSlide || 0;
        if (session.whiteboardData.slides && session.whiteboardData.slides[slideIdx]) {
          session.whiteboardData.slides[slideIdx].drawing = drawing.slice(0, 500000);
        }
      }
    }

    await session.save();

    emitVirtual(req, session.code, 'school:virtual:whiteboard', {
      code: session.code,
      whiteboardData: session.whiteboardData
    });

    res.json({ ok: true, whiteboardData: session.whiteboardData });
  } catch (e) { next(e); }
});

/** 11. POST /sessions/:code/end: End Session (Host/Admin only) */
router.post('/sessions/:code/end', async (req, res, next) => {
  try {
    const session = await loadSessionByCode(req.params.code, req, res);
    if (!session) return;
    const result = vsvc.endSession(session, req.user);
    if (!result.ok) {
      return res.status(result.status || 400).json({ ok: false, message: result.error });
    }

    await session.save();

    emitVirtual(req, session.code, 'school:virtual:ended', {
      code: session.code,
      endedAt: session.endedAt
    });

    res.json({ ok: true, code: session.code, session: vsvc.publicSession(session, { roster: true }) });
  } catch (e) { next(e); }
});

/** 12. GET /sessions/:code/attendance: Attendance Report */
router.get('/sessions/:code/attendance', async (req, res, next) => {
  try {
    const session = await loadSessionByCode(req.params.code, req, res);
    if (!session) return;
    if (!vsvc.canManage(session, req.user)) {
      return res.status(403).json({ ok: false, message: 'تقرير الحضور متاح للمعلم المشرف فقط' });
    }
    res.json({ ok: true, code: session.code, attendance: vsvc.attendanceReport(session) });
  } catch (e) { next(e); }
});

/** 13. POST /sessions/:code/questions: Ask a Question in the Session */
router.post('/sessions/:code/questions', async (req, res, next) => {
  try {
    const session = await loadSessionByCode(req.params.code, req, res);
    if (!session) return;
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ ok: false, message: 'نص السؤال مطلوب' });

    const participant = vsvc.findParticipant(session, req.user._id);
    const senderName = participant ? participant.name : vsvc.accountName(req.user);
    const studentId = participant?.student || null;

    // Save student's question message
    const questionMsg = await VirtualMessage.create({
      session: session._id,
      code: session.code,
      senderType: 'student',
      senderUser: req.user._id,
      senderStudent: studentId,
      senderName,
      type: 'question',
      text: text.slice(0, 4000),
      isVoiceQuestion: Boolean(req.body.isVoice)
    });

    emitVirtual(req, session.code, 'school:virtual:message', {
      code: session.code,
      message: questionMsg
    });

    // Check if AI provider is configured
    if (!schoolAI.configured()) {
      // Do NOT invent a fake answer! Return honest 503
      return res.status(503).json({
        ok: false,
        aiAvailable: false,
        message: 'خدمة المعلم الافتراضي غير مفعلة — لا يوجد مزود ذكاء اصطناعي مربوط بالخادم.',
        question: questionMsg
      });
    }

    // AI is configured: query AI using curriculum context
    try {
      const studentContext = {
        name: senderName,
        stage: session.stage,
        grade: session.grade
      };

      const sources = [];
      if (session.lessonContent || session.sourceTitle) {
        sources.push({
          title: session.sourceTitle,
          page: session.sourcePage || '',
          content: session.lessonContent || session.sourceBookName || session.sourceTitle
        });
      }

      // Enrich with relevant indexed curriculum pages for this subject, grade, and question
      if (curriculumIndex && typeof curriculumIndex.searchCurriculum === 'function') {
        try {
          const hits = curriculumIndex.searchCurriculum({
            stage: session.stage,
            grade: session.grade,
            subject: session.subject,
            query: text,
            limit: 3
          });
          for (const h of hits) {
            sources.push({
              title: `${h.bookTitle} — ص ${h.page}`,
              page: String(h.page),
              chapter: h.chapter,
              lesson: h.lesson,
              content: h.snippet || h.content.slice(0, 600)
            });
          }
        } catch (_) {}
      }

      // Fetch recent messages for conversational context
      const prev = await VirtualMessage.find({ session: session._id, type: { $in: ['question', 'answer'] } })
        .sort({ timestamp: -1 })
        .limit(6)
        .lean();

      const history = prev.reverse().map((m) => ({
        role: m.senderType === 'teacher_ai' ? 'assistant' : 'user',
        content: m.text
      }));

      const aiResult = await schoolAI.ask(
        { student: studentContext, subject: session.subject, lesson: session.lesson, sources },
        [...history, { role: 'user', content: text }]
      );

      if (aiResult && aiResult.answer) {
        const answerMsg = await VirtualMessage.create({
          session: session._id,
          code: session.code,
          senderType: 'teacher_ai',
          senderName: session.virtualTeacher.name,
          type: 'answer',
          text: aiResult.answer.slice(0, 4000),
          aiProvider: aiResult.provider || '',
          aiModel: aiResult.model || '',
          sourceRefs: [{ title: session.sourceTitle, page: session.sourcePage || '' }]
        });

        emitVirtual(req, session.code, 'school:virtual:message', {
          code: session.code,
          message: answerMsg
        });

        return res.json({
          ok: true,
          aiAvailable: true,
          question: questionMsg,
          answer: answerMsg
        });
      }
    } catch (aiErr) {
      return res.status(503).json({
        ok: false,
        aiAvailable: false,
        message: 'خدمة المعلم الافتراضي غير مفعلة — تعذر معالجة الإجابة من المزود.',
        question: questionMsg
      });
    }

    res.json({ ok: true, question: questionMsg, aiAvailable: false });
  } catch (e) { next(e); }
});

/** 14. GET /sessions/:code/messages: Message History */
router.get('/sessions/:code/messages', async (req, res, next) => {
  try {
    const session = await loadSessionByCode(req.params.code, req, res);
    if (!session) return;
    const messages = await VirtualMessage.find({ session: session._id })
      .sort({ timestamp: 1 })
      .limit(200);
    res.json({ ok: true, messages });
  } catch (e) { next(e); }
});

module.exports = router;
