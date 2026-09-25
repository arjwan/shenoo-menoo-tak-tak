/**
 * sumer-ui.js - مصنع المكونات البصرية المشتركة لمدرسة سومر الموحدة (SumerUI)
 * Accessible, Responsive, Semantic Mesopotamian UI Factory
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SumerUI = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // أيقونات SVG خفيفة ومستوحاة من الفن السومري والبصريات الحديثة
  var ICONS = {
    school: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 8-4 8 4"/><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"/><path d="M18 5v17"/><path d="M6 5v17"/><circle cx="12" cy="9" r="2"/></svg>',
    book: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>',
    student: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    teacher: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    guardian: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="3"/></svg>',
    admin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h10"/></svg>',
    sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
    moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
    menu: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>',
    close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    cuneiform: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9 8h6l-3-6zm-6 8l2 6h8l2-6H6zm6 8l-3 4h6l-3-4z"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    alert: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>'
  };

  var SumerUI = {
    escapeHtml: escapeHtml,
    ICONS: ICONS,

    // ------------------------------------------------------------------------
    // 1. الشريط العلوي الموحد (Header Component)
    // ------------------------------------------------------------------------
    renderHeader: function (state) {
      state = state || { ui: { theme: 'light' }, schoolContext: { role: 'guest' } };
      var isDark = state.ui && state.ui.theme === 'dark';
      var themeIcon = isDark ? ICONS.sun : ICONS.moon;
      var role = (state.schoolContext && state.schoolContext.role) || 'guest';

      var roleLabel = 'زائر';
      var roleBadgeClass = 'badge-teal';
      if (state.schoolContext.isStudent) { roleLabel = 'طالب'; roleBadgeClass = 'badge-teal'; }
      else if (state.schoolContext.isTeacher) { roleLabel = 'معلم'; roleBadgeClass = 'badge-gold'; }
      else if (state.schoolContext.isGuardian) { roleLabel = 'ولي أمر'; roleBadgeClass = 'badge-success'; }
      else if (state.schoolContext.isManager || state.schoolContext.isDeveloper) { roleLabel = 'إدارة المدرسة'; roleBadgeClass = 'badge-warning'; }

      var html = '<header class="sumer-header" role="banner">';
      html += '  <div class="sumer-header-start">';
      html += '    <button class="sumer-btn-icon sumer-btn-menu-drawer" id="sumer-drawer-toggle" aria-label="فتح القائمة">';
      html +=        ICONS.menu;
      html += '    </button>';
      html += '    <a href="#welcome" class="sumer-brand-emblem" aria-label="مدرسة سومر - الصفحة الرئيسية">';
      html += '      <div class="sumer-emblem-icon">' + ICONS.cuneiform + '</div>';
      html += '      <div class="sumer-brand-title">';
      html += '        <span class="sumer-brand-main">مدرسة سومر</span>';
      html += '        <span class="sumer-brand-sub">بوابة بلاد الرافدين للتعليم الإلكتروني</span>';
      html += '      </div>';
      html += '    </a>';
      html += '  </div>';

      html += '  <div class="sumer-header-actions">';
      html += '    <span class="sumer-badge ' + roleBadgeClass + '">' + escapeHtml(roleLabel) + '</span>';
      html += '    <button class="sumer-btn-icon" id="sumer-theme-toggle" aria-label="تبديل وضع العرض (نهاري/ليلي)">';
      html +=        themeIcon;
      html += '    </button>';
      html += '  </div>';
      html += '</header>';

      return html;
    },

    // ------------------------------------------------------------------------
    // 2. القائمة الجانبية للحواسيب (Desktop Sidebar Component)
    // ------------------------------------------------------------------------
    renderSidebar: function (state, currentHash) {
      state = state || { schoolContext: { role: 'guest' } };
      currentHash = currentHash || '#welcome';

      var html = '<aside class="sumer-sidebar" role="navigation" aria-label="القائمة الرئيسية">';

      // القسم العام
      html += '<div class="sumer-sidebar-group">';
      html += '  <div class="sumer-sidebar-title">البوابة المدرسية</div>';
      html += '  <ul class="sumer-nav-list">';
      html += '    <li class="sumer-nav-item' + (currentHash === '#welcome' ? ' active' : '') + '">';
      html += '      <a href="#welcome"><span class="sumer-nav-icon">' + ICONS.school + '</span><span>الرئيسية</span></a>';
      html += '    </li>';
      html += '    <li class="sumer-nav-item' + (currentHash.indexOf('#curriculum') === 0 ? ' active' : '') + '">';
      html += '      <a href="#curriculum"><span class="sumer-nav-icon">' + ICONS.book + '</span><span>المناهج العراقية</span></a>';
      html += '    </li>';
      html += '  </ul>';
      html += '</div>';

      // مساحات العمل حسب الصلاحية
      if (state.schoolContext.isStudent || state.schoolContext.isManager) {
        html += '<div class="sumer-sidebar-group">';
        html += '  <div class="sumer-sidebar-title">مساحة الطالب</div>';
        html += '  <ul class="sumer-nav-list">';
        html += '    <li class="sumer-nav-item' + (currentHash === '#student/overview' ? ' active' : '') + '">';
        html += '      <a href="#student/overview"><span class="sumer-nav-icon">' + ICONS.student + '</span><span>لوحة الطالب</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#student/profile' ? ' active' : '') + '">';
        html += '      <a href="#student/profile"><span class="sumer-nav-icon">' + ICONS.info + '</span><span>الملف الأكاديمي</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#student/schedule' || currentHash === '#student/classes' ? ' active' : '') + '">';
        html += '      <a href="#student/schedule"><span class="sumer-nav-icon">' + ICONS.calendar + '</span><span>الجدول والحصص</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash.indexOf('#student/assignments') === 0 ? ' active' : '') + '">';
        html += '      <a href="#student/assignments"><span class="sumer-nav-icon">' + ICONS.book + '</span><span>الواجبات</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#student/grades' ? ' active' : '') + '">';
        html += '      <a href="#student/grades"><span class="sumer-nav-icon">' + ICONS.star + '</span><span>كشف الدرجات</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#student/attendance' ? ' active' : '') + '">';
        html += '      <a href="#student/attendance"><span class="sumer-nav-icon">' + ICONS.check + '</span><span>سجل الحضور</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#student/progress' ? ' active' : '') + '">';
        html += '      <a href="#student/progress"><span class="sumer-nav-icon">' + ICONS.cuneiform + '</span><span>مسار التقدم</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#student/teachers' ? ' active' : '') + '">';
        html += '      <a href="#student/teachers"><span class="sumer-nav-icon">' + ICONS.teacher + '</span><span>المعلمون المعتمدون</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#student/curriculum' ? ' active' : '') + '">';
        html += '      <a href="#student/curriculum"><span class="sumer-nav-icon">' + ICONS.book + '</span><span>مناهج مرحلتي</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash.indexOf('#student/reader') === 0 ? ' active' : '') + '">';
        html += '      <a href="#student/reader"><span class="sumer-nav-icon">' + ICONS.book + '</span><span>القارئ الرقمي المزدوج</span></a>';
        html += '    </li>';
        html += '  </ul>';
        html += '</div>';
      }

      if (state.schoolContext.isTeacher || state.schoolContext.isManager) {
        html += '<div class="sumer-sidebar-group">';
        html += '  <div class="sumer-sidebar-title">مساحة المعلم</div>';
        html += '  <ul class="sumer-nav-list">';
        html += '    <li class="sumer-nav-item' + (currentHash === '#teacher/overview' ? ' active' : '') + '">';
        html += '      <a href="#teacher/overview"><span class="sumer-nav-icon">' + ICONS.teacher + '</span><span>لوحة المعلم</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#teacher/classes' ? ' active' : '') + '">';
        html += '      <a href="#teacher/classes"><span class="sumer-nav-icon">' + ICONS.school + '</span><span>الفصول والحصص</span></a>';
        html += '    </li>';
        html += '  </ul>';
        html += '</div>';
      }

      if (state.schoolContext.isGuardian || state.schoolContext.isManager) {
        html += '<div class="sumer-sidebar-group">';
        html += '  <div class="sumer-sidebar-title">مساحة ولي الأمر</div>';
        html += '  <ul class="sumer-nav-list">';
        html += '    <li class="sumer-nav-item' + (currentHash === '#guardian/overview' ? ' active' : '') + '">';
        html += '      <a href="#guardian/overview"><span class="sumer-nav-icon">' + ICONS.guardian + '</span><span>لوحة ولي الأمر</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#guardian/children' ? ' active' : '') + '">';
        html += '      <a href="#guardian/children"><span class="sumer-nav-icon">' + ICONS.student + '</span><span>ملفات الأبناء</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#auth/register-student' ? ' active' : '') + '">';
        html += '      <a href="#auth/register-student"><span class="sumer-nav-icon">' + ICONS.student + '</span><span>تسجيل ابن جديد</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#guardian/schedule' ? ' active' : '') + '">';
        html += '      <a href="#guardian/schedule"><span class="sumer-nav-icon">' + ICONS.school + '</span><span>الجدول الدراسي</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#guardian/grades' ? ' active' : '') + '">';
        html += '      <a href="#guardian/grades"><span class="sumer-nav-icon">' + ICONS.student + '</span><span>الدرجات</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#guardian/attendance' ? ' active' : '') + '">';
        html += '      <a href="#guardian/attendance"><span class="sumer-nav-icon">' + ICONS.school + '</span><span>الحضور والغياب</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#guardian/reports' ? ' active' : '') + '">';
        html += '      <a href="#guardian/reports"><span class="sumer-nav-icon">' + ICONS.book + '</span><span>تقارير الأبناء</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#guardian/teachers' ? ' active' : '') + '">';
        html += '      <a href="#guardian/teachers"><span class="sumer-nav-icon">' + ICONS.teacher + '</span><span>معلمو الأبناء</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#guardian/messages' ? ' active' : '') + '">';
        html += '      <a href="#guardian/messages"><span class="sumer-nav-icon">' + ICONS.info + '</span><span>طلبات المدرسة</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#guardian/consents' ? ' active' : '') + '">';
        html += '      <a href="#guardian/consents"><span class="sumer-nav-icon">' + ICONS.guardian + '</span><span>الموافقات السبع</span></a>';
        html += '    </li>';
        html += '  </ul>';
        html += '</div>';
      }

      if (state.schoolContext.isManager || state.schoolContext.isDeveloper) {
        html += '<div class="sumer-sidebar-group">';
        html += '  <div class="sumer-sidebar-title">الإدارة المدرسية</div>';
        html += '  <ul class="sumer-nav-list">';
        html += '    <li class="sumer-nav-item' + (currentHash === '#admin/overview' ? ' active' : '') + '">';
        html += '      <a href="#admin/overview"><span class="sumer-nav-icon">' + ICONS.admin + '</span><span>لوحة الإدارة</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#admin/teachers' ? ' active' : '') + '">';
        html += '      <a href="#admin/teachers"><span class="sumer-nav-icon">' + ICONS.teacher + '</span><span>المعلمون والطلبات</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#admin/students' ? ' active' : '') + '">';
        html += '      <a href="#admin/students"><span class="sumer-nav-icon">' + ICONS.student + '</span><span>سجلات الطلاب</span></a>';
        html += '    </li>';
        html += '    <li class="sumer-nav-item' + (currentHash === '#admin/audit' ? ' active' : '') + '">';
        html += '      <a href="#admin/audit"><span class="sumer-nav-icon">' + ICONS.admin + '</span><span>سجل التدقيق</span></a>';
        html += '    </li>';
        html += '  </ul>';
        html += '</div>';
      }

      html += '</aside>';
      return html;
    },

    // ------------------------------------------------------------------------
    // 3. شريط التنقل السفلي للهواتف (Mobile Bottom Bar Component)
    // ------------------------------------------------------------------------
    renderMobileBar: function (state, currentHash) {
      state = state || { schoolContext: { role: 'guest' } };
      currentHash = currentHash || '#welcome';

      var html = '<nav class="sumer-mobile-bar" role="navigation" aria-label="شريط التنقل السفلي">';

      html += '<a href="#welcome" class="sumer-mobile-tab' + (currentHash === '#welcome' ? ' active' : '') + '">';
      html += '  <div class="sumer-mobile-tab-icon">' + ICONS.school + '</div>';
      html += '  <span>الرئيسية</span>';
      html += '</a>';

      html += '<a href="#curriculum" class="sumer-mobile-tab' + (currentHash.indexOf('#curriculum') === 0 ? ' active' : '') + '">';
      html += '  <div class="sumer-mobile-tab-icon">' + ICONS.book + '</div>';
      html += '  <span>المناهج</span>';
      html += '</a>';

      if (state.schoolContext.isStudent) {
        html += '<a href="#student/overview" class="sumer-mobile-tab' + (currentHash.indexOf('#student') === 0 ? ' active' : '') + '">';
        html += '  <div class="sumer-mobile-tab-icon">' + ICONS.student + '</div>';
        html += '  <span>مساحتي</span>';
        html += '</a>';
      } else if (state.schoolContext.isTeacher) {
        html += '<a href="#teacher/overview" class="sumer-mobile-tab' + (currentHash.indexOf('#teacher') === 0 ? ' active' : '') + '">';
        html += '  <div class="sumer-mobile-tab-icon">' + ICONS.teacher + '</div>';
        html += '  <span>حصصي</span>';
        html += '</a>';
      } else if (state.schoolContext.isGuardian) {
        html += '<a href="#guardian/overview" class="sumer-mobile-tab' + (currentHash.indexOf('#guardian') === 0 ? ' active' : '') + '">';
        html += '  <div class="sumer-mobile-tab-icon">' + ICONS.guardian + '</div>';
        html += '  <span>أبنائي</span>';
        html += '</a>';
      } else if (state.schoolContext.isManager || state.schoolContext.isDeveloper) {
        html += '<a href="#admin/overview" class="sumer-mobile-tab' + (currentHash.indexOf('#admin') === 0 ? ' active' : '') + '">';
        html += '  <div class="sumer-mobile-tab-icon">' + ICONS.admin + '</div>';
        html += '  <span>الإدارة</span>';
        html += '</a>';
      } else {
        html += '<a href="#auth/login" class="sumer-mobile-tab' + (currentHash.indexOf('#auth') === 0 ? ' active' : '') + '">';
        html += '  <div class="sumer-mobile-tab-icon">' + ICONS.student + '</div>';
        html += '  <span>الدخول</span>';
        html += '</a>';
      }

      html += '<button type="button" class="sumer-mobile-tab" id="sumer-mobile-menu-btn" aria-label="المزيد من الخيارات">';
      html += '  <div class="sumer-mobile-tab-icon">' + ICONS.menu + '</div>';
      html += '  <span>المزيد</span>';
      html += '</button>';

      html += '</nav>';
      return html;
    },

    // ------------------------------------------------------------------------
    // 4. القائمة المنبثقة للهواتف (Mobile Drawer Component)
    // ------------------------------------------------------------------------
    renderDrawer: function (state) {
      state = state || { ui: { drawerOpen: false } };
      var isOpen = state.ui && state.ui.drawerOpen;

      var html = '<div class="sumer-drawer-backdrop' + (isOpen ? ' open' : '') + '" id="sumer-drawer-backdrop"></div>';
      html += '<aside class="sumer-drawer' + (isOpen ? ' open' : '') + '" id="sumer-drawer" aria-label="القائمة الجانبية">';
      html += '  <div class="sumer-drawer-header">';
      html += '    <div class="sumer-brand-emblem">';
      html += '      <div class="sumer-emblem-icon">' + ICONS.cuneiform + '</div>';
      html += '      <span class="sumer-brand-main">مدرسة سومر</span>';
      html += '    </div>';
      html += '    <button class="sumer-drawer-close" id="sumer-drawer-close" aria-label="إغلاق القائمة">';
      html +=        ICONS.close;
      html += '    </button>';
      html += '  </div>';

      html += '  <div class="sumer-drawer-body">';
      html += '    <ul class="sumer-nav-list">';
      html += '      <li class="sumer-nav-item"><a href="#welcome"><span class="sumer-nav-icon">' + ICONS.school + '</span><span>الصفحة الرئيسية</span></a></li>';
      html += '      <li class="sumer-nav-item"><a href="#curriculum"><span class="sumer-nav-icon">' + ICONS.book + '</span><span>المناهج العراقية الرسمية</span></a></li>';
      html += '      <li class="sumer-nav-item"><a href="#guest"><span class="sumer-nav-icon">' + ICONS.info + '</span><span>عن المدرسة والتجربة المجانية</span></a></li>';
      html += '      <li class="sumer-nav-item"><a href="#auth/register-student"><span class="sumer-nav-icon">' + ICONS.student + '</span><span>تسجيل طالب جديد</span></a></li>';
      html += '      <li class="sumer-nav-item"><a href="#auth/apply-teacher"><span class="sumer-nav-icon">' + ICONS.teacher + '</span><span>طلب انضمام كمعلم</span></a></li>';
      html += '    </ul>';
      html += '  </div>';
      html += '</aside>';

      return html;
    },

    // ------------------------------------------------------------------------
    // 5. المكونات الدلالية المشتركة (Cards, Badges, Buttons, States)
    // ------------------------------------------------------------------------
    renderCard: function (options) {
      options = options || {};
      var html = '<div class="sumer-card' + (options.className ? ' ' + escapeHtml(options.className) : '') + '">';
      if (options.title) {
        html += '<div class="sumer-card-header">';
        html += '  <div>';
        html += '    <h3 class="sumer-card-title">' + (options.icon ? '<span class="sumer-card-icon">' + options.icon + '</span>' : '') + escapeHtml(options.title) + '</h3>';
        if (options.subtitle) {
          html += '    <div class="sumer-card-subtitle">' + escapeHtml(options.subtitle) + '</div>';
        }
        html += '  </div>';
        if (options.badge) {
          html += '  ' + this.renderBadge(options.badge);
        }
        html += '</div>';
      }
      html += '<div class="sumer-card-body">' + (options.body || '') + '</div>';
      if (options.footer) {
        html += '<div class="sumer-card-footer">' + options.footer + '</div>';
      }
      html += '</div>';
      return html;
    },

    renderBadge: function (options) {
      if (typeof options === 'string') options = { text: options, variant: 'teal' };
      options = options || {};
      var variant = options.variant || 'teal';
      var text = options.text || '';
      return '<span class="sumer-badge badge-' + escapeHtml(variant) + '">' +
        (options.icon ? options.icon + ' ' : '') + escapeHtml(text) + '</span>';
    },

    renderButton: function (options) {
      options = options || {};
      var variant = options.variant || 'primary';
      var type = options.type || 'button';
      var disabled = options.disabled ? ' disabled' : '';
      var idAttr = options.id ? ' id="' + escapeHtml(options.id) + '"' : '';
      return '<button type="' + escapeHtml(type) + '" class="sumer-btn sumer-btn-' + escapeHtml(variant) + '"' + idAttr + disabled + '>' +
        (options.icon ? options.icon + ' ' : '') + escapeHtml(options.text || '') + '</button>';
    },

    renderEmptyState: function (options) {
      options = options || {};
      var title = options.title || 'لا توجد بيانات متاحة';
      var desc = options.description || 'لم يتم تسجيل أي عناصر في هذا القسم حتى الآن.';
      var icon = options.icon || ICONS.info;

      var html = '<div class="sumer-empty-state">';
      html += '  <div class="sumer-state-icon">' + icon + '</div>';
      html += '  <h4 class="sumer-state-title">' + escapeHtml(title) + '</h4>';
      html += '  <p class="sumer-state-desc">' + escapeHtml(desc) + '</p>';
      if (options.action) {
        html += '  <div class="sumer-state-action">' + options.action + '</div>';
      }
      html += '</div>';
      return html;
    },

    renderLoadingState: function (message) {
      var msg = message || 'جاري تحميل البيانات...';
      return '<div class="sumer-loading-state" role="status" aria-live="polite">' +
        '  <div class="sumer-spinner" aria-hidden="true"></div>' +
        '  <p class="sumer-state-title">' + escapeHtml(msg) + '</p>' +
        '</div>';
    },

    renderErrorState: function (title, message, retryButton) {
      return '<div class="sumer-error-state" role="alert">' +
        '  <div class="sumer-state-icon" style="color: var(--sumer-danger); background-color: var(--sumer-danger-soft);">' + ICONS.alert + '</div>' +
        '  <h4 class="sumer-state-title">' + escapeHtml(title || 'تعذر استكمال الطلب') + '</h4>' +
        '  <p class="sumer-state-desc">' + escapeHtml(message || 'حدث خطأ أثناء تحميل البيانات. يرجى المحاولة مرة أخرى.') + '</p>' +
        (retryButton ? '  <div>' + retryButton + '</div>' : '') +
        '</div>';
    },

    // ------------------------------------------------------------------------
    // 6. بطاقة الحجز النظيفة للمراحل القادمة (Placeholder Shell)
    // ------------------------------------------------------------------------
    renderPlaceholderShell: function (contract, routeKey) {
      contract = contract || { title: 'مساحة العمل', workspace: 'general', phase: 5 };
      routeKey = routeKey || '#welcome';

      var html = '<div class="sumer-placeholder-shell">';
      html += '  <div class="sumer-placeholder-badge">';
      html += '    <span class="sumer-badge badge-gold">المرحلة القادمة: Phase ' + escapeHtml(contract.phase) + '</span>';
      html += '  </div>';

      html += '  <div class="sumer-placeholder-header">';
      html += '    <h2 class="sumer-placeholder-title">' + escapeHtml(contract.title) + '</h2>';
      html += '    <p class="sumer-placeholder-desc">';
      html += '      هذه المساحة معرّفة ومعتمدة ضمن معمارية مدرسة سومر الموحدة وسيتم تفعيل واجهاتها التفاعلية في المرحلة ' + escapeHtml(contract.phase) + '.';
      html += '    </p>';
      html += '  </div>';

      html += '  <div class="sumer-placeholder-meta">';
      html += '    <span class="sumer-meta-pill">المسار النشط: ' + escapeHtml(routeKey) + '</span>';
      html += '    <span class="sumer-meta-pill">مساحة العمل: ' + escapeHtml(contract.workspace) + '</span>';
      html += '    <span class="sumer-meta-pill">الصلاحية المطلوبة: ' + escapeHtml(contract.roleRequired || 'public') + '</span>';
      html += '    <span class="sumer-meta-pill">النزاهة: بدون بيانات وهمية (Zero Fake Data)</span>';
      html += '  </div>';

      html += '</div>';
      return html;
    }
  };

  return SumerUI;
}));
