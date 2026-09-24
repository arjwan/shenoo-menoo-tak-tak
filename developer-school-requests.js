/* School enrollment requests are isolated from the developer login and MFA flow. */
(() => {
  'use strict';
  const root = document.getElementById('schoolTeacherRequests');
  const dashboard = document.getElementById('dashboardContent');
  const body = document.getElementById('schoolTeacherBody');
  const count = document.getElementById('schoolTeacherCount');
  const message = document.getElementById('schoolTeacherMessage');
  const token = () => localStorage.getItem('developerToken') || '';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let requests = [];

  async function schoolApi(path, options = {}) {
    const response = await fetch((location.protocol === 'file:' ? 'https://shino-mino-tak-tak.duckdns.org' : location.origin) + '/api/school/management' + path, {
      ...options,
      headers: { Authorization: 'Bearer ' + token(), ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'تعذر تحميل طلبات المدرسة');
    return data;
  }

  async function load() {
    if (dashboard.classList.contains('hidden') || !token()) return;
    message.textContent = '';
    try {
      const result = await schoolApi('/teacher-applications?status=pending');
      requests = result.applications || [];
      count.textContent = String(requests.length);
      document.getElementById('schoolTeacherNavCount').textContent = String(requests.length);
      body.innerHTML = requests.map(request => `<tr>
        <td>${escapeHtml(request.fullName || request.applicant?.fullName || 'حساب غير متاح')}<br><small>${escapeHtml(request.applicant?.username || '')}</small></td>
        <td>${escapeHtml((request.subjects || []).join('، ') || '—')}<br><small>${escapeHtml([...(request.stages || []), ...(request.grades || [])].join(' · '))}</small></td>
        <td>${request.createdAt ? new Date(request.createdAt).toLocaleDateString('ar-IQ') : '—'}</td>
        <td><div class="actions"><button class="btn" data-school-action="details" data-school-id="${escapeHtml(request._id)}">التفاصيل</button><button class="btn primary" data-school-action="approved" data-school-id="${escapeHtml(request._id)}">اعتماد</button><button class="btn danger" data-school-action="rejected" data-school-id="${escapeHtml(request._id)}">رفض</button></div></td>
      </tr>`).join('') || '<tr><td colspan="4">لا توجد طلبات معلمين معلقة.</td></tr>';
    } catch (error) {
      count.textContent = '—';
      document.getElementById('schoolTeacherNavCount').textContent = '—';
      body.innerHTML = '<tr><td colspan="4">تعذر عرض الطلبات. اضغط تحديث للمحاولة مجددًا.</td></tr>';
      message.textContent = error.message;
    }
  }

  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-school-action]');
    if (!button) return;
    const request = requests.find(item => String(item._id) === button.dataset.schoolId);
    if (!request) return;
    if (button.dataset.schoolAction === 'details') {
      alert(['المعلم: ' + (request.fullName || '—'), 'اسم المستخدم: ' + (request.applicant?.username || '—'), 'الهاتف: ' + (request.phone || request.applicant?.phone || '—'), 'البريد: ' + (request.email || request.applicant?.email || '—'), 'المراحل: ' + ((request.stages || []).join('، ') || '—'), 'الصفوف: ' + ((request.grades || []).join('، ') || '—'), 'المواد: ' + ((request.subjects || []).join('، ') || '—'), 'المؤهل: ' + (request.qualifications || '—'), 'سنوات الخبرة: ' + (request.experienceYears ?? '—'), 'نبذة: ' + (request.bio || '—'), 'ملاحظات: ' + (request.notes || '—')].join('\n'));
      return;
    }
    const decision = button.dataset.schoolAction;
    const name = request.fullName || 'المعلم';
    if (!confirm(`${decision === 'approved' ? 'اعتماد' : 'رفض'} طلب ${name}؟`)) return;
    const reason = decision === 'rejected' ? prompt('سبب الرفض (اختياري):') : '';
    if (reason === null) return;
    root.querySelectorAll('[data-school-action]').forEach(item => { item.disabled = true; });
    try {
      const result = await schoolApi('/teacher-applications/' + encodeURIComponent(request._id) + '/' + (decision === 'approved' ? 'approve' : 'reject'), {
        method: 'POST', body: JSON.stringify(decision === 'approved' ? { notes: '' } : { reason })
      });
      await load();
      message.textContent = result.message || 'تمت مراجعة الطلب';
    } catch (error) {
      message.textContent = error.message;
      root.querySelectorAll('[data-school-action]').forEach(item => { item.disabled = false; });
    }
  });

  document.getElementById('refreshSchoolTeachers').addEventListener('click', load);
  new MutationObserver(() => { if (!dashboard.classList.contains('hidden')) load(); }).observe(dashboard, { attributes: true, attributeFilter: ['class'] });
  load();
})();
