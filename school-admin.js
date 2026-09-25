// school-admin.js - School Management Frontend Logic
'use strict';

(function () {
  let currentUser = null;
  let schoolContext = null;
  const readAuthToken = () => localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || localStorage.getItem('developerToken') || sessionStorage.getItem('developerToken') || '';\n  let token = readAuthToken();
  let allStudents = [];
  let allRealTeachers = [];
  let allVirtualTeachers = [];

  // Helper: DOM Selectors & Utilities
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  function showAlert(msg, isError = false) {
    const alertBox = $('adminAlert');
    const textEl = $('adminAlertText');
    if (!alertBox || !textEl) return;
    textEl.textContent = msg;
    alertBox.className = `admin-alert ${isError ? 'alert-danger' : 'alert-success'}`;
    alertBox.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { alertBox.hidden = true; }, 7000);
  }

  async function apiCall(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${readAuthToken()}`,
      ...(options.headers || {})
    };
    try {
      const res = await fetch(`/api/school/management${endpoint}`, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `خطأ في الخادم (${res.status})`);
      }
      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  }

  // Navigation Tab Switching
  function setupTabs() {
    const buttons = document.querySelectorAll('.tab-nav-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
        const pane = $(`pane-${tab}`);
        if (pane) pane.classList.add('active');
        loadTabData(tab);
      });
    });
  }

  // Modals Management
  function setupModals() {
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('.admin-modal').hidden = true;
      });
    });

    $('quickAddTeacherBtn')?.addEventListener('click', () => { $('modalAddTeacher').hidden = false; });
    $('openAddTeacherModalBtn')?.addEventListener('click', () => { $('modalAddTeacher').hidden = false; });
    $('quickAddStudentBtn')?.addEventListener('click', () => { $('modalAddStudent').hidden = false; populateStudentFormDropdowns(); });
    $('openAddStudentModalBtn')?.addEventListener('click', () => { $('modalAddStudent').hidden = false; populateStudentFormDropdowns(); });
    $('quickAddScheduleBtn')?.addEventListener('click', () => { $('modalAddSchedule').hidden = false; });
    $('openAddScheduleModalBtn')?.addEventListener('click', () => { $('modalAddSchedule').hidden = false; });
    $('openAddGradeModalBtn')?.addEventListener('click', () => { $('modalAddGrade').hidden = false; populateStudentSelect('gradeStudentSelect'); });
    $('openAddAttendanceModalBtn')?.addEventListener('click', () => { $('modalAddAttendance').hidden = false; populateStudentSelect('attStudentSelect'); });
    $('openAddComplaintModalBtn')?.addEventListener('click', () => { $('modalAddComplaint').hidden = false; populateStudentSelect('complaintStudentSelect'); });

    // Live search for Teacher Account
    setupLiveSearch('teacherUserSearchInput', 'teacherSearchResults', 'teacherUserId', (u) => {
      $('teacherFullName').value = u.fullName || u.username;
      $('teacherPhone').value = u.phone || '';
    });

    // Live search for Guardian Account
    setupLiveSearch('guardianUserSearchInput', 'guardianSearchResults', 'guardianUserId');
  }

  function setupLiveSearch(inputId, resultsId, hiddenId, onSelect) {
    const inp = $(inputId);
    const box = $(resultsId);
    const hidden = $(hiddenId);
    let timer = null;

    inp?.addEventListener('input', () => {
      clearTimeout(timer);
      const q = inp.value.trim();
      if (q.length < 2) {
        box.hidden = true;
        return;
      }
      timer = setTimeout(async () => {
        try {
          const res = await apiCall(`/users/search?q=${encodeURIComponent(q)}`);
          if (!res.users || !res.users.length) {
            box.innerHTML = '<div style="padding:10px;text-align:center;color:#64748b;">لا يوجد حساب مطابق</div>';
            box.hidden = false;
            return;
          }
          box.innerHTML = res.users.map((u) => `
            <div class="search-item" data-id="${u._id}" data-name="${escapeHtml(u.fullName || u.username)}" data-phone="${escapeHtml(u.phone || '')}">
              <div>
                <b>${escapeHtml(u.fullName || u.username)}</b>
                <div style="font-size:0.75rem;color:#64748b;">@${escapeHtml(u.username)} · ${escapeHtml(u.phone || 'بدون هاتف')}</div>
              </div>
              <span class="role-pill role-${u.role}">${u.role}</span>
            </div>
          `).join('');
          box.hidden = false;

          box.querySelectorAll('.search-item').forEach((item) => {
            item.addEventListener('click', () => {
              hidden.value = item.dataset.id;
              inp.value = item.dataset.name;
              box.hidden = true;
              if (onSelect) onSelect({ _id: item.dataset.id, fullName: item.dataset.name, phone: item.dataset.phone });
            });
          });
        } catch {
          box.hidden = true;
        }
      }, 300);
    });
  }

  // Initial Boot
  async function init() {
    try {
      setupTabs();
      setupModals();
      setupForms();

      const me = await apiCall('/me');
      currentUser = me.user;
      schoolContext = me.schoolContext;

      $('currentUserName').textContent = currentUser.fullName || currentUser.username;
      const roleEl = $('currentUserRole');
      roleEl.textContent = schoolContext.role;
      roleEl.className = `role-pill role-${schoolContext.role}`;

      // Adjust views based on role
      if (schoolContext.isGuardian && !schoolContext.isManager && !schoolContext.isDeveloper) {
        $('quickAddTeacherBtn').hidden = true;
        $('openAddTeacherModalBtn').hidden = true;
        $('guardianComplaintAction').hidden = false;
      }

      await loadOverview();
    } catch (err) {
      showAlert(`فشل تحميل بيانات المستخدم: ${err.message}`, true);
    }
  }

  // Load Tab Data Switcher
  function loadTabData(tab) {
    if (tab === 'overview') loadOverview();
    else if (tab === 'teachers') loadTeachers();
    else if (tab === 'students') loadStudents();
    else if (tab === 'guardians') loadGuardians();
    else if (tab === 'schedules') loadSchedules();
    else if (tab === 'grades') loadGrades();
    else if (tab === 'records') loadRecordsTab();
    else if (tab === 'complaints') loadComplaints();
    else if (tab === 'audit') loadAuditLogs();
  }

  // 1. Overview
  async function loadOverview() {
    try {
      const [teachersRes, studentsRes, schedulesRes, complaintsRes, guardiansRes] = await Promise.all([
        apiCall('/teachers'),
        apiCall('/students'),
        apiCall('/schedules'),
        apiCall('/complaints'),
        apiCall('/guardians')
      ]);

      allRealTeachers = teachersRes.realTeachers || [];
      allVirtualTeachers = teachersRes.virtualTeachers || [];
      allStudents = studentsRes.students || [];

      $('statRealTeachersCount').textContent = allRealTeachers.length;
      $('statVirtualTeachersCount').textContent = allVirtualTeachers.length;
      $('statStudentsCount').textContent = allStudents.length;
      $('statGuardiansCount').textContent = (guardiansRes.guardians || []).length;
      $('statSchedulesCount').textContent = (schedulesRes.schedules || []).length;
      
      const newComplaints = (complaintsRes.complaints || []).filter((c) => c.status === 'NEW');
      $('statComplaintsCount').textContent = newComplaints.length;
    } catch (err) {
      console.warn('Overview load error:', err.message);
    }
  }

  // 2. Teachers
  async function loadTeachers() {
    try {
      const res = await apiCall('/teachers');
      allRealTeachers = res.realTeachers || [];
      allVirtualTeachers = res.virtualTeachers || [];

      // Render Real Teachers
      const tbody = $('realTeachersTableBody');
      if (!allRealTeachers.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">لا يوجد معلمون حقيقيون مسجلون بعد. انقر "إضافة معلم حقيقي" للبدء.</td></tr>';
      } else {
        tbody.innerHTML = allRealTeachers.map((t) => `
          <tr>
            <td><b>${escapeHtml(t.name)}</b></td>
            <td>@${escapeHtml(t.user?.username || '')} (${escapeHtml(t.user?.fullName || '')})</td>
            <td>${(t.subjects || []).map((s) => `<span class="brand-link-btn" style="font-size:0.75rem;padding:2px 6px;">${escapeHtml(s)}</span>`).join(' ')}</td>
            <td>${(t.grades || []).join('، ')}</td>
            <td>${(t.sections || []).join('، ')}</td>
            <td>${escapeHtml(t.phone || '-')}</td>
            <td><span class="status-badge ${t.status}">${t.status === 'active' ? 'نشط' : 'مؤرشف'}</span></td>
            <td>
              <button type="button" class="btn btn-sm btn-secondary view-teacher-rec" data-id="${t._id}">السجل</button>
              ${t.status === 'active' ? `<button type="button" class="btn btn-sm btn-danger archive-teacher-btn" data-id="${t._id}">أرشفة</button>` : ''}
            </td>
          </tr>
        `).join('');

        tbody.querySelectorAll('.archive-teacher-btn').forEach((b) => {
          b.addEventListener('click', async () => {
            if (!confirm('هل أنت متأكد من أرشفة هذا المعلم؟ (سجلاته ستبقى محفوظة دائماً ولن تحذف)')) return;
            try {
              await apiCall(`/teachers/${b.dataset.id}`, { method: 'DELETE', body: JSON.stringify({ reason: 'أرشفة إدارية' }) });
              showAlert('تمت أرشفة المعلم بنجاح مع الاحتفاظ بسجلاته الدائمة');
              loadTeachers();
            } catch (e) {
              showAlert(e.message, true);
            }
          });
        });

        tbody.querySelectorAll('.view-teacher-rec').forEach((b) => {
          b.addEventListener('click', () => {
            document.querySelector('[data-tab="records"]').click();
            setTimeout(() => {
              $('selectTeacherForRecord').value = b.dataset.id;
              loadTeacherRecord(b.dataset.id);
            }, 100);
          });
        });
      }

      // Render Virtual Teachers
      const vbody = $('virtualTeachersTableBody');
      vbody.innerHTML = allVirtualTeachers.map((vt) => `
        <tr>
          <td><b>${escapeHtml(vt.name)}</b></td>
          <td>${escapeHtml(vt.subject)}</td>
          <td>${(vt.stages || []).join('، ')}</td>
          <td>${escapeHtml(vt.dialect)}</td>
          <td><span class="ai-virtual-badge">🤖 معلم افتراضي / AI</span></td>
          <td><span class="status-badge active">متاح دائماً</span></td>
        </tr>
      `).join('');
    } catch (err) {
      showAlert(`فشل تحميل المعلمين: ${err.message}`, true);
    }
  }

  // 3. Students
  async function loadStudents() {
    try {
      const stage = $('filterStudentStage')?.value || '';
      const grade = $('filterStudentGrade')?.value || '';
      const section = $('filterStudentSection')?.value || '';
      const q = new URLSearchParams();
      if (stage) q.set('stage', stage);
      if (grade) q.set('grade', grade);
      if (section) q.set('section', section);

      const res = await apiCall(`/students?${q.toString()}`);
      allStudents = res.students || [];

      const tbody = $('studentsTableBody');
      if (!allStudents.length) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-state">لا يوجد طلاب مسجلون يطابقون البحث. انقر "تسجيل طالب" للبدء.</td></tr>';
      } else {
        tbody.innerHTML = allStudents.map((s) => `
          <tr>
            <td><b>${escapeHtml(s.name)}</b></td>
            <td>${escapeHtml(s.stage)} — ${escapeHtml(s.grade)}</td>
            <td><b>${escapeHtml(s.section || 'أ')}</b></td>
            <td>${(s.subjects || []).join('، ') || '-'}</td>
            <td>${(s.assignedTeachers || []).map((at) => escapeHtml(at.teacher?.name || '')).filter(Boolean).join('، ') || '-'}</td>
            <td>${s.assignedVirtualTeacher ? `<span class="ai-virtual-badge">🤖 ${escapeHtml(s.assignedVirtualTeacher.name)}</span>` : '-'}</td>
            <td>${escapeHtml(s.guardian?.fullName || s.guardian?.username || '-')}</td>
            <td><span class="status-badge ${s.status || 'active'}">${s.status === 'archived' ? 'مؤرشف' : 'نشط'}</span></td>
            <td>${new Date(s.registrationDate || s.createdAt).toLocaleDateString('ar-IQ')}</td>
            <td>
              <button type="button" class="btn btn-sm btn-secondary view-student-rec" data-id="${s._id}">السجل الدائم</button>
              ${s.status !== 'archived' ? `<button type="button" class="btn btn-sm btn-danger archive-student-btn" data-id="${s._id}">أرشفة</button>` : ''}
            </td>
          </tr>
        `).join('');

        tbody.querySelectorAll('.archive-student-btn').forEach((b) => {
          b.addEventListener('click', async () => {
            if (!confirm('هل أنت متأكد من أرشفة الطالب؟ ستبقى كامل سجلاته ودرجاته محفوظة ولن تحذف إطلاقاً.')) return;
            try {
              await apiCall(`/students/${b.dataset.id}`, { method: 'DELETE', body: JSON.stringify({ reason: 'أرشفة شؤون القيد' }) });
              showAlert('تمت أرشفة الطالب بنجاح مع الاحتفاظ بكامل سجله الأكاديمي');
              loadStudents();
            } catch (e) {
              showAlert(e.message, true);
            }
          });
        });

        tbody.querySelectorAll('.view-student-rec').forEach((b) => {
          b.addEventListener('click', () => {
            document.querySelector('[data-tab="records"]').click();
            setTimeout(() => {
              $('selectStudentForRecord').value = b.dataset.id;
              loadStudentPermanentRecord(b.dataset.id);
            }, 100);
          });
        });
      }
    } catch (err) {
      showAlert(`فشل تحميل الطلاب: ${err.message}`, true);
    }
  }

  // 4. Guardians & Consents
  async function loadGuardians() {
    try {
      const res = await apiCall('/guardians');
      const guardians = res.guardians || [];
      const tbody = $('guardiansTableBody');

      if (!guardians.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا يوجد أولياء أمور مسجلون حالياً.</td></tr>';
      } else {
        tbody.innerHTML = guardians.map((g) => `
          <tr>
            <td><b>${escapeHtml(g.name)}</b></td>
            <td>@${escapeHtml(g.user?.username || '')}</td>
            <td>${escapeHtml(g.relationship || 'ولي أمر')}</td>
            <td>${escapeHtml(g.contactMethod || 'inApp')}</td>
            <td>${escapeHtml(g.contactPhone || g.user?.phone || '-')}</td>
            <td>${(g.students || []).map((s) => `<span class="brand-link-btn" style="font-size:0.75rem;padding:2px 6px;">${escapeHtml(s.name)} (${s.grade})</span>`).join(' ') || 'لا يوجد'}</td>
            <td>
              <button type="button" class="btn btn-sm btn-primary view-guardian-consents" data-gid="${g._id}">فحص الموافقات</button>
            </td>
          </tr>
        `).join('');
      }

      // Populate consent select
      populateStudentSelect('consentStudentSelect');
    } catch (err) {
      showAlert(`فشل تحميل أولياء الأمور: ${err.message}`, true);
    }
  }

  async function loadStudentConsents(studentId) {
    const container = $('consentsContainer');
    if (!studentId) {
      container.innerHTML = '<p class="empty-state">اختر طالباً من القائمة لعرض سجل موافقات ولي أمره.</p>';
      return;
    }

    try {
      container.innerHTML = '<p class="empty-state">جارٍ جلب سجل الموافقات القابل للتدقيق...</p>';
      const res = await apiCall(`/students/${studentId}/consents`);
      const consents = res.consents || [];

      const typeLabels = {
        microphone: { title: '🎙️ استخدام الميكروفون', desc: 'إذن التحدث في الصف والمشاركة الصوتية (يظل متوقفاً حتى يضغط الطالب بنفسه)' },
        camera: { title: '📷 استخدام الكاميرا', desc: 'إذن تشغيل الكاميرا محلياً للحضور (تظل متوقفة حتى يضغط الطالب بنفسه)' },
        live_classroom_participation: { title: '👥 المشاركة في الصف المباشر', desc: 'إذن حضور الصفوف التفاعلية الحية مع المعلم الحقيقي' },
        virtual_teacher_participation: { title: '🤖 المشاركة مع المعلم الافتراضي', desc: 'إذن الاستفادة من حصص الشرح التفاعلي مع المعلم الافتراضي' },
        ai_voice_usage: { title: '🗣️ التحدث الصوتي مع AI', desc: 'إذن طرح الأسئلة شفهياً وتلقي نطق الإجابة من المعلم الافتراضي' },
        save_learning_qa: { title: '💾 حفظ الأسئلة والأجوبة التعليمية', desc: 'إذن تسجيل استفسارات الطالب وإجابات المعلم في السجل الدراسي للمراجعة' },
        school_notifications: { title: '🔔 إشعارات المدرسة والجدول', desc: 'إرسال تنبيهات المواعيد والاختبارات وملاحظات المعلمين لولي الأمر' }
      };

      container.innerHTML = `
        <div style="margin-bottom:12px;padding:8px 12px;background:var(--admin-card-bg);border-radius:8px;border:1px solid var(--admin-border);">
          <b>موافقات الطالب:</b> ${escapeHtml(res.studentName)} · <small class="text-muted">موافقة صريحة مسجلة ومؤرخة لكل بند بشكل منفصل</small>
        </div>
      ` + consents.map((c) => {
        const meta = typeLabels[c.consentType] || { title: c.consentType, desc: c.text };
        const isGranted = c.granted === true;
        return `
          <div class="consent-card">
            <div class="consent-info">
              <h5>${meta.title}</h5>
              <p>${meta.desc}</p>
              <div style="font-size:0.75rem;color:#64748b;margin-top:4px;">
                الحالة: <b style="color:${isGranted ? '#16a34a' : '#dc2626'}">${isGranted ? '✅ موافقة ممنوحة (GRANTED)' : '❌ غير موافق (DENIED)'}</b>
                ${c.decidedAt ? `· تاريخ القرار: ${new Date(c.decidedAt).toLocaleString('ar-IQ')}` : '· (الوضع الافتراضي: غير مفعل)'}
              </div>
            </div>
            <div>
              <button type="button" class="btn btn-sm ${isGranted ? 'btn-danger' : 'btn-primary'} toggle-consent-btn" data-type="${c.consentType}" data-current="${isGranted}">
                ${isGranted ? 'إلغاء الموافقة (رفض)' : 'منح الموافقة (قبول)'}
              </button>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.toggle-consent-btn').forEach((b) => {
        b.addEventListener('click', async () => {
          const type = b.dataset.type;
          const current = b.dataset.current === 'true';
          const newStatus = !current;
          try {
            await apiCall(`/students/${studentId}/consents`, {
              method: 'POST',
              body: JSON.stringify({
                consentType: type,
                granted: newStatus,
                text: `موافقة ولي الأمر الصريحة على ${type}`,
                version: '2026-09-21-v1'
              })
            });
            showAlert(`تم تحديث حالة الموافقة لـ (${type}) إلى: ${newStatus ? 'موافقة' : 'رفض'}`);
            loadStudentConsents(studentId);
          } catch (e) {
            showAlert(e.message, true);
          }
        });
      });
    } catch (err) {
      container.innerHTML = `<p class="empty-state" style="color:var(--admin-danger);">فشل جلب الموافقات: ${escapeHtml(err.message)}</p>`;
    }
  }

  // 5. Schedules
  async function loadSchedules() {
    try {
      const type = $('filterScheduleType')?.value || '';
      const stage = $('filterScheduleStage')?.value || '';
      const q = new URLSearchParams();
      if (type) q.set('type', type);
      if (stage) q.set('stage', stage);

      const res = await apiCall(`/schedules?${q.toString()}`);
      const schedules = res.schedules || [];
      const tbody = $('schedulesTableBody');

      if (!schedules.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">لا توجد مواعيد أو حصص مجدولة حالياً. انقر "إضافة موعد / اختبار" للجدولة.</td></tr>';
      } else {
        const typeBadge = (t) => {
          if (t === 'LIVE_CLASS') return '<span class="status-badge live">🎙️ حصة مباشرة</span>';
          if (t === 'EXAM') return '<span class="status-badge exam">📝 اختبار / امتحان</span>';
          if (t === 'GENERAL_REVIEW') return '<span class="status-badge review">🔄 مراجعة عامة</span>';
          if (t === 'RECORDED_REPLAY') return '<span class="status-badge replay">▶️ إعادة مادة مصرحة</span>';
          return t;
        };

        tbody.innerHTML = schedules.map((sc) => `
          <tr>
            <td>${typeBadge(sc.type)}</td>
            <td><b>${escapeHtml(sc.title)}</b></td>
            <td>${escapeHtml(sc.subject)} ${sc.lesson ? `— <small>${escapeHtml(sc.lesson)}</small>` : ''}</td>
            <td>${escapeHtml(sc.stage)} / ${escapeHtml(sc.grade)} ${sc.section ? `(${escapeHtml(sc.section)})` : ''}</td>
            <td>${escapeHtml(sc.teacherName)}</td>
            <td>${new Date(sc.scheduledAt).toLocaleString('ar-IQ')} (${sc.durationMinutes} دقيقة)</td>
            <td>
              ${sc.type === 'EXAM' ? `الدرجة: ${sc.examConfig?.maxScore} · نجاح: ${sc.examConfig?.passingScore}` : ''}
              ${sc.type === 'RECORDED_REPLAY' ? `<small>${escapeHtml(sc.recordedResourceUrl || 'مادة منهجية معتمدة')}</small>` : ''}
            </td>
            <td><span class="status-badge ${sc.status}">${sc.status === 'scheduled' ? 'مجدول' : sc.status}</span></td>
          </tr>
        `).join('');
      }
    } catch (err) {
      showAlert(`فشل تحميل المواعيد: ${err.message}`, true);
    }
  }

  // 6. Grades & Attendance
  async function loadGrades() {
    try {
      const res = await apiCall('/students');
      const students = res.students || [];
      const tbody = $('recentGradesTableBody');

      const allScores = [];
      students.forEach((s) => {
        (s.scores || []).forEach((sc) => {
          allScores.push({ ...sc, studentName: s.name, stage: s.stage, grade: s.grade });
        });
      });

      allScores.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      if (!allScores.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">لا توجد درجات مرصودة حتى الآن.</td></tr>';
      } else {
        tbody.innerHTML = allScores.slice(0, 30).map((g) => `
          <tr>
            <td><b>${escapeHtml(g.studentName)}</b> (${escapeHtml(g.grade)})</td>
            <td>${escapeHtml(g.subject)}</td>
            <td>${escapeHtml(g.gradeType || 'تقييم')}</td>
            <td>${escapeHtml(g.lesson || 'اختبار')}</td>
            <td><b style="color:#15803d;">${g.score} / ${g.maxScore}</b></td>
            <td>المعلم المسؤول</td>
            <td>${escapeHtml(g.notes || '-')}</td>
            <td>${new Date(g.createdAt).toLocaleDateString('ar-IQ')}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      showAlert(`فشل تحميل الدرجات: ${err.message}`, true);
    }
  }

  // 7. Permanent Records
  async function loadRecordsTab() {
    populateStudentSelect('selectStudentForRecord');
    populateTeacherSelect('selectTeacherForRecord');
  }

  async function loadStudentPermanentRecord(studentId) {
    if (!studentId) return;
    const view = $('studentPermanentRecordView');
    $('teacherPermanentRecordView').hidden = true;
    view.hidden = false;
    view.innerHTML = '<p class="empty-state">جارٍ جلب السجل الأكاديمي الدائم...</p>';

    try {
      const res = await apiCall(`/students/${studentId}/record`);
      const r = res.record;
      const s = r.student;

      view.innerHTML = `
        <div class="pane-header">
          <div>
            <h2>🎓 السجل الأكاديمي الدائم: ${escapeHtml(s.name)}</h2>
            <p class="text-muted">المرحلة: ${escapeHtml(s.stage)} · الصف: ${escapeHtml(s.grade)} · الشعبة: ${escapeHtml(s.section || 'أ')} · الحالة: <span class="status-badge ${s.status}">${s.status === 'archived' ? 'مؤرشف' : 'نشط'}</span></p>
          </div>
          <button type="button" class="btn btn-secondary" onclick="window.print()">🖨️ طباعة السجل</button>
        </div>

        <div class="stats-grid" style="margin-bottom:16px;">
          <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-info"><h4>المعدل التراكمي</h4><div class="stat-number">${Math.round(s.progress?.average || 0)}%</div></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">✔️</div>
            <div class="stat-info"><h4>سجلات الحضور</h4><div class="stat-number">${r.attendanceRecords?.length || 0}</div></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📝</div>
            <div class="stat-info"><h4>الامتحانات والتقييمات</h4><div class="stat-number">${r.gradeRecords?.length || 0}</div></div>
          </div>
        </div>

        <div class="record-section">
          <h4>👨‍👩‍👧 بيانات ولي الأمر والمعلمين</h4>
          <p><b>ولي الأمر:</b> ${escapeHtml(s.guardian?.fullName || s.guardian?.username)} (هاتف: ${escapeHtml(s.guardian?.phone || '-')})</p>
          <p><b>المعلمون المشرفون:</b> ${(s.assignedTeachers || []).map((t) => `${escapeHtml(t.teacher?.name)} [${t.teacher?.subjects?.join('، ')}]`).join(' · ') || 'لا يوجد إسناد حالياً'}</p>
          <p><b>المعلم الافتراضي:</b> ${s.assignedVirtualTeacher ? `🤖 ${escapeHtml(s.assignedVirtualTeacher.name)}` : 'غير مسند'}</p>
        </div>

        <div class="record-section">
          <h4>📝 سجل الدرجات والامتحانات الدائم</h4>
          <div class="table-responsive">
            <table class="admin-table">
              <thead><tr><th>المادة</th><th>نوع التقييم</th><th>العنوان</th><th>الدرجة</th><th>المعلم</th><th>التاريخ</th></tr></thead>
              <tbody>
                ${(r.gradeRecords || []).length ? r.gradeRecords.map((gr) => `
                  <tr>
                    <td><b>${escapeHtml(gr.subject)}</b></td>
                    <td>${escapeHtml(gr.gradeType)}</td>
                    <td>${escapeHtml(gr.title)}</td>
                    <td><b style="color:#15803d;">${gr.score} / ${gr.maxScore}</b></td>
                    <td>${escapeHtml(gr.teacher?.fullName || gr.teacher?.username || 'المعلم')}</td>
                    <td>${new Date(gr.recordedAt).toLocaleDateString('ar-IQ')}</td>
                  </tr>
                `).join('') : '<tr><td colspan="6" class="empty-state">لا توجد اختبارات مسجلة بعد.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div class="record-section">
          <h4>✔️ سجل الحضور والغياب</h4>
          <div class="table-responsive">
            <table class="admin-table">
              <thead><tr><th>التاريخ</th><th>الحالة</th><th>المعلم</th><th>الملاحظات</th></tr></thead>
              <tbody>
                ${(r.attendanceRecords || []).length ? r.attendanceRecords.map((att) => `
                  <tr>
                    <td>${new Date(att.date).toLocaleDateString('ar-IQ')}</td>
                    <td><span class="status-badge ${att.status}">${att.status === 'present' ? 'حاضر' : att.status === 'absent' ? 'غائب' : att.status}</span></td>
                    <td>${escapeHtml(att.teacher?.fullName || att.teacher?.username || '')}</td>
                    <td>${escapeHtml(att.notes || '-')}</td>
                  </tr>
                `).join('') : '<tr><td colspan="4" class="empty-state">لا توجد سجلات حضور حتى الآن.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      view.innerHTML = `<p class="empty-state" style="color:var(--admin-danger);">فشل تحميل السجل الأكاديمي: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function loadTeacherRecord(teacherId) {
    if (!teacherId) return;
    const view = $('teacherPermanentRecordView');
    $('studentPermanentRecordView').hidden = true;
    view.hidden = false;
    view.innerHTML = '<p class="empty-state">جارٍ جلب السجل المهني للمعلم...</p>';

    try {
      const res = await apiCall(`/teachers/${teacherId}/record`);
      const r = res.record;
      const t = r.teacher;

      view.innerHTML = `
        <div class="pane-header">
          <div>
            <h2>👩‍🏫 السجل المهني للمعلم: ${escapeHtml(t.name)}</h2>
            <p class="text-muted">الحساب: @${escapeHtml(t.user?.username)} · الهاتف: ${escapeHtml(t.phone || '-')} · الحالة: <span class="status-badge ${t.status}">${t.status === 'archived' ? 'مؤرشف' : 'نشط'}</span></p>
          </div>
        </div>
        <div class="record-section">
          <h4>📚 التخصص والصفوف</h4>
          <p><b>المواد:</b> ${(t.subjects || []).join('، ')}</p>
          <p><b>المراحل والصفوف:</b> ${(t.stages || []).join('، ')} — ${(t.grades || []).join('، ')}</p>
          <p><b>الطلاب المسندون:</b> ${(r.assignedStudents || []).length} طالب</p>
        </div>
        <div class="record-section">
          <h4>📅 الحصص والاختبارات المنفذة</h4>
          <p>إجمالي المواعيد المجدولة: ${(r.schedules || []).length} · الصفوف المباشرة: ${(r.liveClassrooms || []).length}</p>
        </div>
      `;
    } catch (err) {
      view.innerHTML = `<p class="empty-state" style="color:var(--admin-danger);">فشل تحميل سجل المعلم: ${escapeHtml(err.message)}</p>`;
    }
  }

  // 8. Complaints
  async function loadComplaints() {
    try {
      const res = await apiCall('/complaints');
      const complaints = res.complaints || [];
      const tbody = $('complaintsTableBody');

      if (!complaints.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">لا توجد شكاوى أو استفسارات مسجلة.</td></tr>';
      } else {
        tbody.innerHTML = complaints.map((c) => `
          <tr>
            <td><b>${escapeHtml(c.guardian?.fullName || c.guardian?.username || 'ولي أمر')}</b></td>
            <td>${escapeHtml(c.student?.name || '-')}</td>
            <td><b>${escapeHtml(c.subject)}</b></td>
            <td>${escapeHtml(c.body)}</td>
            <td>${new Date(c.createdAt).toLocaleDateString('ar-IQ')}</td>
            <td><span class="status-badge ${c.status}">${c.status === 'NEW' ? 'جديدة' : c.status === 'IN_PROGRESS' ? 'قيد المتابعة' : 'مغلقة'}</span></td>
            <td>${c.adminResponse?.text ? `<small>${escapeHtml(c.adminResponse.text)}</small>` : '<span class="text-muted">بانتظار الرد</span>'}</td>
            <td>
              ${(schoolContext.isManager || schoolContext.isDeveloper) ? `<button type="button" class="btn btn-sm btn-primary reply-complaint-btn" data-id="${c._id}" data-subject="${escapeHtml(c.subject)}" data-body="${escapeHtml(c.body)}" data-status="${c.status}">الرد</button>` : '-'}
            </td>
          </tr>
        `).join('');

        tbody.querySelectorAll('.reply-complaint-btn').forEach((b) => {
          b.addEventListener('click', () => {
            $('replyComplaintId').value = b.dataset.id;
            $('replyComplaintSubjectDisplay').textContent = b.dataset.subject;
            $('replyComplaintBodyDisplay').textContent = b.dataset.body;
            $('replyStatusSelect').value = b.dataset.status || 'IN_PROGRESS';
            $('replyTextInput').value = '';
            $('modalReplyComplaint').hidden = false;
          });
        });
      }
    } catch (err) {
      showAlert(`فشل تحميل الشكاوى: ${err.message}`, true);
    }
  }

  // 9. Audit Logs
  async function loadAuditLogs() {
    try {
      const res = await apiCall('/audit-logs');
      const logs = res.logs || [];
      const tbody = $('auditLogsTableBody');

      if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">لا توجد عمليات مسجلة في سجل التدقيق.</td></tr>';
      } else {
        tbody.innerHTML = logs.map((l) => `
          <tr>
            <td>${new Date(l.createdAt).toLocaleString('ar-IQ')}</td>
            <td><b>${escapeHtml(l.actor?.fullName || l.actor?.username || 'مستخدم')}</b> <span class="role-pill role-${l.actor?.role || 'user'}">${l.actor?.role || 'user'}</span></td>
            <td><code>${escapeHtml(l.action)}</code></td>
            <td>${l.target ? escapeHtml(l.target?.fullName || l.target?.username || l.target) : '-'}</td>
            <td>${escapeHtml(l.details || '-')}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      showAlert(`فشل تحميل سجل العمليات: ${err.message}`, true);
    }
  }

  // Forms Submission Handling
  function setupForms() {
    // Filter listeners
    $('filterStudentStage')?.addEventListener('change', loadStudents);
    $('filterStudentGrade')?.addEventListener('input', loadStudents);
    $('filterStudentSection')?.addEventListener('input', loadStudents);
    $('filterScheduleType')?.addEventListener('change', loadSchedules);
    $('filterScheduleStage')?.addEventListener('change', loadSchedules);
    $('consentStudentSelect')?.addEventListener('change', (e) => loadStudentConsents(e.target.value));
    $('selectStudentForRecord')?.addEventListener('change', (e) => loadStudentPermanentRecord(e.target.value));
    $('selectTeacherForRecord')?.addEventListener('change', (e) => loadTeacherRecord(e.target.value));

    // Form: Add Real Teacher
    $('formAddTeacher')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = $('teacherUserId').value;
      if (!userId) {
        alert('يرجى اختيار حساب مستخدم حقيقي مسجل في شنو منو');
        return;
      }
      try {
        await apiCall('/teachers', {
          method: 'POST',
          body: JSON.stringify({
            userId,
            name: $('teacherFullName').value,
            gender: $('teacherGender').value,
            phone: $('teacherPhone').value,
            stages: $('teacherStages').value.split('،').map((s) => s.trim()).filter(Boolean),
            grades: $('teacherGrades').value.split('،').map((g) => g.trim()).filter(Boolean),
            sections: $('teacherSections').value.split('،').map((sec) => sec.trim()).filter(Boolean),
            subjects: $('teacherSubjects').value.split('،').map((sub) => sub.trim()).filter(Boolean)
          })
        });
        showAlert('تم تسجيل وتعيين المعلم الحقيقي بنجاح');
        $('modalAddTeacher').hidden = true;
        $('formAddTeacher').reset();
        loadTeachers();
      } catch (err) {
        showAlert(err.message, true);
      }
    });

    // Form: Add Student
    $('formAddStudent')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const guardianId = $('guardianUserId').value;
      if (!guardianId) {
        alert('يرجى اختيار حساب ولي أمر حقيقي مسجل في شنو منو');
        return;
      }
      try {
        const assignedTeachers = [];
        const tVal = $('assignTeacherSelect').value;
        if (tVal) assignedTeachers.push({ teacher: tVal });

        await apiCall('/students', {
          method: 'POST',
          body: JSON.stringify({
            name: $('studentNameInput').value,
            stage: $('studentStageSelect').value,
            grade: $('studentGradeInput').value,
            section: $('studentSectionInput').value,
            subjects: $('studentSubjectsInput').value.split('،').map((s) => s.trim()).filter(Boolean),
            guardianId,
            assignedTeachers,
            assignedVirtualTeacherId: $('assignVirtualTeacherSelect').value || undefined
          })
        });
        showAlert('تم تسجيل الطالب بنجاح وربطه بولي أمره');
        $('modalAddStudent').hidden = true;
        $('formAddStudent').reset();
        loadStudents();
      } catch (err) {
        showAlert(err.message, true);
      }
    });

    // Form: Add Schedule
    $('formAddSchedule')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = $('schedTypeSelect').value;
      try {
        await apiCall('/schedules', {
          method: 'POST',
          body: JSON.stringify({
            type,
            title: $('schedTitleInput').value,
            stage: $('schedStageSelect').value,
            grade: $('schedGradeInput').value,
            section: $('schedSectionInput').value,
            subject: $('schedSubjectInput').value,
            lesson: $('schedLessonInput').value,
            scheduledAt: $('schedWhenInput').value,
            durationMinutes: Number($('schedDurationInput').value),
            examConfig: type === 'EXAM' ? {
              maxScore: Number($('examMaxScore').value),
              passingScore: Number($('examPassScore').value),
              instructions: $('examInstructions').value
            } : undefined
          })
        });
        showAlert(type === 'EXAM' ? 'تم تحديد موعد الاختبار وإبلاغ الإدارة والطلاب' : 'تمت جدولة الموعد بنجاح');
        $('modalAddSchedule').hidden = true;
        $('formAddSchedule').reset();
        loadSchedules();
      } catch (err) {
        showAlert(err.message, true);
      }
    });

    // Form: Add Grade
    $('formAddGrade')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await apiCall('/grades', {
          method: 'POST',
          body: JSON.stringify({
            studentId: $('gradeStudentSelect').value,
            subject: $('gradeSubjectInput').value,
            gradeType: $('gradeTypeSelect').value,
            title: $('gradeTitleInput').value,
            score: Number($('gradeScoreInput').value),
            maxScore: Number($('gradeMaxScoreInput').value),
            notes: $('gradeNotesInput').value
          })
        });
        showAlert('تم رصد الدرجة بنجاح وحفظها في السجل الأكاديمي الدائم');
        $('modalAddGrade').hidden = true;
        $('formAddGrade').reset();
        loadGrades();
      } catch (err) {
        showAlert(err.message, true);
      }
    });

    // Form: Add Attendance
    $('formAddAttendance')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await apiCall('/attendance', {
          method: 'POST',
          body: JSON.stringify({
            studentId: $('attStudentSelect').value,
            status: $('attStatusSelect').value,
            notes: $('attNotesInput').value
          })
        });
        showAlert('تم تثبيت الحضور في السجل الأكاديمي');
        $('modalAddAttendance').hidden = true;
        $('formAddAttendance').reset();
      } catch (err) {
        showAlert(err.message, true);
      }
    });

    // Form: Add Complaint
    $('formAddComplaint')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await apiCall('/complaints', {
          method: 'POST',
          body: JSON.stringify({
            studentId: $('complaintStudentSelect').value,
            subject: $('complaintSubjectInput').value,
            body: $('complaintBodyInput').value
          })
        });
        showAlert('تم إرسال الشكوى إلى إدارة المدرسة بنجاح');
        $('modalAddComplaint').hidden = true;
        $('formAddComplaint').reset();
        loadComplaints();
      } catch (err) {
        showAlert(err.message, true);
      }
    });

    // Form: Reply Complaint
    $('formReplyComplaint')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = $('replyComplaintId').value;
      try {
        await apiCall(`/complaints/${id}/reply`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: $('replyStatusSelect').value,
            text: $('replyTextInput').value
          })
        });
        showAlert('تم تسجيل رد الإدارة وتحديث حالة الشكوى بنجاح');
        $('modalReplyComplaint').hidden = true;
        loadComplaints();
      } catch (err) {
        showAlert(err.message, true);
      }
    });
  }

  // Populate helper dropdowns
  function populateStudentSelect(selectId) {
    const el = $(selectId);
    if (!el) return;
    el.innerHTML = '<option value="">اختر الطالب...</option>' + allStudents.map((s) => `
      <option value="${s._id}">${escapeHtml(s.name)} (${escapeHtml(s.grade)} - شعبة ${escapeHtml(s.section || 'أ')})</option>
    `).join('');
  }

  function populateTeacherSelect(selectId) {
    const el = $(selectId);
    if (!el) return;
    el.innerHTML = '<option value="">اختر المعلم...</option>' + allRealTeachers.map((t) => `
      <option value="${t._id}">${escapeHtml(t.name)} (${(t.subjects || []).join('، ')})</option>
    `).join('');
  }

  function populateStudentFormDropdowns() {
    const tSel = $('assignTeacherSelect');
    if (tSel) {
      tSel.innerHTML = '<option value="">بدون إسناد مباشر حالياً</option>' + allRealTeachers.map((t) => `
        <option value="${t._id}">${escapeHtml(t.name)} (${(t.subjects || []).join('، ')})</option>
      `).join('');
    }

    const vtSel = $('assignVirtualTeacherSelect');
    if (vtSel) {
      vtSel.innerHTML = '<option value="">بدون إسناد لمعلم افتراضي</option>' + allVirtualTeachers.map((vt) => `
        <option value="${vt._id}">🤖 ${escapeHtml(vt.name)} (${escapeHtml(vt.subject)})</option>
      `).join('');
    }
  }

  // Start on page load
  window.addEventListener('DOMContentLoaded', init);
})();
