'use strict';

/**
 * api-school-phase5-shell.js
 * باقة اختبارات التحقق الشاملة للمرحلة 5 (Unified Sumer School Application Shell)
 *
 * البنود المفحوصة:
 * 1. school.html هو المدخل الموحد الوحيد، والواجهات الـ 12 القديمة محذوفة تماماً.
 * 2. انعدام المراجع التشغيلية للواجهات الـ 12 القديمة (Zero Legacy References).
 * 3. صحة تحميل وسلامة ملفات CSS و JS السومرية الجديدة.
 * 4. عقود موجه المسارات (SumerRouter Contracts) لكافة مساحات العمل.
 * 5. حواجز الصلاحيات وفحص الأدوار (Role-Based Route Guards).
 * 6. عقد التنقل التجاوبي (Desktop Sidebar + Mobile Bottom Bar + Mobile Drawer).
 * 7. النزاهة الأكاديمية وانعدام البيانات الوهمية (Zero Fake/Demo Data).
 * 8. الخصوصية الصارمة: الكاميرا والمايكروفون مغلقان افتراضياً دون تشغيل تلقائي.
 * 9. خلو الواجهات ومحركات المدرسة تماماً من تقنيات المراقبة (MediaRecorder / FaceDetector).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('   اختبارات المرحلة 5 — صدفة مدرسة سومر الموحدة   ');
console.log('====================================================\n');

// --------------------------------------------------------------------------
// 1. التحقق من أن school.html هو المدخل الوحيد وغياب واجهات Legacy
// --------------------------------------------------------------------------
const LEGACY_PAGES = [
  'school-admin.html',
  'school-canva.html',
  'school-index.html',
  'school-structure.html',
  'school-teachers.html',
  'school-students.html',
  'school-curriculum.html',
  'school-reader.html',
  'school-classroom.html',
  'school-virtual-classroom.html',
  'school-live.html'
];

assert.ok(fs.existsSync(path.join(ROOT_DIR, 'school.html')), 'school.html يجب أن يكون موجوداً كمدخل موحد');

for (const page of LEGACY_PAGES) {
  assert.ok(
    !fs.existsSync(path.join(ROOT_DIR, page)),
    `الصفحة القديمة ${page} يجب أن تكون محذوفة تماماً`
  );
}
console.log('✓ 1. school.html هو المدخل الوحيد، وواجهات Legacy القديمة محذوفة بالكامل');

// --------------------------------------------------------------------------
// 2. انعدام أي مراجع تشغيلية لواجهات Legacy
// --------------------------------------------------------------------------
const schoolHtmlContent = fs.readFileSync(path.join(ROOT_DIR, 'school.html'), 'utf8');
for (const page of LEGACY_PAGES) {
  assert.ok(
    !schoolHtmlContent.includes(page),
    `school.html لا يجوز أن يحتوي على أي مرجع لـ ${page}`
  );
}
console.log('✓ 2. خلو school.html التام من أي روابط أو مراجع لصفحات Legacy');

// --------------------------------------------------------------------------
// 3. سلامة ملفات التنسيق والبرمجة الجديدة
// --------------------------------------------------------------------------
const REQUIRED_FILES = [
  'school/css/sumer-tokens.css',
  'school/css/sumer-shell.css',
  'school/css/sumer-components.css',
  'school/js/sumer-state.js',
  'school/js/sumer-router.js',
  'school/js/sumer-ui.js'
];

for (const rel of REQUIRED_FILES) {
  const fullPath = path.join(ROOT_DIR, rel);
  assert.ok(fs.existsSync(fullPath), `الملف ${rel} مفقود في شجرة المشروع`);
  const content = fs.readFileSync(fullPath, 'utf8');
  assert.ok(content.length > 100, `الملف ${rel} غير مكتمل أو فارغ`);
}
console.log('✓ 3. جميع ملفات التنسيق والبرمجة السومرية الجديدة موجودة وسليمة');

// --------------------------------------------------------------------------
// 4. اختبارات مخزن الحالة (SumerStore Contracts)
// --------------------------------------------------------------------------
const SumerStore = require('../school/js/sumer-state');
SumerStore.init();

const initialState = SumerStore.getState();
assert.equal(initialState.schoolContext.role, 'guest', 'الدور الافتراضي يجب أن يكون guest');
assert.equal(initialState.classroom.mediaStatus.camera, false, 'الكاميرا يجب أن تكون مغلقة افتراضياً');
assert.equal(initialState.classroom.mediaStatus.mic, false, 'المايكروفون يجب أن يكون مغلقاً افتراضياً');

// اختبار التبديل السلس للثيم
const nextTheme = SumerStore.toggleTheme();
assert.ok(['light', 'dark'].includes(nextTheme), 'تبديل الثيم يجب أن يعيد light أو dark');
assert.equal(SumerStore.getState().ui.theme, nextTheme);

// اختبار تحديد سياق ولي الأمر واختيار الابن النشط
SumerStore.setSchoolContext({
  role: 'guardian',
  isGuardian: true,
  students: [
    { _id: 'child-101', name: 'أحمد علي', stage: 'ابتدائي', grade: 'الرابع ابتدائي' },
    { _id: 'child-102', name: 'فاطمة علي', stage: 'متوسط', grade: 'الأول متوسط' }
  ]
});

assert.equal(SumerStore.getState().activeChildId, 'child-101', 'الابن النشط الأول يتم اختياره تلقائياً');
const activeChild = SumerStore.getActiveChild();
assert.equal(activeChild.name, 'أحمد علي');

SumerStore.setActiveChild('child-102');
assert.equal(SumerStore.getActiveChild().name, 'فاطمة علي');
console.log('✓ 4. مخزن الحالة SumerStore يعمل بكفاءة تامة ويدير سياق الجلسات والأبناء');

// --------------------------------------------------------------------------
// 5. عقود مسارات الموجه وحواجز الصلاحيات (SumerRouter Contracts & Guards)
// --------------------------------------------------------------------------
const SumerRouter = require('../school/js/sumer-router');
const contracts = SumerRouter.getContracts();

// التأكد من توفر مسارات جميع مساحات العمل المطلوبة
const EXPECTED_CONTRACT_KEYS = [
  '#welcome', '#guest', '#auth/login', '#auth/register-student', '#auth/apply-teacher',
  '#student/overview', '#student/classes', '#student/schedule', '#student/assignments',
  '#teacher/overview', '#teacher/classes', '#teacher/students', '#teacher/gradebook',
  '#guardian/overview', '#guardian/children', '#guardian/schedule', '#guardian/grades',
  '#admin/overview', '#admin/teachers', '#admin/students', '#admin/audit',
  '#curriculum', '#classroom/live', '#classroom/virtual'
];

for (const key of EXPECTED_CONTRACT_KEYS) {
  assert.ok(contracts[key], `عقد المسار ${key} يجب أن يكون معرّفاً في SumerRouter`);
}

// اختبار حواجز الصلاحيات (Guards)
// أ) زائر يحاول دخول مساحة الطالب الخاصة
const guestGuard = SumerRouter.checkGuard('#student/overview', { isStudent: false }, { isAuthenticated: false });
assert.equal(guestGuard.allowed, false, 'يجب منع الزائر غير المسجل من دخول مساحة الطالب');
assert.equal(guestGuard.redirectTo, '#auth/login');

// ب) طالب مسجل يحاول دخول مساحة الطالب
const studentGuard = SumerRouter.checkGuard('#student/overview', { isStudent: true }, { isAuthenticated: true });
assert.equal(studentGuard.allowed, true, 'يجب السماح للطالب المسجل بدخول مساحته');

// ج) طالب يحاول دخول مساحة الإدارة
const studentToAdminGuard = SumerRouter.checkGuard('#admin/overview', { isStudent: true, isManager: false }, { isAuthenticated: true });
assert.equal(studentToAdminGuard.allowed, false, 'يجب منع الطالب من دخول مساحة الإدارة');

// د) مدير المدرسة يدخل مساحة الإدارة
const managerGuard = SumerRouter.checkGuard('#admin/overview', { isManager: true }, { isAuthenticated: true });
assert.equal(managerGuard.allowed, true, 'يجب السماح لمدير المدرسة بدخول مساحة الإدارة');

console.log('✓ 5. عقود المسارات كاملة وحواجز الصلاحيات (Route Guards) مفروضة بدقة');

// --------------------------------------------------------------------------
// 6. عقد التنقل التجاوبي لمصنع الواجهات (SumerUI Components)
// --------------------------------------------------------------------------
const SumerUI = require('../school/js/sumer-ui');

// فحص الشريط العلوي
const headerHtml = SumerUI.renderHeader({ ui: { theme: 'light' }, schoolContext: { role: 'guardian', isGuardian: true } });
assert.match(headerHtml, /مدرسة سومر/);
assert.match(headerHtml, /ولي أمر/);

// فحص القائمة الجانبية للحواسيب (Desktop Sidebar)
const sidebarHtml = SumerUI.renderSidebar({ schoolContext: { isTeacher: true } }, '#teacher/overview');
assert.match(sidebarHtml, /مساحة المعلم/);
assert.match(sidebarHtml, /#teacher\/classes/);

// فحص شريط التنقل السفلي للهواتف (Mobile Bottom Bar)
const mobileBarHtml = SumerUI.renderMobileBar({ schoolContext: { isStudent: true } }, '#student/overview');
assert.match(mobileBarHtml, /sumer-mobile-bar/);
assert.match(mobileBarHtml, /مساحتي/);

// فحص القائمة المنبثقة (Drawer)
const drawerHtml = SumerUI.renderDrawer({ ui: { drawerOpen: true } });
assert.match(drawerHtml, /sumer-drawer/);

// فحص بطاقة الحجز النظيفة (Placeholder Shell)
const placeholderHtml = SumerUI.renderPlaceholderShell(contracts['#guardian/overview'], '#guardian/overview');
assert.match(placeholderHtml, /المرحلة القادمة: Phase 9/);
assert.match(placeholderHtml, /Zero Fake Data/);

console.log('✓ 6. المكونات المشتركة والتنقل التجاوبي (Desktop/Mobile) مكتملة ومطابقة للعقد');

// --------------------------------------------------------------------------
// 7. النزاهة الأكاديمية: انعدام أي بيانات وهمية أو Demo Data في الصدفة
// --------------------------------------------------------------------------
const newFiles = [
  'school.html',
  'school/js/sumer-state.js',
  'school/js/sumer-router.js',
  'school/js/sumer-ui.js'
];

const FORBIDDEN_MOCK_NAMES = [
  'طالب تجريبي',
  'معلم تجريبي',
  'John Doe',
  'عمر النابغة'
];

for (const f of newFiles) {
  const content = fs.readFileSync(path.join(ROOT_DIR, f), 'utf8');
  for (const forbidden of FORBIDDEN_MOCK_NAMES) {
    assert.ok(
      !content.includes(forbidden),
      `الملف ${f} يحتوي على بيانات غير حقيقية محظورة: "${forbidden}"`
    );
  }
}
console.log('✓ 7. النزاهة والصدق الأكاديمي: لا توجد أي بيانات وهمية أو أسماء Demo');

// --------------------------------------------------------------------------
// 8. الخصوصية الصارمة: الكاميرا والمايكروفون مغلقان وافتراضياً
// --------------------------------------------------------------------------
assert.equal(initialState.classroom.mediaStatus.camera, false);
assert.equal(initialState.classroom.mediaStatus.mic, false);
assert.ok(
  !schoolHtmlContent.includes('getUserMedia'),
  'school.html يجب ألا يطلب إذن الكاميرا أو المايكروفون تلقائياً عند التحميل'
);
console.log('✓ 8. الخصوصية الصارمة: الأجهزة مغلقة افتراضياً وممنوع فتحها تلقائياً');

// --------------------------------------------------------------------------
// 9. الأمان والمراقبة: حظر MediaRecorder و FaceDetector
// --------------------------------------------------------------------------
for (const f of newFiles) {
  const content = fs.readFileSync(path.join(ROOT_DIR, f), 'utf8');
  assert.ok(
    !content.includes('MediaRecorder'),
    `الملف ${f} ينتهك سياسة الأمان باستخدام MediaRecorder`
  );
  assert.ok(
    !content.includes('FaceDetector'),
    `الملف ${f} ينتهك سياسة الأمان باستخدام FaceDetector`
  );
}
console.log('✓ 9. الأمان والمراقبة الصارمة: خلو تام من مكتبات التسجيل أو التعرف على الوجوه');

console.log('\n====================================================');
console.log('   جميع اختبارات المرحلة 5 ناجحة بنسبة 100%       ');
console.log('====================================================\n');
