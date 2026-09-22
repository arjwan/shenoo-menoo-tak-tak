'use strict';

// school-virtual-classroom: Pure rule functions and business logic for the
// AI Virtual Teacher Classroom.
//
// Core constraints:
// - Real curriculum sources only: verified against the Iraqi curriculum catalog / KnowledgeSource.
// - AI Virtual Teacher personas: clearly labeled "معلم افتراضي / AI", never impersonating human teachers.
// - Honest empty states and real students: no fake students generated.
// - Security & roles: students cannot become teachers; only host/admin/developer can end or manage class.
const catalog = require('../data/iraqi-curriculum-catalog');
const Knowledge = require('../models/SchoolKnowledgeSource');

const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function generateCode(len = 6) {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    const idx = Math.floor(Math.random() * CODE_CHARS.length);
    s += CODE_CHARS[idx];
  }
  return s;
}

function normalizeCode(v) {
  const c = String(v || '').trim().toUpperCase();
  return /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(c) ? c : '';
}

function idOf(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (v._id) return String(v._id);
  return String(v);
}

function accountName(user) {
  if (!user) return 'مستخدم';
  return String(user.displayName || user.fullName || user.username || 'مستخدم').trim();
}

/** Check whether user can manage/end this virtual session (host, admin, developer). */
function canManage(session, user) {
  if (!user || !session) return false;
  const uid = idOf(user._id || user);
  const hostId = idOf(session.hostUser);
  if (uid && hostId && uid === hostId) return true;
  const role = String(user.role || '').toLowerCase();
  return role === 'admin' || role === 'developer';
}

/** Validate curriculum against real Iraqi catalog and/or SchoolKnowledgeSource. */
async function validateCurriculumSource(input) {
  const stage = String(input.stage || '').trim();
  const grade = String(input.grade || '').trim();
  const subject = String(input.subject || '').trim();
  const lesson = String(input.lesson || '').trim();

  if (!['ابتدائي', 'متوسط', 'إعدادي'].includes(stage)) {
    return { ok: false, error: 'المرحلة غير صالحة. اختر مرحلة معتمدة.' };
  }
  if (!grade) return { ok: false, error: 'الصف الدراسي مطلوب.' };
  if (!subject) return { ok: false, error: 'اسم المادة مطلوب.' };
  if (!lesson) return { ok: false, error: 'عنوان الدرس مطلوب لبدء الحصة الافتراضية.' };

  // 1) Search in Knowledge DB if present
  let dbSource = null;
  try {
    dbSource = await Knowledge.findOne({
      stage,
      grade,
      subject,
      $or: [{ verified: true }, { sourceType: 'official_textbook' }]
    }).lean();
  } catch (e) {
    dbSource = null;
  }

  // 2) Search in Iraqi curriculum catalog (108 real books)
  const catalogItem = (catalog.items || []).find((item) => {
    if (item.stage !== stage) return false;
    const itemGrade = String(item.grade || '').replace(/\s+/g, '');
    const reqGrade = grade.replace(/\s+/g, '');
    if (itemGrade !== reqGrade && !itemGrade.includes(reqGrade) && !reqGrade.includes(itemGrade)) return false;
    const itemSubject = String(item.subject || '').trim();
    return itemSubject === subject || itemSubject.includes(subject) || subject.includes(itemSubject);
  });

  if (!dbSource && !catalogItem) {
    return {
      ok: false,
      error: `لا يوجد مصدر منهج معتمد في الكتالوج العراقي لمادة (${subject}) للصف (${grade}) في مرحلة (${stage}). لا يمكن بدء حصة افتراضية بدون منهج حقيقي.`
    };
  }

  const sourceTitle = dbSource?.title || catalogItem?.title || `كتاب ${subject} — ${grade}`;
  const sourceBookName = catalogItem?.title || dbSource?.title || `كتاب ${subject}`;
  const sourceCatalogId = catalogItem?.id || '';
  const sourcePage = dbSource?.page || '';
  const lessonContent = dbSource?.content || catalogItem?.content || '';

  return {
    ok: true,
    value: {
      stage,
      grade,
      subject,
      lesson,
      sourceTitle,
      sourceBookName,
      sourceCatalogId,
      sourcePage,
      lessonContent
    }
  };
}

/** Construct initial whiteboard slide(s) based on real curriculum lesson. */
function buildInitialWhiteboard(stage, grade, subject, lesson, sourceMeta = {}) {
  // Check if it is the Mathematics lesson "الكسور العشرية والكسور العادية" or similar
  const isMathFractions = subject.includes('الرياضيات') && (lesson.includes('الكسور') || lesson.includes('عشري'));
  
  if (isMathFractions) {
    return {
      slides: [
        {
          title: lesson || 'الكسور العشرية والكسور العادية',
          subtitle: 'تمثيل الكسور على خط الأعداد وتحويل الكسر العادي إلى عشري',
          leftColumn: {
            title: 'تحويل الكسر العادي إلى عشري',
            items: [
              '1/2 = 0.5',
              '3/4 = 0.75',
              '1/4 = 0.25'
            ]
          },
          rightColumn: {
            title: 'تمثيل الكسور على خط الأعداد',
            items: [
              '0 ── 0.25 ── 0.5 ── 0.75 ── 1'
            ],
            diagram: 'number_line'
          },
          example: 'مثال: حول الكسر 3/5 إلى كسر عشري → 3 ÷ 5 = 0.6',
          note: 'ملاحظة: ليس كل كسر عشري ينتهي. فبعضها دوري مثل 1/3 = 0.333...',
          drawing: ''
        }
      ],
      currentSlide: 0
    };
  }

  // General structured lesson slides from real curriculum
  return {
    slides: [
      {
        title: lesson,
        subtitle: `${stage} — ${grade} — ${subject} (المصدر: ${sourceMeta.sourceTitle || 'المنهج العراقي المعتمد'})`,
        leftColumn: {
          title: 'المفاهيم الأساسية للدرس',
          items: [
            `الدرس: ${lesson}`,
            `المادة: ${subject}`,
            `الصف: ${grade}`
          ]
        },
        rightColumn: {
          title: 'النقاط التعليمية',
          items: [
            'قراءة وتحليل أفكار الدرس خطوة بخطوة',
            'حل الأمثلة التطبيقية من الكتاب المدرسي'
          ],
          diagram: 'concept_card'
        },
        example: `تطبيق عملي من ${sourceMeta.sourceBookName || 'الكتاب المنهجي'}`,
        note: 'يمكن للطلاب طرح الأسئلة وسيقوم المعلم الافتراضي بالإجابة عليها ومناقشتها.',
        drawing: ''
      }
    ],
    currentSlide: 0
  };
}

function findParticipant(session, userId) {
  const key = idOf(userId);
  return (session.participants || []).find((p) => idOf(p.user) === key) || null;
}

function isPresent(p) {
  return Boolean(p && !p.leftAt);
}

function joinParticipant(session, input) {
  const { user, student } = input;
  const at = input.at || new Date();
  if (session.status !== 'active') {
    return { ok: false, error: 'هذه الحصة الافتراضية انتهت', status: 410 };
  }

  const userId = idOf(user._id || user);
  const isSessionHost = canManage(session, user);
  let participant = findParticipant(session, userId);

  if (isSessionHost && !student) {
    if (!participant) {
      participant = {
        user: user._id || user,
        name: accountName(user),
        role: 'host',
        permissions: { camera: true, voice: true },
        joinedAt: at,
        leftAt: null,
        online: true,
        handRaised: false,
        handRaisedAt: null,
        media: { camera: false, mic: false },
        attendance: [{ joinedAt: at, leftAt: null }]
      };
      session.participants.push(participant);
      return { ok: true, participant, isNew: true, role: 'host' };
    }
    participant.leftAt = null;
    participant.online = true;
    participant.attendance = participant.attendance || [];
    participant.attendance.push({ joinedAt: at, leftAt: null });
    return { ok: true, participant, isNew: false, role: 'host' };
  }

  // Student joining
  const studentName = student ? String(student.name).trim() : accountName(user);
  const permissions = student?.learningPermissions ? {
    camera: Boolean(student.learningPermissions.camera),
    voice: Boolean(student.learningPermissions.voice)
  } : { camera: true, voice: true };

  if (!participant) {
    participant = {
      user: user._id || user,
      name: studentName,
      student: student ? (student._id || student) : null,
      role: 'student', // Student strictly stays student
      permissions,
      joinedAt: at,
      leftAt: null,
      online: true,
      handRaised: false,
      handRaisedAt: null,
      media: { camera: false, mic: false },
      attendance: [{ joinedAt: at, leftAt: null }]
    };
    session.participants.push(participant);
    return { ok: true, participant, isNew: true, role: 'student' };
  }

  // Update existing participant on rejoin
  participant.name = studentName;
  if (student) participant.student = student._id || student;
  participant.permissions = permissions;
  participant.leftAt = null;
  participant.online = true;
  participant.attendance = participant.attendance || [];
  participant.attendance.push({ joinedAt: at, leftAt: null });

  return { ok: true, participant, isNew: false, role: 'student' };
}

function leaveParticipant(session, userId, at = new Date()) {
  const p = findParticipant(session, userId);
  if (!p) return { ok: false, error: 'المشارك غير مسجل في هذه الحصة', status: 404 };
  if (!p.leftAt) {
    p.leftAt = at;
    p.online = false;
    p.media = { camera: false, mic: false };
    p.handRaised = false;
    if (Array.isArray(p.attendance) && p.attendance.length) {
      const last = p.attendance[p.attendance.length - 1];
      if (last && !last.leftAt) last.leftAt = at;
    }
  }
  return { ok: true, participant: p };
}

function setOnline(session, userId, online) {
  const p = findParticipant(session, userId);
  if (!p) return { ok: false, error: 'المشارك غير موجود', status: 404 };
  const changed = p.online !== Boolean(online);
  p.online = Boolean(online);
  if (!online) {
    p.media = { camera: false, mic: false };
  }
  return { ok: true, participant: p, changed };
}

function setHand(session, actorId, targetId, raised, at = new Date()) {
  if (session.status !== 'active') return { ok: false, error: 'الحصة منتهية', status: 410 };
  const actorKey = idOf(actorId);
  const targetKey = idOf(targetId || actorId);
  const target = findParticipant(session, targetKey);
  if (!target) return { ok: false, error: 'الطالب غير موجود في الحصة', status: 404 };
  
  const isSelf = actorKey === targetKey;
  const isSessionHost = canManage(session, actorId);
  
  if (!isSelf && !(isSessionHost && raised === false)) {
    return { ok: false, error: 'يمكن للمعلم فقط إنزال يد طالب آخر', status: 403 };
  }
  if (target.role === 'host') {
    return { ok: false, error: 'المعلم لا يرفع يده', status: 400 };
  }

  const changed = target.handRaised !== Boolean(raised);
  target.handRaised = Boolean(raised);
  target.handRaisedAt = raised ? at : null;
  return { ok: true, participant: target, changed };
}

function setMedia(session, userId, input = {}) {
  if (session.status !== 'active') return { ok: false, error: 'الحصة منتهية', status: 410 };
  const p = findParticipant(session, userId);
  if (!p) return { ok: false, error: 'المشارك غير موجود', status: 404 };

  const prev = p.media || { camera: false, mic: false };
  let camera = input.camera !== undefined ? Boolean(input.camera) : prev.camera;
  let mic = input.mic !== undefined ? Boolean(input.mic) : prev.mic;
  const forced = [];

  // Enforce guardian consent permissions
  if (camera && p.permissions && p.permissions.camera === false) {
    camera = false;
    forced.push('camera');
  }
  if (mic && p.permissions && p.permissions.voice === false) {
    mic = false;
    forced.push('mic');
  }

  const changed = prev.camera !== camera || prev.mic !== mic;
  p.media = { camera, mic };
  return { ok: true, participant: p, changed, forced, media: { camera, mic } };
}

function endSession(session, actor, at = new Date()) {
  if (!canManage(session, actor)) {
    return { ok: false, error: 'إنهاء الحصة من صلاحية المعلم/المدير فقط', status: 403 };
  }
  if (session.status !== 'active') return { ok: true, changed: false };

  session.status = 'ended';
  session.endedAt = at;
  for (const p of session.participants || []) {
    if (!p.leftAt) {
      p.leftAt = at;
      p.online = false;
      p.media = { camera: false, mic: false };
      p.handRaised = false;
      if (Array.isArray(p.attendance) && p.attendance.length) {
        const last = p.attendance[p.attendance.length - 1];
        if (last && !last.leftAt) last.leftAt = at;
      }
    }
  }
  return { ok: true, changed: true };
}

function publicParticipant(p) {
  if (!p) return null;
  return {
    userId: idOf(p.user),
    name: p.name,
    studentId: p.student ? idOf(p.student) : null,
    role: p.role,
    online: Boolean(p.online),
    handRaised: Boolean(p.handRaised),
    handRaisedAt: p.handRaisedAt,
    media: { camera: Boolean(p.media?.camera), mic: Boolean(p.media?.mic) },
    permissions: { camera: Boolean(p.permissions?.camera), voice: Boolean(p.permissions?.voice) },
    joinedAt: p.joinedAt,
    leftAt: p.leftAt
  };
}

function publicSession(session, opts = {}) {
  if (!session) return null;
  const participants = Array.isArray(session.participants) ? session.participants : [];
  const present = participants.filter(isPresent);
  const students = present.filter((p) => p.role === 'student');

  const base = {
    code: session.code,
    status: session.status,
    hostUserId: idOf(session.hostUser),
    hostName: session.hostName,
    hostRole: session.hostRole,
    virtualTeacher: session.virtualTeacher || {
      profileId: 'sarah-smart',
      name: 'أ. سارة الذكية',
      label: 'معلم افتراضي / AI',
      title: 'معلم رياضيات وعلوم افتراضي',
      dialect: 'ar-standard',
      voiceEnabled: true
    },
    stage: session.stage,
    grade: session.grade,
    subject: session.subject,
    lesson: session.lesson,
    sourceTitle: session.sourceTitle,
    sourceBookName: session.sourceBookName,
    sourcePage: session.sourcePage,
    lessonContent: session.lessonContent,
    whiteboardData: session.whiteboardData || { slides: [], currentSlide: 0 },
    presentCount: present.length,
    studentCount: students.length,
    startedAt: session.startedAt,
    endedAt: session.endedAt
  };

  if (opts.roster) {
    base.participants = participants.map(publicParticipant);
  }
  return base;
}

function attendanceReport(session) {
  const out = [];
  for (const p of session.participants || []) {
    let totalMs = 0;
    const intervals = (p.attendance || []).map((it) => {
      const start = it.joinedAt ? new Date(it.joinedAt).getTime() : 0;
      const end = it.leftAt ? new Date(it.leftAt).getTime() : (session.endedAt ? new Date(session.endedAt).getTime() : Date.now());
      if (start && end > start) totalMs += (end - start);
      return { joinedAt: it.joinedAt, leftAt: it.leftAt };
    });
    out.push({
      userId: idOf(p.user),
      name: p.name,
      studentId: p.student ? idOf(p.student) : null,
      role: p.role,
      online: Boolean(p.online),
      handRaised: Boolean(p.handRaised),
      intervals,
      minutesPresent: Math.max(0, Math.round(totalMs / 60000))
    });
  }
  return out;
}

module.exports = {
  generateCode,
  normalizeCode,
  idOf,
  accountName,
  canManage,
  validateCurriculumSource,
  buildInitialWhiteboard,
  findParticipant,
  isPresent,
  joinParticipant,
  leaveParticipant,
  setOnline,
  setHand,
  setMedia,
  endSession,
  publicParticipant,
  publicSession,
  attendanceReport
};
