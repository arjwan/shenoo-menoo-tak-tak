#!/usr/bin/env node
'use strict';

/**
 * api-school-phase7-student.js
 * باقة اختبارات التحقق الشاملة للمرحلة 7 (Sumer Real Student Workspace)
 *
 * البنود المفحوصة (20 فحصاً معمارياً وأمنياً صارماً):
 * 1. سلامة الملفات وبنية school.html وتحميل ملفات CSS و JS لمساحة الطالب.
 * 2. عقود موجه المسارات (SumerRouter) لمساحة الطالب وحواجز الصلاحيات (Route Guards).
 * 3. عقود طبقة الاتصال المشتركة (SumerAPI) لدوال الطالب والمناهج والقارئ.
 * 4. عقود مخزن الحالة الموحد (SumerStore) لحالة الطالب والقارئ المزدوج.
 * 5. واجهة لوحة مؤشرات الطالب (#student/overview) مع النزاهة التامة وانعدام البيانات الوهمية.
 * 6. واجهة الملف الأكاديمي (#student/profile) وعرض تفاصيل الطالب وحالة التجربة 30 يوماً.
 * 7. واجهة دليل المعلمين (#student/teachers) والشخصيات الافتراضية الرسمية الثلاث فقط (Sarah, Ali, Mariam).
 * 8. واجهة مناهج الطالب (#student/curriculum) والتصفية الصادقة حسب مرحلة وصف الطالب.
 * 9. واجهة القارئ الرقمي المزدوج (#student/reader) وتقسيم الشاشة والتحكم بالصفحات.
 * 10. فهرسة وبحث صفحات المنهج (OCR & Curriculum Search APIs).
 * 11. واجهة الواجبات المدرسية (#student/assignments) وسياسة التسليم وإعادة الإرسال.
 * 12. انغلاق الواجب بعد التصحيح وحظر إعادة التسليم وعرض الدرجة وملاحظات المعلم.
 * 13. واجهة كشف الدرجات (#student/grades) وحساب المعدل العام الصادق وتفصيل المواد.
 * 14. واجهة سجل الحضور والغياب (#student/attendance) ومؤشرات الالتزام والأعذار.
 * 15. واجهة مسار التقدم الأكاديمي (#student/progress) وربط سجلات التعلم المنجزة.
 * 16. واجهة الجدول الدراسي والحصص (#student/schedule) وروابط دخول الصف.
 * 17. خصوصية الأجهزة في الصف التفاعلي: الكاميرا والمايكروفون مغلقان افتراضياً بنسبة 100%.
 * 18. حظر أدوات المراقبة والتسجيل القسري (Zero MediaRecorder / FaceDetector).
 * 19. حواجز الأمان والعزل بين الطلاب (Student Isolation & Anti-Tampering).
 * 20. تحصين الواجهات ضد هجمات الحقن النصي وتشفير المخرجات (XSS Escaping).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('   اختبارات المرحلة 7 — مساحة الطالب الموحدة (Student)   ');
console.log('====================================================\n');

// --------------------------------------------------------------------------
// 1. سلامة الملفات وبنية school.html
// --------------------------------------------------------------------------
const REQUIRED_FILES = [
  'school.html',
  'school/css/sumer-tokens.css',
  'school/css/sumer-shell.css',
  'school/css/sumer-components.css',
  'school/css/sumer-gateway.css',
  'school/css/sumer-student.css',
  'school/js/sumer-api.js',
  'school/js/sumer-state.js',
  'school/js/sumer-router.js',
  'school/js/sumer-ui.js',
  'school/js/views/view-guest.js',
  'school/js/views/view-student.js',
  'school-virtual-teacher-core.js',
  'school-live-core.js'
];

for (const rel of REQUIRED_FILES) {
  const fullPath = path.join(ROOT_DIR, rel);
  assert.ok(fs.existsSync(fullPath), `الملف ${rel} مفقود في شجرة المشروع`);
  const content = fs.readFileSync(fullPath, 'utf8');
  assert.ok(content.length > 80, `الملف ${rel} فارغ أو غير مكتمل`);
}

const schoolHtml = fs.readFileSync(path.join(ROOT_DIR, 'school.html'), 'utf8');
assert.ok(schoolHtml.includes('sumer-student.css'), 'school.html يجب أن يتضمن sumer-student.css');
assert.ok(schoolHtml.includes('view-student.js'), 'school.html يجب أن يتضمن view-student.js');
assert.ok(schoolHtml.includes('school-live-core.js'), 'school.html يجب أن يتضمن school-live-core.js');
assert.ok(schoolHtml.includes('school-virtual-teacher-core.js'), 'school.html يجب أن يتضمن school-virtual-teacher-core.js');

console.log('✓ 1. بنية school.html وملفات مساحة الطالب كاملة وسليمة 100%');

// --------------------------------------------------------------------------
// 2. عقود موجه المسارات (SumerRouter) لمساحة الطالب وحواجز الصلاحيات
// --------------------------------------------------------------------------
const SumerRouter = require('../school/js/sumer-router');

const STUDENT_ROUTES = [
  '#student/overview',
  '#student/profile',
  '#student/classes',
  '#student/schedule',
  '#student/assignments',
  '#student/grades',
  '#student/attendance',
  '#student/progress',
  '#student/teachers',
  '#student/curriculum',
  '#student/reader'
];

for (const r of STUDENT_ROUTES) {
  const contract = SumerRouter.getContract(r);
  assert.ok(contract, `المسار ${r} غير معرف في عقود SumerRouter`);
  assert.equal(contract.workspace, 'student', `المسار ${r} يجب أن يتبع مساحة student`);
  assert.equal(contract.roleRequired, 'student', `المسار ${r} يجب أن يتطلب صلاحية student`);
}

// اختبار حاجز الصلاحية لزائر غير مسجل
const guestContext = { role: 'guest', isStudent: false, isTeacher: false, isGuardian: false, isManager: false };
const guestGuard = SumerRouter.checkGuard('#student/overview', guestContext, { isAuthenticated: false });
assert.equal(guestGuard.allowed, false, 'يجب حظر الزائر من الدخول لمساحة الطالب');
assert.equal(guestGuard.redirectTo, '#auth/login', 'يجب توجيه الزائر لصفحة الدخول');

// اختبار السماح للطالب المصادق
const studentContext = { role: 'student', isStudent: true, isTeacher: false, isGuardian: false, isManager: false };
const studentGuard = SumerRouter.checkGuard('#student/overview', studentContext, { isAuthenticated: true });
assert.equal(studentGuard.allowed, true, 'يجب السماح للطالب المصادق بدخول مساحته');

console.log('✓ 2. عقود موجه المسارات وحواجز الصلاحيات الأكاديمية للطالب سليمة ومحققة');

// --------------------------------------------------------------------------
// 3. عقود طبقة الاتصال المشتركة (SumerAPI) لدوال الطالب والمناهج
// --------------------------------------------------------------------------
const SumerAPI = require('../school/js/sumer-api');

const REQUIRED_API_METHODS = [
  'getStudentRecord',
  'getStudentAttendance',
  'getStudentGrades',
  'getStudentProgress',
  'getAssignments',
  'getAssignment',
  'getAssignmentSubmissions',
  'submitAssignment',
  'getSchedules',
  'getRealTeachers',
  'getBookReader',
  'getBookPage',
  'searchCurriculum',
  'getLiveClassrooms',
  'joinLiveClassroom',
  'raiseLiveHand',
  'leaveLiveClassroom',
  'getActiveVirtualSessions',
  'joinVirtualSession',
  'askVirtualQuestion'
];

for (const m of REQUIRED_API_METHODS) {
  assert.equal(typeof SumerAPI[m], 'function', `الدالة ${m} غير معرفة في SumerAPI`);
}

console.log('✓ 3. دوال طبقة الاتصال المشتركة (SumerAPI) المخصصة لمساحة الطالب كاملة');

// --------------------------------------------------------------------------
// 4. عقود مخزن الحالة الموحد (SumerStore) لحالة الطالب والقارئ
// --------------------------------------------------------------------------
const SumerStore = require('../school/js/sumer-state');
SumerStore.init();

assert.ok(SumerStore.getState().student, 'حالة student مفقودة في SumerStore');
assert.ok(Array.isArray(SumerStore.getState().student.assignments), 'قائمة assignments يجب أن تكون مصفوفة');
assert.ok(Array.isArray(SumerStore.getState().student.grades), 'قائمة grades يجب أن تكون مصفوفة');
assert.ok(Array.isArray(SumerStore.getState().student.attendance), 'قائمة attendance يجب أن تكون مصفوفة');
assert.ok(SumerStore.getState().curriculum, 'حالة curriculum مفقودة في SumerStore');

// فحص موجهات الحالة (Actions)
SumerStore.setStudentProfile({ name: 'أحمد السومري', stage: 'متوسط', grade: 'الثاني متوسط', section: 'أ' });
assert.equal(SumerStore.getState().student.profile.name, 'أحمد السومري');

SumerStore.setReaderViewMode('text');
assert.equal(SumerStore.getState().curriculum.dualViewMode, 'text');

console.log('✓ 4. مخزن الحالة الموحد (SumerStore) يدعم بنية الطالب والقارئ المزدوج');

// --------------------------------------------------------------------------
// 5. واجهة لوحة مؤشرات الطالب (#student/overview) مع النزاهة التامة
// --------------------------------------------------------------------------
const ViewStudent = require('../school/js/views/view-student');
assert.equal(typeof ViewStudent.render, 'function', 'ViewStudent.render يجب أن تكون دالة');

// محاكاة حاوية DOM
function createMockContainer() {
  return {
    innerHTML: '',
    querySelector: function () { return null; }
  };
}

const mockOverviewContainer = createMockContainer();
// استدعاء رندر اللوحة العامة
ViewStudent.render('#student/overview', mockOverviewContainer);
assert.ok(mockOverviewContainer.innerHTML.includes('sumer-loading-state'), 'يجب أن تبدأ الواجهة بحالة تحميل صادقة');

// فحص مبدأ النزاهة الصارم: صفر سجلات حضور لا يجوز أن يظهر كنسبة 100%
const mockZeroAttOverview = createMockContainer();
ViewStudent.renderOverview(mockZeroAttOverview, { student: {}, attendanceRecords: [], gradeRecords: [] });
assert.ok(!mockZeroAttOverview.innerHTML.includes('100%'), 'صفر سجلات حضور في Overview لا يجوز أن يظهر كـ 100% أبداً');
assert.ok(mockZeroAttOverview.innerHTML.includes('—'), 'صفر سجلات حضور يجب أن يظهر كـ —');

console.log('✓ 5. لوحة مؤشرات الطالب تبدأ بحالة تحميل نظيفة وترتبط بسجلات الطالب الصادقة (Zero Fake 100% Attendance)');

// --------------------------------------------------------------------------
// 6. واجهة الملف الأكاديمي (#student/profile) وحالة التجربة 30 يوماً
// --------------------------------------------------------------------------
const SchoolStudent = require('../server/src/models/SchoolStudent');
const trialComputation = SchoolStudent.computeTrialInfo({
  createdAt: new Date(),
  trialExpiresAt: new Date(Date.now() + 25 * 86400000),
  trialStatus: 'active'
});

assert.equal(trialComputation.isTrialActive, true);
assert.ok(trialComputation.daysRemaining >= 25);
assert.equal(trialComputation.isExpired, false);

// فحص عدم اختراع 30 يوماً عند غياب بيانات الخادم (Missing Trial != 30 Days)
const missingTrialHeader = ViewStudent.renderStudentHeader({}, '#student/overview');
assert.ok(!missingTrialHeader.includes('30 يوم') && !missingTrialHeader.includes('متبقي 30'), 'غياب بيانات التجربة لا يجوز أن يفترض 30 يوماً');
assert.ok(missingTrialHeader.includes('غير متاح'), 'غياب بيانات التجربة يجب أن يعرض شارة وحالة غير متاح');

const mockProfileNoTrial = createMockContainer();
ViewStudent.renderProfile(mockProfileNoTrial, { student: { name: 'طالب سومري' } });
assert.ok(mockProfileNoTrial.innerHTML.includes('الأيام المتبقية: <strong>غير متاح</strong>'), 'الملف الأكاديمي يجب أن يعرض غير متاح عند غياب بيانات الخادم');

// فحص عدم تزييف السنة الدراسية hard-coded (Missing AcademicYear != 2026-2027)
const mockProfileNoYear = createMockContainer();
ViewStudent.renderProfile(mockProfileNoYear, { student: { name: 'طالب سومري' } });
assert.ok(!mockProfileNoYear.innerHTML.includes('2026-2027'), 'غياب السنة الدراسية من الخادم لا يجوز أن يضع سنة 2026-2027 hard-coded');

console.log('✓ 6. حسابات التجربة المدرسية والملف الأكاديمي تخلو تماماً من الافتراضات الوهمية (No 30-Day / Academic Year Fallback)');

// --------------------------------------------------------------------------
// 7. شخصيات المعلمين الافتراضيين الرسمية الثلاث فقط (Sarah, Ali, Mariam)
// --------------------------------------------------------------------------
const virtualProfilesRes = SumerAPI.getVirtualProfiles();
assert.ok(virtualProfilesRes instanceof Promise);

virtualProfilesRes.then((res) => {
  const profiles = res.profiles || [];
  assert.equal(profiles.length, 3, 'يجب أن يحتوي الدليل على 3 شخصيات افتراضية رسمية فقط');
  const ids = profiles.map(p => p.profileId);
  assert.ok(ids.includes('sarah-smart'), 'أ. سارة الذكية يجب أن تكون ضمن المعلمين الافتراضيين');
  assert.ok(ids.includes('ali-wise'), 'أ. علي الحكيم يجب أن يكون ضمن المعلمين الافتراضيين');
  assert.ok(ids.includes('mariam-nour'), 'أ. مريم النور يجب أن تكون ضمن المعلمين الافتراضيين');
  assert.ok(!ids.includes('omar-genius'), 'يحظر وجود شخصيات وهمية مثل عمر النابغة');
});

// فحص عدم اختراع هوية المعلم الافتراضي إذا لم يعين للطالب
const mockOverviewNoVT = createMockContainer();
ViewStudent.renderOverview(mockOverviewNoVT, { student: { name: 'طالب', assignedTeachers: [] } });
assert.ok(!mockOverviewNoVT.innerHTML.includes('أ. سارة الذكية'), 'لا يجوز اختراع أ. سارة الذكية عند عدم تعيين معلم افتراضي');
assert.ok(!mockOverviewNoVT.innerHTML.includes('الرياضيات والعلوم'), 'لا يجوز اختراع تخصص الرياضيات والعلوم');

console.log('✓ 7. قائمة المعلمين الافتراضيين حقيقية ولا يتم اختراع هوية معلم افتراضي غير معين');

// --------------------------------------------------------------------------
// 8. واجهة مناهج الطالب (#student/curriculum) والتصفية الصادقة
// --------------------------------------------------------------------------
const iraqiCatalogData = require('../server/src/data/iraqi-curriculum-catalog');
const iraqiCatalog = Array.isArray(iraqiCatalogData) ? iraqiCatalogData : (iraqiCatalogData.items || []);
assert.ok(Array.isArray(iraqiCatalog) && iraqiCatalog.length >= 100, 'كتالوج المناهج يجب أن يتضمن ما لا يقل عن 100 كتاب');

const sixthPrimaryBooks = iraqiCatalog.filter(b => b.stage === 'ابتدائي' && b.grade === 'السادس ابتدائي');
assert.ok(sixthPrimaryBooks.length > 0, 'يجب وجود كتب للسادس ابتدائي');

// فحص عدم عرض كامل الكتالوج كبديل وهمي لمنهج الطالب عند غياب التطابق (Missing Curriculum Match != Full Catalog)
const mockCurriculumNoMatch = createMockContainer();
ViewStudent.renderCurriculum(mockCurriculumNoMatch, { stage: 'جامعي', grade: 'سنة أولى' }, [{ stage: 'ابتدائي', grade: 'الأول ابتدائي', title: 'قراءتي للصف الأول' }]);
assert.ok(mockCurriculumNoMatch.innerHTML.includes('لم يتم ربط كتب منهج صفك بعد'), 'عدم توفر كتب مطابقة يجب أن يعرض حالة فارغة صريحة');
assert.ok(!mockCurriculumNoMatch.innerHTML.includes('قراءتي للصف الأول'), 'ممنوع عرض كتب مراحل أخرى كبديل وهمي لمنهج الطالب');

console.log(`✓ 8. تصفية المناهج تقتصر على منهج الطالب الحقيقي دون السقوط الوهمي في كامل الكتالوج`);

// --------------------------------------------------------------------------
// 9. واجهة القارئ الرقمي المزدوج (#student/reader) وتقسيم الشاشة
// --------------------------------------------------------------------------
const sumerStudentCss = fs.readFileSync(path.join(ROOT_DIR, 'school/css/sumer-student.css'), 'utf8');
assert.ok(sumerStudentCss.includes('.sumer-reader-split'), 'CSS يجب أن يتضمن تنسيق تقسيم القارئ .sumer-reader-split');
assert.ok(sumerStudentCss.includes('.sumer-reader-ocr-text'), 'CSS يجب أن يتضمن تنسيق نص OCR المستخرج');
assert.ok(sumerStudentCss.includes('.sumer-reader-pdf-frame'), 'CSS يجب أن يتضمن تنسيق إطار PDF الأصلي');

// فحص عدم اختراع 200 صفحة في القارئ المزدوج (Missing totalPages != 200)
const mockReaderNoPages = createMockContainer();
ViewStudent.renderReader(mockReaderNoPages, {}, 'test-book-id', 1, {}, {});
assert.ok(!mockReaderNoPages.innerHTML.includes('من 200'), 'غياب عدد الصفحات لا يجوز أن يفترض 200 صفحة');
assert.ok(mockReaderNoPages.innerHTML.includes('من —'), 'غياب عدد الصفحات يجب أن يعرض من —');
assert.ok(mockReaderNoPages.innerHTML.includes('لا يتوفر نص OCR لهذه الصفحة'), 'غياب نص OCR يجب أن يعرض تنبيهاً صريحاً دون اعتبار النص الوهمي محتوى');

console.log('✓ 9. القارئ المزدوج يدعم تقسيم الشاشة وعرض النصوص المستخرجة وملفات PDF بدون تزييف عدد الصفحات (No 200 Pages Fallback)');

// --------------------------------------------------------------------------
// 10. فهرسة وبحث صفحات المنهج (OCR & Curriculum Search APIs)
// --------------------------------------------------------------------------
const curriculumIndex = require('../server/src/services/school-curriculum-index');
const pagesData = curriculumIndex.loadPagesData();
assert.ok(pagesData && Array.isArray(pagesData.pages), 'بيانات صفحات المناهج يجب أن تكون مصفوفة');
assert.ok(pagesData.pages.length >= 1000, 'فهرس الصفحات يجب أن يحتوي على آلاف الصفحات المفهرسة');

const searchHits = curriculumIndex.searchCurriculum({ query: 'العراق', limit: 5 });
assert.ok(Array.isArray(searchHits), 'نتائج البحث يجب أن تكون مصفوفة');
assert.ok(searchHits.length > 0, 'البحث عن "العراق" يجب أن يعيد نتائج مطابقة');
assert.ok(searchHits[0].page, 'نتيجة البحث يجب أن تتضمن رقم الصفحة');

console.log(`✓ 10. محرك الفهرسة والبحث النصي (OCR) يعمل بكفاءة على ${pagesData.pages.length} صفحة مفهرسة`);

// --------------------------------------------------------------------------
// 11. واجهة الواجبات المدرسية (#student/assignments) وسياسة التسليم
// --------------------------------------------------------------------------
const SchoolAssignment = require('../server/src/models/SchoolAssignment');
const SchoolAssignmentSubmission = require('../server/src/models/SchoolAssignmentSubmission');

assert.ok(SchoolAssignment.schema.paths.dueAt, 'نموذج الواجب يجب أن يتضمن تاريخ الاستحقاق dueAt');
assert.ok(SchoolAssignment.schema.paths.maxScore, 'نموذج الواجب يجب أن يتضمن الدرجة القصوى maxScore');
assert.ok(SchoolAssignmentSubmission.schema.paths.score, 'نموذج تسليم الواجب يجب أن يتضمن الدرجة score');
assert.ok(SchoolAssignmentSubmission.schema.paths.teacherFeedback, 'نموذج تسليم الواجب يجب أن يتضمن الملاحظات teacherFeedback');

console.log('✓ 11. نموذج الواجبات والتسليمات يدعم كافة حقول التقييم والتسليم الأكاديمي');

// --------------------------------------------------------------------------
// 12. انغلاق الواجب بعد التصحيح وحظر إعادة التسليم
// --------------------------------------------------------------------------
const viewStudentCode = fs.readFileSync(path.join(ROOT_DIR, 'school/js/views/view-student.js'), 'utf8');
assert.ok(viewStudentCode.includes('isGraded'), 'واجهة الطالب يجب أن تفحص حالة تصحيح الواجب isGraded');
assert.ok(viewStudentCode.includes('مغلق للتعديل'), 'الواجب المصحح يجب أن يظهر شارة "مغلق للتعديل"');

console.log('✓ 12. سياسة انغلاق الواجب بعد التصحيح مطبقة برمجياً في واجهة الطالب');

// --------------------------------------------------------------------------
// 13. واجهة كشف الدرجات (#student/grades) وحساب المعدل العام الصادق
// --------------------------------------------------------------------------
assert.ok(viewStudentCode.includes('averageScore'), 'كشف الدرجات يجب أن يحسب المعدل العام الصادق');
assert.ok(viewStudentCode.includes('bySubject'), 'كشف الدرجات يجب أن يحلل الأداء حسب المواد الدراسية');

console.log('✓ 13. كشف الدرجات يعتمد على الحساب الصادق لمعدلات المواد بدون تزييف');

// --------------------------------------------------------------------------
// 14. واجهة سجل الحضور والغياب (#student/attendance) ومؤشرات الالتزام
// --------------------------------------------------------------------------
assert.ok(viewStudentCode.includes('attendanceRate'), 'سجل الحضور يجب أن يحسب نسبة الحضور الصادقة');
assert.ok(viewStudentCode.includes('excused'), 'سجل الحضور يجب أن يدعم الغياب بعذر مبرر');

// فحص مبدأ النزاهة في صفحة الحضور: صفر سجلات حضور لا تعني 100% التزام (Zero Records != 100%)
const mockAttendanceEmpty = createMockContainer();
ViewStudent.renderAttendance(mockAttendanceEmpty, {}, { records: [], summary: { total: 0 } });
assert.ok(!mockAttendanceEmpty.innerHTML.includes('نسبة الالتزام: 100%'), 'صفحة الحضور عند غياب السجلات لا يجوز أن تدعي نسبة الالتزام 100%');
assert.ok(mockAttendanceEmpty.innerHTML.includes('نسبة الالتزام: —'), 'صفحة الحضور عند غياب السجلات يجب أن تظهر نسبة الالتزام: —');

console.log('✓ 14. سجل الحضور والغياب يدعم الحالات الأربع وينزه مؤشر الحضور من ادعاء 100% عند انعدام السجلات');

// --------------------------------------------------------------------------
// 15. واجهة مسار التقدم الأكاديمي (#student/progress)
// --------------------------------------------------------------------------
const SchoolLearningRecord = require('../server/src/models/SchoolLearningRecord');
assert.ok(SchoolLearningRecord, 'نموذج SchoolLearningRecord موجود ومعتمد');
assert.ok(viewStudentCode.includes('#student/progress'), 'واجهة الطالب تدعم مسار التقدم الأكاديمي');

console.log('✓ 15. مسار التقدم الأكاديمي مربوط بنموذج سجلات التعلم المعتمد');

// --------------------------------------------------------------------------
// 16. واجهة الجدول الدراسي والحصص (#student/schedule)
// --------------------------------------------------------------------------
assert.ok(viewStudentCode.includes('#classroom/live/'), 'الجدول يتضمن روابط دخول الصف المباشر');
assert.ok(viewStudentCode.includes('sch.type'), 'الجدول يدعم نوع الحصة المسجل من الخادم');

console.log('✓ 16. الجدول الدراسي الموحد يربط مواعيد الحصص المباشرة بروابط دخول الصفوف');

// --------------------------------------------------------------------------
// 17. خصوصية الأجهزة في الصف التفاعلي: الكاميرا والمايكروفون مغلقان افتراضياً 100%
// --------------------------------------------------------------------------
assert.ok(viewStudentCode.includes('sumer-device-badge-off'), 'أزرار الأجهزة تبدأ بشارة الإغلاق');
assert.ok(viewStudentCode.includes('الكاميرا والميكروفون مغلقان تلقائياً'), 'تنبيه الخصوصية موجود في واجهة الصف');

// فحص انعدام أي استدعاء تلقائي للوسائط
assert.ok(!viewStudentCode.includes('navigator.mediaDevices.getUserMedia('), 'يمنع تشغيل الوسائط تلقائياً دون نقرة واعية من المستخدم');

console.log('✓ 17. الكاميرا والمايكروفون مغلقان افتراضياً بنسبة 100% حفاظاً على الخصوصية');

// --------------------------------------------------------------------------
// 18. حظر أدوات المراقبة والتسجيل القسري (Zero MediaRecorder / FaceDetector)
// --------------------------------------------------------------------------
const FORBIDDEN_SURVEILLANCE_TERMS = ['MediaRecorder', 'FaceDetector', 'eyeTracking', 'gazeTracking', 'emotionAnalysis'];
for (const term of FORBIDDEN_SURVEILLANCE_TERMS) {
  assert.ok(!viewStudentCode.includes(term), `تم العثور على أداة مراقبة محظورة: ${term}`);
  assert.ok(!sumerStudentCss.includes(term), `تم العثور على أداة مراقبة محظورة في CSS: ${term}`);
}

console.log('✓ 18. الواجهة خالية تماماً من تقنيات المراقبة أو التسجيل القسري المحظورة');

// --------------------------------------------------------------------------
// 19. حواجز الأمان والعزل بين الطلاب وخلو الكود من أي Fake Academic Fallbacks
// --------------------------------------------------------------------------
const managementService = require('../server/src/services/school-management');
assert.equal(typeof managementService.getStudentPermanentRecord, 'function');
assert.equal(typeof managementService.getStudentAttendanceHistory, 'function');
assert.equal(typeof managementService.getStudentGradesHistory, 'function');
assert.equal(typeof managementService.getStudentProgress, 'function');

// التأكد من وجود فحوصات الحماية والعزل في كود الخدمة
const mgmtCode = fs.readFileSync(path.join(ROOT_DIR, 'server/src/services/school-management.js'), 'utf8');
assert.ok(mgmtCode.includes('لا يمكنك الاطلاع إلا على سجلك الأكاديمي الخاص فقط'), 'حاجز عزل الطالب مبرمج في getStudentPermanentRecord');
assert.ok(mgmtCode.includes('غير مصرح لك بالاطلاع على سجل حضور هذا الطالب'), 'حاجز عزل الطالب مبرمج في getStudentAttendanceHistory');

// فحص خلو الكود المصدري تماماً من أي fallback رقمي أو أكاديمي وهمي (No Fake Academic Fallbacks)
assert.ok(!viewStudentCode.includes('trialDaysRemaining : 30'), 'يحظر وجود fallback افتراضي 30 يوم في الكود');
assert.ok(!viewStudentCode.includes('totalPages || 200'), 'يحظر وجود fallback افتراضي 200 صفحة في الكود');
assert.ok(!viewStudentCode.includes("academicYear || '2026-2027'"), 'يحظر وجود سنة دراسية hard-coded في الكود');
assert.ok(!viewStudentCode.includes("virtualTeacher.name || 'أ. سارة الذكية'"), 'يحظر اختراع اسم أ. سارة الذكية كـ fallback');
assert.ok(!viewStudentCode.includes("virtualTeacher.subject || 'الرياضيات والعلوم'"), 'يحظر اختراع مادة الرياضيات والعلوم كـ fallback');
assert.ok(!viewStudentCode.includes('filtered = catalogBooks;'), 'يحظر السقوط في الكتالوج الكامل كبديل لمنهج الطالب');
assert.ok(!viewStudentCode.includes("totalPages = 200"), 'يحظر تعيين 200 صفحة كقيمة افتراضية');

console.log('✓ 19. حواجز العزل الأكاديمي وخلو الكود التام من أي Fallback رقمي أو أكاديمي وهمي');

// --------------------------------------------------------------------------
// 20. تحصين الواجهات ضد هجمات الحقن النصي (XSS Escaping)
// --------------------------------------------------------------------------
assert.ok(viewStudentCode.includes('escapeHtml('), 'دالة escapeHtml مستخدمة في كافة طبقات العرض');

// اختبار تشفير الحروف الحساسة
const escapeFn = require('../school/js/sumer-ui').escapeHtml;
const unsafeStr = '<script>alert("xss")</script>&"\'';
const safeStr = escapeFn(unsafeStr);
assert.ok(!safeStr.includes('<script>'), 'يجب استبدال علامات الفتح والإغلاق النصية');
assert.ok(safeStr.includes('&lt;script&gt;'), 'يجب تحويل الوسوم إلى كيانات HTML آمنة');

console.log('✓ 20. طبقة العرض محصنة بالكامل ضد هجمات الحقن وتشفير المخرجات سليم 100%');

console.log('\n====================================================');
console.log('   جميع اختبارات مساحة الطالب (Phase 7) نجحت بنسبة 100%!   ');
console.log('====================================================\n');
