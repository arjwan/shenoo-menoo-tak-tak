/* Shno Mano — School integration adapter for the seven standalone school pages.
 *
 * The approved Canva interface (original-assets/school-canva/
 * school-canva-latest-20260920.html) discovers its backend through
 * window.ShnoManoIntegrationAdapter and calls the first method name it finds
 * among the documented candidates. This file implements that whole contract on
 * top of the REAL project API — no demo data, no local fixtures:
 *
 *   GET  /api/school/dashboard            school totals from MongoDB
 *   GET  /api/school/structure            stage/grade/section/subject/unit/lesson
 *   GET  /api/school/teachers             the platform teacher directory
 *   GET  /api/school/students             the guardian's students
 *   GET  /api/school/curriculum/catalog   the versioned Iraqi book catalogue
 *   GET  /api/school/curriculum/files     the 136 verified curriculum PDFs
 *   GET  /api/school/curriculum/offline-pack  verified SchoolKnowledgeSource rows
 *   GET  /api/school/books/:id/reader     authorised PDF reader URL
 *   GET  /api/school/classroom/options    real cascade options + lesson content
 *   POST /api/school/classroom/actions    attendance/participation/hand/question/end
 *   GET  /api/school/sessions/active      the running study session
 *
 * The session JWT is read at runtime from the same localStorage/sessionStorage
 * keys the rest of the platform uses and is only ever sent as a Bearer header.
 * If a learner's package has no readable file (or the directory has no match),
 * the API answers honestly and the UI shows that answer — it never invents a
 * record.
 */
(function () {
  "use strict";

  var BASE = "/api/school";

  function token() {
    try { return localStorage.getItem("token") || sessionStorage.getItem("token") || ""; } catch (e) { return ""; }
  }

  function query(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (key) {
      var value = params[key];
      if (value === undefined || value === null || value === "") return;
      parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
    });
    return parts.length ? "?" + parts.join("&") : "";
  }

  function http(pathname, options) {
    options = options || {};
    var headers = { Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (token()) headers.Authorization = "Bearer " + token();
    return window.fetch(BASE + pathname, {
      method: options.method || "GET",
      headers: headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok || data.ok === false) {
          var error = new Error(data.message || ("http " + response.status));
          error.status = response.status;
          error.code = response.status === 404 ? "NOT_FOUND" : response.status === 403 ? "FORBIDDEN" : "API";
          throw error;
        }
        return data;
      });
    });
  }

  // The Canva screens read `{ items: [...] }` (or a bare array). The list
  // adapter also accepts `{ rows: [...] }`; nothing is fabricated here.
  function itemsOf(data) {
    if (Array.isArray(data)) return { items: data };
    var rows = (data && (data.items || data.rows)) || [];
    var out = Object.assign({}, data || {});
    out.items = Array.isArray(rows) ? rows : [];
    return out;
  }

  function list(pathname, params, options) {
    return http(pathname + query(params), options).then(itemsOf);
  }


  function byType(rows, type) {
    return (rows || []).filter(function (row) { return row && (row.type === type || row.kind === type); });
  }

  // Model documents hold real Mongo ids: expose them the way the Canva screens
  // address a record (id / fileId) without leaking sensitive fields.
  function studentRow(student) {
    var progress = student.progress || {};
    return {
      id: String(student._id || student.id || ""),
      name: student.name || "",
      stage: student.stage || "",
      grade: student.grade || "",
      section: student.section || "",
      status: student.active === false ? "غير نشط" : "نشط",
      subjects: Array.isArray(student.subjects) ? student.subjects.join("، ") : "",
      progress: "متوسط " + Math.round(progress.average || 0) + "% · حصص " + (progress.sessions || 0),
      grades: (student.scores || []).length ? (student.scores.length + " درجة مسجلة") : "لا درجات مسجلة",
      sessions: progress.sessions || 0
    };
  }

  function teacherRow(teacher) {
    return {
      id: String(teacher.id || ""),
      name: teacher.name || "",
      gender: teacher.gender || "",
      specialty: teacher.subject || "",
      subject: teacher.subject || "",
      stage: teacher.stage || "",
      section: Array.isArray(teacher.grades) ? teacher.grades.join("، ") : "",
      status: teacher.status || "",
      type: "teacher",
      kind: "teacher"
    };
  }

  function structureRow(row) {
    var out = {
      id: String(row.id || row.name || ""),
      name: row.name || row.title || "",
      type: row.type,
      stage: row.stage || "",
      grade: row.grade || "",
      section: row.section || "",
      subject: row.subject || "",
      status: row.status || ""
    };
    if (row.lessons != null) out.lessons = row.lessons;
    if (row.pages != null) out.pages = row.pages;
    if (row.year != null) out.year = row.year;
    if (row.indexingStatus) out.indexingStatus = row.indexingStatus;
    return out;
  }

  function bookRow(row) {
    return {
      id: String(row.fileId || row.id || ""),
      fileId: String(row.fileId || row.id || ""),
      title: row.title || "",
      stage: row.stage || "",
      grade: row.grade || "",
      subject: row.subject || "",
      year: row.year != null ? String(row.year) : "",
      pages: row.pages != null ? row.pages : undefined,
      size: row.bytes != null ? Math.max(1, Math.round(row.bytes / 1048576)) + " MB" : undefined,
      indexingStatus: row.indexingStatus || "",
      status: row.status || ""
    };
  }

  function matches(row, filters) {
    var keys = ["stage", "grade", "subject", "section"];
    for (var i = 0; i < keys.length; i++) {
      var wanted = filters[keys[i]];
      if (wanted && String(row[keys[i]] || "") !== String(wanted)) return false;
    }
    var unit = filters.unit;
    if (unit && String(row.unit || row.chapter || "") !== String(unit) && String(row.type) !== "grade") return false;
    var q = String(filters.query || "").trim().toLowerCase();
    if (q) {
      var haystack = [row.name, row.title, row.subject, row.stage, row.grade, row.section].join(" ").toLowerCase();
      if (haystack.indexOf(q) === -1) return false;
    }
    return true;
  }

  function structureRequest(payload, options) {
    return list("/structure", {
      stage: payload.stage, grade: payload.grade, section: payload.section,
      subject: payload.subject, unit: payload.unit, query: payload.query
    }, options);
  }

  // /books is served by school-classroom.routes.js: it merges the verified
  // manifest PDFs, the versioned Iraqi catalogue and SchoolKnowledgeSource.
  function curriculumRequest(payload, options) {
    return list("/books", {
      stage: payload.stage, grade: payload.grade, subject: payload.subject,
      unit: payload.unit, query: payload.query
    }, options);
  }


  function dashboard(payload) {
    return http("/dashboard", { signal: payload && payload.signal });
  }

  function structure(payload) {
    var filters = payload || {};
    return structureRequest(filters, { signal: filters.signal }).then(function (data) {
      return Object.assign({}, data, { items: (data.items || []).map(structureRow).filter(function (row) { return matches(row, filters); }) });
    });
  }

  function structureTyped(type) {
    return function (payload) {
      payload = payload || {};
      return structureRequest(payload, { signal: payload.signal }).then(function (data) {
        var rows = byType(data.items, type).map(structureRow).filter(function (row) { return matches(row, payload); });
        return Object.assign({}, data, { items: rows });
      });
    };
  }

  function teachers(payload) {
    var filters = payload || {};
    return http("/teachers", { signal: filters.signal }).then(function (data) {
      var rows = (data.teachers || []).map(teacherRow).filter(function (row) {
        if (filters.gender && row.gender !== filters.gender) return false;
        var grade = filters.grade || filters.section;
        if (grade && String(row.section || "").indexOf(grade) === -1) return false;
        return matches(row, filters);
      });
      return { ok: true, items: rows, teachers: rows };
    });
  }

  function students(payload) {
    var filters = payload || {};
    return http("/students", { signal: filters.signal }).then(function (data) {
      var rows = (data.students || []).map(studentRow).filter(function (row) { return matches(row, filters); });
      return { ok: true, items: rows, students: data.students || [] };
    });
  }

  function curriculum(payload) {
    var filters = payload || {};
    return curriculumRequest(filters, { signal: filters.signal }).then(function (data) {
      var rows = (data.items || []).map(bookRow).filter(function (row) {
        if (!filters.query && (filters.stage || filters.grade || filters.subject || filters.unit)) {
          // Manifest books carry no grade/subject metadata: they are listed
          // only while the filters do not narrow the catalogue by stage.
          if (!row.stage) return false;
        }
        return matches(row, filters);
      });
      return Object.assign({}, data, { items: rows });
    });
  }

  function reader(payload) {
    var fileId = String((payload && (payload.fileId || payload.id)) || "");
    if (!fileId) { var error = new Error("معرف الملف مطلوب لفتح القارئ."); error.code = "CONFIG"; return Promise.reject(error); }
    return http("/books/" + encodeURIComponent(fileId) + "/reader", { signal: payload && payload.signal });
  }

  function classroomOptions(payload) {
    var filters = payload || {};
    var stage = filters["room-stage"], grade = filters["room-grade"], section = filters["room-section"], subject = filters["room-subject"];
    return Promise.all([
      http("/classroom/options" + query({ stage: stage, grade: grade, section: section, subject: subject }), { signal: filters.signal }),
      http("/teachers", { signal: filters.signal }).catch(function () { return { teachers: [] }; })
    ]).then(function (out) {
      var rows = (out[0].items || []).map(function (row) { return Object.assign({}, row); });
      var matched = (out[1].teachers || []).map(teacherRow).filter(function (row) {
        if (stage && row.stage && row.stage !== stage) return false;
        if (subject && row.subject && row.subject !== subject) return false;
        return true;
      }).slice(0, 8);
      return { ok: true, items: rows.concat(matched) };
    });
  }

  function classroomAction(payload) {
    payload = payload || {};
    return http("/classroom/actions", {
      method: "POST",
      signal: payload.signal,
      body: {
        action: payload.action,
        at: payload.at,
        stage: payload["room-stage"],
        grade: payload["room-grade"],
        section: payload["room-section"],
        subject: payload["room-subject"],
        lesson: payload["room-lesson"],
        teacher: payload["room-teacher"],
        question: payload.question,
        note: payload.note
      }
    });
  }

  var adapter = {
    // لوحة المدرسة
    getDashboard: dashboard,
    // الهيكل الدراسي والمراحل والصفوف والمواد والدروس
    searchStructure: structure,
    getStages: structureTyped("stage"),
    getGrades: structureTyped("grade"),
    getSubjects: structureTyped("subject"),
    getLessons: structureTyped("lesson"),
    getDependentOptions: structure,
    getStructureOptions: structure,
    // المعلمون والمعلمات
    searchTeachers: teachers,
    // الطلاب والطالبات
    searchStudents: students,
    // مكتبة المناهج
    searchCurriculum: curriculum,
    // قارئ الكتاب
    getReaderUrl: reader,
    // الصف والحصة
    getClassroomOptions: classroomOptions,
    classroomAction: classroomAction,
    getSessions: function (payload) {
      return http("/sessions/active", { signal: payload && payload.signal }).then(function (data) {
        return { ok: true, items: data.session ? [data.session] : [] };
      });
    }
  };

  window.ShnoManoIntegrationAdapter = adapter;
  window.ShnoSchoolApi = { http: http, list: list, adapter: adapter };
})();
