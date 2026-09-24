/**
 * sumer-router.js - موجه مسارات الواجهة الداخلية وحواجز الصلاحيات لمدرسة سومر (SumerRouter)
 * Declarative Client Hash Router & Role-Based Route Guards
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./sumer-state'));
  } else {
    root.SumerRouter = factory(root.SumerStore);
  }
}(typeof self !== 'undefined' ? self : this, function (SumerStore) {
  'use strict';

  // سجل عقود المسارات المعتمدة لمدرسة سومر الموحدة (Route Contracts Registry)
  var ROUTE_CONTRACTS = {
    // 1. بوابة الزوار والمصادقة العامة
    '#welcome': { workspace: 'welcome', title: 'مرحباً بكم في مدرسة سومر', roleRequired: 'public', phase: 6 },
    '#guest':   { workspace: 'guest',   title: 'استعراض التجربة المدرسية', roleRequired: 'public', phase: 6 },
    '#auth/login':            { workspace: 'auth', title: 'تسجيل الدخول', roleRequired: 'public', phase: 6 },
    '#auth/register-student': { workspace: 'auth', title: 'تسجيل طالب جديد', roleRequired: 'public', phase: 6 },
    '#auth/apply-teacher':    { workspace: 'auth', title: 'طلب انضمام معلم', roleRequired: 'public', phase: 6 },

    // 2. مساحة عمل الطالب (Student Workspace)
    '#student/overview':    { workspace: 'student', title: 'لوحة مؤشرات الطالب', roleRequired: 'student', phase: 7 },
    '#student/profile':     { workspace: 'student', title: 'الملف الأكاديمي للطالب', roleRequired: 'student', phase: 7 },
    '#student/classes':     { workspace: 'student', title: 'حصص الطالب', roleRequired: 'student', phase: 7 },
    '#student/schedule':    { workspace: 'student', title: 'الجدول الدراسي للطالب', roleRequired: 'student', phase: 7 },
    '#student/assignments': { workspace: 'student', title: 'واجبات الطالب', roleRequired: 'student', phase: 7 },
    '#student/grades':      { workspace: 'student', title: 'درجات وتقييمات الطالب', roleRequired: 'student', phase: 7 },
    '#student/attendance':  { workspace: 'student', title: 'سجل حضور وغياب الطالب', roleRequired: 'student', phase: 7 },
    '#student/progress':    { workspace: 'student', title: 'مسار التقدم الأكاديمي', roleRequired: 'student', phase: 7 },
    '#student/teachers':    { workspace: 'student', title: 'معلمو الطالب', roleRequired: 'student', phase: 7 },
    '#student/curriculum':  { workspace: 'student', title: 'مناهج الطالب الدراسية', roleRequired: 'student', phase: 7 },
    '#student/reader':      { workspace: 'student', title: 'القارئ الرقمي المزدوج', roleRequired: 'student', phase: 7 },
    '#student/alerts':      { workspace: 'student', title: 'التنبيهات والإنذارات والامتحانات', roleRequired: 'student', phase: 10 },
    '#student/whiteboards': { workspace: 'student', title: 'السبورات الذكية المحفوظة', roleRequired: 'student', phase: 10 },

    // 3. مساحة عمل المعلم (Teacher Workspace)
    '#teacher/overview':    { workspace: 'teacher', title: 'لوحة المعلم اليومية', roleRequired: 'teacher', phase: 8 },
    '#teacher/classes':     { workspace: 'teacher', title: 'الفصول والحصص', roleRequired: 'teacher', phase: 8 },
    '#teacher/whiteboard':  { workspace: 'teacher', title: 'السبورة الذكية الخاصة', roleRequired: 'teacher', phase: 10 },
    '#teacher/students':    { workspace: 'teacher', title: 'قوائم الطلاب المكلفين', roleRequired: 'teacher', phase: 8 },
    '#teacher/schedule':    { workspace: 'teacher', title: 'جدول مواعيد الحصص', roleRequired: 'teacher', phase: 8 },
    '#teacher/attendance':  { workspace: 'teacher', title: 'رصد الحضور والغياب', roleRequired: 'teacher', phase: 8 },
    '#teacher/assignments': { workspace: 'teacher', title: 'إدارة وتصحيح الواجبات', roleRequired: 'teacher', phase: 8 },
    '#teacher/gradebook':   { workspace: 'teacher', title: 'دفتر الدرجات والتقييمات', roleRequired: 'teacher', phase: 8 },
    '#teacher/reports':     { workspace: 'teacher', title: 'التقارير الأكاديمية والملاحظات', roleRequired: 'teacher', phase: 8 },
    '#teacher/messages':    { workspace: 'teacher', title: 'رسائل أولياء الأمور والإدارة', roleRequired: 'teacher', phase: 8 },

    // 4. مساحة عمل ولي الأمر المستقلة (Guardian Workspace)
    '#guardian/overview':   { workspace: 'guardian', title: 'لوحة ولي الأمر المركزية', roleRequired: 'guardian', phase: 9 },
    '#guardian/children':   { workspace: 'guardian', title: 'إدارة وتحديد ملفات الأبناء', roleRequired: 'guardian', phase: 9 },
    '#guardian/schedule':   { workspace: 'guardian', title: 'الجدول الموحد للأبناء', roleRequired: 'guardian', phase: 9 },
    '#guardian/grades':     { workspace: 'guardian', title: 'كشوف درجات وتقييمات الأبناء', roleRequired: 'guardian', phase: 9 },
    '#guardian/attendance': { workspace: 'guardian', title: 'سجلات حضور وغياب الأبناء', roleRequired: 'guardian', phase: 9 },
    '#guardian/reports':    { workspace: 'guardian', title: 'التقارير الأكاديمية والشهادات', roleRequired: 'guardian', phase: 9 },
    '#guardian/teachers':   { workspace: 'guardian', title: 'معلمو الأبناء والتواصل', roleRequired: 'guardian', phase: 9 },
    '#guardian/messages':   { workspace: 'guardian', title: 'قنوات التواصل المباشر', roleRequired: 'guardian', phase: 9 },
    '#guardian/consents':   { workspace: 'guardian', title: 'إدارة الموافقات السبع الصريحة', roleRequired: 'guardian', phase: 9 },
    '#guardian/complaints': { workspace: 'guardian', title: 'صندوق الشكاوى والمقترحات', roleRequired: 'guardian', phase: 9 },

    // 5. مساحة عمل الإدارة المدرسية الموحدة (School Administration Workspace)
    '#admin/overview':      { workspace: 'admin', title: 'لوحة القيادة المدرسية الشاملة', roleRequired: 'manager', phase: 10 },
    '#admin/teachers':      { workspace: 'admin', title: 'إدارة المعلمين وطلبات الانضمام', roleRequired: 'manager', phase: 10 },
    '#admin/students':      { workspace: 'admin', title: 'إدارة الطلاب والسجلات الدائمة', roleRequired: 'manager', phase: 10 },
    '#admin/guardians':     { workspace: 'admin', title: 'إدارة أولياء الأمور والموافقات', roleRequired: 'manager', phase: 10 },
    '#admin/classes':       { workspace: 'admin', title: 'المراحل والصفوف والشعب الدراسية', roleRequired: 'manager', phase: 10 },
    '#admin/schedules':     { workspace: 'admin', title: 'الجدول العام ومواعيد الاختبارات', roleRequired: 'manager', phase: 10 },
    '#admin/attendance':    { workspace: 'admin', title: 'تقارير الحضور والغياب العامة', roleRequired: 'manager', phase: 10 },
    '#admin/gradebook':     { workspace: 'admin', title: 'المراجعة المركزية للدرجات', roleRequired: 'manager', phase: 10 },
    '#admin/complaints':    { workspace: 'admin', title: 'متابعة والرد على شكاوى أولياء الأمور', roleRequired: 'manager', phase: 10 },
    '#admin/audit':         { workspace: 'admin', title: 'سجل التدقيق الإداري الصارم', roleRequired: 'manager', phase: 10 },

    // 6. المناهج والقارئ والصف الموحد (Shared Features)
    '#curriculum':          { workspace: 'curriculum', title: 'مكتبة المناهج العراقية الرسمية', roleRequired: 'public', phase: 7 },
    '#classroom/live':      { workspace: 'classroom',  title: 'الصف المباشر (WebRTC Star)', roleRequired: 'authenticated', phase: 11 },
    '#classroom/virtual':   { workspace: 'classroom',  title: 'الصف الافتراضي الذكي (AI Persona)', roleRequired: 'authenticated', phase: 11 }
  };

  function matchRoute(hash) {
    if (!hash || hash === '#' || hash === '') return '#welcome';
    hash = hash.split('?')[0]; // عزل معلمات الاستعلام

    if (ROUTE_CONTRACTS[hash]) {
      return hash;
    }

    // مطابقة المسارات الديناميكية كقارئ المنهج أو الصفوف
    if (hash.indexOf('#student/reader/') === 0) {
      return '#student/reader';
    }
    if (hash.indexOf('#curriculum/reader/') === 0) {
      return '#curriculum';
    }
    if (hash.indexOf('#classroom/live/') === 0) {
      return '#classroom/live';
    }
    if (hash.indexOf('#classroom/virtual/') === 0) {
      return '#classroom/virtual';
    }

    return null;
  }

  function checkRouteGuard(contract, schoolContext, auth) {
    if (!contract || contract.roleRequired === 'public') {
      return { allowed: true };
    }

    // التحقق من تسجيل الدخول للمسارات الخاصة
    if (!auth || !auth.isAuthenticated) {
      return {
        allowed: false,
        redirectTo: '#auth/login',
        reason: 'يرجى تسجيل الدخول للوصول إلى هذه المساحة'
      };
    }

    var roleRequired = contract.roleRequired;

    // صلاحيات مدير المنصة أو مدير المدرسة تملك نفاذاً إدارياً
    if (schoolContext.isDeveloper || schoolContext.isManager) {
      return { allowed: true };
    }

    // فحص أدوار الطلاب والمعلمين وأولياء الأمور
    if (roleRequired === 'student' && !schoolContext.isStudent) {
      return { allowed: false, redirectTo: '#welcome', reason: 'هذه المساحة مخصصة للطلاب فقط' };
    }
    if (roleRequired === 'teacher' && !schoolContext.isTeacher) {
      return { allowed: false, redirectTo: '#welcome', reason: 'هذه المساحة مخصصة للمعلمين فقط' };
    }
    if (roleRequired === 'guardian' && !schoolContext.isGuardian) {
      return { allowed: false, redirectTo: '#welcome', reason: 'هذه المساحة مخصصة لأولياء الأمور فقط' };
    }
    if (roleRequired === 'manager' && !(schoolContext.isManager || schoolContext.isDeveloper)) {
      return { allowed: false, redirectTo: '#welcome', reason: 'هذه المساحة محصورة بإدارة المدرسة فقط' };
    }

    return { allowed: true };
  }

  function SumerRouterInstance() {
    this.currentHash = '#welcome';
    this.currentContract = ROUTE_CONTRACTS['#welcome'];
    this.onRouteChangedCallback = null;
  }

  SumerRouterInstance.prototype.init = function (onRouteChanged) {
    this.onRouteChangedCallback = onRouteChanged || null;
    var self = this;

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('hashchange', function () {
        self.handleNavigation(window.location.hash);
      });

      // التعامل مع المسار الأولي
      var initialHash = window.location.hash || '#welcome';
      this.handleNavigation(initialHash);
    }

    return this;
  };

  SumerRouterInstance.prototype.handleNavigation = function (rawHash) {
    var matchedKey = matchRoute(rawHash);
    if (!matchedKey) {
      // إعادة التوجيه للمسار الترحيبي عند عدم العثور على المسار
      this.navigate('#welcome');
      return;
    }

    var contract = ROUTE_CONTRACTS[matchedKey];
    var state = SumerStore ? SumerStore.getState() : { schoolContext: { role: 'guest' }, auth: { isAuthenticated: false } };
    var guardResult = checkRouteGuard(contract, state.schoolContext, state.auth);

    if (!guardResult.allowed) {
      if (typeof window !== 'undefined' && window.location) {
        window.location.hash = guardResult.redirectTo;
      }
      return;
    }

    this.currentHash = rawHash;
    this.currentContract = contract;

    if (SumerStore) {
      SumerStore.setState({
        activeWorkspace: contract.workspace,
        activeRoute: rawHash
      });
    }

    if (typeof this.onRouteChangedCallback === 'function') {
      this.onRouteChangedCallback(rawHash, contract);
    }
  };

  SumerRouterInstance.prototype.navigate = function (hash) {
    if (typeof window !== 'undefined' && window.location) {
      window.location.hash = hash;
    } else {
      this.handleNavigation(hash);
    }
  };

  SumerRouterInstance.prototype.getContracts = function () {
    return ROUTE_CONTRACTS;
  };

  SumerRouterInstance.prototype.getContract = function (routeKey) {
    return ROUTE_CONTRACTS[routeKey] || null;
  };

  SumerRouterInstance.prototype.checkGuard = function (routeKey, schoolContext, auth) {
    var contract = ROUTE_CONTRACTS[routeKey];
    return checkRouteGuard(contract, schoolContext, auth);
  };

  return new SumerRouterInstance();
}));
