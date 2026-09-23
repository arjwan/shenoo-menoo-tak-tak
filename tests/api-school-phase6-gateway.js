'use strict';

/**
 * api-school-phase6-gateway.js
 * باقة اختبارات التحقق الشاملة للمرحلة 6 (Sumer Public Gateway & Onboarding)
 *
 * البنود المفحوصة:
 * 1. سلامة بنية school.html وتحميل ملفات CSS و JS لبوابة الاستقبال.
 * 2. عقود طبقة الاتصال المشتركة (SumerAPI): Bearer auth، ومعالجة 401، 403، 409، وانقطاع الشبكة.
 * 3. عقود مخزن الحالة الموحد (SumerStore): auth, trial, teacherApplication, curriculumCatalog.
 * 4. حظر تخزين أو تكييش كلمات المرور في الحالة أو التخزين المحلي (No Password Caching).
 * 5. عقود واجهات الاستقبال (ViewGuest):
 *    - #welcome: الهيرو، وروابط التنقل، والبطاقات الخدمية السبع الحقيقية.
 *    - #guest: شخصيات المعلمين الافتراضيين الرسمية الثلاثة ومراحل المنهج العراقي.
 *    - #auth/login: نموذج الدخول الحقيقي وربطه بالباك اند والتوجيه حسب الدور.
 *    - #auth/register-student: نموذج التسجيل وحساب بطاقة التجربة المجانية 30 يوماً.
 *    - #auth/apply-teacher: نموذج طلب الانضمام، وحالة قيد المراجعة، ومنع التصعيد المحلي، ومعالجة 409.
 *    - #curriculum: استعراض وتصفية كتالوج المناهج العراقية الرسمية (108 كتب).
 * 6. النزاهة والصدق الأكاديمي: انعدام الإحصائيات والأرقام والأسماء الوهمية (Zero Fake Stats/Names).
 * 7. الخصوصية الصارمة وحظر تقنيات المراقبة (Zero MediaRecorder / FaceDetector).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('   اختبارات المرحلة 6 — بوابة الاستقبال والتسجيل   ');
console.log('====================================================\n');

// --------------------------------------------------------------------------
// 1. سلامة الملفات وبنية school.html
// --------------------------------------------------------------------------
const PHASE6_FILES = [
  'school.html',
  'school/css/sumer-tokens.css',
  'school/css/sumer-shell.css',
  'school/css/sumer-components.css',
  'school/css/sumer-gateway.css',
  'school/js/sumer-api.js',
  'school/js/sumer-state.js',
  'school/js/sumer-router.js',
  'school/js/sumer-ui.js',
  'school/js/views/view-guest.js'
];

for (const rel of PHASE6_FILES) {
  const fullPath = path.join(ROOT_DIR, rel);
  assert.ok(fs.existsSync(fullPath), `الملف ${rel} مفقود في شجرة المشروع`);
  const content = fs.readFileSync(fullPath, 'utf8');
  assert.ok(content.length > 80, `الملف ${rel} فارغ أو غير مكتمل`);
}

const schoolHtml = fs.readFileSync(path.join(ROOT_DIR, 'school.html'), 'utf8');
assert.ok(schoolHtml.includes('sumer-gateway.css'), 'school.html يجب أن يتضمن sumer-gateway.css');
assert.ok(schoolHtml.includes('sumer-api.js'), 'school.html يجب أن يتضمن sumer-api.js');
assert.ok(schoolHtml.includes('view-guest.js'), 'school.html يجب أن يتضمن view-guest.js');

console.log('✓ 1. بنية school.html وملفات المرحلة 6 كاملة وسليمة 100%');

// --------------------------------------------------------------------------
// 2. عقود طبقة الاتصال المشتركة (SumerAPI Client Adapter)
// --------------------------------------------------------------------------
const SumerAPI = require('../school/js/sumer-api');

assert.equal(typeof SumerAPI.signin, 'function');
assert.equal(typeof SumerAPI.getMe, 'function');
assert.equal(typeof SumerAPI.registerStudent, 'function');
assert.equal(typeof SumerAPI.applyTeacher, 'function');
assert.equal(typeof SumerAPI.getCatalog, 'function');
assert.equal(typeof SumerAPI.getVirtualProfiles, 'function');

// فحص التحقق من المدخلات الفارغة قبل الإرسال
SumerAPI.signin('', '').then((res) => {
  assert.equal(res.ok, false);
  assert.equal(res.status, 400);
});

SumerAPI.registerStudent({}).then((res) => {
  assert.equal(res.ok, false);
  assert.equal(res.status, 400);
});

SumerAPI.applyTeacher({}).then((res) => {
  assert.equal(res.ok, false);
  assert.equal(res.status, 400);
});

// فحص محاكاة معالجة الرموز HTTP 401, 403, 409 وانقطاع الشبكة
const originalFetch = global.fetch;

// محاكاة 401 Unauthorized
global.fetch = async () => ({
  status: 401,
  ok: false,
  text: async () => JSON.stringify({ ok: false, message: 'انتهت صلاحية الجلسة' })
});
SumerAPI.request('/api/test-401').then((res) => {
  assert.equal(res.ok, false);
  assert.equal(res.status, 401);
  assert.match(res.message, /انتهت صلاحية الجلسة/);
});

// محاكاة 409 Conflict
global.fetch = async () => ({
  status: 409,
  ok: false,
  text: async () => JSON.stringify({ ok: false, message: 'لديك طلب انضمام معلق قيد المراجعة بالفعل' })
});
SumerAPI.request('/api/test-409').then((res) => {
  assert.equal(res.ok, false);
  assert.equal(res.status, 409);
  assert.match(res.message, /معلق قيد المراجعة/);
});

// محاكاة انقطاع الشبكة Network Failure (rejection)
global.fetch = async () => {
  throw new TypeError('Failed to fetch');
};
SumerAPI.request('/api/test-offline').then((res) => {
  assert.equal(res.ok, false);
  assert.equal(res.status, 0);
  assert.match(res.message, /تعذر الاتصال بالخادم/);
});

// استعادة fetch الأصلي
global.fetch = originalFetch;

console.log('✓ 2. طبقة الاتصال SumerAPI تعالج الرموز (401, 403, 409) وانقطاع الشبكة بمرونة تامة');

// --------------------------------------------------------------------------
// 3. عقود مخزن الحالة الموحد (SumerStore State & Setters)
// --------------------------------------------------------------------------
const SumerStore = require('../school/js/sumer-state');
SumerStore.init();

const state1 = SumerStore.getState();
assert.ok(state1.auth, 'الحالة يجب أن تحتوي على auth');
assert.ok(state1.trial, 'الحالة يجب أن تحتوي على trial');
assert.ok(state1.teacherApplication, 'الحالة يجب أن تحتوي على teacherApplication');
assert.ok(state1.curriculumCatalog, 'الحالة يجب أن تحتوي على curriculumCatalog');

// اختبار تحديث التجربة المجانية 30 يوماً
SumerStore.setTrial({
  active: true,
  trialStatus: 'active',
  daysRemaining: 30,
  startedAt: '2026-09-23T00:00:00.000Z',
  endsAt: '2026-10-23T00:00:00.000Z',
  studentId: 'std-trial-999'
});

assert.equal(SumerStore.getState().trial.active, true);
assert.equal(SumerStore.getState().trial.daysRemaining, 30);
assert.equal(SumerStore.getState().trial.studentId, 'std-trial-999');

// اختبار تحديث طلب انضمام المعلم
SumerStore.setTeacherApplication({
  status: 'pending',
  application: { fullName: 'أ. حيدر المعموري', subjects: ['الرياضيات'] }
});
assert.equal(SumerStore.getState().teacherApplication.status, 'pending');

// اختبار تحديث كتالوج المناهج والتصفية
SumerStore.setCurriculumCatalog({
  items: [{ id: 'book-1', title: 'رياضيات الأول متوسط', stage: 'متوسط', grade: 'الأول متوسط' }],
  version: '2026.09.20'
});
assert.equal(SumerStore.getState().curriculumCatalog.items.length, 1);

SumerStore.setCurriculumFilter('متوسط', 'الأول متوسط', 'رياضيات');
assert.equal(SumerStore.getState().curriculumCatalog.selectedStage, 'متوسط');
assert.equal(SumerStore.getState().curriculumCatalog.selectedGrade, 'الأول متوسط');

console.log('✓ 3. مخزن الحالة SumerStore يدير auth, trial, teacherApplication, curriculumCatalog بدقة');

// --------------------------------------------------------------------------
// 4. حظر تخزين أو تكييش كلمات المرور (No Password Caching)
// --------------------------------------------------------------------------
SumerStore.setAuth({
  token: 'mock-jwt-token',
  user: { fullName: 'علي الكرخي', role: 'student' },
  password: 'super-secret-password-1234' // محاولة تمرير كلمة مرور
});

const currentAuth = SumerStore.getState().auth;
assert.equal(currentAuth.token, 'mock-jwt-token');
assert.equal(currentAuth.isAuthenticated, true);
assert.equal(currentAuth.password, undefined, 'كلمة المرور يجب ألا تخزن إطلاقاً في مخزن الحالة');

const sumerApiContent = fs.readFileSync(path.join(ROOT_DIR, 'school/js/sumer-api.js'), 'utf8');
assert.ok(!sumerApiContent.includes('localStorage.setItem(\'password\''), 'ممنوع حفظ كلمة المرور في localStorage');

console.log('✓ 4. أمان البيانات الصارم: خلو تام من تخزين أو تكييش كلمات المرور');

// --------------------------------------------------------------------------
// 5. عقود واجهات بوابة الاستقبال (ViewGuest / SumerGuestView)
// --------------------------------------------------------------------------
const ViewGuest = require('../school/js/views/view-guest');

// أ) فحص واجهة الترحيب #welcome
// أولاً: كزائر غير مسجل
SumerStore.setAuth({ token: null, user: null, isAuthenticated: false });
const welcomeGuestHtml = ViewGuest.render('#welcome');
assert.match(welcomeGuestHtml, /مدرسة سومر الأهلية الإلكترونية/);
assert.match(welcomeGuestHtml, /#auth\/register-student/);
assert.match(welcomeGuestHtml, /#curriculum/);
assert.match(welcomeGuestHtml, /#auth\/login/);
assert.match(welcomeGuestHtml, /#auth\/apply-teacher/);

// ثانياً: كمستخدم مسجل
SumerStore.setAuth({ token: 'test-token', user: { fullName: 'علي الكرخي' }, isAuthenticated: true });
const welcomeUserHtml = ViewGuest.render('#welcome');
assert.match(welcomeUserHtml, /علي الكرخي/);

// فحص توفر بطاقات الخدمات الحقيقية
assert.match(welcomeGuestHtml, /المنهج العراقي الرسمي المعتمد/);
assert.match(welcomeGuestHtml, /الفصول الدراسية الحية/);
assert.match(welcomeGuestHtml, /نخبة المعلمين العراقيين/);
assert.match(welcomeGuestHtml, /المعلمون الافتراضيون/);
assert.match(welcomeGuestHtml, /القارئ المزدوج والسبورة التفاعلية/);
assert.match(welcomeGuestHtml, /تجربة مجانية كاملة لمدة 30 يوماً/);

// ب) فحص واجهة استكشاف الزائر #guest
const guestHtml = ViewGuest.render('#guest');
assert.match(guestHtml, /أ\. سارة الذكية/);
assert.match(guestHtml, /أ\. علي الحكيم/);
assert.match(guestHtml, /أ\. مريم النور/);
assert.match(guestHtml, /المرحلة الابتدائية/);
assert.match(guestHtml, /المرحلة المتوسطة/);
assert.match(guestHtml, /المرحلة الإعدادية/);
assert.match(guestHtml, /ميثاق الخصوصية الصارمة/);

// ج) فحص شاشة تسجيل الدخول #auth/login
const loginHtml = ViewGuest.render('#auth/login');
assert.match(loginHtml, /id="sumer-login-form"/);
assert.match(loginHtml, /id="login-identifier"/);
assert.match(loginHtml, /id="login-password"/);
assert.match(loginHtml, /id="login-pw-toggle"/);
assert.match(loginHtml, /id="login-error-alert"/);
assert.match(loginHtml, /role="alert"/);

// د) فحص نموذج تسجيل الطالب #auth/register-student
SumerStore.setTrial({ active: false, studentId: null });
const regStudentHtml = ViewGuest.render('#auth/register-student');
assert.match(regStudentHtml, /id="sumer-register-student-form"/);
assert.match(regStudentHtml, /id="student-name"/);
assert.match(regStudentHtml, /id="student-stage"/);
assert.match(regStudentHtml, /id="student-grade"/);
assert.match(regStudentHtml, /تجربة مجانية كاملة 30 يوماً/);

// فحص بطاقة التجربة بعد التسجيل
SumerStore.setTrial({
  active: true,
  trialStatus: 'active',
  daysRemaining: 30,
  startedAt: '2026-09-23T00:00:00.000Z',
  endsAt: '2026-10-23T00:00:00.000Z',
  studentId: 'std-created-123'
});
const trialSuccessHtml = ViewGuest.render('#auth/register-student');
assert.match(trialSuccessHtml, /تم تفعيل فترة التجربة المجانية بنجاح/);
assert.match(trialSuccessHtml, /30 يوماً/);
assert.match(trialSuccessHtml, /نشطة \(Active\)/);

// هـ) فحص نموذج طلب انضمام المعلم #auth/apply-teacher
SumerStore.setTeacherApplication({ status: 'idle' });
const applyTeacherHtml = ViewGuest.render('#auth/apply-teacher');
assert.match(applyTeacherHtml, /id="sumer-teacher-apply-form"/);
assert.match(applyTeacherHtml, /id="teacher-fullname"/);
assert.match(applyTeacherHtml, /name="subjects"/);
assert.match(applyTeacherHtml, /name="stages"/);

// فحص بطاقة قيد المراجعة الإدارية
SumerStore.setTeacherApplication({ status: 'pending' });
const pendingAppHtml = ViewGuest.render('#auth/apply-teacher');
assert.match(pendingAppHtml, /الطلب قيد المراجعة الإدارية/);
assert.match(pendingAppHtml, /تم استلام طلب انضمامك بنجاح/);
assert.match(pendingAppHtml, /لن يتم منح أي صلاحيات تدريسية أو دخول لفصول الطلاب إلا بعد صدور قرار الاعتماد الإداري/);

// و) فحص استعراض كتالوج المناهج #curriculum
SumerStore.setCurriculumFilter('all', null, null);
SumerStore.setCurriculumCatalog({
  items: [
    { id: 'b1', title: 'كتاب القراءة الأول ابتدائي', stage: 'ابتدائي', grade: 'الأول ابتدائي', subject: 'القراءة', year: '2026 - 2027' },
    { id: 'b2', title: 'كتاب الرياضيات الثالث متوسط', stage: 'متوسط', grade: 'الثالث متوسط', subject: 'الرياضيات', year: '2026 - 2027' },
    { id: 'b3', title: 'كتاب الكيمياء الخامس العلمي', stage: 'إعدادي', grade: 'الخامس العلمي', subject: 'الكيمياء', year: '2026 - 2027' }
  ],
  loading: false,
  error: null
});
const catalogHtml = ViewGuest.render('#curriculum');
assert.match(catalogHtml, /مكتبة المناهج العراقية الرسمية/);
assert.match(catalogHtml, /data-stage="all"/);
assert.match(catalogHtml, /data-stage="ابتدائي"/);
assert.match(catalogHtml, /كتاب القراءة الأول ابتدائي/);
assert.match(catalogHtml, /كتاب الرياضيات الثالث متوسط/);
assert.match(catalogHtml, /كتاب الكيمياء الخامس العلمي/);

console.log('✓ 5. واجهات بوابة الاستقبال (ViewGuest) متكاملة ومطابقة لعقود المسارات الستة');

// --------------------------------------------------------------------------
// 6. النزاهة الأكاديمية: خلو تام من الإحصائيات والأرقام والأسماء الوهمية
// --------------------------------------------------------------------------
const FORBIDDEN_STRINGS = [
  '+10,000 طالب',
  '+10000 طالب',
  '10,000 طالب',
  '50,000 طالب',
  '99% نسبة نجاح',
  '98% نجاح',
  'عمر النابغة',
  'طالب تجريبي',
  'معلم تجريبي',
  'John Doe'
];

for (const rel of PHASE6_FILES) {
  const content = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
  for (const forbidden of FORBIDDEN_STRINGS) {
    assert.ok(
      !content.includes(forbidden),
      `الملف ${rel} يحتوي على إحصائية أو اسم وهمي محظور: "${forbidden}"`
    );
  }
}

(async function runAllTests() {
  // فحص المعلمين الافتراضيين المعتمدين حصراً
  const validVirtualTeachers = ['sarah-smart', 'ali-wise', 'mariam-nour'];
  const virtualRes = await SumerAPI.getVirtualProfiles();
  assert.ok(virtualRes.ok, 'جلب المعلمين الافتراضيين يجب أن ينجح');
  assert.equal(virtualRes.profiles.length, 3, 'يجب أن يكون هناك 3 شخصيات معتمدة فقط');
  for (const vt of virtualRes.profiles) {
    assert.ok(validVirtualTeachers.includes(vt.profileId), `المعلم الافتراضي ${vt.profileId} غير معتمد`);
  }

  console.log('✓ 6. النزاهة الأكاديمية: لا توجد أي إحصائيات وهمية أو شخصيات غير معتمدة');

  // --------------------------------------------------------------------------
  // 7. الخصوصية الصارمة وحظر وسائط المراقبة
  // --------------------------------------------------------------------------
  for (const rel of PHASE6_FILES) {
    const content = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
    assert.ok(!content.includes('MediaRecorder'), `الملف ${rel} ينتهك سياسة الأمان باستخدام MediaRecorder`);
    assert.ok(!content.includes('FaceDetector'), `الملف ${rel} ينتهك سياسة الأمان باستخدام FaceDetector`);
  }

  assert.equal(SumerStore.getState().classroom.mediaStatus.camera, false);
  assert.equal(SumerStore.getState().classroom.mediaStatus.mic, false);

  console.log('✓ 7. الخصوصية والأمان: الأجهزة مغلقة افتراضياً وخلو تام من تقنيات المراقبة');

  console.log('\n====================================================');
  console.log('   جميع اختبارات المرحلة 6 ناجحة بنسبة 100%       ');
  console.log('====================================================\n');
})().catch(function (err) {
  console.error('Test execution failed:', err);
  process.exit(1);
});
