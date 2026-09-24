/** Phase 8 teacher workspace. Every list and mutation comes from authenticated APIs. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../sumer-api'), require('../sumer-ui'));
  else root.SumerTeacherView = factory(root.SumerAPI, root.SumerUI);
}(typeof self !== 'undefined' ? self : this, function (api, ui) {
  'use strict';
  var escape = ui.escapeHtml;
  var snapshot = null;
  var nav = [
    ['overview', 'ملفي ولوحتي'], ['students', 'طلابي'], ['classes', 'صفوفي'],
    ['schedule', 'جدولي'], ['assignments', 'الواجبات والتسليمات'],
    ['gradebook', 'الدرجات'], ['attendance', 'الحضور'], ['reports', 'تقارير الطلاب'],
    ['curriculum', 'المناهج والقارئ'], ['classroom', 'الصف والسبورة'], ['live', 'الحصة والبث']
  ];
  function value(v) { return escape(v == null ? '' : v); }
  function date(v) { return v ? value(new Date(v).toLocaleString('ar-IQ')) : 'غير محدد'; }
  function empty(items, label) { return items.length ? '' : '<p class="teacher-empty">لا توجد ' + label + ' مسجلة حاليًا.</p>'; }
  function button(text, action, attrs) { return '<button type="button" class="teacher-button" data-teacher-action="' + action + '" ' + (attrs || '') + '>' + text + '</button>'; }
  function selectStudents() { return (snapshot.students || []).map(function (s) { return '<option value="' + value(s._id) + '">' + value(s.name) + ' · ' + value(s.grade) + '</option>'; }).join(''); }
  function heading(title, subtitle) { return '<header class="teacher-heading"><p>مساحة المعلم المعتمد</p><h1>' + title + '</h1><span>' + subtitle + '</span></header>'; }
  function formStudent(action, fields, submit) {
    return '<form class="teacher-form" data-teacher-form="' + action + '"><label>الطالب<select name="studentId" required><option value="">اختر الطالب</option>' + selectStudents() + '</select></label>' + fields + '<button type="submit">' + submit + '</button></form>';
  }
  function renderSection(section) {
    var d = snapshot, students = d.students || [], schedules = d.schedules || [], assignments = d.assignments || [], submissions = d.submissions || [], reports = d.reports || [], rooms = d.classrooms || [];
    if (section === 'overview') return heading('أهلاً ' + value(d.teacher.name), 'ملفك المهني وبيانات تكليفك الحقيقية') +
      '<div class="teacher-stats"><div><b>' + students.length + '</b>طالب مرتبط</div><div><b>' + schedules.length + '</b>موعد</div><div><b>' + assignments.length + '</b>واجب</div><div><b>' + submissions.filter(function (s) { return s.status !== 'graded'; }).length + '</b>تسليم بانتظار التصحيح</div></div>' +
      '<section class="teacher-card"><h2>ملفي</h2><p>المواد: ' + value((d.teacher.subjects || []).join('، ') || 'غير محددة') + '</p><p>المراحل: ' + value((d.teacher.stages || []).join('، ') || 'غير محددة') + '</p><p>الصفوف: ' + value((d.teacher.grades || []).join('، ') || 'غير محددة') + '</p></section>';
    if (section === 'students') return heading('طلابي', 'الطلاب المرتبطون بتكليفك فقط') + empty(students, 'قوائم طلاب') + students.map(function (s) { return '<article class="teacher-card"><h2>' + value(s.name) + '</h2><p>' + value(s.stage) + ' · ' + value(s.grade) + ' · ' + value(s.section) + '</p><p>المواد: ' + value((s.assignedTeachers || []).filter(function (a) { return String(a.teacher) === String(d.teacher._id); }).map(function (a) { return a.subject; }).join('، ')) + '</p>' + button('عرض السجل', 'record', 'data-id="' + value(s._id) + '"') + '</article>'; }).join('');
    if (section === 'classes') {
      var groups = {};
      students.forEach(function (s) { (s.assignedTeachers || []).forEach(function (a) { if (String(a.teacher) !== String(d.teacher._id)) return; var key = [s.stage, s.grade, s.section, a.subject].join(' · '); groups[key] = (groups[key] || 0) + 1; }); });
      return heading('صفوفي', 'الصفوف والمواد المشتقة من الطلاب المرتبطين فعليًا') + empty(Object.keys(groups), 'صفوف مرتبطة') + Object.keys(groups).map(function (key) { return '<article class="teacher-card"><h2>' + value(key) + '</h2><p>' + groups[key] + ' طالب</p></article>'; }).join('');
    }
    if (section === 'schedule') return heading('جدولي', 'المواعيد الموثقة على حسابك') + '<details class="teacher-card"><summary>جدولة حصة أو اختبار</summary><form class="teacher-form" data-teacher-form="schedule"><label>طلاب الصف<select name="studentIds" multiple size="5" required>' + selectStudents() + '</select></label><label>المادة<input name="subject" required></label><label>النوع<select name="type"><option value="LIVE_CLASS">حصة مباشرة</option><option value="GENERAL_REVIEW">مراجعة</option><option value="EXAM">اختبار</option></select></label><label>العنوان<input name="title" required></label><label>الموعد<input name="scheduledAt" type="datetime-local" required></label><button type="submit">حفظ الموعد</button></form></details>' + empty(schedules, 'مواعيد') + schedules.map(function (s) { return '<article class="teacher-card"><h2>' + value(s.title) + '</h2><p>' + date(s.scheduledAt) + ' · ' + value(s.subject) + ' · ' + value(s.grade) + ' · ' + value(s.status) + '</p></article>'; }).join('');
    if (section === 'assignments') return heading('الواجبات والتسليمات', 'أنشئ واجبًا لطلابك، ثم راجع التسليمات ودرّجها') +
      '<details class="teacher-card"><summary>إنشاء واجب</summary><form class="teacher-form" data-teacher-form="assignment"><label>الطلاب المعنيون<select name="studentIds" multiple required size="5">' + selectStudents() + '</select></label><label>المادة<input name="subject" required></label><label>العنوان<input name="title" required></label><label>الوصف<textarea name="description"></textarea></label><label>آخر موعد<input name="dueAt" type="datetime-local" required></label><label>الدرجة القصوى<input name="maxScore" type="number" min="1" value="100" required></label><button type="submit">نشر الواجب</button></form></details>' + empty(assignments, 'واجبات') + assignments.map(function (a) { var subs = submissions.filter(function (s) { return String(s.assignment) === String(a._id); }); return '<article class="teacher-card"><h2>' + value(a.title) + '</h2><p>' + value(a.subject) + ' · ' + value(a.grade) + ' · موعد التسليم ' + date(a.dueAt) + '</p><p>' + value(a.description) + '</p><p>' + subs.length + ' تسليم</p>' + subs.map(function (s) { return '<div class="teacher-submission"><b>' + value(s.student && s.student.name) + '</b><p>' + value(s.content) + '</p><small>' + value(s.status) + (s.score == null ? '' : ' · ' + value(s.score) + '/' + value(a.maxScore)) + '</small>' + (s.status === 'graded' ? '' : '<form class="teacher-form" data-teacher-form="grade-submission" data-assignment="' + value(a._id) + '" data-submission="' + value(s._id) + '"><label>الدرجة<input name="score" type="number" min="0" max="' + value(a.maxScore) + '" required></label><label>ملاحظات<textarea name="teacherFeedback"></textarea></label><button type="submit">حفظ التصحيح</button></form>') + '</div>'; }).join('') + '</article>'; }).join('');
    if (section === 'gradebook') return heading('دفتر الدرجات', 'الدرجات التي ترصدها لطلابك وموادك فقط') + formStudent('grade', '<label>المادة<input name="subject" required></label><label>العنوان<input name="title" required></label><label>الدرجة<input name="score" type="number" min="0" required></label><label>من<input name="maxScore" type="number" min="1" value="100" required></label>', 'رصد الدرجة') + '<p>لعرض درجات طالب، افتح سجله من تبويب «طلابي».</p>';
    if (section === 'attendance') return heading('الحضور', 'تسجيل حضور الطلاب المرتبطين بك') + formStudent('attendance', '<label>الحالة<select name="status"><option value="present">حاضر</option><option value="absent">غائب</option><option value="late">متأخر</option><option value="excused">بعذر</option></select></label><label>ملاحظة<textarea name="notes"></textarea></label>', 'حفظ الحضور') + '<p>لعرض سجل الحضور افتح ملف الطالب من تبويب «طلابي».</p>';
    if (section === 'reports') return heading('تقارير الطلاب', 'تقاريرك الأكاديمية الموثقة') + formStudent('report', '<label>المادة<input name="subject" required></label><label>المستوى<select name="level"><option value="excellent">ممتاز</option><option value="good">جيد</option><option value="needs_support">يحتاج دعمًا</option></select></label><label>المشاركة<textarea name="participation"></textarea></label><label>الواجبات<textarea name="homework"></textarea></label><label>التوصيات<textarea name="recommendations"></textarea></label>', 'حفظ التقرير') + empty(reports, 'تقارير') + reports.map(function (r) { return '<article class="teacher-card"><b>' + value(r.subject) + '</b><p>' + value(r.recommendations) + '</p><small>' + date(r.createdAt) + '</small></article>'; }).join('');
    if (section === 'curriculum') return heading('المناهج والقارئ', 'كتب الوزارة المتاحة لصفوفك وموادك') + '<div id="teacher-books">جارٍ تحميل الكتب من الخادم…</div>';
    if (section === 'classroom') return heading('الصف والسبورة', 'سبورة موثقة ومباشرة لطلاب الحصة') + empty(rooms.filter(function (r) { return r.status === 'live'; }), 'حصص مباشرة نشطة') + rooms.filter(function (r) { return r.status === 'live'; }).map(function (r) { return '<article class="teacher-card"><h2>' + value(r.lesson || r.subject) + ' · ' + value(r.code) + '</h2><form class="teacher-form" data-teacher-form="board" data-code="' + value(r.code) + '"><label>نص السبورة<textarea name="text" maxlength="2000" required></textarea></label><label>مرجع الكتاب (اختياري)<input name="bookId"></label><label>رقم الصفحة<input name="page" type="number" min="1"></label><button type="submit">نشر على السبورة</button></form>' + button('عرض السبورة', 'board', 'data-code="' + value(r.code) + '"') + '<div class="teacher-board-entries"></div></article>'; }).join('');
    if (section === 'live') return heading('الحصة والبث', 'حصصك المباشرة على الخادم') + '<article class="teacher-card"><a href="school-live.html">بدء حصة مباشرة</a></article>' + empty(rooms, 'حصص') + rooms.map(function (r) { return '<article class="teacher-card"><h2>' + value(r.lesson || r.subject) + '</h2><p>' + value(r.code) + ' · ' + value(r.status) + '</p><a href="school-live.html?code=' + encodeURIComponent(r.code) + '">فتح الحصة</a></article>'; }).join('');
    return heading('مساحة المعلم', 'لا توجد بيانات لهذا القسم');
  }
  function errorText(response) { return (response.data && response.data.message) || response.error || 'تعذر إكمال العملية'; }
  function load(container, section) {
    container.innerHTML = heading('جارٍ تحميل بيانات المعلم', 'من الخادم');
    return api.request('/api/school/teacher/overview').then(function (response) {
      if (!response.ok || !response.data || !response.data.teacher) throw new Error(errorText(response));
      snapshot = response.data;
      container.innerHTML = '<div class="teacher-workspace"><nav class="teacher-tabs" aria-label="مساحة المعلم">' + nav.map(function (item) { return '<a class="' + (item[0] === section ? 'active' : '') + '" href="#teacher/' + item[0] + '">' + item[1] + '</a>'; }).join('') + '</nav><div id="teacher-feedback" role="status"></div><div id="teacher-section">' + renderSection(section) + '</div></div>';
      attach(container, section);
      if (section === 'curriculum') loadBooks(container);
    }).catch(function (err) { container.innerHTML = heading('تعذر تحميل مساحة المعلم', value(err.message)); });
  }
  function loadBooks(container) {
    api.request('/api/school/books').then(function (result) {
      if (!result.ok) throw new Error(errorText(result));
      var teacher = snapshot.teacher;
      var books = (result.data.items || []).filter(function (b) { return (teacher.stages || []).includes(b.stage) && (teacher.grades || []).includes(b.grade) && (teacher.subjects || []).includes(b.subject); });
      container.querySelector('#teacher-books').innerHTML = empty(books, 'كتب مرتبطة بتكليفك') + books.map(function (b) {
        return '<article class="teacher-card"><h2>' + value(b.title) + '</h2><p>' + value(b.stage) + ' · ' + value(b.grade) + ' · ' + value(b.subject) + '</p>' + button('قراءة الصفحات', 'book', 'data-id="' + value(b.id || b._id) + '"') + (b.file && b.file.url ? ' <a href="' + value(b.file.url) + '" target="_blank" rel="noopener">فتح ملف الكتاب</a>' : '') + '</article>';
      }).join('');
      container.querySelectorAll('[data-teacher-action="book"]').forEach(function (el) { el.onclick = function () {
        api.getBookReader(el.dataset.id).then(function (response) {
          if (!response.ok) throw new Error(errorText(response));
          var book = response.data.book || {}, reader = response.data.reader || {};
          container.querySelector('#teacher-books').innerHTML = '<article class="teacher-card"><h2>' + value(book.title || reader.title || 'القارئ') + '</h2><p>صفحات الكتاب: ' + value(reader.totalPages || reader.pageCount || 'غير محددة') + '</p><form class="teacher-form" id="teacher-reader"><label>رقم الصفحة<input type="number" name="page" min="1" value="1" required></label><button type="submit">قراءة الصفحة</button></form><div id="teacher-page"></div></article>';
          container.querySelector('#teacher-reader').onsubmit = function (event) { event.preventDefault(); var page = this.elements.page.value; api.getBookPage(el.dataset.id, page).then(function (result) { if (!result.ok) throw new Error(errorText(result)); var data = result.data.page || result.data; container.querySelector('#teacher-page').innerHTML = '<pre class="teacher-page">' + value(data.text || data.content || 'لا يوجد نص مفهرس لهذه الصفحة') + '</pre>'; }).catch(function (err) { container.querySelector('#teacher-feedback').textContent = err.message; }); };
        }).catch(function (err) { container.querySelector('#teacher-feedback').textContent = err.message; });
      }; });
    }).catch(function (err) { container.querySelector('#teacher-books').textContent = err.message; });
  }
  function attach(container, section) {
    container.querySelectorAll('[data-teacher-action="board"]').forEach(function (el) { el.onclick = function () {
      api.request('/api/school/classrooms/' + encodeURIComponent(el.dataset.code) + '/board').then(function (result) {
        if (!result.ok) throw new Error(errorText(result));
        el.parentElement.querySelector('.teacher-board-entries').innerHTML = empty(result.data.entries || [], 'ملاحظات على السبورة') + (result.data.entries || []).map(function (entry) { return '<p>' + date(entry.createdAt) + ' · ' + value(entry.text) + (entry.page ? ' · صفحة ' + value(entry.page) : '') + '</p>'; }).join('');
      }).catch(function (err) { container.querySelector('#teacher-feedback').textContent = err.message; });
    }; });
    container.querySelectorAll('[data-teacher-action="record"]').forEach(function (buttonEl) {
      buttonEl.onclick = function () {
        api.request('/api/school/teacher/students/' + encodeURIComponent(buttonEl.dataset.id) + '/record').then(function (response) {
          if (!response.ok) throw new Error(errorText(response));
          var r = response.data;
          container.querySelector('#teacher-section').innerHTML = heading('سجل ' + value(r.student.name), 'بيانات مادّتك وسجلاتك لهذا الطالب') + '<article class="teacher-card"><h2>درجاتي</h2>' + empty(r.grades, 'درجات') + r.grades.map(function (g) { return '<p>' + value(g.subject) + ' · ' + value(g.title) + ': ' + value(g.score) + '/' + value(g.maxScore) + '</p>'; }).join('') + '</article><article class="teacher-card"><h2>الحضور</h2>' + empty(r.attendance, 'سجلات حضور') + r.attendance.map(function (a) { return '<p>' + date(a.date) + ' · ' + value(a.status) + '</p>'; }).join('') + '</article><article class="teacher-card"><h2>تقاريري</h2>' + empty(r.reports, 'تقارير') + r.reports.map(function (p) { return '<p>' + value(p.subject) + ' · ' + value(p.recommendations) + '</p>'; }).join('') + '</article>';
        }).catch(function (err) { container.querySelector('#teacher-feedback').textContent = err.message; });
      };
    });
    container.querySelectorAll('[data-teacher-form]').forEach(function (form) { form.onsubmit = function (event) {
      event.preventDefault();
      var data = Object.fromEntries(new FormData(form).entries()), action = form.dataset.teacherForm, endpoint, method = 'POST';
      if (action === 'board') { endpoint = '/api/school/classrooms/' + encodeURIComponent(form.dataset.code) + '/board'; }
      else if (action === 'assignment' || action === 'schedule') {
        var ids = Array.from(form.querySelector('[name="studentIds"]').selectedOptions).map(function (option) { return option.value; });
        var selected = snapshot.students.filter(function (s) { return ids.includes(String(s._id)); });
        if (!selected.length || selected.length !== ids.length || selected.some(function (s) { return s.stage !== selected[0].stage || s.grade !== selected[0].grade || s.section !== selected[0].section || !(s.assignedTeachers || []).some(function (a) { return String(a.teacher) === String(snapshot.teacher._id) && a.subject === data.subject.trim(); }); })) { container.querySelector('#teacher-feedback').textContent = 'اختر طلابًا من الصف والمادة نفسيهما ضمن تكليفك'; return; }
        data.stage = selected[0].stage; data.grade = selected[0].grade; data.section = selected[0].section; if (action === 'assignment') { data.assignedStudents = ids; data.dueAt = new Date(data.dueAt).toISOString(); endpoint = '/api/school/assignments'; }
        else { data.studentIds = ids; data.scheduledAt = new Date(data.scheduledAt).toISOString(); endpoint = '/api/school/management/schedules'; }
      } else if (action === 'grade-submission') { endpoint = '/api/school/assignments/' + encodeURIComponent(form.dataset.assignment) + '/submissions/' + encodeURIComponent(form.dataset.submission) + '/grade'; method = 'PATCH'; }
      else { endpoint = '/api/school/teacher/students/' + encodeURIComponent(data.studentId) + '/' + ({ grade: 'grades', attendance: 'attendance', report: 'reports' }[action]); }
      var submit = form.querySelector('button[type="submit"]'); submit.disabled = true;
      api.request(endpoint, { method: method, body: data }).then(function (response) { if (!response.ok) throw new Error(errorText(response)); load(container, section); }).catch(function (err) { container.querySelector('#teacher-feedback').textContent = err.message; submit.disabled = false; });
    }; });
  }
  function render(route, container) { return load(container, String(route || '').split('/')[1] || 'overview'); }
  return { render: render };
}));
