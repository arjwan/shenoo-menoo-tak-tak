/* Shno Mano — School Canva adapter core (pure, dependency-free).
 *
 * Shared by the browser adapter (school-canva-adapter.js, injected into the
 * immutable Canva original's iframe) and by the Node test-suite. It defines
 * the exact translation between the original's raw-WebSocket integration
 * envelope and the project's authenticated Socket.IO classroom events.
 *
 * The original (original-assets/school-canva/school-canva-original.html) is
 * immutable: everything it needs is fed through its own
 * window.configureIntegration() hook and the WebSocket global this core
 * bridges to Socket.IO.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ShnoSchoolCanvaCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Marker URL: only WebSocket connections to this scheme are bridged to
  // Socket.IO; any other URL still uses the native browser WebSocket.
  var MARKER_PREFIX = 'shno-school://';

  // Original envelope type -> authenticated Socket.IO event.
  var OUTBOUND = {
    heartbeat: { event: 'school:heartbeat', args: function (p) { return [{}]; } },
    joinRoom: { event: 'school:join', args: function (p) { return [{ roomId: p && p.roomId }]; } },
    leaveRoom: { event: 'school:leave', args: function (p) { return [{ roomId: p && p.roomId }]; } },
    offer: { event: 'school:webrtc:offer', args: function (p) { return [{ roomId: p && p.roomId, offer: p && p.offer }]; } },
    answer: { event: 'school:webrtc:answer', args: function (p) { return [{ roomId: p && p.roomId, answer: p && p.answer }]; } },
    iceCandidate: { event: 'school:webrtc:ice', args: function (p) { return [{ roomId: p && p.roomId, candidate: p && p.candidate }]; } }
  };

  // Server event -> original envelope (field names must match the original's
  // handleSignal(): offer/answer/iceCandidate + roomId + value).
  var INBOUND = {
    'school:webrtc:offer': function (d) { return { type: 'offer', roomId: d.roomId, offer: d.offer, from: d.from || '' }; },
    'school:webrtc:answer': function (d) { return { type: 'answer', roomId: d.roomId, answer: d.answer, from: d.from || '' }; },
    'school:webrtc:ice': function (d) { return { type: 'iceCandidate', roomId: d.roomId, candidate: d.candidate, from: d.from || '' }; },
    'school:participants': function (d) { return { type: 'participants', roomId: d.roomId, participants: d.participants || [], left: d.left || '' }; },
    'school:live': function (d) { return { type: 'live', roomId: d.roomId, kind: d.kind || '', text: d.text || '', from: d.from || '', name: d.name || '', at: d.at || '' }; }
  };

  function isMarkerUrl(url) {
    return String(url || '').indexOf(MARKER_PREFIX) === 0;
  }

  /**
   * Translate one outbound envelope {type, payload, ...} into a Socket.IO
   * command. Returns null for unknown types (they stay no-ops, exactly like
   * the original treats unknown inbound events).
   */
  function toSocketCommand(envelope) {
    var mapping = OUTBOUND[envelope && envelope.type];
    if (!mapping) return null;
    var payload = (envelope && envelope.payload) || {};
    return { event: mapping.event, args: mapping.args(payload) };
  }

  /** Translate one inbound Socket.IO event into an original envelope. */
  function fromSocketEvent(event, data) {
    var mapping = INBOUND[event];
    return mapping ? mapping(data || {}) : null;
  }

  var INBOUND_EVENTS = Object.keys(INBOUND);
  var OUTBOUND_TYPES = Object.keys(OUTBOUND);

  /**
   * Build the RTCPeerConnection iceServers list from the adapter config.
   * STUN is the project default; TURN (with optional username/credential)
   * only appears when the server configured it from environment.
   */
  function buildIceServers(config) {
    config = config || {};
    var servers = [];
    var stun = String(config.stunUrl || '').trim();
    if (stun) servers.push({ urls: stun });
    var turns = Array.isArray(config.turnServers) ? config.turnServers : [];
    for (var i = 0; i < turns.length; i++) {
      var s = turns[i] || {};
      var urls = Array.isArray(s.urls) ? s.urls : [s.urls];
      urls = urls.map(function (u) { return String(u || '').trim(); }).filter(Boolean);
      if (!urls.length) continue;
      var server = { urls: urls.length === 1 ? urls[0] : urls };
      if (s.username) server.username = String(s.username);
      if (s.username && s.credential) server.credential = String(s.credential);
      servers.push(server);
    }
    return servers;
  }

  function defaultConfig() {
    return {
      restApiUrl: '',
      websocketUrl: '',
      stunUrl: '',
      turnServers: [],
      environment: 'demo',
      requestTimeoutMs: 8000,
      schemaVersion: '1.0'
    };
  }

  /** Same demo rule as the original: no restApiUrl and no websocketUrl. */
  function isDemoConfig(config) {
    return !config || (!config.restApiUrl && !config.websocketUrl);
  }

  /**
   * Map a real guardian's learningPermissions (school page consent) to the
   * original's consent labels. Only explicit true grants the original's
   * media gate; everything else stays "بانتظار الموافقة" (never auto-grant).
   */
  function mapConsents(permissions) {
    var base = { camera: 'بانتظار الموافقة', mic: 'بانتظار الموافقة', recording: 'بانتظار الموافقة' };
    var p = permissions || {};
    if (p.camera === true) base.camera = 'موافق عليه';
    else if (p.camera === false) base.camera = 'مرفوض';
    if (p.voice === true) base.mic = 'موافق عليه';
    else if (p.voice === false) base.mic = 'مرفوض';
    return base;
  }

  function consentAllowsMedia(consents, kind) {
    var key = kind === 'video' ? 'camera' : 'mic';
    return Boolean(consents && consents[key] === 'موافق عليه');
  }

  /**
   * View wiring (pure mappers only — the browser adapter applies them to the
   * original's own data globals and DOM so every page shows the real account).
   */

  /** Pick the best offline-pack item for a subject (stage+grade preferred). */
  function pickPackItem(items, subject, stage, grade) {
    items = Array.isArray(items) ? items : [];
    var matching = items.filter(function (it) { return it && it.subject === subject; });
    if (!matching.length) return null;
    return matching.find(function (it) { return it.stage === stage && it.grade === grade; }) ||
      matching.find(function (it) { return it.stage === stage; }) || matching[0];
  }

  /**
   * Build the original's lessons[subject] entry from a real offline-pack
   * item. Any field the pack does not carry falls back to the demo lesson,
   * so the original's board/exam machinery keeps working either way.
   */
  function packLesson(item, fallback) {
    item = item || {};
    fallback = fallback || {};
    return {
      unit: item.chapter || fallback.unit || 'وحدة المنهاج',
      lesson: item.lesson || item.title || fallback.lesson || 'درس من المنهاج',
      points: item.content || fallback.points || '',
      question: item.question || fallback.question || '',
      exam: item.question || fallback.exam || '',
      keys: item.modelAnswer ? [item.modelAnswer] : (fallback.keys || [])
    };
  }

  /** Real curriculum rows for the original's state.library catalog. */
  function packLibrary(items) {
    items = Array.isArray(items) ? items : [];
    return items.map(function (it) {
      var parts = [it.stage, it.grade, it.subject, it.chapter, it.lesson].filter(Boolean);
      return {
        name: it.title || (it.file && it.file.originalName) || 'ملف منهج',
        chapter: parts.length ? parts.join(' ← ') : 'منهاج شنو منو',
        status: it.verified === false ? 'مرفوع — بانتظار الاعتماد' : 'منهاج شنو منو'
      };
    });
  }

  /** The seven home statistics (students, teachers, grades, subjects, lessons, exams, reports). */
  function homeStats(input) {
    input = input || {};
    function distinct(arr) {
      var seen = {};
      var out = [];
      (Array.isArray(arr) ? arr : []).forEach(function (x) {
        x = String(x || '').trim();
        if (x && !seen[x]) { seen[x] = 1; out.push(x); }
      });
      return out;
    }
    return [
      Number(input.studentCount) || 0,
      Number(input.teacherCount) || 0,
      distinct(input.grades).length,
      distinct(input.subjects).length,
      Number(input.lessonCount) || 0,
      Number(input.examCount) || 0,
      Number(input.reportCount) || 0
    ];
  }

  function formatCount(n) {
    try { return Number(n || 0).toLocaleString('en-US'); } catch (e) { return String(n || 0); }
  }

  /**
   * Derive the original's learning path (stage/grade/subject/teacher) from a
   * real student and the platform's real teacher directory.
   */
  function studentPath(student, teachers) {
    student = student || {};
    teachers = Array.isArray(teachers) ? teachers : [];
    var stage = String(student.stage || '').trim();
    var grade = String(student.grade || '').trim();
    var subjects = (Array.isArray(student.subjects) ? student.subjects : [])
      .map(function (s) { return String(s || '').trim(); }).filter(Boolean);
    var subject = subjects[0] || '';
    var match = teachers.find(function (t) {
      return t && t.stage === stage && t.subject === subject &&
        Array.isArray(t.grades) && t.grades.indexOf(grade) !== -1;
    });
    if (!match) match = teachers.find(function (t) { return t && t.stage === stage && t.subject === subject; });
    return {
      stage: stage,
      grade: grade,
      subject: subject,
      subjects: subjects,
      teacherId: match ? String(match.id || '') : ''
    };
  }

  /** Text replacements for the report view (the original hard-codes demo values). */
  function reportPatches(data) {
    data = data || {};
    var patches = [];
    if (data.studentName) patches.push({ from: 'ليان أحمد', to: String(data.studentName) });
    if (Number.isFinite(data.sessions) && data.sessions > 0) {
      patches.push({ from: 'مدة التعلم: 25 دقيقة (تجريبي)', to: 'الحصص المكتملة: ' + data.sessions + ' (شنو منو)' });
    }
    if (Number.isFinite(data.average) && data.average > 0) {
      patches.push({ from: 'نسبة التقدم: 70%', to: 'متوسط الدرجات: ' + Math.round(data.average) + '% (شنو منو)' });
    }
    return patches;
  }

  /** Consent log line built from the real consent state. */
  function consentLogText(consents) {
    var c = consents || {};
    var labels = { camera: 'الكاميرا', mic: 'الميكروفون', recording: 'التسجيل' };
    var parts = Object.keys(labels).map(function (k) { return labels[k] + ': ' + (c[k] || 'بانتظار الموافقة'); });
    return 'سجل الموافقات (من ملف الطالب في شنو منو): ' + parts.join(' | ') + '. لا يتم حفظ صوت أو فيديو أو صور كاميرا.';
  }

  /** Student-seat cards: the real student first, then live participants. */
  function seatCards(studentName, participants) {
    var seats = [];
    var seen = {};
    function add(name, status) {
      name = String((name && (name.name || name.id)) || name || '').trim();
      if (!name || seen[name]) return;
      seen[name] = 1;
      seats.push({ name: name, status: status });
    }
    add(studentName, 'طالبك (حقيقي)');
    (Array.isArray(participants) ? participants : []).forEach(function (p) { add(p, 'متصل الآن'); });
    if (!seats.length) seats.push({ name: 'بانتظار الطلاب', status: '—' });
    return seats;
  }

  /**
   * Deterministic classroom id from the learning context. Stable across
   * reloads/reconnects so the same student+subject always meets in the same
   * room; no secrets derived.
   */
  function stableRoomId(parts) {
    var input = (parts || []).map(function (p) { return String(p == null ? '' : p).trim(); }).join('|');
    var h = 5381;
    for (var i = 0; i < input.length; i++) {
      h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
    }
    var slug = input.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48);
    return 'canva-' + h.toString(36) + '-' + (slug || 'room');
  }

  return {
    MARKER_PREFIX: MARKER_PREFIX,
    INBOUND_EVENTS: INBOUND_EVENTS,
    OUTBOUND_TYPES: OUTBOUND_TYPES,
    isMarkerUrl: isMarkerUrl,
    toSocketCommand: toSocketCommand,
    fromSocketEvent: fromSocketEvent,
    buildIceServers: buildIceServers,
    defaultConfig: defaultConfig,
    isDemoConfig: isDemoConfig,
    mapConsents: mapConsents,
    consentAllowsMedia: consentAllowsMedia,
    stableRoomId: stableRoomId,
    pickPackItem: pickPackItem,
    packLesson: packLesson,
    packLibrary: packLibrary,
    homeStats: homeStats,
    formatCount: formatCount,
    studentPath: studentPath,
    reportPatches: reportPatches,
    consentLogText: consentLogText,
    seatCards: seatCards
  };
});
