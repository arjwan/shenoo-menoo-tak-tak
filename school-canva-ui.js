/* Shno Mano — shared UI layer for the seven standalone school pages.
 *
 * This file is the approved Canva interface logic
 * (original-assets/school-canva/school-canva-latest-20260920.html) moved into
 * the real project, keeping its screens, wording, states and behaviour:
 *   - same messageFor(), setStatus(), loading(), toast(), report(), diagnostic()
 *   - same collection filters, CSV validation and detail whitelist
 *   - same data contract: it only talks to window.ShnoManoIntegrationAdapter
 *     (school-api-adapter.js) which is bound to the real /api/school API.
 *
 * Two project-only differences, both required so the pages are standalone:
 *   1. every element binding is guarded, so a page that shows one screen never
 *      throws for the elements of the other screens;
 *   2. changePage() opens the target standalone page (school-<page>.html) when
 *      that screen is not part of the current document.
 *
 * The Canva asset itself is never modified.
 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var PAGE_FILES = {
    index: "school-index.html", structure: "school-structure.html", teachers: "school-teachers.html",
    students: "school-students.html", curriculum: "school-curriculum.html",
    reader: "school-reader.html", classroom: "school-classroom.html"
  };
  var SCREEN_FOR = {
    index: "screen-index", structure: "screen-collection", teachers: "screen-collection",
    students: "screen-collection", curriculum: "screen-collection",
    reader: "screen-reader", classroom: "screen-classroom"
  };
  var stages = [
    { id: "primary", name: "الابتدائية", grades: ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"] },
    { id: "middle", name: "المتوسطة", grades: ["الأول المتوسط", "الثاني المتوسط", "الثالث المتوسط"] },
    { id: "preparatory", name: "الإعدادية", grades: ["الرابع الإعدادي", "الخامس الإعدادي", "السادس الإعدادي"] }
  ];
  var pageNames = {
    index: "الرئيسية", structure: "الهيكل الدراسي", teachers: "المعلمون والمعلمات",
    students: "الطلاب والطالبات", curriculum: "مكتبة المناهج", reader: "قارئ الكتاب", classroom: "الصف والحصة"
  };
  var state = { page: "index", aborters: {}, lastSync: null, lastError: "", lastBook: null, lastLessonText: "", tests: [], stats: { teachers: null, personas: null, books: null }, csv: null };
  var sensitive = /token|secret|password|hash|authorization|cookie|credential/i;


  function api() { return window.ShnoManoIntegrationAdapter || window.apiClient || null; }
  function functions() { var client = api(); return client ? Object.keys(client).filter(function (k) { return typeof client[k] === "function"; }) : []; }
  function has(names) { return names.some(function (name) { return functions().indexOf(name) !== -1; }); }
  function icon() { if (window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons(); }
  function ownPage() { return String(window.__SHNO_SCHOOL_PAGE__ || "index"); }

  function messageFor(error) {
    if (error && error.code === "CONFIG") return "يحتاج هذا القسم إلى إعداد API أو عقد تكامل مكتشف.";
    if (error && error.name === "AbortError") return "تم إلغاء الطلب السابق بسبب تغيير الاختيارات.";
    var status = error && (error.status || error.statusCode);
    if (status === 401) return "انتهت الجلسة أو تحتاج إلى مصادقة مؤكدة.";
    if (status === 403) return "لا تملك الصلاحية المطلوبة لهذا الإجراء.";
    if (status === 404) return "لم يعثر المصدر على المورد المطلوب.";
    if (status === 429) return "تم تحديد معدل الطلبات؛ حاول مجدداً بعد قليل.";
    if (status >= 500) return "حدث خطأ في خادم المصدر. أعد المحاولة لاحقاً.";
    return "تعذر تأكيد العملية من المصدر." + (error && error.message ? " " + error.message : "");
  }
  function setStatus(el, text, tone) {
    if (!el) return;
    el.replaceChildren();
    var p = document.createElement("p");
    p.className = "font-bold " + (tone === "error" ? "text-[#93452e]" : tone === "warn" ? "text-[#846019]" : "text-[#53706f]");
    p.textContent = text;
    el.appendChild(p);
  }
  function loading(el, text) {
    if (!el) return;
    el.replaceChildren();
    var row = document.createElement("div");
    row.className = "flex items-center gap-2 font-bold text-[#146c70]";
    var i = document.createElement("i");
    i.setAttribute("data-lucide", "loader-circle");
    i.className = "spinner h-5 w-5";
    var s = document.createElement("span");
    s.textContent = text || "جارٍ تحميل البيانات المؤكدة…";
    row.append(i, s);
    el.appendChild(row);
    icon();
  }
  function toast(text) {
    var box = $("toast"), textEl = $("toast-text");
    if (!box || !textEl) return;
    textEl.textContent = text;
    box.classList.add("show");
    window.setTimeout(function () { box.classList.remove("show"); }, 3600);
  }
  function refreshConnection() {
    var ready = Boolean(api()), chip = $("connection-chip"), label = $("connection-label"), sync = $("last-sync");
    if (label) label.textContent = ready ? "طبقة التكامل جاهزة" : "يحتاج إعداد API";
    if (chip) chip.className = "status-chip " + (ready ? "bg-[#e3f0eb] text-[#146c70]" : "bg-[#fff4d9] text-[#846019]");
    if (sync) sync.textContent = "آخر مزامنة مؤكدة: " + (state.lastSync ? new Date(state.lastSync).toLocaleString("ar-IQ") : "لا يوجد");
  }
  function invoke(candidates, payload, bucket) {
    var client = api(), method = candidates.find(function (n) { return client && typeof client[n] === "function"; });
    if (!method) { var error = new Error("لا توجد دالة متوافقة مكتشفة في طبقة التكامل."); error.code = "CONFIG"; return Promise.reject(error); }
    if (state.aborters[bucket] && state.aborters[bucket].abort) state.aborters[bucket].abort();
    var controller = new AbortController();
    state.aborters[bucket] = controller;
    return Promise.resolve()
      .then(function () { return client[method](Object.assign({}, payload, { signal: controller.signal })); })
      .then(function (result) {
        state.lastSync = new Date().toISOString();
        state.lastError = "";
        refreshConnection();
        return result;
      })
      .catch(function (error) {
        if (error.name !== "AbortError") state.lastError = messageFor(error);
        throw error;
      });
  }
  function optionsFrom(data) { return Array.isArray(data) ? data : (Array.isArray(data && data.items) ? data.items : []); }
  function label(item) { return (item && (item.name || item.title || item.label || item.displayName)) || ""; }
  function idOf(item) { return (item && (item.id != null ? item.id : item.value != null ? item.value : item._id != null ? item._id : label(item))) || ""; }
  function setSelect(select, rows, placeholder, disabled) {
    if (!select) return;
    select.replaceChildren();
    var first = document.createElement("option");
    first.value = ""; first.textContent = placeholder;
    select.appendChild(first);
    rows.forEach(function (row) {
      var op = document.createElement("option");
      op.value = idOf(row); op.textContent = label(row);
      select.appendChild(op);
    });
    select.disabled = Boolean(disabled);
  }
  function formValues(form) {
    var out = {};
    if (!form || !form.querySelectorAll) return out;
    Array.prototype.forEach.call(form.querySelectorAll("[name]"), function (field) {
      if (field.name) out[field.name] = field.value;
    });
    return out;
  }
  function makeSelect(id, text, initial, disabled) {
    var wrap = document.createElement("div"), lab = document.createElement("label"), sel = document.createElement("select");
    lab.htmlFor = id; lab.className = "mb-1 block font-bold"; lab.textContent = text;
    sel.id = id; sel.name = id; sel.className = "field";
    setSelect(sel, initial || [], disabled ? "يتطلب اختياراً سابقاً" : "اختر من البيانات المتاحة", disabled);
    wrap.append(lab, sel); return wrap;
  }
  function makeInput(id, text, placeholder) {
    var wrap = document.createElement("div"), lab = document.createElement("label"), input = document.createElement("input");
    lab.htmlFor = id; lab.className = "mb-1 block font-bold"; lab.textContent = text;
    input.id = id; input.name = id; input.className = "field"; input.placeholder = placeholder;
    wrap.append(lab, input); return wrap;
  }


  // ------------------------------------------------------------------------
  // Screens: navigation between the seven standalone pages.
  // ------------------------------------------------------------------------
  function openDrawer() {
    var drawer = $("mobile-drawer"), overlay = $("drawer-overlay");
    if (drawer) drawer.classList.add("is-open");
    if (overlay) overlay.classList.add("is-open");
  }
  function closeDrawer() {
    var drawer = $("mobile-drawer"), overlay = $("drawer-overlay");
    if (drawer) drawer.classList.remove("is-open");
    if (overlay) overlay.classList.remove("is-open");
  }
  function screenIdFor(page) { return SCREEN_FOR[page] || "screen-index"; }
  function changePage(page) {
    var target = PAGE_FILES[page] ? page : "index";
    if ($(screenIdFor(target))) return showScreen(target);
    var file = PAGE_FILES[target];
    if (file && window.location && window.location.assign) window.location.assign(file);
    else if (file) window.location.href = file;
  }
  function showScreen(page) {
    state.page = page;
    state.lastLessonText = "";
    if ("speechSynthesis" in window && window.speechSynthesis) window.speechSynthesis.cancel();
    var wanted = screenIdFor(page);
    document.querySelectorAll(".screen").forEach(function (screen) { screen.hidden = screen.id !== wanted; });
    document.querySelectorAll("[data-page]").forEach(function (button) { button.classList.toggle("is-active", button.dataset.page === page); });
    if ($("breadcrumb-current")) $("breadcrumb-current").textContent = pageNames[page];
    document.title = pageNames[page] + " | شنو منو مدرسة";
    if (page === "index") loadDashboard();
    if (["structure", "teachers", "students", "curriculum"].indexOf(page) !== -1) buildCollection(page);
    if (page === "reader") loadReader();
    if (page === "classroom") buildClassroom();
    closeDrawer();
    icon();
  }

  // ------------------------------------------------------------------------
  // الرئيسية
  // ------------------------------------------------------------------------
  function loadDashboard() {
    var cards = $("dashboard-results"), home = $("home-state");
    loading(cards); loading(home, "جارٍ التحقق من لوحة المدرسة…");
    invoke(["getDashboard", "getSchoolDashboard", "dashboard"], {}, "dashboard").then(function (data) {
      var metrics = optionsFrom((data && (data.metrics || data.items)) || []);
      if (!cards) return;
      cards.replaceChildren();
      if (!metrics.length) setStatus(cards, "لم يُحسم من المصدر: لا توجد إحصاءات مؤكدة في الاستجابة.", "warn");
      metrics.forEach(function (metric) {
        var card = document.createElement("article");
        card.className = "soft-card rounded-2xl bg-white p-4";
        var a = document.createElement("p"), b = document.createElement("p");
        a.className = "font-bold text-[#53706f]"; b.className = "mt-2 text-2xl font-extrabold text-[#146c70]";
        a.textContent = metric.label || metric.name || "مؤشر";
        b.textContent = String(metric.value == null ? "لم يُحسم" : metric.value);
        card.append(a, b); cards.appendChild(card);
      });
      setStatus(home, data && data.account && data.account.role ? "الدور الحالي المؤكد: " + data.account.role : "اكتمل الطلب دون معلومات حساب مصرح بها.");
    }).catch(function (error) {
      var m = messageFor(error);
      setStatus(cards, m, error.code === "CONFIG" ? "warn" : "error");
      setStatus(home, m, error.code === "CONFIG" ? "warn" : "error");
    });
  }


  // ------------------------------------------------------------------------
  // الهيكل الدراسي / المعلمون والمعلمات / الطلاب والطالبات / مكتبة المناهج
  // ------------------------------------------------------------------------
  var collectionInfo = {
    structure: { kind: "Structure", kicker: "تنظيم المدرسة", title: "الهيكل الدراسي", copy: "تظهر الشُعب والمواد والوحدات والدروس من المصدر المؤكد فقط.", fields: ["stage", "grade", "section", "subject", "unit"] },
    teachers: { kind: "Teachers", kicker: "دليل الكادر", title: "المعلمون والمعلمات", copy: "لا تعرض البطاقات إلا السجلات التي يعيدها المصدر وفق الصلاحيات.", fields: ["query", "gender", "status", "stage", "grade", "section", "subject"], csv: true },
    students: { kind: "Students", kicker: "شؤون الطلبة", title: "الطلاب والطالبات", copy: "الحضور والدرجات والتقدم لا تظهر إلا حين يعيدها المصدر مصرحاً بها.", fields: ["query", "stage", "grade", "section"] },
    curriculum: { kind: "Curriculum", kicker: "المكتبة الرقمية", title: "مكتبة المناهج", copy: "العناوين والكتب والفهرسة وروابط القراءة تظهر فقط بعد تأكيد المصدر.", fields: ["query", "stage", "grade", "subject", "unit"] }
  };
  function heroFor(page) {
    var map = { teachers: "teachers-hero-image", students: "students-hero-image", curriculum: "curriculum-hero-image" };
    var collection = $("screen-collection");
    if (!collection || !collection.querySelectorAll) return;
    collection.querySelectorAll("img[data-template-id]").forEach(function (image) {
      image.classList.toggle("hidden", image.dataset.templateId !== map[page]);
    });
  }
  function buildCollection(page) {
    var info = collectionInfo[page];
    if (!info) return;
    heroFor(page);
    if ($("collection-kicker")) $("collection-kicker").textContent = info.kicker;
    if ($("collection-title")) $("collection-title").textContent = info.title;
    if ($("collection-copy")) $("collection-copy").textContent = info.copy;
    if ($("list-heading")) $("list-heading").textContent = "النتائج المؤكدة";
    if ($("detail-heading")) $("detail-heading").textContent = "التفاصيل والصلاحيات";
    var form = $("filter-form");
    if (form) form.replaceChildren();
    if ($("collection-results")) $("collection-results").replaceChildren();
    setStatus($("collection-results"), "لم يبدأ طلب البيانات بعد.");
    setStatus($("detail-results"), "اختر سجلاً مؤكداً لعرض البيانات المصرح بها.");
    if ($("form-status")) $("form-status").textContent = "";
    if ($("csv-label")) $("csv-label").classList.toggle("hidden", !info.csv);
    if (form) info.fields.forEach(function (field) {
      if (field === "query") form.appendChild(makeInput(field, "بحث بالاسم أو العنوان", "اكتب للبحث بعد الاتصال"));
      else if (field === "stage") form.appendChild(makeSelect(field, "المرحلة", stages));
      else if (field === "gender") form.appendChild(makeSelect(field, "الجنس", [{ id: "male", name: "معلم" }, { id: "female", name: "معلمة" }]));
      else if (field === "status") form.appendChild(makeSelect(field, "الحالة", [], true));
      else form.appendChild(makeSelect(field, { grade: "الصف", section: "الشعبة", subject: "المادة", unit: "الوحدة أو الفصل" }[field], [], true));
    });
    if (form) form.onsubmit = function (e) { e.preventDefault(); loadCollection(info); };
    if ($("stage")) $("stage").onchange = function () { cascade(info, "stage"); };
    ["grade", "section", "subject"].forEach(function (id) {
      if ($(id)) $(id).onchange = function () { cascade(info, id); };
    });
    if ($("csv-input")) $("csv-input").onchange = function (e) { parseCsv(e.target.files[0]); };
  }
  function dependentFields(from, available) {
    var order = ["stage", "grade", "section", "subject", "unit"];
    return order.slice(order.indexOf(from) + 1).filter(function (x) { return available.indexOf(x) !== -1; });
  }
  function cascade(info, from) {
    var dependents = dependentFields(from, info.fields);
    dependents.forEach(function (id) { setSelect($(id), [], "جارٍ تحميل الخيارات المؤكدة…", true); });
    if (from === "stage" && $("grade")) {
      var stage = stages.find(function (s) { return s.id === ($("stage") ? $("stage").value : ""); });
      if (stage) setSelect($("grade"), stage.grades.map(function (name) { return { id: name, name: name }; }), "اختر صفاً", false);
    }
    if (!has(["getGrades", "listGrades", "getDependentOptions", "getStructureOptions"])) return;
    var payload = formValues($("filter-form"));
    invoke(from === "stage" ? ["getGrades", "listGrades", "getDependentOptions", "getStructureOptions"] : ["getDependentOptions", "getStructureOptions"], payload, "filter-" + from)
      .then(function (response) {
        var rows = optionsFrom(response);
        dependents.forEach(function (id) {
          var select = $(id);
          if (!select) return;
          var matching = rows.filter(function (row) { return !row.type || row.type === id || row.kind === id; });
          if (matching.length) setSelect(select, matching, "اختر من المصدر", false);
          else if (id !== "grade" || !$("stage").value) setSelect(select, [], "لا توجد نتائج بعد رد ناجح", true);
        });
      })
      .catch(function (error) {
        if (error.name === "AbortError") return;
        dependents.forEach(function (id) { setSelect($(id), [], messageFor(error), true); });
        if ($("form-status")) $("form-status").textContent = messageFor(error);
      });
  }


  function allowedDetails(row) {
    var accepted = ["name", "displayName", "title", "gender", "specialty", "subject", "subjects", "stage", "grade", "section", "status", "accountType", "type", "isEducationalPersona", "isVirtualPersona", "attendance", "absence", "grades", "progress", "lessons", "sessions", "year", "pages", "pageCount", "size", "indexingStatus"];
    return Object.entries(row || {}).filter(function (entry) {
      var key = entry[0], value = entry[1];
      return accepted.indexOf(key) !== -1 && !sensitive.test(key) && value !== undefined && value !== null && typeof value !== "object";
    });
  }
  function showDetails(row) {
    var box = $("detail-results");
    if (!box) return;
    box.replaceChildren();
    var details = allowedDetails(row);
    if (!details.length) { setStatus(box, "غير متاح من المصدر أو محجوب بالصلاحية.", "warn"); return; }
    var names = { name: "الاسم", displayName: "الاسم", title: "العنوان", gender: "الجنس", specialty: "الاختصاص", subject: "المادة", stage: "المرحلة", grade: "الصف", section: "الشعبة", status: "الحالة", accountType: "نوع الحساب", type: "النوع", attendance: "الحضور", absence: "الغياب", grades: "الدرجات", progress: "التقدم", lessons: "الدروس", sessions: "الحصص", year: "السنة", pages: "عدد الصفحات", pageCount: "عدد الصفحات", size: "الحجم", indexingStatus: "حالة الفهرسة" };
    details.forEach(function (entry) {
      var line = document.createElement("p");
      line.className = "mb-2 rounded-xl bg-[#eff6f3] p-3 font-bold text-[#53706f]";
      line.textContent = (names[entry[0]] || entry[0]) + ": " + String(entry[1]);
      box.appendChild(line);
    });
    if (row && (row.id || row._id || row.fileId)) {
      state.lastBook = row;
      // The reader is a standalone page: the confirmed book selection travels
      // with the user instead of living in the document that closes.
      try { sessionStorage.setItem("shno-school-book", JSON.stringify(row)); } catch (error) { /* private mode */ }
      toast("تم اختيار كتاب مؤكد. افتح قارئ الكتاب لطلب رابط القراءة المصرح به.");
    }
  }
  function recordCard(row) {
    var card = document.createElement("article");
    card.className = "record"; card.tabIndex = 0;
    var title = document.createElement("p");
    title.className = "font-extrabold";
    title.textContent = row.name || row.displayName || row.title || "سجل مؤكد من المصدر";
    var meta = document.createElement("p");
    meta.className = "mt-1 text-sm font-bold text-[#53706f]";
    var persona = row.isEducationalPersona === true || row.isVirtualPersona === true;
    meta.textContent = [persona ? "شخصية تعليمية افتراضية" : null, row.gender, row.specialty || row.subject, row.stage, row.grade, row.section, row.status].filter(Boolean).join(" · ") || "لا توجد تفاصيل إضافية مصرح بها.";
    card.append(title, meta);
    var open = function () { showDetails(row); };
    card.onclick = open;
    card.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") open(); };
    return card;
  }
  function loadCollection(info) {
    var target = $("collection-results");
    loading(target);
    var payload = formValues($("filter-form"));
    invoke(["search" + info.kind, "list" + info.kind, "get" + info.kind], payload, "collection-" + info.kind)
      .then(function (data) {
        var rows = optionsFrom(data);
        if (!target) return;
        target.replaceChildren();
        if (!rows.length) { setStatus(target, "لا توجد نتائج بعد نجاح رد المصدر.", "warn"); return; }
        rows.forEach(function (row) { target.appendChild(recordCard(row)); });
        if (info.kind === "Teachers") {
          state.stats.teachers = rows.filter(function (r) { return !r.isEducationalPersona && !r.isVirtualPersona; }).length;
          state.stats.personas = rows.filter(function (r) { return r.isEducationalPersona || r.isVirtualPersona; }).length;
        }
        if (info.kind === "Curriculum") state.stats.books = rows.length;
      })
      .catch(function (error) { if (error.name !== "AbortError") setStatus(target, messageFor(error), error.code === "CONFIG" ? "warn" : "error"); });
  }


  function parseQuotedCsv(text) {
    var rows = [], row = [], cell = "", quoted = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i], next = text[i + 1];
      if (ch === '"' && quoted && next === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) { row.push(cell); cell = ""; }
      else if ((ch === "\n" || ch === "\r") && !quoted) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cell);
        if (row.some(function (x) { return x.trim() !== ""; })) rows.push(row);
        row = []; cell = "";
      } else cell += ch;
    }
    if (quoted) throw new Error("يوجد اقتباس غير مغلق في ملف CSV.");
    row.push(cell);
    if (row.some(function (x) { return x.trim() !== ""; })) rows.push(row);
    return rows;
  }
  function parseCsv(file) {
    if (!file) return;
    var status = $("form-status");
    if (!has(["importTeachersCsv", "importTeachers"])) {
      if (status) status.textContent = "يحتاج استيراد CSV إلى endpoint استيراد معتمد في طبقة التكامل.";
      return;
    }
    return Promise.resolve(file.text()).then(function (text) {
      var matrix = parseQuotedCsv(text);
      if (matrix.length < 2) throw new Error("الملف لا يحتوي صفوف بيانات.");
      var headers = matrix[0].map(function (h) { return h.replace(/^\uFEFF/, "").trim().toLowerCase(); });
      if (headers.indexOf("name") === -1) throw new Error("يلزم وجود عمود name؛ لم يُرسل أي صف.");
      var accepted = [], rejected = [], seen = {};
      matrix.slice(1).forEach(function (values, index) {
        var record = {};
        headers.forEach(function (h, i) { record[h] = (values[i] || "").trim(); });
        var name = (record.name || "").toLocaleLowerCase("ar");
        var reasons = [];
        if (!name) reasons.push("الاسم مطلوب");
        if (seen[name]) reasons.push("سجل مكرر");
        if (record.gender && ["male", "female", "معلم", "معلمة", "ذكر", "أنثى"].indexOf(record.gender) === -1) reasons.push("الجنس غير معتمد");
        if (record.stage && !stages.some(function (s) { return s.id === record.stage || s.name === record.stage; })) reasons.push("المرحلة غير معتمدة");
        if (reasons.length) rejected.push({ line: index + 2, reasons: reasons });
        else { seen[name] = true; accepted.push(record); }
      });
      if (!accepted.length) {
        if (status) status.textContent = "لم يُرسل أي صف. المرفوض: " + rejected.map(function (x) { return "صف " + x.line + " (" + x.reasons.join("، ") + ")"; }).join("؛ ");
        return;
      }
      if (status) status.textContent = "المقبول " + accepted.length + "، المرفوض " + rejected.length + ". جارٍ طلب تأكيد الاستيراد…";
      return invoke(["importTeachersCsv", "importTeachers"], { rows: accepted }, "csv-import").then(function (result) {
        var confirmed = result && (result.imported != null ? result.imported : result.confirmed != null ? result.confirmed : result.count);
        if (status) status.textContent = confirmed !== undefined
          ? "أكد Backend استيراد " + confirmed + " صفاً. المقبول محلياً " + accepted.length + "، المرفوض " + rejected.length + "."
          : "استجاب Backend للاستيراد دون عدد مؤكد. المقبول محلياً " + accepted.length + "، المرفوض " + rejected.length + ".";
      });
    }).catch(function (error) { if (status) status.textContent = messageFor(error); });
  }

  // ------------------------------------------------------------------------
  // قارئ الكتاب
  // ------------------------------------------------------------------------
  function loadReader() {
    var meta = $("reader-meta"), viewer = $("pdf-reader"), download = $("reader-download");
    if (download) download.disabled = true;
    if (viewer) viewer.replaceChildren();
    var book = state.lastBook;
    if (!book) {
      try { book = state.lastBook = JSON.parse(sessionStorage.getItem("shno-school-book") || "null"); } catch (error) { book = null; }
    }
    if (!book) {
      setStatus(meta, "اختر كتاباً مؤكداً من مكتبة المناهج أولاً.", "warn");
      setStatus(viewer, "لا يوجد معرف ملف مصرح به لطلب القارئ.", "warn");
      return;
    }
    loading(meta, "جارٍ طلب رابط القراءة المصرح به…");
    loading(viewer, "جارٍ تحميل القارئ…");
    var fileId = book.fileId || book.id || book._id;
    invoke(["getReaderUrl", "getPdfReaderUrl", "getBookReader"], { fileId: fileId }, "reader")
      .then(function (result) {
        var url = result && (result.url || result.readerUrl);
        if (!url) { var error = new Error("لم يعد المصدر رابط قراءة مصرحاً به."); error.code = "CONFIG"; throw error; }
        var bits = [result.title || book.title, result.year || book.year,
          (result.pageCount || result.pages) ? "الصفحات: " + (result.pageCount || result.pages) : null,
          result.indexingStatus || book.indexingStatus].filter(Boolean);
        setStatus(meta, bits.join(" · ") || "رابط قراءة مصرح به من المصدر.");
        if (viewer) {
          viewer.replaceChildren();
          var frame = document.createElement("iframe");
          frame.title = "قارئ كتاب PDF مصرح به";
          frame.src = url;
          frame.className = "reader-frame";
          frame.setAttribute("allowfullscreen", "");
          viewer.appendChild(frame);
        }
        state.lastReaderUrl = url;
        if (result.downloadUrl && result.canDownload === true && download) {

  // ------------------------------------------------------------------------
  // الصف والحصة
  // ------------------------------------------------------------------------
  function buildClassroom() {
    var form = $("classroom-form");
    if (form) form.replaceChildren();
    [["room-stage", "المرحلة", stages, false], ["room-grade", "الصف", [], true], ["room-section", "الشعبة", [], true],
     ["room-subject", "المادة", [], true], ["room-lesson", "الدرس", [], true], ["room-teacher", "المعلم/المعلمة", [], true]]
      .forEach(function (field) { if (form) form.appendChild(makeSelect(field[0], field[1], field[2], field[3])); });
    setStatus($("lesson-content"), "اختر الدرس لتحميل النص الفعلي وفق الصلاحية.", "warn");
    if ($("classroom-status")) $("classroom-status").textContent = "";
    if ($("class-actions")) $("class-actions").replaceChildren();
    if ($("room-stage")) $("room-stage").onchange = function () { loadRoomOptions("stage"); };
    ["room-grade", "room-section", "room-subject", "room-lesson"].forEach(function (id) {
      if ($(id)) $(id).onchange = function () { loadRoomOptions(id.replace("room-", "")); };
    });
    [["attendance", "تسجيل الحضور"], ["participation", "تسجيل المشاركة"], ["hand", "رفع اليد"], ["question", "إرسال سؤال"], ["end", "إنهاء الحصة"]]
      .forEach(function (pair) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "rounded-xl bg-[#e3f0eb] px-4 py-3 text-right font-extrabold text-[#146c70]";
        button.textContent = pair[1];
        button.onclick = function () { classAction(pair[0], button); };
        if ($("class-actions")) $("class-actions").appendChild(button);
      });
    if ($("speech-play")) $("speech-play").onclick = playSpeech;
    if ($("speech-pause")) $("speech-pause").onclick = function () { if (window.speechSynthesis) window.speechSynthesis.pause(); };
    if ($("speech-stop")) $("speech-stop").onclick = function () { if (window.speechSynthesis) window.speechSynthesis.cancel(); };
  }
  function loadRoomOptions(from) {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    state.lastLessonText = "";
    var payload = formValues($("classroom-form")), status = $("classroom-status");
    invoke(["getClassroomOptions", "getDependentOptions"], payload, "classroom-" + from)
      .then(function (data) {
        var rows = optionsFrom(data);
        [["room-grade", "grade"], ["room-section", "section"], ["room-subject", "subject"], ["room-lesson", "lesson"], ["room-teacher", "teacher"]]
          .forEach(function (pair) {
            var select = $(pair[0]);
            var matching = rows.filter(function (row) { return row.type === pair[1] || row.kind === pair[1]; });
            if (matching.length) setSelect(select, matching, "اختر من المصدر", false);
          });
        var lesson = rows.find(function (row) { return typeof row.content === "string" && row.content.trim(); });
        if (lesson) { state.lastLessonText = lesson.content; setStatus($("lesson-content"), lesson.content); }
        if (status) status.textContent = rows.length ? "تم تحديث الخيارات من المصدر." : "لا توجد خيارات بعد نجاح رد المصدر.";
      })
      .catch(function (error) { if (error.name !== "AbortError" && status) status.textContent = messageFor(error); });
  }
  function classAction(action, button) {
    var payload = formValues($("classroom-form"));
    if (!payload["room-lesson"] && action !== "end") {
      if ($("classroom-status")) $("classroom-status").textContent = "اختر الدرس من مصدر مؤكد قبل تنفيذ الإجراء.";
      return;
    }
    if (button) button.disabled = true;
    return invoke(["classroomAction", "recordClassroomAction"], Object.assign({ action: action, at: new Date().toISOString() }, payload), "class-action")
      .then(function () { if ($("classroom-status")) $("classroom-status").textContent = "أكد الخادم الإجراء بنجاح."; })
      .catch(function (error) { if ($("classroom-status")) $("classroom-status").textContent = messageFor(error); })
      .then(function () { if (button) button.disabled = false; });
  }
  function playSpeech() {
    if (!state.lastLessonText) { toast("لا يوجد نص درس مؤكد لتشغيل الشرح الصوتي."); return; }
    if (!("speechSynthesis" in window) || !window.SpeechSynthesisUtterance) { toast("الشرح الصوتي غير مدعوم في هذه البيئة."); return; }
    window.speechSynthesis.cancel();
    var utterance = new window.SpeechSynthesisUtterance(state.lastLessonText);
    utterance.lang = "ar-IQ";
    var voice = window.speechSynthesis.getVoices().find(function (v) { return v.lang.toLowerCase().indexOf("ar") === 0; });
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

          download.disabled = false;
          download.onclick = function () { window.open(result.downloadUrl, "_blank", "noopener"); };
        }
      })
      .catch(function (error) {
        setStatus(meta, messageFor(error), error.code === "CONFIG" ? "warn" : "error");

  // ------------------------------------------------------------------------
  // تقرير الحالة والاختبار التشخيصي
  // ------------------------------------------------------------------------
  function report() {
    var out = $("report-content");
    if (!out) return;
    out.replaceChildren();
    var rows = [
      ["حالة طبقة التكامل", api() ? "تم اكتشاف طبقة تكامل" : "يحتاج إعداداً خارجياً"],
      ["الدوال المكتشفة", functions().length ? functions().join("، ") : "لم تُكتشف دوال"],
      ["حد البيئة", "الصفحات المستقلة داخل المشروع؛ طبقة التكامل تربط /api/school الحقيقي ونماذج server/src."],
      ["الوحدات المستقلة", PAGE_FILES.index + "، " + PAGE_FILES.structure + "، " + PAGE_FILES.teachers + "، " + PAGE_FILES.students + "، " + PAGE_FILES.curriculum + "، " + PAGE_FILES.reader + "، " + PAGE_FILES.classroom],
      ["المراحل المرجعية", stages.map(function (s) { return s.name; }).join("، ")],
      ["المعلمون الحقيقيون", state.stats.teachers == null ? "لم يُحسم من المصدر" : state.stats.teachers],
      ["الشخصيات التعليمية", state.stats.personas == null ? "لم يُحسم من المصدر" : state.stats.personas],
      ["الكتب", state.stats.books == null ? "لم يُحسم من المصدر" : state.stats.books],
      ["آخر مزامنة مؤكدة", state.lastSync ? new Date(state.lastSync).toLocaleString("ar-IQ") : "لم تُحسم من المصدر"],
      ["آخر خطأ فعلي", state.lastError || "لا يوجد"]
    ];
    rows.forEach(function (pair) {
      var card = document.createElement("div");
      card.className = "rounded-2xl bg-white p-4";
      var a = document.createElement("p"), b = document.createElement("p");
      a.className = "font-bold text-[#53706f]"; b.className = "mt-1 font-extrabold";
      a.textContent = pair[0]; b.textContent = String(pair[1]);
      card.append(a, b); out.appendChild(card);
    });
    state.tests.forEach(function (test) {
      var line = document.createElement("div");
      line.className = "rounded-2xl border border-[#cce1db] bg-[#eff6f3] p-4 font-bold";
      line.textContent = test;
      out.appendChild(line);
    });
  }
  function diagnostic() {
    state.tests = [];
    var checks = [["المرحلة", ["getStages", "listStages"]], ["الصف", ["getGrades", "listGrades"]], ["المادة", ["getSubjects", "listSubjects"]], ["الدرس", ["getLessons", "listLessons"]], ["المعلم", ["searchTeachers", "listTeachers"]], ["الحصة", ["getClassroomOptions", "getSessions"]]];
    return checks.reduce(function (chain, pair) {
      return chain.then(function () {
        if (!has(pair[1])) { state.tests.push("SKIP — " + pair[0] + ": يحتاج إعداد endpoint مكتشف."); return null; }
        return invoke(pair[1], {}, "diagnostic-" + pair[0]).then(function () {
          state.tests.push("PASS — " + pair[0] + ": تم تأكيد استجابة المصدر.");
        }).catch(function (error) {
          state.tests.push((error.name === "AbortError" ? "SKIP" : "FAIL") + " — " + pair[0] + ": " + messageFor(error));
        });
      });
    }, Promise.resolve()).then(function () { report(); });
  }

  // ------------------------------------------------------------------------
  // Bindings (guarded: each standalone page has its own screen only)
  // ------------------------------------------------------------------------
  function bind() {
    for (var i = 0; i < PAGES.length; i++) {
      var page = PAGES[i];
      Array.prototype.forEach.call(document.querySelectorAll('[data-page="' + page + '"]'), function (button) {
        button.addEventListener("click", function () { changePage(button.dataset.page); });
      });
    }
    if ($("menu-button")) $("menu-button").onclick = openDrawer;
    if ($("drawer-close")) $("drawer-close").onclick = closeDrawer;
    if ($("drawer-overlay")) $("drawer-overlay").onclick = closeDrawer;
    if ($("report-button")) $("report-button").onclick = function () { if ($("report-modal")) $("report-modal").classList.add("is-open"); report(); };
    if ($("report-close")) $("report-close").onclick = function () { if ($("report-modal")) $("report-modal").classList.remove("is-open"); };
    if ($("diagnostic-button")) $("diagnostic-button").onclick = diagnostic;
    if ($("dashboard-retry")) $("dashboard-retry").onclick = loadDashboard;
    if ($("reader-retry")) $("reader-retry").onclick = loadReader;
    if ($("reader-fullscreen")) $("reader-fullscreen").onclick = function () { if ($("pdf-reader") && $("pdf-reader").requestFullscreen) $("pdf-reader").requestFullscreen(); };
  }

  function start() {
    bind();
    refreshConnection();
    changePage(ownPage());
    icon();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  // Exposed for the DOM test-suite and for embedding the screens elsewhere.
  window.ShnoSchoolCanvaUI = { changePage: changePage, showScreen: showScreen, refreshConnection: refreshConnection, diagnostic: diagnostic, report: report, pageFiles: PAGE_FILES };
})();

        setStatus(viewer, messageFor(error), "error");
      });
  }
