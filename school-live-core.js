/* school-live-core.js — pure helpers for the REAL CLASSROOM V1 page
 * (school-live.html). No DOM, no network: identical in the browser
 * (window.SchoolLiveCore) and in Node tests (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SchoolLiveCore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STAGES = ['ابتدائي', 'متوسط', 'إعدادي'];
  var str = function (v, max) { return String(v === undefined || v === null ? '' : v).trim().slice(0, max || 200); };
  var uniq = function (list) { var seen = {}; return list.filter(function (x) { if (!x || seen[x]) return false; seen[x] = true; return true; }); };

  function normalizeCode(value) {
    var code = str(value, 12).toUpperCase();
    return /^[A-Z0-9]{4,12}$/.test(code) ? code : '';
  }

  function codeFromSearch(search) {
    var m = /(?:[?&])code=([^&#]+)/.exec(String(search || ''));
    return m ? normalizeCode(decodeURIComponent(m[1])) : '';
  }

  /** userId from a JWT payload without any library (client identity only). */
  function userIdFromToken(token) {
    try {
      var part = String(token || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var json = typeof atob === 'function' ? atob(part) : Buffer.from(part, 'base64').toString('binary');
      var payload = JSON.parse(decodeURIComponent(json.split('').map(function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join('')));
      return payload && payload.userId ? String(payload.userId) : '';
    } catch (e) { return ''; }
  }

  /** Cascading choices from the real Iraqi curriculum catalogue items. */
  function cascade(items, selection) {
    items = Array.isArray(items) ? items : [];
    selection = selection || {};
    var stages = STAGES.filter(function (s) { return items.some(function (it) { return it.stage === s; }); });
    var grades = selection.stage ? uniq(items.filter(function (it) { return it.stage === selection.stage; }).map(function (it) { return it.grade; })) : [];
    var subjects = selection.stage && selection.grade ? uniq(items.filter(function (it) { return it.stage === selection.stage && it.grade === selection.grade; }).map(function (it) { return it.subject; })) : [];
    return { stages: stages, grades: grades, subjects: subjects };
  }

  /** The guardian's REAL pupils that belong to this classroom's stage+grade. */
  function pupilsFor(students, classroom) {
    students = Array.isArray(students) ? students : [];
    if (!classroom) return students.filter(function (s) { return s && s.active !== false; });
    return students.filter(function (s) { return s && s.active !== false && s.stage === classroom.stage && s.grade === classroom.grade; });
  }

  /**
   * Options for "attend as": real pupils of the classroom's grade first, then
   * the account itself. Never invents a pupil.
   */
  function attendeeOptions(students, classroom, accountName) {
    var pupils = pupilsFor(students, classroom).map(function (s) {
      return { value: String(s._id || s.id), label: s.name + ' — ' + s.grade, permissions: s.learningPermissions || { camera: false, voice: false } };
    });
    pupils.push({ value: '', label: 'أنا بنفسي (' + (accountName || 'هذا الحساب') + ')', permissions: { camera: true, voice: true } });
    return pupils;
  }

  function classroomTitle(c) {
    if (!c) return '';
    var head = str(c.subject) + ' — ' + str(c.grade) + ' (' + str(c.stage) + ')';
    return c.lesson ? head + ' · ' + str(c.lesson) : head;
  }

  function counts(classroom) {
    var list = ((classroom && classroom.participants) || []).filter(function (p) { return p.role === 'student'; });
    var present = list.filter(function (p) { return p.present; });
    return {
      present: present.length,
      online: present.filter(function (p) { return p.online; }).length,
      hands: present.filter(function (p) { return p.handRaised; }).length
    };
  }

  /** Teacher grid rows: present students, online first, raised hands first (oldest hand first). */
  function studentTiles(classroom) {
    var list = ((classroom && classroom.participants) || []).filter(function (p) { return p.role === 'student' && p.present; });
    return list.slice().sort(function (a, b) {
      if (Boolean(a.online) !== Boolean(b.online)) return a.online ? -1 : 1;
      if (Boolean(a.handRaised) !== Boolean(b.handRaised)) return a.handRaised ? -1 : 1;
      if (a.handRaised && b.handRaised) return String(a.handRaisedAt || '').localeCompare(String(b.handRaisedAt || ''));
      return String(a.name).localeCompare(String(b.name), 'ar');
    }).map(function (p) {
      return {
        userId: String(p.userId), name: p.name, online: Boolean(p.online),
        camera: Boolean(p.media && p.media.camera), mic: Boolean(p.media && p.media.mic),
        handRaised: Boolean(p.handRaised), mutedByTeacher: Boolean(p.mutedByTeacher),
        permissions: p.permissions || { camera: true, voice: true }
      };
    });
  }

  function teacherOf(classroom) {
    return ((classroom && classroom.participants) || []).find(function (p) { return p.role === 'teacher'; }) || null;
  }

  /** Student-side device button state: the guardian's consent and the teacher's mute win. */
  function deviceState(you, kind, active) {
    you = you || {};
    var perms = you.permissions || { camera: true, voice: true };
    if (kind === 'camera') {
      if (perms.camera === false) return { disabled: true, active: false, label: '📷 الكاميرا غير مسموحة', reason: 'ولي الأمر لم يفعّل الكاميرا لهذا الطالب من صفحة المدرسة' };
      return { disabled: false, active: Boolean(active), label: active ? '📷 إيقاف الكاميرا' : '📷 تشغيل الكاميرا', reason: '' };
    }
    if (perms.voice === false) return { disabled: true, active: false, label: '🎙️ الصوت غير مسموح', reason: 'ولي الأمر لم يفعّل الصوت لهذا الطالب من صفحة المدرسة' };
    if (you.mutedByTeacher) return { disabled: true, active: false, label: '🔇 كتم المعلم صوتك', reason: 'المعلم كتم الميكروفون؛ سيعود الزر عند رفع الكتم' };
    return { disabled: false, active: Boolean(active), label: active ? '🎙️ إيقاف المايك' : '🎙️ تشغيل المايك', reason: '' };
  }

  /**
   * Star reconciliation for the teacher: which online students still need a
   * peer connection and which existing connections must be closed.
   */
  function reconcilePeers(classroom, existingIds) {
    var existing = {};
    (existingIds || []).forEach(function (id) { existing[String(id)] = true; });
    var wanted = {};
    studentTiles(classroom).filter(function (t) { return t.online; }).forEach(function (t) { wanted[t.userId] = true; });
    return {
      offer: Object.keys(wanted).filter(function (id) { return !existing[id]; }),
      close: Object.keys(existing).filter(function (id) { return !wanted[id]; })
    };
  }

  function statusText(classroom, you) {
    if (!classroom) return '';
    if (classroom.status === 'ended') return 'انتهت الحصة';
    if (you && you.role === 'teacher') {
      var c = counts(classroom);
      return c.present ? ('الحاضرون: ' + c.present + ' · المتصلون الآن: ' + c.online + (c.hands ? ' · ✋ ' + c.hands : '')) : 'لا يوجد طلاب حاضرون بعد — شارك رمز الحصة ' + classroom.code;
    }
    return classroom.teacherOnline ? 'المعلم متصل — ' + classroom.teacherName : 'بانتظار اتصال المعلم ' + classroom.teacherName;
  }

  return {
    STAGES: STAGES,
    normalizeCode: normalizeCode,
    codeFromSearch: codeFromSearch,
    userIdFromToken: userIdFromToken,
    cascade: cascade,
    pupilsFor: pupilsFor,
    attendeeOptions: attendeeOptions,
    classroomTitle: classroomTitle,
    counts: counts,
    studentTiles: studentTiles,
    teacherOf: teacherOf,
    deviceState: deviceState,
    reconcilePeers: reconcilePeers,
    statusText: statusText
  };
}));
