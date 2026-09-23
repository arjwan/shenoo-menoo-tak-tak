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

  /**
   * Index of the verified PDF manifest (GET /api/school/curriculum/files).
   * Real field names only: files[].fileName / url / catalogId / bytes / pages.
   * A catalogue book is "readable" when one of its real identifiers matches a
   * manifest entry that carries a url on this server.
   */
  function indexCurriculumFiles(files) {
    var byName = {}, byUrl = {}, byCatalogId = {};
    (Array.isArray(files) ? files : []).forEach(function (f) {
      if (!f || !f.url) return;
      if (f.fileName) byName[String(f.fileName)] = f;
      byUrl[String(f.url)] = f;
      if (f.catalogId !== null && f.catalogId !== undefined && f.catalogId !== '') byCatalogId[String(f.catalogId)] = f;
    });
    return { byName: byName, byUrl: byUrl, byCatalogId: byCatalogId };
  }

  function matchCurriculumFile(item, index) {
    if (!item || !index) return null;
    var file = item.file || {};
    if (file.originalName && index.byName[String(file.originalName)]) return index.byName[String(file.originalName)];
    if (file.url && index.byUrl[String(file.url)]) return index.byUrl[String(file.url)];
    if (item.id !== undefined && item.id !== null && index.byCatalogId[String(item.id)]) return index.byCatalogId[String(item.id)];
    return null;
  }

  /**
   * Real curriculum rows for the original's library catalog.
   * `items` come primarily from GET /api/school/curriculum/catalog (108 books,
   * independent of the guardian's students); `files` is the verified PDF
   * manifest. Only a book joined to a real manifest url is readable — a
   * `source_pending` row stays without any open url. No demo rows ever.
   */
  function packLibrary(items, files) {
    items = Array.isArray(items) ? items : [];
    var index = indexCurriculumFiles(files);
    return items.map(function (it) {
      var parts = [it.stage, it.grade, it.subject, it.chapter, it.lesson].filter(Boolean);
      var matched = matchCurriculumFile(it, index);
      var url = matched && matched.url ? String(matched.url) : '';
      var readable = Boolean(url);
      var status;
      if (readable) {
        status = 'منهاج شنو منو — متاح للقراءة';
      } else if (it.availability === 'source_pending') {
        // Official catalogue row still waiting for a real PDF on this server.
        status = 'مفهرس — بانتظار النسخة الرسمية';
      } else if (it.verified === false) {
        // Guardian/teacher upload not yet approved.
        status = 'مرفوع — بانتظار الاعتماد';
      } else {
        status = 'منهاج شنو منو';
      }
      return {
        id: it.id !== undefined && it.id !== null ? String(it.id) : '',
        name: it.title || (it.file && it.file.originalName) || 'ملف منهج',
        chapter: parts.length ? parts.join(' ← ') : 'منهاج شنو منو',
        status: status,
        stage: it.stage || '',
        grade: it.grade || '',
        subject: it.subject || '',
        url: url,
        readable: readable,
        pages: matched ? Number(matched.pages) || 0 : 0,
        bytes: matched ? Number(matched.bytes) || 0 : 0,
        fileName: matched && matched.fileName ? String(matched.fileName) : ''
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


  // ---------------------------------------------------------------------
  // Integration contract of the 2026-09-21 Canva school page
  // (legacy Canva integration: `window.ShnoManoIntegrationAdapter`,
  // invoke([...candidates], payload) / has([...])). Pure helpers: the browser
  // adapter only adds the authenticated fetches. Vocabulary comes from the
  // real catalogue / teachers / students payloads — never from constants
  // invented here. The only fixed mapping is the page's OWN stage ids/labels
  // (primary/middle/preparatory) onto the catalogue stage names.
  // ---------------------------------------------------------------------
  var PAGE_STAGE_ALIASES = {
    primary: 'ابتدائي', 'الابتدائية': 'ابتدائي', 'ابتدائي': 'ابتدائي',
    middle: 'متوسط', 'المتوسطة': 'متوسط', 'متوسط': 'متوسط',
    preparatory: 'إعدادي', 'الإعدادية': 'إعدادي', 'إعدادي': 'إعدادي'
  };
  var PAGE_GENDER_ALIASES = { male: 'ذكر', female: 'أنثى', 'معلم': 'ذكر', 'معلمة': 'أنثى', 'ذكر': 'ذكر', 'أنثى': 'أنثى' };
  var HIERARCHY = ['stage', 'grade', 'section', 'subject', 'unit'];

  function str(v) { return v === undefined || v === null ? '' : String(v).trim(); }
  function distinct(list) {
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (x) { x = str(x); if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }
  function normalizeStage(value) {
    value = str(value);
    if (!value) return '';
    return PAGE_STAGE_ALIASES[value] || '';
  }
  /** Real grades of a stage, in catalogue order. */
  function gradesOf(items, stage) {
    return distinct((Array.isArray(items) ? items : []).filter(function (it) { return !stage || it.stage === stage; }).map(function (it) { return it.grade; }));
  }
  /**
   * Map a grade value coming from the page onto the catalogue's real grade
   * names: exact name first; otherwise the page's own local labels
   * ("الأول", "الرابع الإعدادي") match every real grade of the stage that
   * starts with the same ordinal (so a branchless label reaches both the
   * scientific and literary branches). Empty -> no grade filter.
   */
  function matchGrades(value, items, stage) {
    value = str(value);
    var real = gradesOf(items, stage);
    if (!value) return real;
    if (real.indexOf(value) !== -1) return [value];
    // A real grade name of ANOTHER stage is stale (stage changed) — never remapped.
    if (gradesOf(items, '').indexOf(value) !== -1) return [];
    var ordinal = value.split(/\s+/)[0];
    return real.filter(function (g) { return g.split(/\s+/)[0] === ordinal; });
  }
  /** Resolve the page's filter form (stage/grade/section/subject/unit/query…) onto real catalogue values. */
  function resolveFilters(payload, items) {
    payload = payload || {};
    var pick = function (a, b) { return str(payload[a] !== undefined ? payload[a] : payload[b]); };
    var stage = normalizeStage(pick('stage', 'room-stage'));
    var rawStage = pick('stage', 'room-stage');
    var grades = matchGrades(pick('grade', 'room-grade'), items, stage);
    return {
      rawStage: rawStage,
      stage: stage,
      stageKnown: !rawStage || Boolean(stage),
      grade: pick('grade', 'room-grade'),
      grades: grades,
      subject: pick('subject', 'room-subject'),
      unit: str(payload.unit),
      lesson: pick('lesson', 'room-lesson'),
      teacher: pick('teacher', 'room-teacher'),
      query: str(payload.query).toLowerCase(),
      gender: PAGE_GENDER_ALIASES[str(payload.gender)] || '',
      status: str(payload.status)
    };
  }
  function catalogMatches(it, f) {
    if (!f.stageKnown) return false;
    if (f.stage && it.stage !== f.stage) return false;
    if (f.grade && f.grades.indexOf(it.grade) === -1) return false;
    if (f.subject && it.subject !== f.subject) return false;
    return true;
  }
  function option(type, value, extra) {
    return Object.assign({ type: type, id: value, name: value }, extra || {});
  }
  /**
   * Dependent options for the page's cascade (stage -> grade -> section ->
   * subject -> unit). Rows are typed so the page routes each to its select.
   * Sections do not exist in the school backend and the catalogue carries no
   * chapters: those levels simply get no rows (the page then reports "no
   * results after a successful reply" — never invented values).
   */
  function structureOptions(items, packItems, payload) {
    items = Array.isArray(items) ? items : [];
    var f = resolveFilters(payload, items);
    var rows = [];
    if (!f.stageKnown) return rows;
    var scoped = items.filter(function (it) { return catalogMatches(it, f); });
    if (f.stage) gradesOf(scoped, f.stage).forEach(function (g) { rows.push(option('grade', g, { stage: f.stage })); });
    if (f.stage && f.grade && f.grades.length) {
      distinct(scoped.map(function (it) { return it.subject; })).forEach(function (sub) { rows.push(option('subject', sub, { stage: f.stage })); });
    }
    if (f.stage && f.grade && f.subject) {
      var chapters = distinct((Array.isArray(packItems) ? packItems : []).filter(function (k) {
        return k && k.stage === f.stage && f.grades.indexOf(k.grade) !== -1 && k.subject === f.subject;
      }).map(function (k) { return k.chapter; }).concat(scoped.map(function (it) { return it.chapter; })));
      chapters.forEach(function (ch) { rows.push(option('unit', ch, { stage: f.stage, subject: f.subject })); });
    }
    return rows;
  }
  /** Structure browser rows: the deepest selected level's children, from the catalogue only. */
  function structureRows(items, payload) {
    items = Array.isArray(items) ? items : [];
    var f = resolveFilters(payload, items);
    if (!f.stageKnown) return [];
    var scoped = items.filter(function (it) { return catalogMatches(it, f); });
    var q = function (text) { return !f.query || String(text || '').toLowerCase().indexOf(f.query) !== -1; };
    if (f.stage && f.grade && f.subject) {
      return scoped.filter(function (it) { return q(it.title); }).map(function (it) {
        return { id: it.id, type: 'book', name: it.title, stage: it.stage, grade: it.grade, subject: it.subject, year: it.year || undefined,
          status: it.availability === 'source_pending' ? 'مفهرس — بانتظار النسخة الرسمية' : 'في الكتالوج الرسمي' };
      });
    }
    if (f.stage && f.grade) {
      return distinct(scoped.map(function (it) { return it.subject; })).filter(q).map(function (sub) {
        var n = scoped.filter(function (it) { return it.subject === sub; }).length;
        return { id: sub, type: 'subject', name: sub, stage: f.stage, grade: f.grades.length === 1 ? f.grades[0] : undefined, status: n + ' كتاب' };
      });
    }
    if (f.stage) {
      return gradesOf(scoped, f.stage).filter(q).map(function (g) {
        var n = scoped.filter(function (it) { return it.grade === g; }).length;
        return { id: g, type: 'grade', name: g, stage: f.stage, status: distinct(scoped.filter(function (it) { return it.grade === g; }).map(function (it) { return it.subject; })).length + ' مادة · ' + n + ' كتاب' };
      });
    }
    return distinct(items.map(function (it) { return it.stage; })).filter(q).map(function (stg) {
      var n = items.filter(function (it) { return it.stage === stg; });
      return { id: stg, type: 'stage', name: stg, status: gradesOf(n, stg).length + ' صف · ' + n.length + ' كتاب' };
    });
  }
  /** Library rows (catalogue ⋈ manifest via packLibrary) in the page's record shape. */
  function curriculumRows(libraryRows, items, payload) {
    libraryRows = Array.isArray(libraryRows) ? libraryRows : [];
    var f = resolveFilters(payload, items);
    if (!f.stageKnown) return [];
    return libraryRows.filter(function (row) {
      if (f.stage && row.stage !== f.stage) return false;
      if (f.grade && f.grades.indexOf(row.grade) === -1) return false;
      if (f.subject && row.subject !== f.subject) return false;
      if (f.unit && String(row.chapter || '').indexOf(f.unit) === -1) return false;
      if (f.query) {
        var hay = [row.name, row.subject, row.grade, row.stage, row.chapter].join(' ').toLowerCase();
        if (hay.indexOf(f.query) === -1) return false;
      }
      return true;
    }).map(curriculumRecord);
  }
  function curriculumRecord(row) {
    var record = {
      id: row.id || row.name,
      title: row.name,
      stage: row.stage, grade: row.grade, subject: row.subject,
      status: row.status,
      indexingStatus: row.readable ? 'PDF متاح للقراءة على خادم شنو منو' : 'مفهرس — بانتظار النسخة الرسمية',
      readable: Boolean(row.readable),
      curriculum_file_url: row.readable ? row.url : ''
    };
    if (row.readable) {
      record.fileId = row.id || row.name;
      if (row.pages) record.pages = row.pages;
      if (row.bytes) record.size = Math.max(1, Math.round(row.bytes / 1048576)) + ' MB';
    }
    return record;
  }
  /** Reader contract: a url ONLY for a book joined to a real manifest PDF. */
  function readerResult(libraryRows, fileId) {
    fileId = str(fileId);
    var row = (Array.isArray(libraryRows) ? libraryRows : []).find(function (r) { return String(r.id || r.name) === fileId; });
    if (!row) return { ok: false, message: 'الكتاب غير موجود في كتالوج المنهج العراقي.' };
    if (!row.readable || !row.url) return { ok: false, message: 'هذا الكتاب مفهرس فقط — بانتظار النسخة الرسمية، ولا يوجد ملف PDF له على خادم شنو منو بعد.' };
    return { ok: true, url: row.url, readerUrl: row.url, title: row.name, pageCount: row.pages || undefined,
      indexingStatus: 'PDF متاح للقراءة على خادم شنو منو', downloadUrl: row.url, canDownload: true };
  }
  /** Teacher directory rows (GET /api/school/teachers) filtered by the page's form. */
  function teacherRows(teachers, items, payload) {
    teachers = Array.isArray(teachers) ? teachers : [];
    var f = resolveFilters(payload, items);
    if (!f.stageKnown) return [];
    return teachers.filter(function (t) {
      if (f.stage && t.stage !== f.stage) return false;
      if (f.grade && !(Array.isArray(t.grades) ? t.grades : []).some(function (g) { return f.grades.indexOf(g) !== -1; })) return false;
      if (f.subject && t.subject !== f.subject) return false;
      if (f.gender && t.gender !== f.gender) return false;
      if (f.status && t.status !== f.status) return false;
      if (f.query && [t.name, t.subject, t.stage].join(' ').toLowerCase().indexOf(f.query) === -1) return false;
      return true;
    }).map(function (t) {
      return {
        id: t.id, name: t.name, gender: t.gender, subject: t.subject, specialty: t.subject, stage: t.stage,
        grades: (Array.isArray(t.grades) ? t.grades : []).join('، '), status: t.status,
        // The school directory is the platform's AI teaching staff (schoolAI personas), not human accounts.
        isEducationalPersona: true, accountType: 'معلم شنو منو الذكي (شخصية تعليمية)',
        lessons: t.style || undefined, year: t.experience ? Number(t.experience) : undefined
      };
    });
  }
  /** The guardian's real students (GET /api/school/students) filtered by the page's form. */
  function studentRows(students, items, payload) {
    students = Array.isArray(students) ? students : [];
    var f = resolveFilters(payload, items);
    if (!f.stageKnown) return [];
    return students.filter(function (s) {
      if (f.stage && s.stage !== f.stage) return false;
      if (f.grade && f.grades.indexOf(s.grade) === -1) return false;
      if (f.query && String(s.name || '').toLowerCase().indexOf(f.query) === -1) return false;
      return true;
    }).map(function (s) {
      var progress = s.progress || {};
      var record = { id: String(s._id || s.id), name: s.name, stage: s.stage, grade: s.grade,
        subjects: (Array.isArray(s.subjects) ? s.subjects : []).join('، '),
        status: s.parentApproved ? 'موافقة ولي الأمر مؤكدة' : 'بانتظار موافقة ولي الأمر' };
      if (progress.sessions !== undefined) record.sessions = Number(progress.sessions) || 0;
      if (progress.average !== undefined) record.progress = Math.round(Number(progress.average) || 0) + '%';
      if (Array.isArray(s.scores) && s.scores.length) record.grades = s.scores.length + ' درجة مسجلة';
      return record;
    });
  }
  /**
   * Classroom selects (room-stage/grade/section/subject/lesson/teacher).
   * The page rebuilds EVERY select for which the reply carries typed rows
   * (losing its current value), so a level is only re-sent while its current
   * value is not a valid member of that level's real options. Lessons are
   * verified offline-pack lessons for the selection when the account has
   * them, otherwise the catalogue's books for that subject; the lesson text
   * row is emitted only from a real Knowledge `content`.
   */
  var LIVE_PREFIX = 'classroom:';
  function liveCode(teacherId) {
    teacherId = str(teacherId);
    if (teacherId.indexOf(LIVE_PREFIX) !== 0) return '';
    var code = teacherId.slice(LIVE_PREFIX.length).toUpperCase();
    return /^[A-Z0-9]{4,12}$/.test(code) ? code : '';
  }
  var VIRTUAL_PREFIX = 'virtual:';
  function virtualCode(teacherId) {
    teacherId = str(teacherId);
    if (teacherId.indexOf(VIRTUAL_PREFIX) !== 0) return '';
    var code = teacherId.slice(VIRTUAL_PREFIX.length).toUpperCase();
    return /^[A-Z0-9]{4,12}$/.test(code) ? code : '';
  }
  function virtualSessionRows(virtualSessions, f) {
    return (Array.isArray(virtualSessions) ? virtualSessions : []).filter(function (s) {
      if (!s || s.status !== 'active' || !s.code) return false;
      if (s.stage !== f.stage) return false;
      if (f.grades.length && f.grades.indexOf(s.grade) === -1) return false;
      return !(f.subject && s.subject !== f.subject);
    }).map(function (s) {
      var tName = s.virtualTeacher && s.virtualTeacher.name ? s.virtualTeacher.name : 'معلم افتراضي';
      return { type: 'teacher', id: VIRTUAL_PREFIX + String(s.code).toUpperCase(), name: '🤖 ' + str(tName) + ' (معلم افتراضي / AI) — حصة: ' + str(s.subject) + (s.lesson ? ' / ' + str(s.lesson) : ''), subject: s.subject, virtual: true, code: String(s.code).toUpperCase() };
    });
  }
  function virtualPointerText(s) {
    var tName = s.virtualTeacher && s.virtualTeacher.name ? s.virtualTeacher.name : 'المعلم الافتراضي';
    return 'صف افتراضي ذكي مع ' + str(tName) + ' (معلم افتراضي / AI) — ' + str(s.subject) + (s.lesson ? ' / ' + str(s.lesson) : '') + ' — رمز الحصة ' + String(s.code).toUpperCase() + '. السبورة الذكية والأسئلة متاحة عبر رمز الحصة: ' + String(s.code).toUpperCase();
  }
  /**
   * REAL live classrooms (GET /api/school/classrooms/live) as teacher rows of
   * the Canva classroom page: only classrooms of the chosen stage+grade
   * (+subject once chosen). Real teacher account name, real code — the page
   * design is untouched, the row simply carries id "classroom:<CODE>".
   */
  function liveClassroomRows(liveClassrooms, f) {
    return (Array.isArray(liveClassrooms) ? liveClassrooms : []).filter(function (c) {
      if (!c || c.status !== 'live' || !c.code) return false;
      if (c.stage !== f.stage) return false;
      if (f.grades.length && f.grades.indexOf(c.grade) === -1) return false;
      return !(f.subject && c.subject !== f.subject);
    }).map(function (c) {
      return { type: 'teacher', id: LIVE_PREFIX + String(c.code).toUpperCase(), name: str(c.teacherName) + ' — حصة مباشرة الآن: ' + str(c.subject) + (c.lesson ? ' / ' + str(c.lesson) : ''), subject: c.subject, live: true, code: String(c.code).toUpperCase(), presentCount: Number(c.presentCount) || 0 };
    });
  }
  function livePointerText(c) {
    return 'حصة مباشرة الآن مع ' + str(c.teacherName) + ' — ' + str(c.subject) + (c.lesson ? ' / ' + str(c.lesson) : '') + ' — رمز الحصة ' + String(c.code).toUpperCase() + ' (الكاميرا والمايك لا يعملان إلا بضغطة الطالب وبموافقة ولي الأمر).';
  }
  function classroomOptions(items, packItems, teachers, payload, liveClassrooms, virtualSessions) {
    items = Array.isArray(items) ? items : [];
    packItems = Array.isArray(packItems) ? packItems : [];
    teachers = Array.isArray(teachers) ? teachers : [];
    var f = resolveFilters(payload, items);
    var rows = [];
    if (!f.stageKnown || !f.stage) return rows;
    var gradeChosen = Boolean(f.grade) && f.grades.length > 0;
    if (!gradeChosen) {
      gradesOf(items, f.stage).forEach(function (g) { rows.push(option('grade', g)); });
      return rows;
    }
    var scoped = items.filter(function (it) { return catalogMatches(it, f); });
    var subjects = distinct(items.filter(function (it) { return catalogMatches(it, { stageKnown: true, stage: f.stage, grade: f.grade, grades: f.grades, subject: '' }); }).map(function (it) { return it.subject; }));
    var subjectChosen = Boolean(f.subject) && subjects.indexOf(f.subject) !== -1;
    if (!subjectChosen) subjects.forEach(function (sub) { rows.push(option('subject', sub)); });
    var lessonRows = [];
    var lessons = [];
    if (subjectChosen) {
      lessons = packItems.filter(function (k) {
        return k && k.lesson && k.stage === f.stage && f.grades.indexOf(k.grade) !== -1 && k.subject === f.subject;
      });
      if (lessons.length) {
        lessons.forEach(function (k) { lessonRows.push({ type: 'lesson', id: 'knowledge:' + k.id, name: k.lesson, subject: k.subject }); });
      } else {
        scoped.forEach(function (it) { lessonRows.push({ type: 'lesson', id: 'book:' + it.id, name: it.title, subject: it.subject }); });
      }
    }
    var lessonChosen = Boolean(f.lesson) && lessonRows.some(function (r) { return r.id === f.lesson; });
    if (subjectChosen && !lessonChosen) rows = rows.concat(lessonRows);
    if (lessonChosen) {
      var chosen = lessons.find(function (k) { return 'knowledge:' + k.id === f.lesson; });
      if (chosen && str(chosen.content)) rows.push({ type: 'lesson-content', id: 'content:' + chosen.id, name: chosen.lesson, content: str(chosen.content) });
    }
    var liveRows = liveClassroomRows(liveClassrooms, f);
    var vRows = virtualSessionRows(virtualSessions, f);
    var teacherRowsOut = liveRows.concat(vRows).concat(teachers.filter(function (t) {
      if (t.stage !== f.stage) return false;
      if (subjectChosen && t.subject !== f.subject) return false;
      return !(Array.isArray(t.grades) && t.grades.length && !t.grades.some(function (g) { return f.grades.indexOf(g) !== -1; }));
    }).map(function (t) { return { type: 'teacher', id: t.id, name: t.name, subject: t.subject }; }));
    var teacherChosen = Boolean(f.teacher) && teacherRowsOut.some(function (r) { return r.id === f.teacher; });
    if (!teacherChosen) rows = rows.concat(teacherRowsOut);
    // A selected REAL live classroom: point to it honestly (code + page) —
    // appended after real lesson text, never presented as lesson content.
    var selectedCode = liveCode(f.teacher);
    var selectedLive = selectedCode ? (Array.isArray(liveClassrooms) ? liveClassrooms : []).find(function (c) { return c && c.status === 'live' && String(c.code).toUpperCase() === selectedCode; }) : null;
    if (selectedLive && liveRows.some(function (r) { return r.code === selectedCode; })) {
      var contentRow = rows.find(function (r) { return r.type === 'lesson-content' && typeof r.content === 'string' && r.content.trim(); });
      if (contentRow) contentRow.content = contentRow.content + '\n\n' + livePointerText(selectedLive);
      else rows.push({ type: 'live-classroom', id: 'live:' + selectedCode, name: str(selectedLive.teacherName), content: livePointerText(selectedLive), code: selectedCode });
    }
    // A selected Virtual Classroom:
    var selectedVCode = virtualCode(f.teacher);
    var selectedVirtual = selectedVCode ? (Array.isArray(virtualSessions) ? virtualSessions : []).find(function (s) { return s && s.status === 'active' && String(s.code).toUpperCase() === selectedVCode; }) : null;
    if (selectedVirtual && vRows.some(function (r) { return r.code === selectedVCode; })) {
      var contentRowV = rows.find(function (r) { return r.type === 'lesson-content' && typeof r.content === 'string' && r.content.trim(); });
      if (contentRowV) contentRowV.content = contentRowV.content + '\n\n' + virtualPointerText(selectedVirtual);
      else rows.push({ type: 'virtual-classroom', id: 'virtual:' + selectedVCode, name: str(selectedVirtual.virtualTeacher && selectedVirtual.virtualTeacher.name), content: virtualPointerText(selectedVirtual), code: selectedVCode });
    }
    return rows;
  }
  /** Lesson label from a classroom lesson id (knowledge:<id> | book:<id>). */
  function lessonLabel(lessonId, items, packItems) {
    lessonId = str(lessonId);
    if (lessonId.indexOf('knowledge:') === 0) {
      var k = (Array.isArray(packItems) ? packItems : []).find(function (x) { return 'knowledge:' + x.id === lessonId; });
      return k ? str(k.lesson || k.title) : '';
    }
    if (lessonId.indexOf('book:') === 0) {
      var b = (Array.isArray(items) ? items : []).find(function (x) { return 'book:' + x.id === lessonId; });
      return b ? str(b.title) : '';
    }
    return lessonId;
  }
  /**
   * Plan a classroom action onto a REAL backend call for one of the
   * guardian's real students — or refuse with the reason. Nothing here ever
   * creates a student or invents content: attendance = POST /sessions/start,
   * participation = POST /students/:id/notes, hand = POST /operations
   * ("رفع يد" record for the existing student), end = complete the active
   * session; "question" needs question text the page cannot supply.
   */
  function classroomActionPlan(input) {
    input = input || {};
    var items = Array.isArray(input.items) ? input.items : [];
    var f = resolveFilters(input.payload, items);
    var action = str(input.payload && input.payload.action);
    var at = str(input.payload && input.payload.at) || new Date().toISOString();
    var students = (Array.isArray(input.students) ? input.students : []).filter(function (s) {
      return s && (!f.stage || s.stage === f.stage) && (!f.grade || f.grades.indexOf(s.grade) !== -1);
    });
    var lesson = lessonLabel(f.lesson, items, input.packItems);
    var code = liveCode(f.teacher);
    if (code) {
      // REAL live classroom selected (id classroom:<CODE>) -> the live engine.
      if (action === 'end') return { kind: 'live.end', code: code };
      if (action === 'hand') return { kind: 'live.hand', code: code, body: { raised: true } };
      if (action === 'attendance') {
        if (!f.stage) return { kind: 'refuse', message: 'اختر المرحلة من المصدر أولاً.' };
        if (!students.length) return { kind: 'refuse', message: 'لا يوجد طالب مسجل في حسابك لهذه المرحلة والصف — أضف الطالب من صفحة المدرسة أولاً؛ لا يُنشأ طالب تلقائياً.' };
        return { kind: 'live.join', code: code, body: { studentId: String(students[0]._id || students[0].id) } };
      }
      // participation / question: unchanged below (real note / honest refusal).
    }
    var vcode = virtualCode(f.teacher);
    if (vcode) {
      // Virtual Classroom selected (id virtual:<CODE>) -> the virtual engine.
      if (action === 'end') return { kind: 'virtual.end', code: vcode };
      if (action === 'hand') return { kind: 'virtual.hand', code: vcode, body: { raised: true } };
      if (action === 'attendance') {
        if (!f.stage) return { kind: 'refuse', message: 'اختر المرحلة من المصدر أولاً.' };
        if (!students.length) return { kind: 'refuse', message: 'لا يوجد طالب مسجل في حسابك لهذه المرحلة والصف — أضف الطالب من صفحة المدرسة أولاً؛ لا يُنشأ طالب تلقائياً.' };
        return { kind: 'virtual.join', code: vcode, body: { studentId: String(students[0]._id || students[0].id) } };
      }
    }
    if (action === 'end') {
      var session = input.session;
      if (!session || !session._id) return { kind: 'refuse', message: 'لا توجد حصة نشطة في حسابك لإنهائها.' };
      return { kind: 'session.complete', sessionId: String(session._id), body: { score: 0, maxScore: 0, teacherNote: 'أُنهيت الحصة من صف Canva في ' + at } };
    }
    if (!f.stage) return { kind: 'refuse', message: 'اختر المرحلة من المصدر أولاً.' };
    if (!students.length) return { kind: 'refuse', message: 'لا يوجد طالب مسجل في حسابك لهذه المرحلة والصف — أضف الطالب من صفحة المدرسة أولاً؛ لا يُنشأ طالب تلقائياً.' };
    var student = students[0];
    if (action === 'attendance') {
      if (!f.subject) return { kind: 'refuse', message: 'اختر المادة من المصدر قبل تسجيل الحضور.' };
      return { kind: 'session.start', body: { studentId: String(student._id || student.id), subject: f.subject, lesson: lesson } };
    }
    if (action === 'participation') {
      return { kind: 'note', studentId: String(student._id || student.id), body: { text: 'مشاركة في الحصة' + (lesson ? ' — درس ' + lesson : '') + ' (' + at + ')', subject: f.subject } };
    }
    if (action === 'hand') {
      return { kind: 'operation', record: {
        student_name: student.name, stage: f.stage, grade: student.grade, subject: f.subject, lesson: lesson,
        answer_type: 'رفع يد', question_text: 'رفع يد' + (lesson ? ' — ' + lesson : ''),
        answer_text: 'رفع الطالب يده للمشاركة' + (lesson ? ' في درس ' + lesson : '') + ' — ' + at,
        operation_id: 'canva-hand-' + String(student._id || student.id) + '-' + at
      } };
    }
    if (action === 'question') {
      return { kind: 'refuse', message: 'إرسال سؤال يحتاج نص السؤال، وهذه الواجهة لا توفر حقلاً له؛ استخدم «اسأل المعلم» في صفحة المدرسة.' };
    }
    return { kind: 'refuse', message: 'إجراء غير معروف: ' + action };
  }
  /** Dashboard metrics from real payloads only. */
  function dashboardMetrics(input) {
    input = input || {};
    var students = Array.isArray(input.students) ? input.students : [];
    var teachers = Array.isArray(input.teachers) ? input.teachers : [];
    var library = Array.isArray(input.libraryRows) ? input.libraryRows : [];
    var readable = library.filter(function (r) { return r.readable; }).length;
    var metrics = [
      { label: 'الطلاب في حسابك', value: students.length },
      { label: 'معلمو شنو منو (شخصيات تعليمية)', value: teachers.length },
      { label: 'كتب الكتالوج العراقي', value: library.length },
      { label: 'كتب PDF متاحة للقراءة', value: readable },
      { label: 'كتب بانتظار النسخة الرسمية', value: library.length - readable },
      { label: 'الحصة الحالية', value: input.session ? (input.session.subject || 'نشطة') : 'لا توجد حصة نشطة' },
      { label: 'حصص مباشرة الآن', value: Array.isArray(input.liveClassrooms) ? input.liveClassrooms.filter(function (c) { return c && c.status === 'live'; }).length : 0 },
      { label: 'المواعيد المجدولة', value: Array.isArray(input.schedules) ? input.schedules.length : 0 }
    ];
    return metrics;
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
    seatCards: seatCards,
    // 2026-09-21 Canva page contract (pure)
    HIERARCHY: HIERARCHY,
    normalizeStage: normalizeStage,
    matchGrades: matchGrades,
    resolveFilters: resolveFilters,
    structureOptions: structureOptions,
    structureRows: structureRows,
    curriculumRows: curriculumRows,
    readerResult: readerResult,
    teacherRows: teacherRows,
    studentRows: studentRows,
    classroomOptions: classroomOptions,
    liveCode: liveCode,
    liveClassroomRows: liveClassroomRows,
    VIRTUAL_PREFIX: VIRTUAL_PREFIX,
    virtualCode: virtualCode,
    virtualSessionRows: virtualSessionRows,
    lessonLabel: lessonLabel,
    classroomActionPlan: classroomActionPlan,
    dashboardMetrics: dashboardMetrics
  };
});
