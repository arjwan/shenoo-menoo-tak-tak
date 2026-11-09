'use strict';
const VirtualSession = require('../models/VirtualClassroomSession');
const KnowledgeSource = require('../models/SchoolKnowledgeSource');
const { getCurriculumConnection } = require('../config/curriculum-db');
const { normalizeCode } = require('./school-virtual-classroom');

function failure(code, status) { const error = new Error(code); error.status = status; return error; }
function id(value) { return String(value?._id || value || ''); }
async function getLessonCurriculumContext(sessionCode, userId) {
  const code = normalizeCode(sessionCode);
  if (!code || !userId) throw failure('INVALID_SESSION_OR_USER_PARAMS', 400);
  // Session and membership are checked against the existing MariaDB runtime.
  const session = await VirtualSession.findOne({ code }).lean();
  if (!session) throw failure('SESSION_NOT_FOUND', 404);
  if (session.status !== 'active') throw failure('SESSION_ENDED', 410);
  const host = id(session.hostUser) === id(userId);
  const member = (session.participants || []).some(p =>
    id(p.user) === id(userId) && !p.leftAt
  );
  if (!host && !member) throw failure('UNAUTHORIZED_CLASSROOM_ACCESS', 403);

  const conn = await getCurriculumConnection();
  // The exported model is a MariaDB wrapper; use its original Mongoose schema.
  const schema = KnowledgeSource.$original?.schema;
  const Source = conn.models?.SchoolKnowledgeSource ||
    (schema && conn.model('SchoolKnowledgeSource', schema));
  if (!Source) throw failure('CURRICULUM_SCHEMA_UNAVAILABLE', 503);
  // Never trust a client-provided source ID or lesson title.
  // Match the server-stored class binding and require verified sources.
  const candidates = await Source.find({
    stage: session.stage,
    grade: session.grade,
    subject: session.subject,
    lesson: session.lesson,
    verified: true
  }).select('title stage grade subject lesson page content sourceType verified').limit(20).lean();
  const source = candidates.find(s =>
    (!session.sourcePage || String(s.page || '') === String(session.sourcePage)) &&
    (!session.sourceTitle || s.title === session.sourceTitle ||
      String(session.sourceTitle).startsWith(s.title + ' —'))
  );
  if (!source) throw failure('VERIFIED_CURRICULUM_SOURCE_NOT_FOUND', 404);
  return {
    sessionCode: session.code,
    stage: session.stage,
    grade: session.grade,
    subject: session.subject,
    lessonTitle: session.lesson,
    curriculum: {
      sourceId: String(source._id),
      bookTitle: source.title,
      page: source.page || '',
      verifiedContent: source.content
    },
    teacherProfile: {
      name: session.virtualTeacher?.name || '',
      dialect: session.virtualTeacher?.dialect || 'ar-standard'
    }
  };
}
module.exports = { getLessonCurriculumContext };
