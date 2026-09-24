/**
 * Phase 8 — Sumer School teacher workspace.
 * Uses authenticated school APIs only; no demo/fake records.
 */
(function (root) {
  'use strict';
  var api, store, ui, mount, route = '#teacher/overview';
  var cache = { me: null, teacher: null, students: [], schedules: [], assignments: [] };

  function esc(v) { return ui.escapeHtml(v == null ? '' : String(v)); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function payload(r, key) { return r && r.ok && r.data ? (key ? arr(r.data[key]) : r.data) : null; }
  function empty(t) { return '<div class="sumer-empty">' + esc(t) + '</div>'; }
  function head(title, text) {
    return '<header class="teacher-head"><span class="sumer-badge badge-gold">مساحة المعلم</span><h1>' + esc(title) +
      '</h1><p>' + esc(text) + '</p></header>' + tabs();
  }
  function tabs() {
    var x = [['overview','اليوم'],['classes','الصفوف'],['students','الطلاب'],['schedule','الجدول'],
      ['attendance','الحضور'],['assignments','الواجبات'],['gradebook','الدرجات'],['reports','التقارير'],['messages','الرسائل']];
    return '<nav class="teacher-tabs">' + x.map(function (i) {
      var h = '#teacher/' + i[0];
      return '<a href="' + h + '" class="' + (route.split('?')[0] === h ? 'active' : '') + '">' + i[1] + '</a>';
    }).join('') + '</nav>';
  }
  function card(title, body) { return '<section class="teacher-card"><h2>' + esc(title) + '</h2>' + body + '</section>'; }
  function options() {
    return cache.students.map(function (s) {
      return '<option value="' + esc(s._id || s.id) + '">' + esc(s.name) + ' — ' + esc(s.grade || '') + '</option>';
    }).join('');
  }
  function scheduleRow(s) {
    return '<div class="teacher-row"><div><b>' + esc(s.title || s.subject || 'موعد') + '</b><small>' +
      esc([s.subject,s.grade,s.scheduledAt ? new Date(s.scheduledAt).toLocaleString('ar-IQ') : ''].filter(Boolean).join(' · ')) +
      '</small></div></div>';
  }
  function load() {
    return Promise.all([
      api.request('/api/school/management/me'),
      api.request('/api/school/management/students'),
      api.request('/api/school/management/schedules'),
      api.request('/api/school/assignments')
    ]).then(function (r) {
      cache.me = payload(r[0]);
      if (!cache.me || !cache.me.schoolContext || !cache.me.schoolContext.isTeacher) throw new Error('هذه المساحة مخصصة للمعلم المعتمد فقط');
      cache.teacher = cache.me.schoolContext.teacher || {};
      cache.students = payload(r[1], 'students') || [];
      cache.schedules = payload(r[2], 'schedules') || [];
      cache.assignments = payload(r[3], 'assignments') || [];
    });
  }
  function overview() {
    var t = cache.teacher || {}, today = new Date().toISOString().slice(0,10);
    var events = cache.schedules.filter(function(s){ return String(s.scheduledAt || s.date || '').slice(0,10) === today; });
    return head('لوحة المعلم اليومية','طلابك وصفوفك وسجلاتك من الخادم مباشرة.') +
      '<div class="teacher-metrics"><div><b>'+cache.students.length+'</b><span>طلابي</span></div><div><b>'+cache.assignments.length+
      '</b><span>الواجبات</span></div><div><b>'+events.length+'</b><span>مواعيد اليوم</span></div><div><b>'+arr(t.subjects).length+
      '</b><span>المواد</span></div></div>' +
      card('تكليفي التدريسي','<p><b>'+esc(t.name || cache.me.user.fullName)+'</b></p><p>'+esc(arr(t.subjects).join('، ') || 'لا توجد مواد مسجلة')+
      '</p><p>'+esc(arr(t.grades).join('، ') || 'لا توجد صفوف مسجلة')+'</p>') +
      card('اليوم',events.length ? '<div class="teacher-list">'+events.map(scheduleRow).join('')+'</div>' : empty('لا توجد مواعيد اليوم.'));
  }
  function classes() {
    var t=cache.teacher||{};
    return head('الصفوف والمواد','التكليفات الحقيقية ومداخل الصف.') +
      card('تكليفاتي','<div class="teacher-chips">'+arr(t.subjects).concat(arr(t.grades)).map(function(x){return '<span>'+esc(x)+'</span>';}).join('')+'</div>')+
      card('أدوات الصف','<div class="teacher-actions"><a href="/school-live.html">الصف المباشر</a><a href="/school-virtual-classroom.html">السبورة والصف</a><a href="#teacher/schedule">الجدول</a></div>');
  }
  function students() {
    return head('طلابي','تظهر فقط الملفات التي يسمح بها نطاق المعلم في الخادم.') +
      card('قائمة الطلاب',cache.students.length ? '<div class="teacher-list">'+cache.students.map(function(s){
        return '<div class="teacher-row"><div><b>'+esc(s.name)+'</b><small>'+esc([s.stage,s.grade,s.section&&('شعبة '+s.section)].filter(Boolean).join(' · '))+
          '</small></div><button data-record="'+esc(s._id||s.id)+'">السجل</button></div>';
      }).join('')+'</div><div id="teacher-record"></div>' : empty('لا يوجد طلاب مكلفون بهذا المعلم.'));
  }
  function schedule() {
    return head('الجدول','الحصص والاختبارات المسجلة ضمن نطاقك.') +
      card('المواعيد',cache.schedules.length ? '<div class="teacher-list">'+cache.schedules.map(scheduleRow).join('')+'</div>' : empty('لا توجد مواعيد مسجلة.'));
  }
  function attendance() {
    return head('الحضور','رصد الحضور والغياب والتأخير في السجل الأكاديمي.') +
      card('تسجيل الحضور','<form id="teacher-attendance" class="teacher-form"><label>الطالب<select name="studentId" required><option value="">اختر الطالب</option>'+options()+
      '</select></label><label>المادة<input name="subject" required></label><label>الحالة<select name="status"><option value="present">حاضر</option><option value="absent">غائب</option><option value="late">متأخر</option><option value="excused">مجاز</option></select></label><label>التاريخ<input name="date" type="date" required></label><button>حفظ الحضور</button></form>');
  }
  function assignments() {
    return head('الواجبات','إنشاء الواجبات ومراجعة تسليمات الطلاب الحقيقية.') +
      card('واجب جديد','<form id="teacher-assignment" class="teacher-form"><label>العنوان<input name="title" required></label><label>المادة<input name="subject" required></label><label>المرحلة<input name="stage"></label><label>الصف<input name="grade"></label><label>الموعد النهائي<input name="dueAt" type="datetime-local" required></label><label>الدرجة القصوى<input name="maxScore" type="number" min="1" value="100" required></label><label class="wide">التفاصيل<textarea name="description" required></textarea></label><button>نشر الواجب</button></form>') +
      card('الواجبات المنشورة',cache.assignments.length ? '<div class="teacher-list">'+cache.assignments.map(function(a){return '<div class="teacher-row"><div><b>'+esc(a.title)+'</b><small>'+esc(a.subject||'')+'</small></div><button data-submissions="'+esc(a._id||a.id)+'">التسليمات</button></div>';}).join('')+'</div><div id="teacher-submissions"></div>' : empty('لا توجد واجبات منشورة.'));
  }
  function gradebook() {
    return head('دفتر الدرجات','رصد التقييمات وعرض السجل الأكاديمي.') +
      card('رصد درجة','<form id="teacher-grade" class="teacher-form"><label>الطالب<select name="studentId" required><option value="">اختر الطالب</option>'+options()+
      '</select></label><label>المادة<input name="subject" required></label><label>التقييم<input name="title" required></label><label>الدرجة<input name="score" type="number" min="0" required></label><label>من<input name="maxScore" type="number" min="1" value="100" required></label><button>حفظ الدرجة</button></form><div id="teacher-grade-result"></div>');
  }
  function reports() {
    return head('التقارير','قراءة السجل الدائم للطلاب المكلفين.') +
      card('سجل طالب','<form id="teacher-report" class="teacher-form"><label>الطالب<select name="studentId" required><option value="">اختر الطالب</option>'+options()+'</select></label><button>عرض السجل</button></form><div id="teacher-report-result"></div>');
  }
  function messages() {
    return head('الرسائل','التواصل المدرسي دون منح صلاحيات إدارة المدرسة.') +
      card('قنوات التواصل','<div class="teacher-actions"><a href="/messages.html">رسائل شنو منو</a><a href="/sumer-school/communication.html">تقارير وتواصل المدرسة</a></div>');
  }
  function renderNow() {
    var key=route.split('?')[0].replace('#teacher/','');
    var f={overview:overview,classes:classes,students:students,schedule:schedule,attendance:attendance,assignments:assignments,gradebook:gradebook,reports:reports,messages:messages}[key]||overview;
    mount.innerHTML=f();
  }
  function formData(form){var o={};new FormData(form).forEach(function(v,k){o[k]=v;});return o;}
  function send(path, method, body){return api.request(path,{method:method,body:body});}
  function resultBox(id, html){var x=document.getElementById(id);if(x)x.innerHTML=html;}
  function bind() {
    mount.addEventListener('submit',function(ev){
      var f=ev.target;if(!f.id)return;ev.preventDefault();var b=formData(f),p;
      if(f.id==='teacher-attendance') p=send('/api/school/management/attendance','POST',b);
      if(f.id==='teacher-assignment'){b.maxScore=Number(b.maxScore);p=send('/api/school/assignments','POST',b);}
      if(f.id==='teacher-grade'){b.score=Number(b.score);b.maxScore=Number(b.maxScore);p=send('/api/school/management/grades','POST',b);}
      if(f.id==='teacher-report'){p=api.request('/api/school/management/students/'+encodeURIComponent(b.studentId)+'/record').then(function(r){var d=payload(r);resultBox('teacher-report-result',d?'<pre class="teacher-record">'+esc(JSON.stringify(d,null,2))+'</pre>':empty('تعذر قراءة السجل.'));});return;}
      if(p)p.then(function(r){if(!r.ok)throw new Error(r.message||'تعذر الحفظ');ui.showToast('تم الحفظ بنجاح','success');return load();}).then(renderNow).catch(function(err){ui.showToast(err.message||'تعذر التنفيذ','error');});
    });
    mount.addEventListener('click',function(ev){
      var s=ev.target.closest('[data-submissions]'),r=ev.target.closest('[data-record]');
      if(s)api.request('/api/school/assignments/'+encodeURIComponent(s.dataset.submissions)+'/submissions').then(function(x){var list=payload(x,'submissions')||[];resultBox('teacher-submissions',card('التسليمات',list.length?'<div class="teacher-list">'+list.map(function(v){return '<div class="teacher-row"><div><b>'+esc(v.studentName||v.student?.name||'طالب')+'</b><small>'+esc(v.status||'submitted')+'</small></div></div>';}).join('')+'</div>':empty('لا توجد تسليمات بعد.')));});
      if(r)api.request('/api/school/management/students/'+encodeURIComponent(r.dataset.record)+'/record').then(function(x){var d=payload(x);resultBox('teacher-record',d?'<pre class="teacher-record">'+esc(JSON.stringify(d,null,2))+'</pre>':empty('تعذر قراءة السجل.'));});
    });
  }
  var view={
    render:function(routeKey,target){api=root.SumerAPI;store=root.SumerStore;ui=root.SumerUI;mount=target;route=routeKey||'#teacher/overview';mount.innerHTML=head('جاري التحميل','يتم جلب بيانات المعلم...');load().then(function(){renderNow();bind();}).catch(function(err){mount.innerHTML=head('تعذر فتح مساحة المعلم',err.message);});}
  };
  root.SumerTeacherView=view;root.ViewTeacher=view;
}(typeof self!=='undefined'?self:this));
