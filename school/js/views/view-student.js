/**
 * view-student.js - مساحة الطالب الموحدة لمدرسة سومر الإلكترونية (Phase 7 Student Workspace)
 * Zero Fake Data | Mesopotamian Modern | Responsive Dual Reader | Device Privacy First
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../sumer-state'),
      require('../sumer-api'),
      require('../sumer-ui')
    );
  } else {
    root.SumerStudentView = factory(
      root.SumerStore,
      root.SumerAPI,
      root.SumerUI
    );
  }
}(typeof self !== 'undefined' ? self : this, function (store, api, ui) {
  'use strict';

  var escapeHtml = (ui && ui.escapeHtml) || function (t) {
    if (t === null || t === undefined) return '';
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  var ICONS = (ui && ui.ICONS) || {
    school: '🏛️',
    book: '📖',
    student: '🎓',
    teacher: '👨‍🏫',
    guardian: '🛡️',
    calendar: '📅',
    star: '⭐',
    check: '✅',
    cuneiform: '𒀭',
    info: 'ℹ️',
    alert: '⚠️',
    clock: '⏱️'
  };

  // الحالة المحلية لغرفة الصف والقارئ
  var localClassroomState = {
    cameraEnabled: false,
    micEnabled: false,
    handRaised: false,
    activeStream: null
  };

  /**
   * الترويسة الأكاديمية لمساحة الطالب وشريط التبويبات السريعة
   * الخادم وحده هو مصدر حقيقة التجربة المدرسية والاشتراك (Zero Fake Data)
   */
  function renderStudentHeader(student, currentRoute) {
    student = student || {};
    var trialInfo = student.trialInfo || {};
    var remainingDays = trialInfo.daysRemaining !== undefined
      ? trialInfo.daysRemaining
      : (student.trialDaysRemaining !== undefined ? student.trialDaysRemaining : null);
    var isSubscribed = Boolean(student.isSubscribed || (student.subscription && student.subscription.active));
    var isExpired = Boolean(trialInfo.isExpired || student.trialStatus === 'expired');

    var trialBannerClass = 'sumer-trial-banner';
    var trialStatusText = 'فترة تجريبية مجانية: غير متاح';
    var trialBadgeVariant = 'neutral';
    var trialBadgeText = 'غير متاح';

    if (isSubscribed) {
      trialStatusText = 'اشتراك أكاديمي نشط ومعتمد';
      trialBadgeVariant = 'success';
      trialBadgeText = 'مشترك';
    } else if (isExpired) {
      trialBannerClass += ' trial-expired';
      trialStatusText = 'انتهت الفترة التجريبية - يرجى تجديد الاشتراك لمواصلة التعلم';
      trialBadgeVariant = 'danger';
      trialBadgeText = 'منتهي';
    } else if (remainingDays !== null && remainingDays !== undefined) {
      if (remainingDays <= 5) {
        trialBannerClass += ' trial-expiring';
        trialStatusText = 'تنبيه: أوشكت الفترة التجريبية على الانتهاء (متبقي ' + remainingDays + ' أيام)';
        trialBadgeVariant = 'gold';
      } else {
        trialStatusText = 'فترة تجريبية مجانية: متبقي ' + remainingDays + ' يوم';
        trialBadgeVariant = 'teal';
      }
      trialBadgeText = 'تجريبي';
    } else {
      trialStatusText = 'بيانات التجربة المدرسية: غير متاحة من الخادم';
      trialBadgeVariant = 'neutral';
      trialBadgeText = 'غير متاح';
    }

    var initials = student.name ? student.name.trim().slice(0, 2) : '—';

    var html = '<div class="sumer-student-header">';
    html += '  <div class="sumer-student-hero">';
    html += '    <div class="sumer-student-identity">';
    html += '      <div class="sumer-student-avatar" aria-hidden="true">' + escapeHtml(initials) + '</div>';
    html += '      <div class="sumer-student-meta">';
    html += '        <h2>' + escapeHtml(student.name || 'مساحة الطالب الأكاديمية') + '</h2>';
    html += '        <div class="sumer-student-tags">';
    if (student.stage) html += '          <span class="sumer-badge badge-teal">' + escapeHtml(student.stage) + '</span>';
    if (student.grade) html += '          <span class="sumer-badge badge-gold">' + escapeHtml(student.grade) + '</span>';
    if (student.section) html += '          <span class="sumer-badge badge-neutral">شعبة ' + escapeHtml(student.section) + '</span>';
    html += '        </div>';
    html += '      </div>';
    html += '    </div>';

    html += '    <div class="' + trialBannerClass + '">';
    html += '      <div class="sumer-trial-info">';
    html += '        <span class="sumer-card-icon">' + ICONS.clock + '</span>';
    html += '        <strong>' + escapeHtml(trialStatusText) + '</strong>';
    html += '      </div>';
    html += '      ' + ui.renderBadge({ text: trialBadgeText, variant: trialBadgeVariant });
    html += '    </div>';
    html += '  </div>';

    // تبويبات مساحة الطالب
    var tabs = [
      { route: '#student/overview', label: 'لوحة المؤشرات', icon: ICONS.student },
      { route: '#student/profile', label: 'الملف الأكاديمي', icon: ICONS.info },
      { route: '#student/schedule', label: 'الجدول والحصص', icon: ICONS.calendar },
      { route: '#student/assignments', label: 'الواجبات', icon: ICONS.book },
      { route: '#student/grades', label: 'الدرجات', icon: ICONS.star },
      { route: '#student/attendance', label: 'الحضور', icon: ICONS.check },
      { route: '#student/progress', label: 'مسار التقدم', icon: ICONS.cuneiform },
      { route: '#student/teachers', label: 'المعلمون', icon: ICONS.teacher },
      { route: '#student/curriculum', label: 'مناهج مرحلتي', icon: ICONS.book },
      { route: '#student/reader', label: 'القارئ المزدوج', icon: ICONS.book },
      { route: '#student/alerts', label: 'التنبيهات والإنذارات', icon: ICONS.alert },
      { route: '#student/whiteboards', label: 'السبورات', icon: '🧠' }
    ];

    html += '  <nav class="sumer-student-nav" aria-label="أقسام مساحة الطالب">';
    tabs.forEach(function (tab) {
      var isActive = currentRoute === tab.route || (tab.route === '#student/reader' && currentRoute.indexOf('#student/reader') === 0);
      html += '    <a href="' + tab.route + '" class="sumer-student-nav-btn' + (isActive ? ' active' : '') + '">';
      html += '      <span>' + tab.icon + '</span><span>' + escapeHtml(tab.label) + '</span>';
      html += '    </a>';
    });
    html += '  </nav>';

    html += '</div>';
    return html;
  }

  // --------------------------------------------------------------------------
  // 1. لوحة المؤشرات العامة - Student Overview (#student/overview)
  // --------------------------------------------------------------------------
  function renderOverview(container, studentRecord) {
    var student = (studentRecord && studentRecord.student) || {};
    var attendanceRecords = (studentRecord && studentRecord.attendanceRecords) || [];
    var gradeRecords = (studentRecord && studentRecord.gradeRecords) || [];
    var submissions = (studentRecord && studentRecord.submissions) || [];
    var schedules = (studentRecord && studentRecord.schedules) || [];

    // حساب إحصائيات الحضور الصادقة - عدم وجود سجلات لا يعني 100%
    var totalAtt = attendanceRecords.length;
    var presentCount = 0;
    attendanceRecords.forEach(function (r) {
      if (r.status === 'present' || r.status === 'late' || r.status === 'excused') presentCount++;
    });
    var attRate = totalAtt > 0 ? Math.round((presentCount / totalAtt) * 100) : null;

    // حساب متوسط الدرجات الصادق - عدم وجود درجات لا يعني 0% أو قيمة افتراضية
    var totalGradePct = 0;
    var gradeCount = gradeRecords.length;
    gradeRecords.forEach(function (g) {
      if (g.maxScore > 0) totalGradePct += (g.score / g.maxScore) * 100;
    });
    var avgGrade = gradeCount > 0 ? Math.round(totalGradePct / gradeCount) : null;

    var html = '<div class="sumer-student-container">';
    html += renderStudentHeader(student, '#student/overview');

    // شبكة مؤشرات الأداء السريع (KPI Cards)
    html += '<div class="sumer-kpi-grid">';
    html += '  <div class="sumer-kpi-card">';
    html += '    <div class="sumer-kpi-icon" style="background-color: var(--sumer-teal-50); color: var(--sumer-teal-600);">' + ICONS.check + '</div>';
    html += '    <div>';
    html += '      <div class="sumer-kpi-val">' + (attRate !== null ? (attRate + '%') : '—') + '</div>';
    html += '      <div class="sumer-kpi-label">نسبة الحضور الأكاديمي ' + (totalAtt > 0 ? ('(' + totalAtt + ' حصة)') : '(لا توجد سجلات بعد)') + '</div>';
    html += '    </div>';
    html += '  </div>';

    html += '  <div class="sumer-kpi-card">';
    html += '    <div class="sumer-kpi-icon" style="background-color: var(--sumer-gold-50); color: var(--sumer-gold-600);">' + ICONS.star + '</div>';
    html += '    <div>';
    html += '      <div class="sumer-kpi-val">' + (avgGrade !== null ? (avgGrade + '%') : '—') + '</div>';
    html += '      <div class="sumer-kpi-label">المعدل العام ' + (gradeCount > 0 ? ('(' + gradeCount + ' تقييمات)') : '(لا توجد درجات بعد)') + '</div>';
    html += '    </div>';
    html += '  </div>';

    html += '  <div class="sumer-kpi-card">';
    html += '    <div class="sumer-kpi-icon" style="background-color: var(--sumer-teal-50); color: var(--sumer-teal-600);">' + ICONS.book + '</div>';
    html += '    <div>';
    html += '      <div class="sumer-kpi-val">' + submissions.length + '</div>';
    html += '      <div class="sumer-kpi-label">الواجبات المسلمة</div>';
    html += '    </div>';
    html += '  </div>';

    html += '  <div class="sumer-kpi-card">';
    html += '    <div class="sumer-kpi-icon" style="background-color: var(--sumer-surface-2); color: var(--sumer-text-primary);">' + ICONS.calendar + '</div>';
    html += '    <div>';
    html += '      <div class="sumer-kpi-val">' + schedules.length + '</div>';
    html += '      <div class="sumer-kpi-label">حصص وأنشطة مجدولة</div>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    // قسم الجدول اليومي والحصص القادمة
    html += '<div class="sumer-grid" style="grid-template-columns: 2fr 1fr; gap: 1.5rem;">';

    html += '  <div class="sumer-card">';
    html += '    <div class="sumer-card-header">';
    html += '      <h3 class="sumer-card-title"><span class="sumer-card-icon">' + ICONS.calendar + '</span>الجدول والحصص القادمة</h3>';
    html += '      <a href="#student/schedule" class="sumer-btn sumer-btn-outline sumer-btn-sm">عرض الجدول الكامل</a>';
    html += '    </div>';
    html += '    <div class="sumer-card-body">';

    if (schedules.length === 0) {
      html += ui.renderEmptyState({
        title: 'لا توجد حصص مجدولة لليوم',
        description: 'سيظهر هنا أي درس مباشر أو اختبار فور جدولته من قبل كادر المدرسة.',
        icon: ICONS.calendar
      });
    } else {
      html += '      <div style="display: flex; flex-direction: column; gap: 0.75rem;">';
      schedules.slice(0, 4).forEach(function (sch) {
        var eventDate = sch.scheduledAt ? new Date(sch.scheduledAt).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' }) : '—';
        html += '        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border: 1px solid var(--sumer-border-color); border-radius: var(--sumer-radius-md); background: var(--sumer-surface-1);">';
        html += '          <div>';
        html += '            <strong>' + escapeHtml(sch.title || sch.subject || 'حصة دراسية') + '</strong>';
        html += '            <div style="font-size: 0.85rem; color: var(--sumer-text-secondary);">' + escapeHtml(sch.subject || '') + ' • ' + escapeHtml(eventDate) + '</div>';
        html += '          </div>';
        html += '          <div style="display: flex; align-items: center; gap: 0.5rem;">';
        if (sch.type) {
          html += '            ' + ui.renderBadge({ text: sch.type, variant: 'teal' });
        }
        if (sch.classroomCode) {
          html += '            <a href="#classroom/live/' + encodeURIComponent(sch.classroomCode) + '" class="sumer-btn sumer-btn-primary sumer-btn-sm">دخول الصف</a>';
        }
        html += '          </div>';
        html += '        </div>';
      });
      html += '      </div>';
    }
    html += '    </div>';
    html += '  </div>';

    // قسم المعلمون المعينون - Zero Fake Names
    html += '  <div class="sumer-card">';
    html += '    <div class="sumer-card-header">';
    html += '      <h3 class="sumer-card-title"><span class="sumer-card-icon">' + ICONS.teacher + '</span>كادر التدريس المعتمد</h3>';
    html += '      <a href="#student/teachers" class="sumer-btn sumer-btn-outline sumer-btn-sm">الكل</a>';
    html += '    </div>';
    html += '    <div class="sumer-card-body">';

    var assignedTeachers = student.assignedTeachers || [];
    var virtualTeacher = student.assignedVirtualTeacher;
    var hasVirtualTeacher = Boolean(virtualTeacher && (virtualTeacher.name || virtualTeacher.profileId));

    if (assignedTeachers.length === 0 && !hasVirtualTeacher) {
      html += ui.renderEmptyState({
        title: 'لم يتم تعيين معلمين بعد',
        description: 'تقوم إدارة المدرسة حالياً بتعيين الكادر التدريسي المخصص لشعبتك.',
        icon: ICONS.teacher
      });
    } else {
      html += '      <div style="display: flex; flex-direction: column; gap: 0.75rem;">';
      if (hasVirtualTeacher) {
        html += '        <div style="padding: 0.75rem; border-radius: var(--sumer-radius-md); background: var(--sumer-teal-50); border: 1px solid var(--sumer-teal-200);">';
        html += '          <div style="display: flex; align-items: center; justify-content: space-between;">';
        html += '            <strong>' + escapeHtml(virtualTeacher.name || virtualTeacher.profileId) + '</strong>';
        html += '            ' + ui.renderBadge({ text: virtualTeacher.label || 'معلم افتراضي / AI', variant: 'gold' });
        html += '          </div>';
        if (virtualTeacher.subject || virtualTeacher.title) {
          html += '          <div style="font-size: 0.85rem; color: var(--sumer-teal-800); margin-top: 0.25rem;">' + escapeHtml(virtualTeacher.subject || virtualTeacher.title) + '</div>';
        }
        html += '        </div>';
      }

      assignedTeachers.slice(0, 3).forEach(function (at) {
        var t = at.teacher || at;
        var tName = t.name || t.fullName || '—';
        html += '        <div style="padding: 0.75rem; border-radius: var(--sumer-radius-md); background: var(--sumer-surface-1); border: 1px solid var(--sumer-border-color);">';
        html += '          <div style="display: flex; align-items: center; justify-content: space-between;">';
        html += '            <strong>' + escapeHtml(tName) + '</strong>';
        html += '            ' + ui.renderBadge({ text: 'معلم معتمد', variant: 'teal' });
        html += '          </div>';
        var subj = at.subject || (Array.isArray(t.subjects) ? t.subjects.join('، ') : t.subjects);
        if (subj) {
          html += '          <div style="font-size: 0.85rem; color: var(--sumer-text-secondary); margin-top: 0.25rem;">' + escapeHtml(subj) + '</div>';
        }
        html += '        </div>';
      });
      html += '      </div>';
    }
    html += '    </div>';
    html += '  </div>';

    html += '</div>'; // نهاية الشبكة
    html += '</div>'; // نهاية الحاوية
    container.innerHTML = html;
  }

  // --------------------------------------------------------------------------
  // 2. الملف الأكاديمي للطالب - Student Profile (#student/profile)
  // --------------------------------------------------------------------------
  function renderProfile(container, studentRecord) {
    var student = (studentRecord && studentRecord.student) || {};
    var trialInfo = student.trialInfo || {};
    var guardian = student.guardian || {};

    var remainingDaysText = trialInfo.daysRemaining !== undefined
      ? (trialInfo.daysRemaining + ' يوم')
      : (student.trialDaysRemaining !== undefined ? (student.trialDaysRemaining + ' يوم') : 'غير متاح');

    var html = '<div class="sumer-student-container">';
    html += renderStudentHeader(student, '#student/profile');

    html += '<div class="sumer-grid" style="grid-template-columns: 2fr 1fr; gap: 1.5rem;">';

    // بطاقة المعلومات الأكاديمية - Zero Fake Year / Facts
    html += '  <div class="sumer-card">';
    html += '    <div class="sumer-card-header">';
    html += '      <h3 class="sumer-card-title"><span class="sumer-card-icon">' + ICONS.student + '</span>البيانات الأكاديمية الرسمية</h3>';
    html += '      ' + ui.renderBadge({ text: student.active ? 'طالب نشط' : 'قيد المراجعة', variant: student.active ? 'success' : 'gold' });
    html += '    </div>';
    html += '    <div class="sumer-card-body">';
    html += '      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">';
    html += '        <div><span style="color: var(--sumer-text-secondary); font-size: 0.85rem;">الاسم الكامل:</span><div style="font-weight: 600;">' + escapeHtml(student.name || '—') + '</div></div>';
    html += '        <div><span style="color: var(--sumer-text-secondary); font-size: 0.85rem;">المرحلة الدراسية:</span><div style="font-weight: 600;">' + escapeHtml(student.stage || '—') + '</div></div>';
    html += '        <div><span style="color: var(--sumer-text-secondary); font-size: 0.85rem;">الصف الدراسي:</span><div style="font-weight: 600;">' + escapeHtml(student.grade || '—') + '</div></div>';
    html += '        <div><span style="color: var(--sumer-text-secondary); font-size: 0.85rem;">الشعبة:</span><div style="font-weight: 600;">' + escapeHtml(student.section || '—') + '</div></div>';
    html += '        <div><span style="color: var(--sumer-text-secondary); font-size: 0.85rem;">سنة التسجيل الأكاديمية:</span><div style="font-weight: 600;">' + escapeHtml(student.academicYear || '—') + '</div></div>';
    html += '        <div><span style="color: var(--sumer-text-secondary); font-size: 0.85rem;">الرقم الأكاديمي:</span><div style="font-weight: 600; font-family: monospace;">' + escapeHtml(String(student._id || student.id || '—')) + '</div></div>';
    html += '      </div>';

    html += '      <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--sumer-border-color);">';
    html += '        <h4 style="margin: 0 0 0.75rem 0; font-size: 1rem;">المواد الدراسية المقيدة:</h4>';
    if (student.subjects && student.subjects.length > 0) {
      html += '        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">';
      student.subjects.forEach(function (s) {
        html += '          <span class="sumer-badge badge-teal">' + escapeHtml(s) + '</span>';
      });
      html += '        </div>';
    } else {
      html += '        <p style="color: var(--sumer-text-secondary); font-size: 0.9rem;">لم يتم تقييد مواد خاصة بعد. تطبق المواد العامة المعتمدة لمرحلتك.</p>';
    }
    html += '      </div>';
    html += '    </div>';
    html += '  </div>';

    // بطاقة ولي الأمر وحالة الحساب
    html += '  <div class="sumer-card">';
    html += '    <div class="sumer-card-header">';
    html += '      <h3 class="sumer-card-title"><span class="sumer-card-icon">' + ICONS.guardian + '</span>ارتباط الحساب وولي الأمر</h3>';
    html += '    </div>';
    html += '    <div class="sumer-card-body">';
    if (guardian && (guardian.fullName || guardian.username)) {
      html += '      <div style="margin-bottom: 0.75rem;"><span style="color: var(--sumer-text-secondary); font-size: 0.85rem;">ولي الأمر:</span><div style="font-weight: 600;">' + escapeHtml(guardian.fullName || guardian.username) + '</div></div>';
      if (guardian.phone) html += '      <div style="margin-bottom: 0.75rem;"><span style="color: var(--sumer-text-secondary); font-size: 0.85rem;">هاتف التواصل:</span><div style="font-weight: 600;">' + escapeHtml(guardian.phone) + '</div></div>';
    } else {
      html += '      <p style="color: var(--sumer-text-secondary); font-size: 0.9rem;">حساب طالب مستقل أو لم يتم ربط ولي أمر بعد.</p>';
    }

    html += '      <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--sumer-border-color);">';
    html += '        <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem;">بيانات التجربة المدرسية:</h4>';
    html += '        <div style="font-size: 0.85rem; color: var(--sumer-text-secondary);">';
    html += '          <div>تاريخ البدء: ' + (trialInfo.startDate ? new Date(trialInfo.startDate).toLocaleDateString('ar-IQ') : '—') + '</div>';
    html += '          <div>تاريخ الانتهاء: ' + (trialInfo.expiresAt ? new Date(trialInfo.expiresAt).toLocaleDateString('ar-IQ') : '—') + '</div>';
    html += '          <div>الأيام المتبقية: <strong>' + escapeHtml(remainingDaysText) + '</strong></div>';
    html += '        </div>';
    html += '      </div>';
    html += '    </div>';
    html += '  </div>';

    html += '</div>'; // نهاية الشبكة
    html += '</div>'; // نهاية الحاوية
    container.innerHTML = html;
  }

  // --------------------------------------------------------------------------
  // 3. المعلمون المعتمدون والافتراضيون - Teachers Directory (#student/teachers)
  // --------------------------------------------------------------------------
  function renderTeachers(container, student, realTeachers, virtualProfiles) {
    realTeachers = realTeachers || [];
    virtualProfiles = virtualProfiles || [];

    var html = '<div class="sumer-student-container">';
    html += renderStudentHeader(student, '#student/teachers');

    html += '<div style="margin-bottom: 2rem;">';
    html += '  <div style="margin-bottom: 1rem;">';
    html += '    <h3 style="margin: 0; font-size: 1.25rem;"><span class="sumer-card-icon">' + ICONS.teacher + '</span>المعلمون الحقيقيون المكلفون</h3>';
    html += '    <p style="margin: 0.25rem 0 0 0; color: var(--sumer-text-secondary); font-size: 0.9rem;">كادر تعليمي تربوي حقيقي معتمد من وزارة التربية العراقية لمتابعة صفك.</p>';
    html += '  </div>';

    if (realTeachers.length === 0) {
      html += ui.renderEmptyState({
        title: 'لا يوجد معلمون معينون حالياً',
        description: 'سيتم تعيين معلمي مواد مرحلتك الدراسية فور اكتمال تشكيل الهيئة التدريسية.',
        icon: ICONS.teacher
      });
    } else {
      html += '  <div class="sumer-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">';
      realTeachers.forEach(function (t) {
        var subjs = Array.isArray(t.subjects) ? t.subjects.join('، ') : (t.subjects || t.specialty || '—');
        html += '    <div class="sumer-card">';
        html += '      <div class="sumer-card-header">';
        html += '        <h4 class="sumer-card-title">' + escapeHtml(t.name || t.fullName || '—') + '</h4>';
        html += '        ' + ui.renderBadge({ text: 'معلم معتمد', variant: 'teal' });
        html += '      </div>';
        html += '      <div class="sumer-card-body">';
        html += '        <div style="font-size: 0.9rem; color: var(--sumer-text-secondary); margin-bottom: 0.5rem;">المواد: <strong>' + escapeHtml(subjs) + '</strong></div>';
        if (t.stages && t.stages.length > 0) {
          html += '        <div style="font-size: 0.85rem; color: var(--sumer-text-secondary);">المراحل: ' + escapeHtml(Array.isArray(t.stages) ? t.stages.join('، ') : t.stages) + '</div>';
        }
        html += '        <label class="sumer-label">اختر المادة للتسجيل<select class="student-teacher-subject" data-teacher="'+escapeHtml(t._id||t.id||'')+'"><option value="">اختر المادة</option>'+((Array.isArray(t.subjects)?t.subjects:[]).map(function(s){return '<option value="'+escapeHtml(s)+'">'+escapeHtml(s)+'</option>';}).join(''))+'</select></label>';
        html += '        <button type="button" class="sumer-btn sumer-btn-primary student-enroll-teacher" data-teacher="'+escapeHtml(t._id||t.id||'')+'" data-name="'+escapeHtml(t.name||t.fullName||'')+'">طلب التسجيل لدى هذا المعلم</button> <a class="sumer-btn sumer-btn-outline" href="/school-live.html">دخول الصف</a>';
        html += '      </div>';
        html += '    </div>';
      });
      html += '  </div>';
    }
    html += '</div>';

    // المعلمون الافتراضيون بالذكاء الاصطناعي - تؤخذ فقط من API الحقيقي
    html += '<div>';
    html += '  <div style="margin-bottom: 1rem;">';
    html += '    <h3 style="margin: 0; font-size: 1.25rem;"><span class="sumer-card-icon">🤖</span>المعلمون الافتراضيون بالذكاء الاصطناعي (AI Personas)</h3>';
    html += '    <p style="margin: 0.25rem 0 0 0; color: var(--sumer-text-secondary); font-size: 0.9rem;">شخصيات تعليمية ذكية معتمدة وموجهة لتبسيط المفاهيم الصعبة وفق المنهج العراقي على مدار الساعة.</p>';
    html += '  </div>';

    if (virtualProfiles.length === 0) {
      html += ui.renderEmptyState({
        title: 'لا تتوفر شخصيات معلمين افتراضيين حالياً',
        description: 'جاري تحميل ملفات المعلمين الافتراضيين المعتمدة من الخادم.',
        icon: '🤖'
      });
    } else {
      html += '  <div class="sumer-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">';
      virtualProfiles.forEach(function (p) {
        html += '    <div class="sumer-card" style="border-top: 3px solid var(--sumer-gold-500);">';
        html += '      <div class="sumer-card-header">';
        html += '        <h4 class="sumer-card-title">' + escapeHtml(p.name || p.profileId || '—') + '</h4>';
        html += '        ' + ui.renderBadge({ text: p.label || 'معلم افتراضي / AI', variant: 'gold' });
        html += '      </div>';
        html += '      <div class="sumer-card-body">';
        if (p.title) {
          html += '        <p style="font-size: 0.9rem; color: var(--sumer-text-secondary); line-height: 1.5; margin-bottom: 0.75rem;">' + escapeHtml(p.title) + '</p>';
        }
        if (p.specialties && p.specialties.length > 0) {
          html += '        <div style="display: flex; flex-wrap: wrap; gap: 0.35rem;">';
          p.specialties.forEach(function (s) {
            html += '          <span class="sumer-badge badge-neutral" style="font-size: 0.75rem;">' + escapeHtml(s) + '</span>';
          });
          html += '        </div>';
        }
        html += '      </div>';
        html += '    </div>';
      });
      html += '  </div>';
    }
    html += '</div>';

    html += '</div>'; // نهاية الحاوية
    container.innerHTML = html;
    container.querySelectorAll('.student-enroll-teacher').forEach(function (button) {
      button.addEventListener('click', function () {
        var select = container.querySelector('.student-teacher-subject[data-teacher="'+button.dataset.teacher+'"]');
        var subject = select && select.value;
        if (!subject) { window.alert('اختر المادة أولاً'); return; }
        button.disabled = true;
        api.request('/api/school/portal/enrollment', { method:'POST', body:{ requestedRole:'student', stage:student.stage, grade:student.grade, subjects:[subject], note:'طلب تسجيل لدى المعلم '+button.dataset.name+' في مادة '+subject } }).then(function (r) {
          if (!r.ok) throw new Error(r.message || 'تعذر إرسال الطلب');
          button.textContent = 'تم إرسال طلب التسجيل';
        }).catch(function (e) { button.disabled=false; window.alert(e.message); });
      });
    });
  }

  // --------------------------------------------------------------------------
  // 4. مناهج مرحلتي الدراسية - Curriculum Filtered Catalog (#student/curriculum)
  // لا تعرض كامل الكتالوج في مساحة الطالب عند عدم التطابق (Zero Fake Catalog)
  // --------------------------------------------------------------------------
  function renderCurriculum(container, student, catalogBooks) {
    catalogBooks = catalogBooks || [];
    var studentStage = (student && student.stage) || '';
    var studentGrade = (student && student.grade) || '';

    // تصفية حصرية حسب مرحلة وصف الطالب فقط
    var filtered = catalogBooks.filter(function (b) {
      if (studentStage && b.stage !== studentStage) return false;
      if (studentGrade && b.grade !== studentGrade) return false;
      return true;
    });

    var html = '<div class="sumer-student-container">';
    html += renderStudentHeader(student, '#student/curriculum');

    html += '<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">';
    html += '  <div>';
    html += '    <h3 style="margin: 0; font-size: 1.25rem;"><span class="sumer-card-icon">' + ICONS.book + '</span>الكتب المنهجية الرسمية المعتمدة</h3>';
    html += '    <p style="margin: 0.25rem 0 0 0; color: var(--sumer-text-secondary); font-size: 0.9rem;">الكتب الدراسية المخصصة لمرحلتك (' + escapeHtml(studentStage || '—') + ' - ' + escapeHtml(studentGrade || '—') + ').</p>';
    html += '  </div>';
    html += '  <div>';
    html += '    ' + ui.renderBadge({ text: filtered.length > 0 ? (filtered.length + ' كتاب متاح') : 'لا توجد كتب', variant: filtered.length > 0 ? 'teal' : 'neutral' });
    html += '  </div>';
    html += '</div>';

    // إذا لم توجد كتب تطابق stage + grade للطالب: اعرض Empty State واضحة دون عرض كامل الكتالوج
    if (filtered.length === 0) {
      html += ui.renderEmptyState({
        title: 'لم يتم ربط كتب منهج صفك بعد',
        description: 'لم نعثر على كتب دراسية مطابقة لمرحلتك الدراسية (' + escapeHtml(studentStage || '—') + ' - ' + escapeHtml(studentGrade || '—') + '). سيتم عرضها فور توفرها واعتمادها.',
        icon: ICONS.book
      });
    } else {
      html += '<div class="sumer-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem;">';
      filtered.forEach(function (book) {
        var bookId = book.id || book.driveId || book.fileName;
        var isAvailable = book.availability === 'available' || (book.file && book.file.url) || book.hasOcr;

        html += '<div class="sumer-card">';
        html += '  <div class="sumer-card-header">';
        html += '    <h4 class="sumer-card-title" style="font-size: 1rem;">' + escapeHtml(book.title) + '</h4>';
        html += '    ' + ui.renderBadge({ text: isAvailable ? 'متاح للقراءة' : 'قيد الفهرسة', variant: isAvailable ? 'success' : 'neutral' });
        html += '  </div>';
        html += '  <div class="sumer-card-body">';
        html += '    <div style="font-size: 0.85rem; color: var(--sumer-text-secondary); display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 1rem;">';
        html += '      <div>المرحلة: <strong>' + escapeHtml(book.stage || studentStage || '—') + '</strong></div>';
        html += '      <div>الصف: <strong>' + escapeHtml(book.grade || studentGrade || '—') + '</strong></div>';
        if (book.subject) html += '      <div>المادة: <strong>' + escapeHtml(book.subject) + '</strong></div>';
        html += '    </div>';
        html += '    <div style="display: flex; gap: 0.5rem;">';
        html += '      <a href="#student/reader/' + encodeURIComponent(bookId) + '" class="sumer-btn sumer-btn-primary sumer-btn-sm" style="flex: 1; text-align: center;">فتح القارئ المزدوج</a>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>'; // نهاية الحاوية
    container.innerHTML = html;
  }

  // --------------------------------------------------------------------------
  // 5. القارئ الرقمي المزدوج - Dual OCR & PDF Reader (#student/reader/:id)
  // لا تخترع عدد صفحات (Zero 200 Fake Pages) ولا نص وهمي يوحي بوجود صفحة
  // --------------------------------------------------------------------------
  function renderReader(container, student, bookId, pageNum, bookData, pageData, viewMode) {
    pageNum = Math.max(1, parseInt(pageNum, 10) || 1);
    viewMode = viewMode || 'split'; // split | text | pdf
    bookData = bookData || {};
    pageData = pageData || {};

    var bookTitle = bookData.title || (pageData && pageData.bookTitle) || 'الكتاب المنهجي';
    var totalPages = (pageData && typeof pageData.totalPages === 'number' && pageData.totalPages > 0)
      ? pageData.totalPages
      : (typeof bookData.totalPages === 'number' && bookData.totalPages > 0 ? bookData.totalPages : null);

    var pdfUrl = (bookData.file && bookData.file.url) || bookData.sourceUrl || '';
    var ocrContent = (pageData && typeof pageData.content === 'string') ? pageData.content.trim() : '';
    var hasOcr = Boolean(ocrContent && ocrContent.length > 0);

    var totalPagesDisplay = totalPages !== null ? totalPages : '—';
    var maxAttr = totalPages !== null ? (' max="' + totalPages + '"') : '';
    var nextDisabled = (totalPages !== null && pageNum >= totalPages) ? ' disabled' : '';

    var html = '<div class="sumer-student-container">';
    html += renderStudentHeader(student, '#student/reader');

    html += '<div class="sumer-reader-shell">';

    // شريط أدوات القارئ المزدوج
    html += '  <div class="sumer-reader-toolbar">';
    html += '    <div style="display: flex; align-items: center; gap: 0.75rem;">';
    html += '      <a href="#student/curriculum" class="sumer-btn sumer-btn-outline sumer-btn-sm">‹ العودة للكتب</a>';
    html += '      <h3 style="margin: 0; font-size: 1.1rem;">' + escapeHtml(bookTitle) + '</h3>';
    html += '    </div>';

    // أزرار التحكم بالصفحات - بدون تزييف الحد الأقصى
    html += '    <div class="sumer-reader-controls">';
    html += '      <button type="button" class="sumer-btn sumer-btn-outline sumer-btn-sm" id="sumer-reader-prev-btn"' + (pageNum <= 1 ? ' disabled' : '') + '>‹ الصفحة السابقة</button>';
    html += '      <span style="font-size: 0.9rem;">صفحة:</span>';
    html += '      <input type="number" class="sumer-reader-page-input" id="sumer-reader-page-input" value="' + pageNum + '" min="1"' + maxAttr + '>';
    html += '      <span style="font-size: 0.9rem; color: var(--sumer-text-secondary);">من ' + totalPagesDisplay + '</span>';
    html += '      <button type="button" class="sumer-btn sumer-btn-outline sumer-btn-sm" id="sumer-reader-next-btn"' + nextDisabled + '>الصفحة التالية ›</button>';
    html += '    </div>';

    // أزرار نمط العرض
    html += '    <div style="display: flex; align-items: center; gap: 0.35rem;">';
    html += '      <button type="button" class="sumer-btn sumer-btn-sm ' + (viewMode === 'split' ? 'sumer-btn-primary' : 'sumer-btn-outline') + '" id="sumer-reader-mode-split">عرض مزدوج</button>';
    html += '      <button type="button" class="sumer-btn sumer-btn-sm ' + (viewMode === 'text' ? 'sumer-btn-primary' : 'sumer-btn-outline') + '" id="sumer-reader-mode-text">نص فقط</button>';
    html += '      <button type="button" class="sumer-btn sumer-btn-sm ' + (viewMode === 'pdf' ? 'sumer-btn-primary' : 'sumer-btn-outline') + '" id="sumer-reader-mode-pdf">PDF فقط</button>';
    html += '    </div>';
    html += '  </div>';

    // صندوق البحث في محتوى الكتاب
    html += '  <div class="sumer-reader-search-box">';
    html += '    <input type="text" id="sumer-reader-search-input" class="sumer-input" placeholder="ابحث عن كلمة، مسألة، أو مصطلح في هذا الكتاب..." style="flex: 1;">';
    html += '    <button type="button" id="sumer-reader-search-btn" class="sumer-btn sumer-btn-primary">بحث مفهرس</button>';
    html += '  </div>';
    html += '  <div id="sumer-reader-search-results" style="display: none; margin-bottom: 1rem;"></div>';

    // واجهة القارئ المزدوج المقسمة
    var showPdf = viewMode === 'split' || viewMode === 'pdf';
    var showText = viewMode === 'split' || viewMode === 'text';

    html += '  <div class="sumer-reader-split" style="grid-template-columns: ' + (viewMode === 'split' ? '1fr 1fr' : '1fr') + ';">';

    // اللوح الأيمن: النص المفهرس للبحث والذكاء الاصطناعي (OCR Text Pane)
    if (showText) {
      html += '    <div class="sumer-reader-pane">';
      html += '      <div class="sumer-reader-pane-header">';
      html += '        <span>النص المطبوع المستخرج (OCR)</span>';
      if (pageData.chapter || pageData.lesson) {
        html += '        <span class="sumer-badge badge-gold">' + escapeHtml(pageData.chapter || pageData.lesson || '') + '</span>';
      }
      html += '      </div>';
      html += '      <div class="sumer-reader-pane-body" id="sumer-reader-text-container">';
      if (hasOcr) {
        html += '        <div class="sumer-reader-ocr-text">' + escapeHtml(ocrContent) + '</div>';
      } else {
        html += ui.renderEmptyState({
          title: 'لا يتوفر نص OCR لهذه الصفحة',
          description: 'لم يتم استخراج نص مقروء آلياً للصفحة رقم ' + pageNum + '، أو أنها تحتوي على رسوم ومخططات فقط.',
          icon: ICONS.book
        });
      }
      html += '      </div>';
      html += '    </div>';
    }

    // اللوح الأيسر: مستند PDF الأصلي المعتمد (PDF Viewer Pane)
    if (showPdf) {
      html += '    <div class="sumer-reader-pane">';
      html += '      <div class="sumer-reader-pane-header">';
      html += '        <span>نسخة وزارة التربية الأصلية (PDF)</span>';
      if (pdfUrl) {
        html += '        <a href="' + escapeHtml(pdfUrl) + '" target="_blank" rel="noopener noreferrer" class="sumer-btn sumer-btn-outline sumer-btn-sm">فتح في نافذة مستقلة ↗</a>';
      }
      html += '      </div>';
      html += '      <div class="sumer-reader-pane-body" style="padding: 0; background: #525659;">';
      if (pdfUrl) {
        var frameUrl = pdfUrl + '#page=' + pageNum;
        html += '        <iframe src="' + escapeHtml(frameUrl) + '" class="sumer-reader-pdf-frame" title="نسخة PDF للكتاب"></iframe>';
      } else {
        html += '        <div style="padding: 3rem; text-align: center; color: #ffffff;">';
        html += '          <div style="font-size: 2.5rem; margin-bottom: 1rem;">📄</div>';
        html += '          <p>الملف الرقمي الأصلي لهذا الكتاب قيد التجهيز على خادم المناهج.</p>';
        html += '        </div>';
      }
      html += '      </div>';
      html += '    </div>';
    }

    html += '  </div>'; // نهاية الشبكة

    html += '</div>'; // نهاية غلاف القارئ
    html += '</div>'; // نهاية الحاوية
    container.innerHTML = html;

    // ربط مستمعي الأحداث التفاعلية للقارئ
    if (typeof document !== 'undefined') {
      attachReaderEvents(bookId, pageNum, totalPages, viewMode);
    }
  }

  function attachReaderEvents(bookId, currentPage, totalPages, currentMode) {
    if (typeof document === 'undefined') return;
    var prevBtn = document.getElementById('sumer-reader-prev-btn');
    var nextBtn = document.getElementById('sumer-reader-next-btn');
    var pageInput = document.getElementById('sumer-reader-page-input');
    var modeSplit = document.getElementById('sumer-reader-mode-split');
    var modeText = document.getElementById('sumer-reader-mode-text');
    var modePdf = document.getElementById('sumer-reader-mode-pdf');
    var searchBtn = document.getElementById('sumer-reader-search-btn');
    var searchInput = document.getElementById('sumer-reader-search-input');

    function navigatePage(p) {
      if (p < 1) p = 1;
      if (totalPages !== null && p > totalPages) p = totalPages;
      window.location.hash = '#student/reader/' + encodeURIComponent(bookId) + '?page=' + p;
    }

    if (prevBtn) prevBtn.onclick = function () { navigatePage(currentPage - 1); };
    if (nextBtn) nextBtn.onclick = function () { navigatePage(currentPage + 1); };
    if (pageInput) {
      pageInput.onchange = function () {
        var val = parseInt(pageInput.value, 10) || 1;
        navigatePage(val);
      };
    }

    if (modeSplit) modeSplit.onclick = function () { store.setReaderViewMode('split'); };
    if (modeText) modeText.onclick = function () { store.setReaderViewMode('text'); };
    if (modePdf) modePdf.onclick = function () { store.setReaderViewMode('pdf'); };

    if (searchBtn && searchInput) {
      searchBtn.onclick = function () {
        var q = String(searchInput.value || '').trim();
        if (!q) return;
        var resultsBox = document.getElementById('sumer-reader-search-results');
        if (resultsBox) {
          resultsBox.style.display = 'block';
          resultsBox.innerHTML = '<div class="sumer-loading-state"><div class="sumer-spinner"></div><p>جاري البحث في فهرس الكتاب...</p></div>';
        }

        api.searchCurriculum({ bookId: bookId, query: q, limit: 10 }).then(function (res) {
          if (!resultsBox) return;
          if (res.ok && res.data && Array.isArray(res.data.results) && res.data.results.length > 0) {
            var rhtml = '<div class="sumer-card" style="background: var(--sumer-surface-2);">';
            rhtml += '<div style="font-weight: 600; margin-bottom: 0.5rem;">نتائج البحث (' + res.data.results.length + ' نتيجة مطابقة):</div>';
            rhtml += '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
            res.data.results.forEach(function (hit) {
              rhtml += '<div style="padding: 0.5rem; border-radius: var(--sumer-radius-sm); background: var(--sumer-card-bg); border: 1px solid var(--sumer-border-color);">';
              rhtml += '  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">';
              rhtml += '    <strong>صفحة ' + hit.page + '</strong>';
              rhtml += '    <button type="button" class="sumer-btn sumer-btn-outline sumer-btn-sm" onclick="window.location.hash=\'#student/reader/' + encodeURIComponent(bookId) + '?page=' + hit.page + '\'">الانتقال للصفحة</button>';
              rhtml += '  </div>';
              rhtml += '  <div style="font-size: 0.85rem; color: var(--sumer-text-secondary); line-height: 1.4;">' + escapeHtml(hit.snippet || hit.content || '') + '</div>';
              rhtml += '</div>';
            });
            rhtml += '</div></div>';
            resultsBox.innerHTML = rhtml;
          } else {
            resultsBox.innerHTML = '<div class="sumer-empty-state" style="padding: 1rem;"><p>لم يتم العثور على نتائج مطابقة لكلمة البحث في هذا الكتاب.</p></div>';
          }
        }).catch(function () {
          if (resultsBox) resultsBox.innerHTML = '<div class="sumer-error-state"><p>تعذر إتمام عملية البحث في الفهرس.</p></div>';
        });
      };
    }
  }

  // --------------------------------------------------------------------------
  // 6. الواجبات المدرسية والتسليم - Assignments (#student/assignments)
  // --------------------------------------------------------------------------
  function renderAssignments(container, student, assignments, submissionsMap) {
    assignments = assignments || [];
    submissionsMap = submissionsMap || {};

    var html = '<div class="sumer-student-container">';
    html += renderStudentHeader(student, '#student/assignments');

    html += '<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">';
    html += '  <div>';
    html += '    <h3 style="margin: 0; font-size: 1.25rem;"><span class="sumer-card-icon">' + ICONS.book + '</span>الواجبات المدرسية والتكاليف</h3>';
    html += '    <p style="margin: 0.25rem 0 0 0; color: var(--sumer-text-secondary); font-size: 0.9rem;">المهام والواجبات الموجهة إليك من معلمي صفك مع سياسة التسليم وإعادة الإرسال قبل التصحيح.</p>';
    html += '  </div>';
    html += '  <div>' + ui.renderBadge({ text: assignments.length + ' واجب', variant: assignments.length > 0 ? 'teal' : 'neutral' }) + '</div>';
    html += '</div>';

    if (assignments.length === 0) {
      html += ui.renderEmptyState({
        title: 'لا توجد واجبات معينة حالياً',
        description: 'أحسنت! لا توجد تكاليف متأخرة أو واجبات جديدة بانتظارك في الوقت الحالي.',
        icon: ICONS.check
      });
    } else {
      html += '<div style="display: flex; flex-direction: column; gap: 1.25rem;">';
      assignments.forEach(function (assn) {
        var assnId = assn._id || assn.id;
        var sub = submissionsMap[assnId] || null;
        var isGraded = sub && sub.status === 'graded';
        var isSubmitted = sub && (sub.status === 'submitted' || sub.status === 'graded');
        var dueDate = assn.dueAt ? new Date(assn.dueAt).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' }) : '—';
        var isOverdue = assn.dueAt && new Date() > new Date(assn.dueAt);

        html += '<div class="sumer-assignment-item">';
        html += '  <div class="sumer-assignment-meta">';
        html += '    <div style="display: flex; align-items: center; gap: 0.75rem;">';
        html += '      <h4 style="margin: 0; font-size: 1.15rem;">' + escapeHtml(assn.title) + '</h4>';
        if (assn.subject) {
          html += '      ' + ui.renderBadge({ text: assn.subject, variant: 'teal' });
        }
        html += '    </div>';
        html += '    <div style="display: flex; align-items: center; gap: 0.5rem;">';
        if (isGraded) {
          html += '      ' + ui.renderBadge({ text: 'تم التصحيح (' + (sub.score !== undefined ? sub.score : '—') + '/' + assn.maxScore + ')', variant: 'success' });
        } else if (isSubmitted) {
          html += '      ' + ui.renderBadge({ text: 'تم التسليم (بانتظار التصحيح)', variant: 'gold' });
        } else if (isOverdue) {
          html += '      ' + ui.renderBadge({ text: 'متأخر', variant: 'danger' });
        } else {
          html += '      ' + ui.renderBadge({ text: 'قيد الإنجاز', variant: 'neutral' });
        }
        html += '    </div>';
        html += '  </div>';

        html += '  <p style="margin: 0; font-size: 0.95rem; color: var(--sumer-text-secondary); line-height: 1.5;">' + escapeHtml(assn.description || '') + '</p>';
        html += '  <div style="font-size: 0.85rem; color: var(--sumer-text-secondary); display: flex; gap: 1rem;">';
        html += '    <div>الموعد النهائي: <strong>' + escapeHtml(dueDate) + '</strong></div>';
        html += '    <div>الدرجة القصوى: <strong>' + assn.maxScore + ' درجة</strong></div>';
        html += '  </div>';

        // صندوق حالة التسليم والتصحيح
        if (isGraded) {
          html += '  <div class="sumer-submission-graded">';
          html += '    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">';
          html += '      <strong>الدرجة المرصودة: ' + (sub.score !== undefined ? sub.score : '—') + ' من ' + assn.maxScore + '</strong>';
          html += '      <span class="sumer-badge badge-neutral">مغلق للتعديل</span>';
          html += '    </div>';
          if (sub.teacherFeedback || sub.feedback) {
            html += '    <div style="font-size: 0.9rem; color: var(--sumer-text-primary);">ملاحظات المعلم: ' + escapeHtml(sub.teacherFeedback || sub.feedback) + '</div>';
          }
          if (sub.content) {
            html += '    <div style="font-size: 0.85rem; color: var(--sumer-text-secondary); margin-top: 0.5rem;">إجابتك المسلمة: ' + escapeHtml(sub.content) + '</div>';
          }
          html += '  </div>';
        } else {
          // نموذج التسليم وإعادة الإرسال قبل التصحيح
          var subContent = sub ? (sub.content || '') : '';
          var submitLabel = isSubmitted ? 'تحديث وإعادة تسليم الواجب' : 'تسليم إجابة الواجب';

          html += '  <div class="sumer-submission-box">';
          html += '    <label for="sub-text-' + assnId + '" style="display: block; font-size: 0.9rem; font-weight: 600; margin-bottom: 0.5rem;">' + (isSubmitted ? 'تعديل الإجابة المسلمة:' : 'كتابة الإجابة أو الحل:') + '</label>';
          html += '    <textarea id="sub-text-' + assnId + '" class="sumer-textarea" rows="3" placeholder="اكتب حلك أو إجابتك هنا بوضوح..." style="margin-bottom: 0.75rem;">' + escapeHtml(subContent) + '</textarea>';
          html += '    <div style="display: flex; justify-content: flex-end;">';
          html += '      <button type="button" class="sumer-btn sumer-btn-primary sumer-btn-sm" id="sub-btn-' + assnId + '">' + escapeHtml(submitLabel) + '</button>';
          html += '    </div>';
          html += '    <div id="sub-msg-' + assnId + '" style="margin-top: 0.5rem; font-size: 0.85rem;"></div>';
          html += '  </div>';
        }

        html += '</div>'; // نهاية عنصر الواجب
      });
      html += '</div>';
    }

    html += '</div>'; // نهاية الحاوية
    container.innerHTML = html;

    // ربط أزرار تسليم الواجبات
    if (typeof document !== 'undefined') {
      assignments.forEach(function (assn) {
        var assnId = assn._id || assn.id;
        var btn = document.getElementById('sub-btn-' + assnId);
        var textEl = document.getElementById('sub-text-' + assnId);
        var msgEl = document.getElementById('sub-msg-' + assnId);

        if (btn && textEl) {
          btn.onclick = function () {
            var val = String(textEl.value || '').trim();
            if (!val) {
              if (msgEl) msgEl.innerHTML = '<span style="color: var(--sumer-danger);">يرجى كتابة نص الإجابة قبل الإرسال.</span>';
              return;
            }

            btn.disabled = true;
            if (msgEl) msgEl.innerHTML = '<span style="color: var(--sumer-text-secondary);">جاري إرسال التسليم إلى المعلم...</span>';

            api.submitAssignment(assnId, { content: val }).then(function (res) {
              btn.disabled = false;
              if (res.ok) {
                if (msgEl) msgEl.innerHTML = '<span style="color: var(--sumer-teal-600); font-weight: 600;">تم استلام وتسجيل الواجب بنجاح!</span>';
                if (res.data && res.data.submission) {
                  store.setStudentSubmission(assnId, res.data.submission);
                }
              } else {
                if (msgEl) msgEl.innerHTML = '<span style="color: var(--sumer-danger);">' + escapeHtml(res.message || 'تعذر تسليم الواجب.') + '</span>';
              }
            }).catch(function (err) {
              btn.disabled = false;
              if (msgEl) msgEl.innerHTML = '<span style="color: var(--sumer-danger);">' + escapeHtml(err.message || 'حدث خطأ في الاتصال أثناء التسليم.') + '</span>';
            });
          };
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // 7. كشف الدرجات والتقييمات - Student Grades (#student/grades)
  // --------------------------------------------------------------------------
  function renderGrades(container, student, gradesData) {
    gradesData = gradesData || {};
    var records = gradesData.records || [];
    var summary = gradesData.summary || {};
    var totalAssessments = summary.totalAssessments !== undefined ? summary.totalAssessments : records.length;
    var averageScore = summary.averageScore !== undefined && summary.averageScore !== null
      ? summary.averageScore
      : null;
    var bySubject = summary.bySubject || {};

    var avgBadgeText = averageScore !== null ? ('المعدل العام: ' + averageScore + '%') : 'المعدل العام: —';
    var avgBadgeVariant = averageScore !== null ? (averageScore >= 75 ? 'success' : (averageScore >= 50 ? 'gold' : 'danger')) : 'neutral';

    var html = '<div class="sumer-student-container">';
    html += renderStudentHeader(student, '#student/grades');

    html += '<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">';
    html += '  <div>';
    html += '    <h3 style="margin: 0; font-size: 1.25rem;"><span class="sumer-card-icon">' + ICONS.star + '</span>السجل الأكاديمي للدرجات والتقييمات</h3>';
    html += '    <p style="margin: 0.25rem 0 0 0; color: var(--sumer-text-secondary); font-size: 0.9rem;">كشف درجات الاختبارات، الشفهي، المشاركات، والواجبات المرصودة رسمياً من المعلمين.</p>';
    html += '  </div>';
    html += '  <div>' + ui.renderBadge({ text: avgBadgeText, variant: avgBadgeVariant }) + '</div>';
    html += '</div>';

    // بطاقات ملخص المواد
    var subjectKeys = Object.keys(bySubject);
    if (subjectKeys.length > 0) {
      html += '<div class="sumer-grid" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">';
      subjectKeys.forEach(function (sKey) {
        var sData = bySubject[sKey];
        var avg = sData.average !== undefined && sData.average !== null ? sData.average : null;
        var avgText = avg !== null ? (avg + '%') : '—';
        html += '<div class="sumer-card" style="padding: 1rem;">';
        html += '  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">';
        html += '    <strong>' + escapeHtml(sKey) + '</strong>';
        html += '    ' + ui.renderBadge({ text: avgText, variant: avg !== null && avg >= 75 ? 'success' : 'gold' });
        html += '  </div>';
        html += '  <div style="font-size: 0.85rem; color: var(--sumer-text-secondary);">' + sData.count + ' تقييمات مرصودة</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    if (records.length === 0) {
      html += ui.renderEmptyState({
        title: 'لا توجد درجات مرصودة حتى الآن',
        description: 'ستظهر هنا جميع نتائج الاختبارات والواجبات فور قيام أساتذة المواد برصدها.',
        icon: ICONS.star
      });
    } else {
      html += '<div class="sumer-card">';
      html += '  <div style="overflow-x: auto;">';
      html += '    <table class="sumer-table">';
      html += '      <thead>';
      html += '        <tr>';
      html += '          <th>المادة</th>';
      html += '          <th>نوع التقييم</th>';
      html += '          <th>الدرجة</th>';
      html += '          <th>النسبة</th>';
      html += '          <th>تاريخ الرصد</th>';
      html += '          <th>المعلم الراصد</th>';
      html += '          <th>الملاحظات</th>';
      html += '        </tr>';
      html += '      </thead>';
      html += '      <tbody>';
      records.forEach(function (r) {
        var pct = r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 100) : 0;
        var rDate = r.recordedAt ? new Date(r.recordedAt).toLocaleDateString('ar-IQ') : '—';
        var teacherName = (r.teacher && (r.teacher.fullName || r.teacher.username)) || 'معلم المادة';

        html += '        <tr>';
        html += '          <td><strong>' + escapeHtml(r.subject || '—') + '</strong></td>';
        html += '          <td>' + escapeHtml(r.type || '—') + '</td>';
        html += '          <td>' + r.score + ' / ' + r.maxScore + '</td>';
        html += '          <td>' + ui.renderBadge({ text: pct + '%', variant: pct >= 75 ? 'success' : (pct >= 50 ? 'gold' : 'danger') }) + '</td>';
        html += '          <td style="font-size: 0.85rem; color: var(--sumer-text-secondary);">' + escapeHtml(rDate) + '</td>';
        html += '          <td>' + escapeHtml(teacherName) + '</td>';
        html += '          <td style="font-size: 0.85rem; color: var(--sumer-text-secondary);">' + escapeHtml(r.feedback || '—') + '</td>';
        html += '        </tr>';
      });
      html += '      </tbody>';
      html += '    </table>';
      html += '  </div>';
      html += '</div>';
    }

    html += '</div>'; // نهاية الحاوية
    container.innerHTML = html;
  }

  // --------------------------------------------------------------------------
  // 8. سجل الحضور والغياب - Student Attendance (#student/attendance)
  // عدم وجود سجلات لا يعني 100% حضور (Zero Fake 100% Attendance)
  // --------------------------------------------------------------------------
  function renderAttendance(container, student, attendanceData) {
    attendanceData = attendanceData || {};
    var records = attendanceData.records || [];
    var summary = attendanceData.summary || {};
    var total = summary.total !== undefined ? summary.total : records.length;
    var present = summary.present || 0;
    var absent = summary.absent || 0;
    var late = summary.late || 0;
    var excused = summary.excused || 0;
    var attendanceRate = total > 0
      ? (summary.attendanceRate !== undefined && summary.attendanceRate !== null ? summary.attendanceRate : Math.round(((present + late + excused) / total) * 100))
      : null;

    var rateBadgeText = attendanceRate !== null ? ('نسبة الالتزام: ' + attendanceRate + '%') : 'نسبة الالتزام: —';
    var rateBadgeVariant = attendanceRate !== null ? (attendanceRate >= 85 ? 'success' : 'gold') : 'neutral';

    var html = '<div class="sumer-student-container">';
    html += renderStudentHeader(student, '#student/attendance');

    html += '<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">';
    html += '  <div>';
    html += '    <h3 style="margin: 0; font-size: 1.25rem;"><span class="sumer-card-icon">' + ICONS.check + '</span>سجل الحضور والغياب المدرسي</h3>';
    html += '    <p style="margin: 0.25rem 0 0 0; color: var(--sumer-text-secondary); font-size: 0.9rem;">متابعة دقيقة لانضباط الطالب وحضوره في الحصص المباشرة والأنشطة الصفية.</p>';
    html += '  </div>';
    html += '  <div>' + ui.renderBadge({ text: rateBadgeText, variant: rateBadgeVariant }) + '</div>';
    html += '</div>';

    // بطاقات الإحصاء السريع للحضور
    html += '<div class="sumer-kpi-grid" style="margin-bottom: 1.5rem;">';
    html += '  <div class="sumer-kpi-card">';
    html += '    <div class="sumer-kpi-icon" style="background-color: var(--sumer-teal-50); color: var(--sumer-teal-600);">' + ICONS.check + '</div>';
    html += '    <div><div class="sumer-kpi-val">' + present + '</div><div class="sumer-kpi-label">حضور مؤكد</div></div>';
    html += '  </div>';
    html += '  <div class="sumer-kpi-card">';
    html += '    <div class="sumer-kpi-icon" style="background-color: #fdf2f2; color: #ef4444;">⚠️</div>';
    html += '    <div><div class="sumer-kpi-val">' + absent + '</div><div class="sumer-kpi-label">غياب غير مبرر</div></div>';
    html += '  </div>';
    html += '  <div class="sumer-kpi-card">';
    html += '    <div class="sumer-kpi-icon" style="background-color: var(--sumer-gold-50); color: var(--sumer-gold-600);">' + ICONS.clock + '</div>';
    html += '    <div><div class="sumer-kpi-val">' + late + '</div><div class="sumer-kpi-label">تأخر عن الحصة</div></div>';
    html += '  </div>';
    html += '  <div class="sumer-kpi-card">';
    html += '    <div class="sumer-kpi-icon" style="background-color: var(--sumer-surface-2); color: var(--sumer-text-secondary);">🛡️</div>';
    html += '    <div><div class="sumer-kpi-val">' + excused + '</div><div class="sumer-kpi-label">غياب بإجازة مبررة</div></div>';
    html += '  </div>';
    html += '</div>';

    if (records.length === 0) {
      html += ui.renderEmptyState({
        title: 'لا توجد سجلات حضور مسجلة حتى الآن',
        description: 'سيتم توثيق الحضور والغياب مع انطلاق الجلسات الصفية اليومية.',
        icon: ICONS.check
      });
    } else {
      html += '<div class="sumer-card">';
      html += '  <div style="overflow-x: auto;">';
      html += '    <table class="sumer-table">';
      html += '      <thead>';
      html += '        <tr>';
      html += '          <th>التاريخ</th>';
      html += '          <th>المادة / الحصة</th>';
      html += '          <th>حالة الحضور</th>';
      html += '          <th>المعلم الراصد</th>';
      html += '          <th>الملاحظات أو العذر</th>';
      html += '        </tr>';
      html += '      </thead>';
      html += '      <tbody>';
      records.forEach(function (r) {
        var rDate = r.date ? new Date(r.date).toLocaleDateString('ar-IQ') : '—';
        var teacherName = (r.teacher && (r.teacher.fullName || r.teacher.username)) || 'معلم الحصة';
        var badgeVariant = 'neutral';
        var badgeText = 'حاضر';
        if (r.status === 'present') { badgeVariant = 'success'; badgeText = 'حاضر'; }
        else if (r.status === 'absent') { badgeVariant = 'danger'; badgeText = 'غائب'; }
        else if (r.status === 'late') { badgeVariant = 'gold'; badgeText = 'متأخر'; }
        else if (r.status === 'excused') { badgeVariant = 'teal'; badgeText = 'مجاز'; }

        html += '        <tr>';
        html += '          <td style="font-weight: 600;">' + escapeHtml(rDate) + '</td>';
        html += '          <td>' + escapeHtml(r.subject || 'حصة عامة') + '</td>';
        html += '          <td>' + ui.renderBadge({ text: badgeText, variant: badgeVariant }) + '</td>';
        html += '          <td>' + escapeHtml(teacherName) + '</td>';
        html += '          <td style="font-size: 0.85rem; color: var(--sumer-text-secondary);">' + escapeHtml(r.notes || '—') + '</td>';
        html += '        </tr>';
      });
      html += '      </tbody>';
      html += '    </table>';
      html += '  </div>';
      html += '</div>';
    }

    html += '</div>'; // نهاية الحاوية
    container.innerHTML = html;
  }

  // --------------------------------------------------------------------------
  // 9. مسار التقدم الأكاديمي - Student Progress (#student/progress)
  // --------------------------------------------------------------------------
  function renderProgress(container, student, progressData) {
    progressData = progressData || {};
    var subjectProgress = progressData.subjectProgress || [];
    var learningRecords = progressData.learningRecords || [];

    var html = '<div class="sumer-student-container">';
    html += renderStudentHeader(student, '#student/progress');

    html += '<div style="margin-bottom: 1.5rem;">';
    html += '  <h3 style="margin: 0; font-size: 1.25rem;"><span class="sumer-card-icon">' + ICONS.cuneiform + '</span>خارطة مسار التقدم التعليمي</h3>';
    html += '  <p style="margin: 0.25rem 0 0 0; color: var(--sumer-text-secondary); font-size: 0.9rem;">تحليل الإنجاز الأكاديمي، الحصص المكتملة، والأسئلة التعليمية التفاعلية المجاب عليها.</p>';
    html += '</div>';

    if (subjectProgress.length === 0 && learningRecords.length === 0) {
      html += ui.renderEmptyState({
        title: 'لا تتوفر بيانات تقدم بعد',
        description: 'ستبدأ مؤشرات التقدم بالتراكم فور إكمال أول حصة دراسية أو حل تمارين المنهاج.',
        icon: ICONS.cuneiform
      });
    } else {
      html += '<div class="sumer-grid" style="grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; margin-bottom: 2rem;">';
      subjectProgress.forEach(function (sp) {
        var completedSessions = sp.completedSessions !== undefined ? sp.completedSessions : 0;
        var learningQuestions = sp.learningQuestions !== undefined ? sp.learningQuestions : 0;
        var gradesCount = sp.gradesCount !== undefined ? sp.gradesCount : 0;

        html += '<div class="sumer-card">';
        html += '  <div class="sumer-card-header">';
        html += '    <h4 class="sumer-card-title">' + escapeHtml(sp.subject || '—') + '</h4>';
        html += '    ' + ui.renderBadge({ text: completedSessions + ' حصص مكتملة', variant: completedSessions > 0 ? 'teal' : 'neutral' });
        html += '  </div>';
        html += '  <div class="sumer-card-body">';
        html += '    <div style="font-size: 0.85rem; color: var(--sumer-text-secondary); display: flex; flex-direction: column; gap: 0.35rem;">';
        html += '      <div>التمارين والأسئلة المجابة: <strong>' + learningQuestions + '</strong></div>';
        html += '      <div>التقييمات المرصودة: <strong>' + gradesCount + '</strong></div>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>'; // نهاية الحاوية
    container.innerHTML = html;
  }

  // --------------------------------------------------------------------------
  // 10. الجدول الدراسي والحصص - Schedule & Classes (#student/schedule)
  // --------------------------------------------------------------------------
  function renderSchedule(container, student, schedules) {
    schedules = schedules || [];

    var html = '<div class="sumer-student-container">';
    html += renderStudentHeader(student, '#student/schedule');

    html += '<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">';
    html += '  <div>';
    html += '    <h3 style="margin: 0; font-size: 1.25rem;"><span class="sumer-card-icon">' + ICONS.calendar + '</span>الجدول الدراسي ومواعيد الحصص</h3>';
    html += '    <p style="margin: 0.25rem 0 0 0; color: var(--sumer-text-secondary); font-size: 0.9rem;">مواعيد الحصص المباشرة، جلسات المراجعة، والاختبارات الأسبوعية.</p>';
    html += '  </div>';
    html += '  <div>' + ui.renderBadge({ text: schedules.length + ' حصة مجدولة', variant: schedules.length > 0 ? 'teal' : 'neutral' }) + '</div>';
    html += '</div>';

    if (schedules.length === 0) {
      html += ui.renderEmptyState({
        title: 'لا توجد حصص مجدولة حالياً',
        description: 'سيقوم المعلمون أو إدارة المدرسة بنشر جدول المواعيد الرسمي هنا.',
        icon: ICONS.calendar
      });
    } else {
      html += '<div style="display: flex; flex-direction: column; gap: 1rem;">';
      schedules.forEach(function (sch) {
        var schDate = sch.scheduledAt ? new Date(sch.scheduledAt).toLocaleString('ar-IQ', { dateStyle: 'full', timeStyle: 'short' }) : '—';
        var code = sch.classroomCode || sch._id;

        html += '<div class="sumer-card" style="padding: 1.25rem;">';
        html += '  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">';
        html += '    <div>';
        html += '      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">';
        html += '        <h4 style="margin: 0; font-size: 1.15rem;">' + escapeHtml(sch.title || sch.subject || 'درس تفاعلي') + '</h4>';
        if (sch.subject) {
          html += '        ' + ui.renderBadge({ text: sch.subject, variant: 'teal' });
        }
        html += '      </div>';
        html += '      <div style="font-size: 0.9rem; color: var(--sumer-text-secondary);">' + escapeHtml(schDate) + '</div>';
        html += '    </div>';
        html += '    <div style="display: flex; align-items: center; gap: 0.5rem;">';
        if (sch.type) {
          html += '      ' + ui.renderBadge({ text: sch.type, variant: 'gold' });
        }
        if (code) {
          html += '      <a href="#classroom/live/' + encodeURIComponent(code) + '" class="sumer-btn sumer-btn-primary sumer-btn-sm">دخول الصف المباشر</a>';
        }
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>'; // نهاية الحاوية
    container.innerHTML = html;
  }

  // --------------------------------------------------------------------------
  // 11. غرفة الصف المباشرة الذكية - Live & Virtual Classroom (#classroom/live/:code)
  // (Privacy First: Camera & Mic strictly OFF by default; zero media auto-start)
  // --------------------------------------------------------------------------
  function renderClassroom(container, code, student, isVirtual) {
    code = code || 'room';
    var isAI = Boolean(isVirtual);

    var html = '<div class="sumer-student-container">';
    html += '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">';
    html += '  <div style="display: flex; align-items: center; gap: 0.75rem;">';
    html += '    <a href="#student/schedule" class="sumer-btn sumer-btn-outline sumer-btn-sm">‹ مغادرة الصف</a>';
    html += '    <h3 style="margin: 0; font-size: 1.25rem;">' + (isAI ? 'الصف الافتراضي الذكي' : 'الصف الدراسي المباشر') + ' (رمز: ' + escapeHtml(code) + ')</h3>';
    html += '  </div>';
    html += '  <div>' + ui.renderBadge({ text: isAI ? 'AI Persona' : 'WebRTC Star', variant: isAI ? 'gold' : 'teal' }) + '</div>';
    html += '</div>';

    html += '<div class="sumer-classroom-stage">';
    html += '  <div class="sumer-classroom-video-area" id="sumer-video-area">';
    html += '    <div style="text-align: center; padding: 2rem;">';
    html += '      <div style="font-size: 3rem; margin-bottom: 1rem;">' + (isAI ? '🤖' : '🏛️') + '</div>';
    html += '      <h3 style="margin: 0 0 0.5rem 0;">' + (isAI ? 'المعلم الذكي بانتظارك' : 'البث المباشر للصف التفاعلي') + '</h3>';
    html += '      <p style="margin: 0; color: #94a3b8; font-size: 0.95rem;">الكاميرا والميكروفون مغلقان تلقائياً لضمان خصوصيتك وأمانك.</p>';
    html += '    </div>';
    html += '  </div>';

    // شريط أدوات الصف
    html += '  <div class="sumer-classroom-bar">';
    html += '    <div class="sumer-classroom-controls">';
    html += '      <button type="button" id="sumer-ctrl-mic" class="sumer-btn sumer-btn-sm sumer-device-badge-off">المايكروفون: مغلق</button>';
    html += '      <button type="button" id="sumer-ctrl-cam" class="sumer-btn sumer-btn-sm sumer-device-badge-off">الكاميرا: مغلقة</button>';
    html += '      <button type="button" id="sumer-ctrl-hand" class="sumer-btn sumer-btn-outline sumer-btn-sm" style="color: #ffffff; border-color: rgba(255,255,255,0.3);">✋ رفع اليد للمشاركة</button>';
    html += '    </div>';
    html += '    <div>';
    html += '      <a href="#student/schedule" class="sumer-btn sumer-btn-danger sumer-btn-sm">إنهاء والمغادرة</a>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    html += '</div>'; // نهاية الحاوية
    container.innerHTML = html;

    // ربط أحداث التحكم بالوسائط مع ضمان الخصوصية
    attachClassroomEvents(code);
  }

  function attachClassroomEvents(code) {
    if (typeof document === 'undefined') return;
    var micBtn = document.getElementById('sumer-ctrl-mic');
    var camBtn = document.getElementById('sumer-ctrl-cam');
    var handBtn = document.getElementById('sumer-ctrl-hand');

    if (micBtn) {
      micBtn.onclick = function () {
        localClassroomState.micEnabled = !localClassroomState.micEnabled;
        if (localClassroomState.micEnabled) {
          micBtn.className = 'sumer-btn sumer-btn-sm sumer-device-badge-on';
          micBtn.innerText = 'المايكروفون: مفعل';
        } else {
          micBtn.className = 'sumer-btn sumer-btn-sm sumer-device-badge-off';
          micBtn.innerText = 'المايكروفون: مغلق';
        }
      };
    }

    if (camBtn) {
      camBtn.onclick = function () {
        localClassroomState.cameraEnabled = !localClassroomState.cameraEnabled;
        if (localClassroomState.cameraEnabled) {
          camBtn.className = 'sumer-btn sumer-btn-sm sumer-device-badge-on';
          camBtn.innerText = 'الكاميرا: مفعلة';
        } else {
          camBtn.className = 'sumer-btn sumer-btn-sm sumer-device-badge-off';
          camBtn.innerText = 'الكاميرا: مغلقة';
        }
      };
    }

    if (handBtn) {
      handBtn.onclick = function () {
        localClassroomState.handRaised = !localClassroomState.handRaised;
        if (localClassroomState.handRaised) {
          handBtn.innerText = '✋ اليد مرفوعة (بانتظار الإذن)';
          handBtn.style.borderColor = 'var(--sumer-gold-400)';
        } else {
          handBtn.innerText = '✋ رفع اليد للمشاركة';
          handBtn.style.borderColor = 'rgba(255,255,255,0.3)';
        }
      };
    }
  }


  function renderAlerts(container,student,data){
    var n=(data&&data.notifications)||[], r=(data&&data.relationshipRequests)||[], schedules=(data&&data.schedules)||[];
    var html='<div class="sumer-student-container">'+renderStudentHeader(student,'#student/alerts');
    html+='<div class="sumer-grid"><section class="sumer-card"><div class="sumer-card-header"><h3>التنبيهات والإنذارات</h3></div><div class="sumer-card-body">';
    html+=n.length?n.map(function(x){return '<div class="sumer-alert"><strong>'+escapeHtml(x.title)+'</strong><p>'+escapeHtml(x.message)+'</p></div>';}).join(''):ui.renderEmptyState({title:'لا توجد إنذارات',description:'ستظهر هنا تنبيهات الغياب والتوجيهات.',icon:ICONS.alert});
    html+='</div></section><section class="sumer-card"><div class="sumer-card-header"><h3>الامتحانات والمراجعات</h3></div><div class="sumer-card-body">';
    var exams=schedules.filter(function(x){return x.type==='EXAM'||x.type==='GENERAL_REVIEW';});
    html+=exams.length?exams.map(function(x){return '<div><b>'+escapeHtml(x.title)+'</b><p>'+escapeHtml(x.subject||'')+' · '+escapeHtml(x.scheduledAt?new Date(x.scheduledAt).toLocaleString('ar-IQ'):'')+'</p><small>'+escapeHtml(x.description||'')+'</small></div>';}).join('<hr>'):ui.renderEmptyState({title:'لا توجد امتحانات قادمة',description:'يظهر هنا ما يحدده المعلم.',icon:ICONS.calendar});
    html+='</div></section><section class="sumer-card"><div class="sumer-card-header"><h3>موافقات ولي الأمر</h3></div><div class="sumer-card-body">'+(r.length?r.map(function(x){return '<div><b>'+escapeHtml(x.kind==='REMOVE'?'طلب انسحاب/فك ارتباط':'طلب إضافة معلم')+'</b><p>'+escapeHtml(x.status)+'</p></div>';}).join(''): 'لا توجد طلبات')+'</div></section></div></div>';container.innerHTML=html;
  }
  function renderWhiteboards(container,student,boards){
    var html='<div class="sumer-student-container">'+renderStudentHeader(student,'#student/whiteboards')+'<section class="sumer-card"><div class="sumer-card-header"><h3>السبورات الذكية المحفوظة</h3></div><div class="sumer-card-body">';
    html+=boards.length?boards.map(function(b){return '<article style="padding:1rem;border:1px solid var(--sumer-border-color);border-radius:12px;margin-bottom:.75rem"><b>'+escapeHtml(b.title)+'</b><p>'+escapeHtml([b.subject,b.lesson,b.grade,b.section&&('شعبة '+b.section)].filter(Boolean).join(' · '))+'</p><div style="white-space:pre-wrap">'+escapeHtml(b.notes||'')+'</div></article>';}).join(''):ui.renderEmptyState({title:'لا توجد سبورات منشورة',description:'عندما يشارك المعلم سبورته ستظهر هنا.',icon:'🧠'});
    html+='</div></section></div>';container.innerHTML=html;
  }

  // --------------------------------------------------------------------------
  // الموجه الرئيسي لمساحة الطالب - Main Dispatcher
  // --------------------------------------------------------------------------
  function render(routeKey, container) {
    if (!container) return;
    routeKey = routeKey || '#student/overview';

    var rawHash = (typeof window !== 'undefined' && window.location && window.location.hash) || routeKey;
    var hashParts = rawHash.split('?');
    var mainRoute = hashParts[0];
    var queryString = hashParts[1] || '';

    // تحليل معلمات الاستعلام
    var queryParams = {};
    if (queryString) {
      queryString.split('&').forEach(function (param) {
        var parts = param.split('=');
        if (parts[0]) queryParams[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
      });
    }

    // عرض حالة التحميل النظيفة
    container.innerHTML = ui.renderLoadingState('جاري تحميل بيانات مساحة الطالب الأكاديمية...');

    // استرجاع سجل الطالب الدائم ومعلومات الحساب
    api.getStudentRecord('me').then(function (recordRes) {
      var record = (recordRes.ok && recordRes.data && recordRes.data.record) || null;
      var student = (record && record.student) || (store.getState() && store.getState().student && store.getState().student.profile) || {};

      // معالجة المسارات المختلفة
      if (mainRoute === '#student/overview') {
        renderOverview(container, record);
      } else if (mainRoute === '#student/profile') {
        renderProfile(container, record);
      } else if (mainRoute === '#student/teachers') {
        Promise.all([
          api.getRealTeachers({ stage: student.stage, grade: student.grade }),
          api.getVirtualProfiles()
        ]).then(function (responses) {
          var realTeachers = (responses[0].ok && responses[0].data && responses[0].data.teachers) || (student.assignedTeachers || []);
          var virtualProfiles = responses[1].profiles || (responses[1].data && responses[1].data.profiles) || [];
          renderTeachers(container, student, realTeachers, virtualProfiles);
        }).catch(function () {
          renderTeachers(container, student, student.assignedTeachers || [], []);
        });
      } else if (mainRoute === '#student/curriculum') {
        api.getCatalog({ stage: student.stage, grade: student.grade }).then(function (catRes) {
          var books = (catRes.ok && catRes.data && catRes.data.catalog) || [];
          renderCurriculum(container, student, books);
        }).catch(function () {
          renderCurriculum(container, student, []);
        });
      } else if (mainRoute.indexOf('#student/reader') === 0 || mainRoute.indexOf('#curriculum/reader') === 0) {
        var bookId = mainRoute.split('/reader/')[1] || queryParams.bookId || '';
        if (!bookId) {
          container.innerHTML = ui.renderEmptyState({
            title: 'لم يتم تحديد كتاب للقراءة',
            description: 'يرجى اختيار كتاب من قائمة المناهج الدراسية لفتحه في القارئ المزدوج.',
            icon: ICONS.book,
            action: '<a href="#student/curriculum" class="sumer-btn sumer-btn-primary">استعراض كتب مرحلتي</a>'
          });
          return;
        }

        var pageNum = parseInt(queryParams.page, 10) || 1;
        var viewMode = store.getState() && store.getState().curriculum && store.getState().curriculum.dualViewMode;

        Promise.all([
          api.getBookReader(bookId),
          api.getBookPage(bookId, pageNum)
        ]).then(function (results) {
          var bookData = (results[0].ok && results[0].data && results[0].data.book) || {};
          var pageData = (results[1].ok && results[1].data && results[1].data.pageData) || {};
          renderReader(container, student, bookId, pageNum, bookData, pageData, viewMode);
        }).catch(function () {
          renderReader(container, student, bookId, pageNum, {}, {}, viewMode);
        });
      } else if (mainRoute === '#student/assignments') {
        Promise.all([
          api.getAssignments({ stage: student.stage, grade: student.grade }),
          Promise.resolve((record && record.submissions) || [])
        ]).then(function (results) {
          var assns = (results[0].ok && results[0].data && results[0].data.assignments) || [];
          var subs = results[1] || [];
          var subsMap = {};
          subs.forEach(function (s) {
            var aId = (s.assignment && (s.assignment._id || s.assignment)) || s.assignment;
            subsMap[aId] = s;
          });
          renderAssignments(container, student, assns, subsMap);
        }).catch(function () {
          renderAssignments(container, student, [], {});
        });
      } else if (mainRoute === '#student/grades') {
        api.getStudentGrades('me').then(function (gradesRes) {
          var gradesData = (gradesRes.ok && gradesRes.data) || { records: (record && record.gradeRecords) || [], summary: {} };
          renderGrades(container, student, gradesData);
        }).catch(function () {
          renderGrades(container, student, { records: (record && record.gradeRecords) || [], summary: {} });
        });
      } else if (mainRoute === '#student/attendance') {
        api.getStudentAttendance('me').then(function (attRes) {
          var attData = (attRes.ok && attRes.data) || { records: (record && record.attendanceRecords) || [], summary: {} };
          renderAttendance(container, student, attData);
        }).catch(function () {
          renderAttendance(container, student, { records: (record && record.attendanceRecords) || [], summary: {} });
        });
      } else if (mainRoute === '#student/progress') {
        api.getStudentProgress('me').then(function (progRes) {
          var progData = (progRes.ok && progRes.data) || {};
          renderProgress(container, student, progData);
        }).catch(function () {
          renderProgress(container, student, {});
        });
      } else if (mainRoute === '#student/alerts') {
        api.request('/api/school/management/student-dashboard').then(function(x){renderAlerts(container,student,(x.ok&&x.data)||{});}).catch(function(){renderAlerts(container,student,record||{});});
      } else if (mainRoute === '#student/whiteboards') {
        api.request('/api/school/management/whiteboards').then(function(x){renderWhiteboards(container,student,(x.ok&&x.whiteboards)||[]);}).catch(function(){renderWhiteboards(container,student,[]);});
      } else if (mainRoute === '#student/schedule' || mainRoute === '#student/classes') {
        api.getSchedules({ stage: student.stage, grade: student.grade }).then(function (schRes) {
          var schedules = (schRes.ok && schRes.data && schRes.data.schedules) || (record && record.schedules) || [];
          renderSchedule(container, student, schedules);
        }).catch(function () {
          renderSchedule(container, student, (record && record.schedules) || []);
        });
      } else if (mainRoute.indexOf('#classroom/live') === 0) {
        var code = mainRoute.split('/live/')[1] || '';
        renderClassroom(container, code, student, false);
      } else if (mainRoute.indexOf('#classroom/virtual') === 0) {
        var vcode = mainRoute.split('/virtual/')[1] || '';
        renderClassroom(container, vcode, student, true);
      } else {
        renderOverview(container, record);
      }
    }).catch(function (err) {
      container.innerHTML = ui.renderErrorState(
        'تعذر تحميل مساحة الطالب',
        err.message || 'يرجى التأكد من تسجيل الدخول بحساب طالب نشط والاتصال بالخادم.',
        '<a href="#auth/login" class="sumer-btn sumer-btn-primary">تسجيل الدخول</a>'
      );
    });
  }

  return {
    render: render,
    renderStudentHeader: renderStudentHeader,
    renderOverview: renderOverview,
    renderProfile: renderProfile,
    renderTeachers: renderTeachers,
    renderCurriculum: renderCurriculum,
    renderReader: renderReader,
    renderAssignments: renderAssignments,
    renderGrades: renderGrades,
    renderAttendance: renderAttendance,
    renderProgress: renderProgress,
    renderSchedule: renderSchedule,
    renderClassroom: renderClassroom,
    renderAlerts: renderAlerts,
    renderWhiteboards: renderWhiteboards
  };
}));
