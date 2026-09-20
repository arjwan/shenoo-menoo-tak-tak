'use strict';

// Pure mapping layer between the immutable Canva school original's queue
// records (the `record` object it POSTs to /operations) and the real Shno
// Mano school models. No Mongoose, no I/O: the route in
// routes/school-canva.routes.js applies the returned plan.
//
// Record fields come from the original's createRecord() and are contract
// documented by tests/api-school-canva-runtime.js.

const STAGES = new Set(['ابتدائي', 'متوسط', 'إعدادي']);
const CONSENT_APPROVED = 'موافق عليه';

function text(value, max) {
  const s = String(value == null ? '' : value).trim();
  return s.length > max ? s.slice(0, max) : s;
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Extract the idempotency key exactly like the original sends it:
 * header `Idempotency-Key` (syncNow) with the record id as fallback.
 */
function extractClientOpId(headers = {}, body = {}) {
  const fromHeaders = String((headers && (headers['idempotency-key'] || headers['Idempotency-Key'])) || '').trim();
  if (fromHeaders) return fromHeaders.slice(0, 160);
  const fromBody = String((body && (body.id || body.clientOpId)) || '').trim();
  return fromBody.slice(0, 160);
}

/**
 * Build the deterministic operation plan for one Canva record.
 * Returns { ok:false, error } when the record cannot be represented with
 * the real school models (the route answers 400 and the item stays in the
 * client queue with status "failed").
 */
function planRecord(record = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { ok: false, error: 'السجل غير صالح' };
  }

  const name = text(record.student_name, 100) || 'طالب Canva';
  const stage = text(record.stage, 40);
  const grade = text(record.grade, 80) || 'غير محدد';
  if (!STAGES.has(stage)) {
    return { ok: false, error: 'اختر المرحلة أولاً قبل المزامنة' };
  }

  const actions = [{ kind: 'student.ensure', name, stage, grade }];
  const type = text(record.answer_type, 60);
  const subject = text(record.subject, 120);
  const lesson = text(record.question_text && record.lesson ? record.lesson : '', 160);

  if (record.camera_consent != null || record.mic_consent != null) {
    actions.push({
      kind: 'consent',
      voice: record.mic_consent === CONSENT_APPROVED,
      camera: record.camera_consent === CONSENT_APPROVED
    });
  }

  if (type === 'ملف منهج' && text(record.curriculum_file_name, 240)) {
    actions.push({
      kind: 'knowledge',
      title: text(record.curriculum_file_name, 180),
      stage,
      grade,
      subject: text(record.curriculum_subject, 120) || subject || 'غير محدد',
      chapter: text(record.curriculum_chapter, 160)
    });
  }

  if ((type === 'إجابة كتابية' || type === 'رفع يد') && text(record.answer_text, 4000)) {
    actions.push({
      kind: 'learning.record',
      subject,
      lesson,
      question: text(record.question_text, 4000),
      answer: text(record.answer_text, 4000)
    });
  }

  if (type === 'اختبار' && Number.isFinite(num(record.score, NaN))) {
    const score = Math.max(0, Math.min(100, num(record.score, 0)));
    const maxScore = Math.max(1, Math.min(100, num(record.max_score, 10)));
    actions.push({
      kind: 'score',
      subject: subject || 'غير محدد',
      score,
      maxScore,
      approved: record.grade_approved === true
    });
    if (score > 0) {
      actions.push({
        kind: 'session.complete',
        subject: subject || 'غير محدد',
        lesson,
        score,
        maxScore,
        teacherNote: text(
          record.grade_approved === true
            ? `درجة معتمدة من منصة Canva: ${score}/${maxScore}`
            : `درجة مقترحة من منصة Canva: ${score}/${maxScore} — بحاجة مراجعة المعلم`,
          2000
        )
      });
    }
  }

  if (type === 'اعتماد درجة' && Number.isFinite(num(record.score, NaN))) {
    actions.push({
      kind: 'note',
      text: `اعتماد درجة: ${Math.max(0, num(record.score, 0))}/${Math.max(1, num(record.max_score, 10))}`,
      subject: subject || 'تقرير'
    });
  }

  if ((type === 'مسودة تقرير' || type === 'إرسال تقرير') && text(record.report_status, 60)) {
    actions.push({
      kind: 'note',
      text: `تقرير (${type}): ${text(record.report_status, 60)}`,
      subject: subject || 'تقرير'
    });
  }

  return {
    ok: true,
    student: { name, stage, grade },
    actions
  };
}

module.exports = { planRecord, extractClientOpId, STAGES: Array.from(STAGES), CONSENT_APPROVED };
