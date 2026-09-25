/**
 * view-guest.js - واجهة بوابة الاستقبال العامة والتسجيل لمدرسة سومر (SumerGuestView)
 * Covers routes: #welcome, #guest, #auth/login, #auth/register-student, #auth/apply-teacher, #curriculum
 *
 * Principles:
 * - Real Iraqi curriculum catalog (108 books)
 * - Real 30-day trial status computed server-side
 * - Real teacher application submission & 409 conflict handling
 * - Real auth via POST /api/auth/signin & context fetch
 * - Transparent AI teacher personas (Sarah, Ali, Mariam)
 * - Zero fake statistics or invented numbers
 * - Strict privacy: cameras and mics off by default
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../sumer-state'),
      require('../sumer-api'),
      require('../sumer-ui')
    );
  } else {
    var view = factory(root.SumerStore, root.SumerAPI, root.SumerUI);
    root.SumerGuestView = view;
    root.ViewGuest = view;
  }
}(typeof self !== 'undefined' ? self : this, function (SumerStore, SumerAPI, SumerUI) {
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

  function formatDateArabic(dateStr) {
    if (!dateStr) return 'غير محدد';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString('ar-IQ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (_) {
      return String(dateStr);
    }
  }

  // المراحل والصفوف المعتمدة في جمهورية العراق وفق الكتالوج الرسمي
  var CURRICULUM_STAGES = {
    'ابتدائي': {
      grades: ['الأول ابتدائي', 'الثاني ابتدائي', 'الثالث ابتدائي', 'الرابع ابتدائي', 'الخامس ابتدائي', 'السادس ابتدائي'],
      subjects: ['القراءة', 'الرياضيات', 'التربية الإسلامية', 'العلوم', 'اللغة الإنكليزية', 'اللغة العربية', 'الاجتماعيات']
    },
    'متوسط': {
      grades: ['الأول متوسط', 'الثاني متوسط', 'الثالث متوسط'],
      subjects: ['اللغة العربية', 'الرياضيات', 'التربية الإسلامية', 'الأحياء', 'الفيزياء', 'الكيمياء', 'اللغة الإنكليزية', 'الاجتماعيات', 'الحاسوب']
    },
    'إعدادي': {
      grades: ['الرابع العلمي', 'الرابع الأدبي', 'الخامس العلمي', 'الخامس الأدبي', 'السادس العلمي', 'السادس الأدبي'],
      subjects: ['اللغة العربية', 'الرياضيات', 'التربية الإسلامية', 'الأحياء', 'الفيزياء', 'الكيمياء', 'اللغة الإنكليزية', 'الحاسوب', 'التاريخ', 'الجغرافية', 'الاقتصاد', 'علم الاجتماع', 'الفلسفة وعلم النفس']
    }
  };

  // المعلمون الافتراضيون المعتمدون بنظام الذكاء الاصطناعي (مع شارة صريحة ودقيقة)
  var CANONICAL_VIRTUAL_TEACHERS = [
    {
      profileId: 'sarah-smart',
      name: 'أ. سارة الذكية',
      label: 'معلم افتراضي / AI',
      role: 'مساعدة ذكية تفاعلية',
      title: 'معلمة ذكاء اصطناعي متخصصة في العلوم والرياضيات وتنمية مهارات التفكير التحليلي',
      specialties: ['الرياضيات', 'العلوم', 'الكيمياء', 'الفيزياء'],
      avatarInitial: 'س'
    },
    {
      profileId: 'ali-wise',
      name: 'أ. علي الحكيم',
      label: 'معلم افتراضي / AI',
      role: 'مساعد ذكي تفاعلي',
      title: 'معلم ذكاء اصطناعي متخصص في اللغة العربية، قواعد النحو، والبلاغة والتربية الإسلامية',
      specialties: ['اللغة العربية', 'القراءة', 'التربية الإسلامية'],
      avatarInitial: 'ع'
    },
    {
      profileId: 'mariam-nour',
      name: 'أ. مريم النور',
      label: 'معلمة افتراضية / AI',
      role: 'مساعدة ذكية تفاعلية',
      title: 'معلمة ذكاء اصطناعي متخصصة في الاجتماعيات، الجغرافيا، والتاريخ العراقي الأصيل',
      specialties: ['الاجتماعيات', 'التاريخ', 'الجغرافيا'],
      avatarInitial: 'م'
    }
  ];

  var SumerGuestView = {
    // ------------------------------------------------------------------------
    // 1. واجهة الترحيب العامة (#welcome)
    // ------------------------------------------------------------------------
    renderWelcome: function (state) {
      state = state || SumerStore.getState();
      var isAuth = state.auth && state.auth.isAuthenticated;
      var user = state.auth && state.auth.user;

      var html = '<div class="sumer-welcome-view">';

      // قسم الهيرو السومري
      html += '  <section class="sumer-hero" aria-labelledby="welcome-hero-title">';
      html += '    <div class="sumer-hero-cuneiform-accent" aria-hidden="true">𒀭</div>';
      html += '    <div class="sumer-hero-badge">';
      html += '      <span aria-hidden="true">✦</span> منظومة التعليم المدرسي الموحد وفق المنهج العراقي الرسمي';
      html += '    </div>';

      html += '    <h1 class="sumer-hero-title" id="welcome-hero-title">';
      html += '      مرحباً بكم في <span class="sumer-hero-title-highlight">مدرسة سومر الأهلية الإلكترونية</span>';
      html += '    </h1>';

      html += '    <p class="sumer-hero-subtitle">';
      html += '      صرح رقمي تعليمي متكامل يجمع عراقة بلاد الرافدين بأحدث تقنيات التعليم التفاعلي. كتب دراسية رسمية معتمدة، فصول حية مباشرة، معلمون أكفاء، ومساعدون أذكياء لدعم مسار الطالب الأكاديمي بأعلى معايير الخصوصية والأمان.';
      html += '    </p>';

      // أزرار الإجراءات السريعة — تبقى ثابتة عند الرجوع إلى #welcome
      // لا نخفي إجراءات البوابة لمجرد أن جلسة شنو منو أصبحت موثقة.
      html += '    <div class="sumer-hero-actions">';
      html += '      <a href="#auth/register-student" class="sumer-btn sumer-btn-gold" id="btn-hero-register">';
      html += isAuth ? '        تسجيل طالب جديد' : '        تسجيل طالب جديد (تجربة 30 يوماً مجاناً)';
      html += '      </a>';
      html += '      <a href="#curriculum" class="sumer-btn sumer-btn-outline" style="border-color: rgba(255,255,255,0.4); color: #ffffff;">';
      html += '        استعراض المنهج العراقي (108 كتب)';
      html += '      </a>';
      if (isAuth && state.schoolContext && state.schoolContext.isTeacher) {
        html += '      <a href="#teacher/overview" class="sumer-btn sumer-btn-secondary" style="background: rgba(255,255,255,0.15); color: #ffffff;">لوحة المعلم</a>';
      } else if (isAuth && state.schoolContext && state.schoolContext.isGuardian) {
        html += '      <a href="#guardian/overview" class="sumer-btn sumer-btn-secondary" style="background: rgba(255,255,255,0.15); color: #ffffff;">لوحة ولي الأمر</a>';
      } else if (isAuth && state.schoolContext && state.schoolContext.isStudent) {
        html += '      <a href="#student/overview" class="sumer-btn sumer-btn-secondary" style="background: rgba(255,255,255,0.15); color: #ffffff;">لوحة الطالب</a>';
      } else if (isAuth && state.schoolContext && (state.schoolContext.isManager || state.schoolContext.isDeveloper)) {
        html += '      <a href="#admin/overview" class="sumer-btn sumer-btn-secondary" style="background: rgba(255,255,255,0.15); color: #ffffff;">دخول المنصة</a>';
      } else {
        html += '      <a href="#auth/login" class="sumer-btn sumer-btn-secondary" style="background: rgba(255,255,255,0.15); color: #ffffff;">دخول المنصة</a>';
      }
      html += '      <a href="#auth/apply-teacher" class="sumer-btn sumer-btn-outline" style="border-color: var(--sumer-gold-400); color: var(--sumer-gold-300);">طلب انضمام كمعلم</a>';
      if (isAuth) {
        html += '      <span class="sumer-welcome-user" style="color: var(--sumer-gold-300); font-size: var(--sumer-font-sm);">أهلاً بك، ' + escapeHtml(user ? user.fullName : 'عضو مدرستنا') + '</span>';
      }
      html += '    </div>';

      // ميزات الصدق والشفافية
      html += '    <div class="sumer-hero-pills">';
      html += '      <span class="sumer-hero-pill">✓ 108 كتب رقمية رسمية من وزارة التربية العراقية</span>';
      html += '      <span class="sumer-hero-pill">✓ فترة تجربة مجانية كاملة لمدة 30 يوماً</span>';
      html += '      <span class="sumer-hero-pill">✓ خصوصية تامة: الكاميرا والمايكروفون مغلقان دائماً وافتراضياً</span>';
      html += '      <span class="sumer-hero-pill">✓ موافقات ولي الأمر السبع الصريحة</span>';
      html += '    </div>';
      html += '  </section>';

      // قسم بطاقات الخدمات الحقيقية
      html += '  <section class="sumer-services-section" aria-labelledby="services-title">';
      html += '    <div class="sumer-section-title-wrap">';
      html += '      <h2 class="sumer-section-title" id="services-title">خدمات البيئة التعليمية الموحدة</h2>';
      html += '      <p class="sumer-section-desc">مكونات تعليمية أصيلة مبنية لخدمة الطالب العراقي والمعلم وولي الأمر دون إحصائيات وهمية</p>';
      html += '    </div>';

      html += '    <div class="sumer-services-grid">';

      // 1. المنهج العراقي الرسمي
      html += '      <div class="sumer-service-card">';
      html += '        <div class="sumer-service-icon">';
      html += '          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>';
      html += '        </div>';
      html += '        <h3 class="sumer-service-title">المنهج العراقي الرسمي المعتمد</h3>';
      html += '        <p class="sumer-service-desc">كتالوج رقمي أصيل يضم 108 كتب دراسية معتمدة لكافة المراحل: الابتدائي (6 صفوف)، المتوسط (3 صفوف)، والإعدادي (علمي وأدبي) لعام 2026 - 2027.</p>';
      html += '        <div class="sumer-service-footer">';
      html += '          <a href="#curriculum" class="sumer-btn sumer-btn-outline sumer-btn-sm" style="width: 100%;">استعراض مكتبة الكتب</a>';
      html += '        </div>';
      html += '      </div>';

      // 2. الفصول الحية المباشرة
      html += '      <div class="sumer-service-card">';
      html += '        <div class="sumer-service-icon">';
      html += '          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';
      html += '        </div>';
      html += '        <h3 class="sumer-service-title">الفصول الدراسية الحية (Live Star)</h3>';
      html += '        <p class="sumer-service-desc">حصص مباشرة صوت وصورة عبر شبكة WebRTC المباشرة مع المعلمين المعتمدين، متوافقة مع ضوابط الخصوصية وبدون تشغيل تلقائي للوسائط.</p>';
      html += '        <div class="sumer-service-footer">';
      html += '          <span class="sumer-badge badge-teal">تفاعل مباشر مع رصد الحضور</span>';
      html += '        </div>';
      html += '      </div>';

      // 3. المعلمون العراقيون المتخصصون
      html += '      <div class="sumer-service-card">';
      html += '        <div class="sumer-service-icon">';
      html += '          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
      html += '        </div>';
      html += '        <h3 class="sumer-service-title">نخبة المعلمين العراقيين</h3>';
      html += '        <p class="sumer-service-desc">كوادر تدريسية متخصصة ومعتمدة تخضع ملفاتها لتدقيق إدارة المدرسة، مع نظام تكليف صارم يحصر كل معلم في اختصاصه ومراحله المعتمدة.</p>';
      html += '        <div class="sumer-service-footer">';
      html += '          <a href="#auth/apply-teacher" class="sumer-btn sumer-btn-outline sumer-btn-sm" style="width: 100%;">تقديم طلب انضمام كمعلم</a>';
      html += '        </div>';
      html += '      </div>';

      // 4. المعلمون الافتراضيون بالذكاء الاصطناعي
      html += '      <div class="sumer-service-card">';
      html += '        <div class="sumer-service-icon">';
      html += '          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 3.3 2 6.2 5 7.4V20a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.6c3-1.2 5-4.1 5-7.4a8 8 0 0 0-8-8z"/><path d="M10 14h4"/></svg>';
      html += '        </div>';
      html += '        <h3 class="sumer-service-title">المعلمون الافتراضيون (AI Personas)</h3>';
      html += '        <p class="sumer-service-desc">مساعدون أذكياء بشارات واضحة (أ. سارة، أ. علي، أ. مريم) يجيبون بصدق مستندين إلى نصوص المنهج الرسمي ودون اختلاق إجابات وهمية.</p>';
      html += '        <div class="sumer-service-footer">';
      html += '          <a href="#guest" class="sumer-btn sumer-btn-outline sumer-btn-sm" style="width: 100%;">التعرف على المعلمين الأذكياء</a>';
      html += '        </div>';
      html += '      </div>';

      // 5. القارئ الرقمي المزدوج والسبورة
      html += '      <div class="sumer-service-card">';
      html += '        <div class="sumer-service-icon">';
      html += '          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 9 6 6m0-6-6 6"/></svg>';
      html += '        </div>';
      html += '        <h3 class="sumer-service-title">القارئ المزدوج والسبورة التفاعلية</h3>';
      html += '        <p class="sumer-service-desc">بيئة قراءة وتدوين متطورة تتيح فتح صفحات الكتب الرسمية المتطابقة مع نسخة الوزارة، والتأشير التفاعلي وحل التدريبات والشروح المصورة.</p>';
      html += '        <div class="sumer-service-footer">';
      html += '          <span class="sumer-badge badge-teal">تكامل مع الكتب الرسمية</span>';
      html += '        </div>';
      html += '      </div>';

      // 6. فترة التجربة المجانية 30 يوماً
      html += '      <div class="sumer-service-card" style="border-color: var(--sumer-gold-400);">';
      html += '        <div class="sumer-service-icon" style="background-color: var(--sumer-gold-50); color: var(--sumer-gold-600);">';
      html += '          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
      html += '        </div>';
      html += '        <h3 class="sumer-service-title">تجربة مجانية كاملة لمدة 30 يوماً</h3>';
      html += '        <p class="sumer-service-desc">يحصل كل طالب مسجل على فترة تجربة كاملة لمدة 30 يوماً محسوبة من تاريخ التسجيل، تتيح استكشاف كافة المناهج والحصص دون أي التزام مالي مسبق.</p>';
      html += '        <div class="sumer-service-footer">';
      html += '          <a href="#auth/register-student" class="sumer-btn sumer-btn-gold sumer-btn-sm" style="width: 100%;">بدء التجربة المجانية الآن</a>';
      html += '        </div>';
      html += '      </div>';

      html += '    </div>';
      html += '  </section>';
      html += '</div>';

      return html;
    },

    // ------------------------------------------------------------------------
    // 2. واجهة استكشاف الزائر المتقدمة (#guest)
    // ------------------------------------------------------------------------
    renderGuest: function (state) {
      state = state || SumerStore.getState();

      var html = '<div class="sumer-guest-view">';
      html += '  <div class="sumer-section-title-wrap">';
      html += '    <h1 class="sumer-section-title">استكشاف أركان مدرسة سومر الأهلية</h1>';
      html += '    <p class="sumer-section-desc">تعرف على المنظومة التعليمية الرقمية الأولى المصممة وفق البيئة والمنهج الوطني العراقي</p>';
      html += '  </div>';

      // المعلمون الافتراضيون المعتمدون
      html += '  <section style="margin-bottom: 3rem;">';
      html += '    <h2 style="font-size: var(--sumer-font-lg); margin-bottom: 1rem; color: var(--sumer-text-primary); display: flex; align-items: center; gap: 0.5rem;">';
      html += '      <span style="color: var(--sumer-gold-500);">✦</span> شخصيات المعلمين الافتراضيين المعتمدة (AI Personas)';
      html += '    </h2>';
      html += '    <p style="font-size: var(--sumer-font-sm); color: var(--sumer-text-secondary); margin-bottom: 1.5rem;">';
      html += '      معلمون أذكياء مدربون حصراً على نصوص المناهج العراقية الرسمية لتقديم الدعم التفاعلي والإجابة عن استفسارات الطلاب بأمان وموثوقية.';
      html += '    </p>';

      html += '    <div class="sumer-teachers-grid">';
      for (var i = 0; i < CANONICAL_VIRTUAL_TEACHERS.length; i++) {
        var vt = CANONICAL_VIRTUAL_TEACHERS[i];
        html += '      <div class="sumer-teacher-card">';
        html += '        <div class="sumer-teacher-card-header">';
        html += '          <div class="sumer-teacher-avatar-circle">' + vt.avatarInitial + '</div>';
        html += '          <div class="sumer-teacher-info">';
        html += '            <h3 class="sumer-teacher-name">' + escapeHtml(vt.name) + '</h3>';
        html += '            <span class="sumer-badge badge-gold" style="font-size: 0.7rem;">' + escapeHtml(vt.label) + '</span>';
        html += '          </div>';
        html += '        </div>';
        html += '        <p style="font-size: var(--sumer-font-xs); color: var(--sumer-text-secondary); line-height: 1.5; margin-bottom: 0.75rem;">' + escapeHtml(vt.title) + '</p>';
        html += '        <div class="sumer-teacher-specialties">';
        for (var j = 0; j < vt.specialties.length; j++) {
          html += '          <span class="sumer-tag">' + escapeHtml(vt.specialties[j]) + '</span>';
        }
        html += '        </div>';
        html += '      </div>';
      }
      html += '    </div>';
      html += '  </section>';

      // مراحل المنهج العراقي
      html += '  <section style="margin-bottom: 3rem;">';
      html += '    <h2 style="font-size: var(--sumer-font-lg); margin-bottom: 1.5rem; color: var(--sumer-text-primary);">';
      html += '      المراحل الدراسية والصفوف المشمولة بالمنهج العراقي (108 كتب)';
      html += '    </h2>';

      html += '    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">';
      // ابتدائي
      html += '      <div class="sumer-card">';
      html += '        <h3 class="sumer-card-title" style="color: var(--sumer-teal-600);">';
      html += '          المرحلة الابتدائية (6 صفوف)';
      html += '        </h3>';
      html += '        <p class="sumer-card-subtitle" style="margin-bottom: 1rem;">الصفوف من الأول وحتى السادس الابتدائي</p>';
      html += '        <ul style="list-style: none; font-size: var(--sumer-font-xs); color: var(--sumer-text-secondary); line-height: 1.8;">';
      html += '          <li>• الأول والثاني والثالث والرابع والخامس والسادس الابتدائي</li>';
      html += '          <li>• المواد: القراءة، الرياضيات، العلوم، الإسلامية، الإنكليزية، الاجتماعيات</li>';
      html += '        </ul>';
      html += '        <div style="margin-top: 1.25rem;">';
      html += '          <a href="#curriculum" class="sumer-btn sumer-btn-outline sumer-btn-sm" style="width: 100%;">كتب المرحلة الابتدائية</a>';
      html += '        </div>';
      html += '      </div>';

      // متوسط
      html += '      <div class="sumer-card">';
      html += '        <h3 class="sumer-card-title" style="color: var(--sumer-teal-600);">';
      html += '          المرحلة المتوسطة (3 صفوف)';
      html += '        </h3>';
      html += '        <p class="sumer-card-subtitle" style="margin-bottom: 1rem;">الصفوف من الأول وحتى الثالث المتوسط</p>';
      html += '        <ul style="list-style: none; font-size: var(--sumer-font-xs); color: var(--sumer-text-secondary); line-height: 1.8;">';
      html += '          <li>• الأول متوسط، الثاني متوسط، الثالث متوسط الوزاري</li>';
      html += '          <li>• المواد: الرياضيات، العلوم (فيزياء، كيمياء، أحياء)، العربي، الإنكليزي، الحاسوب</li>';
      html += '        </ul>';
      html += '        <div style="margin-top: 1.25rem;">';
      html += '          <a href="#curriculum" class="sumer-btn sumer-btn-outline sumer-btn-sm" style="width: 100%;">كتب المرحلة المتوسطة</a>';
      html += '        </div>';
      html += '      </div>';

      // إعدادي
      html += '      <div class="sumer-card">';
      html += '        <h3 class="sumer-card-title" style="color: var(--sumer-teal-600);">';
      html += '          المرحلة الإعدادية (علمي وأدبي)';
      html += '        </h3>';
      html += '        <p class="sumer-card-subtitle" style="margin-bottom: 1rem;">الرابع والخامس والسادس الإعدادي بفرعيه</p>';
      html += '        <ul style="list-style: none; font-size: var(--sumer-font-xs); color: var(--sumer-text-secondary); line-height: 1.8;">';
      html += '          <li>• الفرع العلمي: الرياضيات، الفيزياء، الكيمياء، الأحياء، العربي، الإنكليزي</li>';
      html += '          <li>• الفرع الأدبي: التاريخ، الجغرافية، الاقتصاد، الفلسفة، العربي، الإنكليزي</li>';
      html += '        </ul>';
      html += '        <div style="margin-top: 1.25rem;">';
      html += '          <a href="#curriculum" class="sumer-btn sumer-btn-outline sumer-btn-sm" style="width: 100%;">كتب المرحلة الإعدادية</a>';
      html += '        </div>';
      html += '      </div>';
      html += '    </div>';
      html += '  </section>';

      // ميثاق الخصوصية الصارمة وفترة التجربة
      html += '  <section class="sumer-card" style="border-left: 4px solid var(--sumer-teal-500); margin-bottom: 3rem;">';
      html += '    <h3 class="sumer-card-title">ميثاق الخصوصية الصارمة وحماية الطالب</h3>';
      html += '    <p style="font-size: var(--sumer-font-sm); color: var(--sumer-text-secondary); line-height: 1.7; margin: 0.75rem 0;">';
      html += '      تلتزم مدرسة سومر بأعلى المعايير الأخلاقية والتقنية لحماية خصوصية الطلاب والأسر العراقية. الكاميرا والمايكروفون مغلقان دائماً وافتراضياً، ولا يتم تفعيل أي وسائط دون إذن صريح من ولي الأمر عبر نظام الموافقات السبع الصريحة. المنظومة خالية تماماً من أدوات التسجيل التلقائي أو التعرف على الوجوه.';
      html += '    </p>';
      html += '    <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem;">';
      html += '      <a href="#auth/register-student" class="sumer-btn sumer-btn-gold">تسجيل طالب وبدء التجربة المجانية</a>';
      html += '      <a href="#auth/apply-teacher" class="sumer-btn sumer-btn-outline">طلب انضمام كمعلم</a>';
      html += '    </div>';
      html += '  </section>';

      html += '</div>';
      return html;
    },

    // ------------------------------------------------------------------------
    // 3. شاشة تسجيل الدخول الرسمية (#auth/login)
    // ------------------------------------------------------------------------
    renderLogin: function (state) {
      state = state || SumerStore.getState();
      var authState = state.auth || {};

      var html = '<div class="sumer-auth-container">';
      html += '  <div class="sumer-form-card">';
      html += '    <div class="sumer-form-header">';
      html += '      <div style="width: 50px; height: 50px; border-radius: var(--sumer-radius-full); background: var(--sumer-teal-50); color: var(--sumer-teal-600); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">';
      html += '        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>';
      html += '      </div>';
      html += '      <h1 class="sumer-form-title">تسجيل الدخول إلى مدرسة سومر</h1>';
      html += '      <p class="sumer-form-subtitle">أدخل معرّف حساب شكو ماكو المعتمد وكلمة المرور للمتابعة</p>';
      html += '    </div>';

      // وعاء رسائل الخطأ مع دور إمكانية الوصول role="alert"
      html += '    <div id="login-error-alert" class="sumer-alert sumer-alert-error" role="alert" style="display: ' + (authState.error ? 'flex' : 'none') + ';">';
      html += '      <span id="login-error-text">' + escapeHtml(authState.error || '') + '</span>';
      html += '    </div>';

      html += '    <form id="sumer-login-form" novalidate>';
      // معرّف الحساب
      html += '      <div class="sumer-form-group">';
      html += '        <label for="login-identifier" class="sumer-label">';
      html += '          اسم المستخدم أو البريد الإلكتروني أو الهاتف <span class="sumer-required">*</span>';
      html += '        </label>';
      html += '        <input type="text" id="login-identifier" name="identifier" class="sumer-input" ';
      html += '               placeholder="مثال: ali_iraq أو 07701234567" autocomplete="username" required>';
      html += '        <p class="sumer-form-help">يقبل اسم المستخدم، رقم الهاتف العراقي، أو البريد الإلكتروني</p>';
      html += '      </div>';

      // كلمة المرور مع زر إظهار/إخفاء كلمة المرور
      html += '      <div class="sumer-form-group">';
      html += '        <label for="login-password" class="sumer-label">';
      html += '          كلمة المرور <span class="sumer-required">*</span>';
      html += '        </label>';
      html += '        <div class="sumer-input-pw-wrap">';
      html += '          <input type="password" id="login-password" name="password" class="sumer-input" ';
      html += '                 placeholder="••••••••" autocomplete="current-password" required>';
      html += '          <button type="button" id="login-pw-toggle" class="sumer-pw-toggle-btn" ';
      html += '                  aria-label="إظهار أو إخفاء كلمة المرور" title="إظهار / إخفاء">';
      html += '            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      html += '          </button>';
      html += '        </div>';
      html += '      </div>';

      // اختيار بوابة الدخول — لا يمنح صلاحية؛ الخادم يبقى المصدر الحاكم للدور
      html += '      <div class="sumer-form-group">';
      html += '        <label class="sumer-label">الدخول بصفتي</label>';
      html += '        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;">';
      html += '          <button type="button" class="sumer-btn sumer-btn-outline sumer-login-role active" data-login-role="student" aria-pressed="true">طالب</button>';
      html += '          <button type="button" class="sumer-btn sumer-btn-outline sumer-login-role" data-login-role="guardian" aria-pressed="false">ولي أمر</button>';
      html += '          <button type="button" class="sumer-btn sumer-btn-outline sumer-login-role" data-login-role="teacher" aria-pressed="false">معلم</button>';
      html += '          <button type="button" class="sumer-btn sumer-btn-outline sumer-login-role" data-login-role="admin" aria-pressed="false">إدارة</button>';
      html += '        </div>';
      html += '        <input type="hidden" id="login-role" value="student">';
      html += '        <p class="sumer-form-help">يُستخدم الاختيار لتوجيهك فقط؛ صلاحية الحساب الفعلية تُتحقق من الخادم.</p>';
      html += '      </div>';

      // زر الدخول
      html += '      <div style="margin-top: 1.75rem;">';
      html += '        <button type="submit" id="login-submit-btn" class="sumer-btn sumer-btn-primary" style="width: 100%; justify-content: center;">';
      html += '          <span>دخول المنصة</span>';
      html += '        </button>';
      html += '      </div>';
      html += '    </form>';

      // روابط التوجيه المساعدة
      html += '    <div style="margin-top: 1.75rem; padding-top: 1.25rem; border-top: 1px solid var(--sumer-border-subtle); display: flex; flex-direction: column; gap: 0.75rem; text-align: center; font-size: var(--sumer-font-xs); color: var(--sumer-text-muted);">';
      html += '      <div>ليس لديك حساب؟ <a href="#auth/register-student" style="color: var(--sumer-teal-600); font-weight: var(--sumer-weight-bold);">سجل كطالب جديد مع تجربة 30 يوماً</a></div>';
      html += '      <div>معلم وترغب بالانضمام للكوادر التدريسية؟ <a href="#auth/apply-teacher" style="color: var(--sumer-gold-600); font-weight: var(--sumer-weight-bold);">تقديم طلب انضمام كمعلم</a></div>';
      html += '    </div>';

      html += '  </div>';
      html += '</div>';

      return html;
    },

    // ------------------------------------------------------------------------
    // 4. نموذج تسجيل طالب جديد وتفعيل التجربة المجانية (#auth/register-student)
    // ------------------------------------------------------------------------
    renderRegisterStudent: function (state) {
      state = state || SumerStore.getState();
      var trial = state.trial || {};
      var isAuth = state.auth && state.auth.isAuthenticated;

      var html = '<div class="sumer-auth-container" style="max-width: 620px;">';

      // إذا كان قد تم تسجيل الطالب وتفعيل التجربة المجانية للتو
      if (trial.active && trial.studentId) {
        html += '  <div class="sumer-trial-card">';
        html += '    <div class="sumer-trial-header">';
        html += '      <div style="width: 56px; height: 56px; border-radius: var(--sumer-radius-full); background: var(--sumer-gold-50); color: var(--sumer-gold-600); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; border: 2px solid var(--sumer-gold-400);">';
        html += '        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
        html += '      </div>';
        html += '      <h2 style="font-size: var(--sumer-font-xl); font-weight: var(--sumer-weight-bold); color: var(--sumer-text-primary); margin-bottom: 0.5rem;">تم تفعيل فترة التجربة المجانية بنجاح!</h2>';
        html += '      <p style="font-size: var(--sumer-font-sm); color: var(--sumer-text-secondary);">تم تسجيل ملف الطالب في قاعدة البيانات المدرسية وتفعيل اشتراك التجربة المجانية الكاملة لمدة 30 يوماً.</p>';
        html += '    </div>';

        html += '    <div class="sumer-trial-countdown">';
        html += '      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
        html += '      <span>الأيام المتبقية في التجربة: ' + escapeHtml(trial.daysRemaining || 30) + ' يوماً</span>';
        html += '    </div>';

        html += '    <div class="sumer-trial-meta-grid">';
        html += '      <div class="sumer-trial-meta-item">';
        html += '        <div class="sumer-trial-meta-label">حالة التجربة</div>';
        html += '        <div class="sumer-trial-meta-val" style="color: var(--sumer-success-text);">' + (trial.active ? 'نشطة (Active)' : 'منتهية') + '</div>';
        html += '      </div>';
        html += '      <div class="sumer-trial-meta-item">';
        html += '        <div class="sumer-trial-meta-label">تاريخ البداية</div>';
        html += '        <div class="sumer-trial-meta-val">' + formatDateArabic(trial.startedAt) + '</div>';
        html += '      </div>';
        html += '      <div class="sumer-trial-meta-item">';
        html += '        <div class="sumer-trial-meta-label">تاريخ نهاية التجربة</div>';
        html += '        <div class="sumer-trial-meta-val">' + formatDateArabic(trial.endsAt) + '</div>';
        html += '      </div>';
        html += '    </div>';

        html += '    <div style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center; margin-top: 1.5rem;">';
        html += '      <a href="#curriculum" class="sumer-btn sumer-btn-primary">استعراض المنهج والكتب الدراسية</a>';
        html += '      <button type="button" id="btn-register-another" class="sumer-btn sumer-btn-outline">تسجيل طالب آخر</button>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
        return html;
      }

      // نموذج التسجيل
      html += '  <div class="sumer-form-card">';
      html += '    <div class="sumer-form-header">';
      html += '      <span class="sumer-badge badge-gold" style="margin-bottom: 0.75rem;">تجربة مجانية كاملة 30 يوماً</span>';
      html += '      <h1 class="sumer-form-title">تسجيل طالب جديد في مدرسة سومر</h1>';
      html += '      <p class="sumer-form-subtitle">سجل بيانات الطالب للبدء فوراً بفترة استكشاف مجانية لمدة 30 يوماً لكافة الكتب والحصص</p>';
      html += '    </div>';

      if (!isAuth) {
        html += '    <div class="sumer-alert sumer-alert-info" style="margin-bottom: 1.5rem;">';
        html += '      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
        html += '      <div>لتسجيل الطالب وربطه بملفك العائلي، يرجى <a href="#auth/login" style="color: var(--sumer-teal-700); font-weight: var(--sumer-weight-bold); text-decoration: underline;">تسجيل الدخول أولاً</a> إذا كان لديك حساب بالفعل.</div>';
        html += '    </div>';
      }

      html += '    <div id="student-error-alert" class="sumer-alert sumer-alert-error" role="alert" style="display: none;">';
      html += '      <span id="student-error-text"></span>';
      html += '    </div>';

      html += '    <form id="sumer-register-student-form" novalidate>';
      // اسم الطالب
      html += '      <div class="sumer-form-group">';
      html += '        <label for="student-name" class="sumer-label">';
      html += '          الاسم الثلاثي للطالب <span class="sumer-required">*</span>';
      html += '        </label>';
      html += '        <input type="text" id="student-name" name="name" class="sumer-input" ';
      html += '               placeholder="مثال: أحمد حيدر علي" required>';
      html += '      </div>';

      // المرحلة الدراسية
      html += '      <div class="sumer-form-group">';
      html += '        <label for="student-stage" class="sumer-label">';
      html += '          المرحلة الدراسية <span class="sumer-required">*</span>';
      html += '        </label>';
      html += '        <select id="student-stage" name="stage" class="sumer-select" required>';
      html += '          <option value="">اختر المرحلة الدراسية...</option>';
      html += '          <option value="ابتدائي">ابتدائي</option>';
      html += '          <option value="متوسط">متوسط</option>';
      html += '          <option value="إعدادي">إعدادي</option>';
      html += '        </select>';
      html += '      </div>';

      // الصف الدراسي (يتغير ديناميكياً)
      html += '      <div class="sumer-form-group">';
      html += '        <label for="student-grade" class="sumer-label">';
      html += '          الصف الدراسي <span class="sumer-required">*</span>';
      html += '        </label>';
      html += '        <select id="student-grade" name="grade" class="sumer-select" required disabled>';
      html += '          <option value="">اختر المرحلة أولاً لتحديد الصف...</option>';
      html += '        </select>';
      html += '      </div>';

      // الشعبة
      html += '      <div class="sumer-form-group">';
      html += '        <label for="student-section" class="sumer-label">الشعبة الدراسية</label>';
      html += '        <input type="text" id="student-section" name="section" class="sumer-input" ';
      html += '               value="أ" placeholder="مثال: أ أو ب">';
      html += '      </div>';

      // المواد المقررة
      html += '      <div class="sumer-form-group">';
      html += '        <label class="sumer-label">المواد الدراسية المقررة</label>';
      html += '        <div id="student-subjects-container" class="sumer-checkbox-group">';
      html += '          <span style="font-size: var(--sumer-font-xs); color: var(--sumer-text-muted);">حدد المرحلة والصف لعرض المواد المعتمدة تلقائياً</span>';
      html += '        </div>';
      html += '      </div>';

      // زر الحفظ والتسجيل
      html += '      <div style="margin-top: 2rem;">';
      html += '        <button type="submit" id="student-submit-btn" class="sumer-btn sumer-btn-gold" style="width: 100%; justify-content: center;">';
      html += '          <span>تأكيد التسجيل وبدء التجربة المجانية 30 يوماً</span>';
      html += '        </button>';
      html += '      </div>';
      html += '    </form>';

      html += '  </div>';
      html += '</div>';

      return html;
    },

    // ------------------------------------------------------------------------
    // 5. نموذج تقديم طلب انضمام كمعلم (#auth/apply-teacher)
    // ------------------------------------------------------------------------
    renderTeacherApply: function (state) {
      state = state || SumerStore.getState();
      var appState = state.teacherApplication || {};
      var isAuth = state.auth && state.auth.isAuthenticated;
      var user = state.auth && state.auth.user;

      var html = '<div class="sumer-auth-container" style="max-width: 680px;">';

      // إذا كان لدى المعلم طلب انضمام قيد المراجعة الإدارية
      if (appState.status === 'pending') {
        html += '  <div class="sumer-app-status-card">';
        html += '    <div class="sumer-app-status-badge">';
        html += '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
        html += '      <span>الطلب قيد المراجعة الإدارية</span>';
        html += '    </div>';
        html += '    <h2 style="font-size: var(--sumer-font-xl); font-weight: var(--sumer-weight-bold); color: var(--sumer-text-primary); margin-bottom: 0.5rem;">تم استلام طلب انضمامك بنجاح</h2>';
        html += '    <p style="font-size: var(--sumer-font-sm); color: var(--sumer-text-secondary); line-height: 1.6; margin-bottom: 1.5rem;">';
        html += '      شكراً لاهتمامك بالانضمام للكوادر التدريسية لمدرسة سومر الأهلية. تم قيد طلبك في السجل الإداري وهو يخضع للتدقيق وفق المعايير الأكاديمية لوزارة التربية العراقية.';
        html += '    </p>';

        html += '    <div class="sumer-alert sumer-alert-info" style="text-align: right; margin-bottom: 1.5rem;">';
        html += '      <strong>تنبيه الأمان والنزاهة:</strong> لن يتم منح أي صلاحيات تدريسية أو دخول لفصول الطلاب إلا بعد صدور قرار الاعتماد الإداري الرسمي من إدارة المدرسة.';
        html += '    </div>';

        html += '    <div style="display: flex; gap: 1rem; justify-content: center;">';
        html += '      <a href="#curriculum" class="sumer-btn sumer-btn-outline">استعراض المنهج العراقي</a>';
        html += '      <a href="#welcome" class="sumer-btn sumer-btn-primary">العودة للرئيسية</a>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
        return html;
      }

      // نموذج التقديم
      html += '  <div class="sumer-form-card">';
      html += '    <div class="sumer-form-header">';
      html += '      <div style="width: 50px; height: 50px; border-radius: var(--sumer-radius-full); background: var(--sumer-gold-50); color: var(--sumer-gold-700); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">';
      html += '        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>';
      html += '      </div>';
      html += '      <h1 class="sumer-form-title">طلب انضمام للكوادر التدريسية</h1>';
      html += '      <p class="sumer-form-subtitle">نرحب بالمعلمين والمدرسين الأكفاء لتدريس المنهج العراقي الرسمي في مدرسة سومر</p>';
      html += '    </div>';

      if (!isAuth) {
        html += '    <div class="sumer-alert sumer-alert-info" style="margin-bottom: 1.5rem;">';
        html += '      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
        html += '      <div>يتطلب تقديم الطلب تسجيل الدخول بحساب شكو ماكو أولاً لربط هويتك بالطلب الإداري. <a href="#auth/login" style="color: var(--sumer-teal-700); font-weight: var(--sumer-weight-bold); text-decoration: underline;">تسجيل الدخول الآن</a></div>';
        html += '    </div>';
      }

      html += '    <div id="teacher-error-alert" class="sumer-alert sumer-alert-error" role="alert" style="display: none;">';
      html += '      <span id="teacher-error-text"></span>';
      html += '    </div>';

      html += '    <form id="sumer-teacher-apply-form" novalidate>';
      // الاسم الكامل
      html += '      <div class="sumer-form-group">';
      html += '        <label for="teacher-fullname" class="sumer-label">';
      html += '          الاسم الكامل واللقب العلمي <span class="sumer-required">*</span>';
      html += '        </label>';
      html += '        <input type="text" id="teacher-fullname" name="fullName" class="sumer-input" ';
      html += '               value="' + escapeHtml(user ? user.fullName : '') + '" ';
      html += '               placeholder="مثال: أ. محمد عبد الحسن الربيعي" required>';
      html += '      </div>';

      // الهاتف والبريد
      html += '      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">';
      html += '        <div class="sumer-form-group">';
      html += '          <label for="teacher-phone" class="sumer-label">رقم الهاتف العراقي</label>';
      html += '          <input type="tel" id="teacher-phone" name="phone" class="sumer-input" ';
      html += '                 value="' + escapeHtml(user ? (user.phone || '') : '') + '" placeholder="0770xxxxxxx">';
      html += '        </div>';
      html += '        <div class="sumer-form-group">';
      html += '          <label for="teacher-email" class="sumer-label">البريد الإلكتروني</label>';
      html += '          <input type="email" id="teacher-email" name="email" class="sumer-input" ';
      html += '                 value="' + escapeHtml(user ? (user.email || '') : '') + '" placeholder="teacher@example.com">';
      html += '        </div>';
      html += '      </div>';

      // المراحل التدريسية المرغوبة
      html += '      <div class="sumer-form-group">';
      html += '        <label class="sumer-label">المراحل التي ترغب بتدريسها <span class="sumer-required">*</span></label>';
      html += '        <div class="sumer-checkbox-group">';
      html += '          <label class="sumer-checkbox-label"><input type="checkbox" name="stages" value="ابتدائي"> المرحلة الابتدائية</label>';
      html += '          <label class="sumer-checkbox-label"><input type="checkbox" name="stages" value="متوسط"> المرحلة المتوسطة</label>';
      html += '          <label class="sumer-checkbox-label"><input type="checkbox" name="stages" value="إعدادي"> المرحلة الإعدادية</label>';
      html += '        </div>';
      html += '      </div>';

      // المواد والتخصصات
      html += '      <div class="sumer-form-group">';
      html += '        <label class="sumer-label">المواد والتخصصات التدريسية <span class="sumer-required">*</span></label>';
      html += '        <div class="sumer-checkbox-group">';
      var allSubjects = ['الرياضيات', 'اللغة العربية', 'العلوم', 'الفيزياء', 'الكيمياء', 'الأحياء', 'اللغة الإنكليزية', 'التربية الإسلامية', 'الاجتماعيات', 'الحاسوب', 'التاريخ', 'الجغرافية'];
      for (var sIdx = 0; sIdx < allSubjects.length; sIdx++) {
        html += '          <label class="sumer-checkbox-label"><input type="checkbox" name="subjects" value="' + escapeHtml(allSubjects[sIdx]) + '"> ' + escapeHtml(allSubjects[sIdx]) + '</label>';
      }
      html += '        </div>';
      html += '      </div>';

      // المؤهل والخبرة
      html += '      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">';
      html += '        <div class="sumer-form-group">';
      html += '          <label for="teacher-qualifications" class="sumer-label">المؤهل الأكاديمي والجامعة</label>';
      html += '          <input type="text" id="teacher-qualifications" name="qualifications" class="sumer-input" ';
      html += '                 placeholder="مثال: بكالوريوس تربية رياضيات - جامعة بغداد">';
      html += '        </div>';
      html += '        <div class="sumer-form-group">';
      html += '          <label for="teacher-exp-years" class="sumer-label">سنوات الخبرة</label>';
      html += '          <input type="number" id="teacher-exp-years" name="experienceYears" class="sumer-input" ';
      html += '                 min="0" max="45" value="3">';
      html += '        </div>';
      html += '      </div>';

      // نبذة وملاحظات
      html += '      <div class="sumer-form-group">';
      html += '        <label for="teacher-bio" class="sumer-label">نبذة عن الخبرات والشهادات التدريبية</label>';
      html += '        <textarea id="teacher-bio" name="bio" class="sumer-textarea" rows="3" ';
      html += '                  placeholder="اذكر بإيجاز المدارس السابقة، الإنجازات الأكاديمية، والدورات..."></textarea>';
      html += '      </div>';

      // زر الإرسال
      html += '      <div style="margin-top: 2rem;">';
      html += '        <button type="submit" id="teacher-submit-btn" class="sumer-btn sumer-btn-primary" style="width: 100%; justify-content: center;">';
      html += '          <span>إرسال طلب الانضمام للمراجعة الإدارية</span>';
      html += '        </button>';
      html += '      </div>';
      html += '    </form>';

      html += '  </div>';
      html += '</div>';

      return html;
    },

    // ------------------------------------------------------------------------
    // 6. استعراض كتالوج المناهج العراقية الرسمية المعتمدة (#curriculum)
    // ------------------------------------------------------------------------
    renderCurriculum: function (state) {
      state = state || SumerStore.getState();
      var catalog = state.curriculumCatalog || { items: [], loading: false, error: null };
      var selectedStage = catalog.selectedStage || 'all';
      var selectedGrade = catalog.selectedGrade || '';
      var selectedSubject = catalog.selectedSubject || '';

      var html = '<div class="sumer-curriculum-view">';
      html += '  <div class="sumer-section-title-wrap">';
      html += '    <h1 class="sumer-section-title">مكتبة المناهج العراقية الرسمية</h1>';
      html += '    <p class="sumer-section-desc">108 كتب دراسية معتمدة لجميع المراحل من وزارة التربية العراقية لعام 2026 - 2027</p>';
      html += '  </div>';

      // شريط التصفية الهرمي
      html += '  <div class="sumer-catalog-filter-bar">';
      html += '    <div class="sumer-stage-tabs" role="tablist" aria-label="تصفية حسب المرحلة">';
      html += '      <button type="button" class="sumer-stage-tab' + (selectedStage === 'all' ? ' active' : '') + '" data-stage="all">كافة المراحل (108)</button>';
      html += '      <button type="button" class="sumer-stage-tab' + (selectedStage === 'ابتدائي' ? ' active' : '') + '" data-stage="ابتدائي">الابتدائي</button>';
      html += '      <button type="button" class="sumer-stage-tab' + (selectedStage === 'متوسط' ? ' active' : '') + '" data-stage="متوسط">المتوسط</button>';
      html += '      <button type="button" class="sumer-stage-tab' + (selectedStage === 'إعدادي' ? ' active' : '') + '" data-stage="إعدادي">الإعدادي</button>';
      html += '    </div>';

      html += '    <div class="sumer-catalog-inputs">';
      // اختيار الصف
      html += '      <select id="catalog-grade-select" class="sumer-select sumer-catalog-select" aria-label="تصفية حسب الصف">';
      html += '        <option value="">جميع الصفوف</option>';
      if (selectedStage && CURRICULUM_STAGES[selectedStage]) {
        var grds = CURRICULUM_STAGES[selectedStage].grades;
        for (var gIdx = 0; gIdx < grds.length; gIdx++) {
          var selG = (selectedGrade === grds[gIdx]) ? ' selected' : '';
          html += '        <option value="' + escapeHtml(grds[gIdx]) + '"' + selG + '>' + escapeHtml(grds[gIdx]) + '</option>';
        }
      }
      html += '      </select>';

      // اختيار المادة أو البحث
      html += '      <input type="search" id="catalog-search-input" class="sumer-input sumer-catalog-search" ';
      html += '             placeholder="بحث باسم المادة أو الكتاب..." value="' + escapeHtml(selectedSubject) + '" aria-label="بحث في الكتب">';
      html += '    </div>';
      html += '  </div>';

      // حالة التحميل
      if (catalog.loading) {
        html += SumerUI.renderLoadingState('جاري تحميل كتب المنهج العراقي الرسمي من الخادم...');
        html += '</div>';
        return html;
      }

      // حالة الخطأ
      if (catalog.error) {
        var retryBtn = '<button type="button" id="catalog-retry-btn" class="sumer-btn sumer-btn-primary" style="margin-top: 1rem;">إعادة المحاولة</button>';
        html += SumerUI.renderErrorState('تعذر جلب كتالوج المناهج', catalog.error, retryBtn);
        html += '</div>';
        return html;
      }

      // تصفية الكتب المعروضة
      var items = catalog.items || [];
      var filtered = items.filter(function (book) {
        if (selectedStage && selectedStage !== 'all' && book.stage !== selectedStage) return false;
        if (selectedGrade && book.grade !== selectedGrade) return false;
        if (selectedSubject) {
          var term = selectedSubject.trim().toLowerCase();
          var titleMatch = book.title && book.title.toLowerCase().indexOf(term) !== -1;
          var subjectMatch = book.subject && book.subject.toLowerCase().indexOf(term) !== -1;
          if (!titleMatch && !subjectMatch) return false;
        }
        return true;
      });

      // شارة إحصائية صادقة لعدد الكتب المعروضة
      html += '  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">';
      html += '    <span style="font-size: var(--sumer-font-sm); color: var(--sumer-text-secondary);">';
      html += '      عرض <strong>' + filtered.length + '</strong> كتاباً من إجمالي <strong>' + items.length + '</strong> كتاباً رسمياً';
      html += '    </span>';
      html += '    <span class="sumer-badge badge-teal">وزارة التربية العراقية (2026 - 2027)</span>';
      html += '  </div>';

      if (filtered.length === 0) {
        html += SumerUI.renderEmptyState({
          title: 'لا توجد كتب مطابقة لخيارات التصفية',
          description: 'جرب تغيير المرحلة أو الصف أو مسح كلمة البحث للاطلاع على باقي الكتب الدراسية.'
        });
      } else {
        html += '  <div class="sumer-books-grid">';
        for (var b = 0; b < filtered.length; b++) {
          var book = filtered[b];
          var stageBadgeClass = book.stage === 'ابتدائي' ? 'badge-teal' : (book.stage === 'متوسط' ? 'badge-gold' : 'badge-warning');

          html += '    <div class="sumer-book-card" data-book-id="' + escapeHtml(book.id) + '">';
          html += '      <div class="sumer-book-badge-wrap">';
          html += '        <span class="sumer-badge ' + stageBadgeClass + '">' + escapeHtml(book.stage) + '</span>';
          html += '        <span style="font-size: 0.7rem; color: var(--sumer-text-muted);">' + escapeHtml(book.year || '2026 - 2027') + '</span>';
          html += '      </div>';

          html += '      <h3 class="sumer-book-title">' + escapeHtml(book.title) + '</h3>';

          html += '      <div class="sumer-book-meta">';
          html += '        <div>الصف: <strong>' + escapeHtml(book.grade) + '</strong></div>';
          html += '        <div>المادة: <strong>' + escapeHtml(book.subject) + '</strong></div>';
          if (book.term) {
            html += '        <div>الفصل/الجزء: ' + escapeHtml(book.term) + '</div>';
          }
          html += '      </div>';

          html += '      <div class="sumer-book-actions">';
          html += '        <span class="sumer-badge badge-success" style="font-size: 0.65rem;">معتمد رسمياً</span>';
          html += '        <button type="button" class="sumer-btn sumer-btn-outline sumer-btn-sm btn-preview-book" ';
          html += '                data-book-id="' + escapeHtml(book.id) + '" ';
          html += '                data-book-title="' + escapeHtml(book.title) + '">';
          html += '          معاينة الكتاب';
          html += '        </button>';
          html += '      </div>';
          html += '    </div>';
        }
        html += '  </div>';
      }

      html += '</div>';
      return html;
    },

    // ------------------------------------------------------------------------
    // 7. محرك العرض والربط التفاعلي الرئيسي (Main View Router & Mount)
    // ------------------------------------------------------------------------
    render: function (routeKey, mountEl) {
      routeKey = routeKey || '#welcome';
      var state = SumerStore.getState();

      var renderedHtml = '';
      if (routeKey === '#welcome') {
        renderedHtml = this.renderWelcome(state);
      } else if (routeKey === '#guest') {
        renderedHtml = this.renderGuest(state);
      } else if (routeKey === '#auth/login') {
        renderedHtml = this.renderLogin(state);
      } else if (routeKey === '#auth/register-student') {
        renderedHtml = this.renderRegisterStudent(state);
      } else if (routeKey === '#auth/apply-teacher') {
        renderedHtml = this.renderTeacherApply(state);
      } else if (routeKey === '#curriculum') {
        renderedHtml = this.renderCurriculum(state);
        // عند فتح صفحة المنهج: تحميل الكتالوج إن لم يكن محملاً
        if (!state.curriculumCatalog.items || state.curriculumCatalog.items.length === 0) {
          this.fetchCatalog();
        }
      } else {
        renderedHtml = this.renderWelcome(state);
      }

      if (mountEl && typeof mountEl === 'object') {
        mountEl.innerHTML = renderedHtml;
        this.bindEvents(routeKey, mountEl);
      }

      return renderedHtml;
    },

    // ------------------------------------------------------------------------
    // 8. جلب بيانات الكتالوج من الخادم
    // ------------------------------------------------------------------------
    fetchCatalog: function () {
      SumerStore.setCurriculumCatalog({ loading: true, error: null });
      var filters = {};
      var catalogState = SumerStore.getState().curriculumCatalog;
      if (catalogState.selectedStage && catalogState.selectedStage !== 'all') {
        filters.stage = catalogState.selectedStage;
      }
      if (catalogState.selectedGrade) {
        filters.grade = catalogState.selectedGrade;
      }

      SumerAPI.getCatalog(filters).then(function (res) {
        if (res.ok && res.data && Array.isArray(res.data.items)) {
          SumerStore.setCurriculumCatalog({
            items: res.data.items,
            version: res.data.version,
            loading: false,
            error: null
          });
        } else {
          SumerStore.setCurriculumCatalog({
            loading: false,
            error: res.message || 'تعذر جلب كتالوج المناهج من الخادم'
          });
        }
      }).catch(function (err) {
        SumerStore.setCurriculumCatalog({
          loading: false,
          error: 'فشل الاتصال بالخادم أثناء جلب المناهج'
        });
      });
    },

    // ------------------------------------------------------------------------
    // 9. ربط الأحداث التفاعلية (Event Listeners Binding)
    // ------------------------------------------------------------------------
    bindEvents: function (routeKey, mountEl) {
      if (!mountEl) return;
      var self = this;

      // ----------------------------------------------------------------------
      // أ) شاشة تسجيل الدخول (#auth/login)
      // ----------------------------------------------------------------------
      if (routeKey === '#auth/login') {
        var pwInput = mountEl.querySelector('#login-password');
        var pwToggle = mountEl.querySelector('#login-pw-toggle');
        if (pwToggle && pwInput) {
          pwToggle.onclick = function () {
            if (pwInput.type === 'password') {
              pwInput.type = 'text';
              pwToggle.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
            } else {
              pwInput.type = 'password';
              pwToggle.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
            }
          };
        }

        var loginForm = mountEl.querySelector('#sumer-login-form');
        var roleInput = mountEl.querySelector('#login-role');
        var roleButtons = mountEl.querySelectorAll('.sumer-login-role');
        for (var rb = 0; rb < roleButtons.length; rb++) {
          roleButtons[rb].onclick = function () {
            var selected = this.getAttribute('data-login-role') || 'student';
            if (roleInput) roleInput.value = selected;
            for (var rbi = 0; rbi < roleButtons.length; rbi++) {
              var on = roleButtons[rbi] === this;
              roleButtons[rbi].classList.toggle('active', on);
              roleButtons[rbi].setAttribute('aria-pressed', on ? 'true' : 'false');
            }
          };
        }
        var errAlert = mountEl.querySelector('#login-error-alert');
        var errText = mountEl.querySelector('#login-error-text');
        var submitBtn = mountEl.querySelector('#login-submit-btn');

        if (loginForm) {
          loginForm.onsubmit = function (e) {
            e.preventDefault();
            var idEl = mountEl.querySelector('#login-identifier');
            var identifier = (idEl ? idEl.value : '').trim();
            var password = (pwInput ? pwInput.value : '');

            if (!identifier || !password) {
              if (errAlert && errText) {
                errText.textContent = 'يرجى إدخال اسم المستخدم/الهاتف وكلمة المرور';
                errAlert.style.display = 'flex';
              }
              return;
            }

            if (submitBtn) {
              submitBtn.disabled = true;
              submitBtn.innerHTML = '<span class="sumer-spinner" style="width: 16px; height: 16px; border-width: 2px;" aria-hidden="true"></span> <span>جاري تسجيل الدخول...</span>';
            }
            if (errAlert) errAlert.style.display = 'none';

            SumerAPI.signin(identifier, password).then(function (res) {
              // مسح كلمة المرور فوراً من الذاكرة والمدخل
              if (pwInput) pwInput.value = '';

              if (!res.ok) {
                if (submitBtn) {
                  submitBtn.disabled = false;
                  submitBtn.innerHTML = '<span>دخول المنصة</span>';
                }
                if (errAlert && errText) {
                  errText.textContent = res.message || 'بيانات الدخول غير صحيحة';
                  errAlert.style.display = 'flex';
                }
                SumerStore.setAuth({ error: res.message || 'فشل تسجيل الدخول' });
                return;
              }

              // نجاح تسجيل الدخول: جلب سياق المدرسة
              SumerAPI.getMe().then(function (meRes) {
                if (meRes.ok && meRes.data) {
                  SumerStore.setSchoolContext(meRes.data.schoolContext, meRes.data.user);
                  SumerStore.setAuth({
                    token: res.token,
                    user: meRes.data.user,
                    isAuthenticated: true,
                    error: null
                  });

                  // التوجيه حسب الدور الحقيقي من الخادم. اختيار المستخدم لا يرفع الصلاحية.
                  var ctx = meRes.data.schoolContext || {};
                  var requestedRole = roleInput ? roleInput.value : '';
                  var allowed = {
                    student: !!ctx.isStudent,
                    guardian: !!ctx.isGuardian,
                    teacher: !!ctx.isTeacher,
                    admin: !!(ctx.isManager || ctx.isDeveloper)
                  };
                  if (requestedRole && allowed[requestedRole]) {
                    window.location.hash = requestedRole === 'admin' ? '#admin/overview' : '#' + requestedRole + '/overview';
                  } else if (ctx.isTeacher) {
                    window.location.hash = '#teacher/overview';
                  } else if (ctx.isGuardian) {
                    window.location.hash = '#guardian/overview';
                  } else if (ctx.isStudent) {
                    window.location.hash = '#student/overview';
                  } else if (ctx.isManager || ctx.isDeveloper) {
                    window.location.hash = '#admin/overview';
                  } else {
                    window.location.hash = '#welcome';
                  }
                } else {
                  window.location.hash = '#welcome';
                }
              }).catch(function () {
                window.location.hash = '#welcome';
              });
            }).catch(function (networkErr) {
              if (pwInput) pwInput.value = '';
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>دخول المنصة</span>';
              }
              if (errAlert && errText) {
                errText.textContent = 'تعذر الاتصال بالخادم، تحقق من اتصال الإنترنت';
                errAlert.style.display = 'flex';
              }
            });
          };
        }
      }

      // ----------------------------------------------------------------------
      // ب) تسجيل طالب جديد (#auth/register-student)
      // ----------------------------------------------------------------------
      if (routeKey === '#auth/register-student') {
        var stageSelect = mountEl.querySelector('#student-stage');
        var gradeSelect = mountEl.querySelector('#student-grade');
        var subjectsContainer = mountEl.querySelector('#student-subjects-container');

        if (stageSelect && gradeSelect) {
          stageSelect.onchange = function () {
            var val = stageSelect.value;
            gradeSelect.innerHTML = '<option value="">اختر الصف...</option>';

            if (val && CURRICULUM_STAGES[val]) {
              gradeSelect.disabled = false;
              var grds = CURRICULUM_STAGES[val].grades;
              for (var k = 0; k < grds.length; k++) {
                var opt = document.createElement('option');
                opt.value = grds[k];
                opt.textContent = grds[k];
                gradeSelect.appendChild(opt);
              }

              // عرض المواد
              if (subjectsContainer) {
                var sbjs = CURRICULUM_STAGES[val].subjects;
                var subjHtml = '';
                for (var s = 0; s < sbjs.length; s++) {
                  subjHtml += '<label class="sumer-checkbox-label"><input type="checkbox" name="subjects" value="' + escapeHtml(sbjs[s]) + '" checked> ' + escapeHtml(sbjs[s]) + '</label>';
                }
                subjectsContainer.innerHTML = subjHtml;
              }
            } else {
              gradeSelect.disabled = true;
              if (subjectsContainer) {
                subjectsContainer.innerHTML = '<span style="font-size: var(--sumer-font-xs); color: var(--sumer-text-muted);">حدد المرحلة والصف لعرض المواد</span>';
              }
            }
          };
        }

        var regForm = mountEl.querySelector('#sumer-register-student-form');
        var regErrAlert = mountEl.querySelector('#student-error-alert');
        var regErrText = mountEl.querySelector('#student-error-text');
        var regSubmitBtn = mountEl.querySelector('#student-submit-btn');

        if (regForm) {
          regForm.onsubmit = function (e) {
            e.preventDefault();
            var nameEl = mountEl.querySelector('#student-name');
            var stageEl = mountEl.querySelector('#student-stage');
            var gradeEl = mountEl.querySelector('#student-grade');
            var sectionEl = mountEl.querySelector('#student-section');

            var name = (nameEl ? nameEl.value : '').trim();
            var stage = (stageEl ? stageEl.value : '').trim();
            var grade = (gradeEl ? gradeEl.value : '').trim();
            var section = (sectionEl ? sectionEl.value : 'أ').trim();

            var checkedSubjects = [];
            var subjectBoxes = mountEl.querySelectorAll('input[name="subjects"]:checked');
            for (var sb = 0; sb < subjectBoxes.length; sb++) {
              checkedSubjects.push(subjectBoxes[sb].value);
            }

            if (!name || !stage || !grade) {
              if (regErrAlert && regErrText) {
                regErrText.textContent = 'يرجى إدخال اسم الطالب واختيار المرحلة والصف';
                regErrAlert.style.display = 'flex';
              }
              return;
            }

            if (regSubmitBtn) {
              regSubmitBtn.disabled = true;
              regSubmitBtn.innerHTML = '<span class="sumer-spinner" style="width: 16px; height: 16px; border-width: 2px;" aria-hidden="true"></span> <span>جاري تسجيل الطالب...</span>';
            }
            if (regErrAlert) regErrAlert.style.display = 'none';

            SumerAPI.registerStudent({
              name: name,
              stage: stage,
              grade: grade,
              section: section,
              subjects: checkedSubjects
            }).then(function (res) {
              if (regSubmitBtn) regSubmitBtn.disabled = false;

              if (!res.ok) {
                if (regSubmitBtn) regSubmitBtn.innerHTML = '<span>تأكيد التسجيل وبدء التجربة المجانية 30 يوماً</span>';
                if (regErrAlert && regErrText) {
                  regErrText.textContent = res.message || 'تعذر تسجيل الطالب. تأكد من تسجيل الدخول بحسابك.';
                  regErrAlert.style.display = 'flex';
                }
                return;
              }

              // نجاح التسجيل: حساب وتخزين حالة التجربة المجانية من استجابة الخادم
              var student = res.data && res.data.student;
              if (student) {
                var now = new Date();
                var ends = student.trialEndsAt ? new Date(student.trialEndsAt) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                var daysRemaining = Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

                SumerStore.setTrial({
                  active: true,
                  trialStatus: student.trialStatus || 'active',
                  startedAt: student.trialStartedAt || now.toISOString(),
                  endsAt: student.trialEndsAt || ends.toISOString(),
                  daysRemaining: daysRemaining,
                  studentId: String(student._id || student.id)
                });
              }

              // إعادة رندرة الصفحة لعرض بطاقة تأكيد التجربة المجانية
              self.render('#auth/register-student', mountEl);
            }).catch(function () {
              if (regSubmitBtn) {
                regSubmitBtn.disabled = false;
                regSubmitBtn.innerHTML = '<span>تأكيد التسجيل وبدء التجربة المجانية 30 يوماً</span>';
              }
              if (regErrAlert && regErrText) {
                regErrText.textContent = 'تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت.';
                regErrAlert.style.display = 'flex';
              }
            });
          };
        }

        var btnRegisterAnother = mountEl.querySelector('#btn-register-another');
        if (btnRegisterAnother) {
          btnRegisterAnother.onclick = function () {
            SumerStore.setTrial({ active: false, studentId: null });
            self.render('#auth/register-student', mountEl);
          };
        }
      }

      // ----------------------------------------------------------------------
      // ج) تقديم طلب انضمام كمعلم (#auth/apply-teacher)
      // ----------------------------------------------------------------------
      if (routeKey === '#auth/apply-teacher') {
        var teacherForm = mountEl.querySelector('#sumer-teacher-apply-form');
        var tErrAlert = mountEl.querySelector('#teacher-error-alert');
        var tErrText = mountEl.querySelector('#teacher-error-text');
        var tSubmitBtn = mountEl.querySelector('#teacher-submit-btn');

        if (teacherForm) {
          teacherForm.onsubmit = function (e) {
            e.preventDefault();
            var nameEl = mountEl.querySelector('#teacher-fullname');
            var phoneEl = mountEl.querySelector('#teacher-phone');
            var emailEl = mountEl.querySelector('#teacher-email');
            var qualEl = mountEl.querySelector('#teacher-qualifications');
            var expEl = mountEl.querySelector('#teacher-exp-years');
            var bioEl = mountEl.querySelector('#teacher-bio');

            var fullName = (nameEl ? nameEl.value : '').trim();
            var phone = (phoneEl ? phoneEl.value : '').trim();
            var email = (emailEl ? emailEl.value : '').trim();
            var qualifications = (qualEl ? qualEl.value : '').trim();
            var experienceYears = Number(expEl ? expEl.value : 0);
            var bio = (bioEl ? bioEl.value : '').trim();

            var stages = [];
            var stageBoxes = mountEl.querySelectorAll('input[name="stages"]:checked');
            for (var si = 0; si < stageBoxes.length; si++) stages.push(stageBoxes[si].value);

            var subjects = [];
            var subjBoxes = mountEl.querySelectorAll('input[name="subjects"]:checked');
            for (var sj = 0; sj < subjBoxes.length; sj++) subjects.push(subjBoxes[sj].value);

            if (!fullName) {
              if (tErrAlert && tErrText) {
                tErrText.textContent = 'الاسم الكامل مطلوب لتقديم الطلب';
                tErrAlert.style.display = 'flex';
              }
              return;
            }

            if (subjects.length === 0) {
              if (tErrAlert && tErrText) {
                tErrText.textContent = 'يجب اختيار مادة أو تخصص تدريسي واحد على الأقل';
                tErrAlert.style.display = 'flex';
              }
              return;
            }

            if (tSubmitBtn) {
              tSubmitBtn.disabled = true;
              tSubmitBtn.innerHTML = '<span class="sumer-spinner" style="width: 16px; height: 16px; border-width: 2px;" aria-hidden="true"></span> <span>جاري إرسال الطلب...</span>';
            }
            if (tErrAlert) tErrAlert.style.display = 'none';

            SumerAPI.applyTeacher({
              fullName: fullName,
              phone: phone,
              email: email,
              stages: stages,
              subjects: subjects,
              qualifications: qualifications,
              experienceYears: experienceYears,
              bio: bio
            }).then(function (res) {
              if (tSubmitBtn) tSubmitBtn.disabled = false;

              if (!res.ok) {
                if (tSubmitBtn) tSubmitBtn.innerHTML = '<span>إرسال طلب الانضمام للمراجعة الإدارية</span>';
                var msg = res.message || 'تعذر تقديم الطلب';
                if (res.status === 401) {
                  msg = 'يجب تسجيل الدخول بحساب شكو ماكو المعتمد لتقديم طلب التدريس.';
                }
                if (tErrAlert && tErrText) {
                  tErrText.textContent = msg;
                  tErrAlert.style.display = 'flex';
                }
                SumerStore.setTeacherApplication({ status: 'error', error: msg });
                return;
              }

              // نجاح التقديم: حفظ الحالة كـ pending بدون أي تصعيد صلاحيات محلي
              SumerStore.setTeacherApplication({
                status: 'pending',
                application: res.data && res.data.application,
                submittedAt: new Date().toISOString()
              });

              // إعادة رندرة الصفحة لعرض بطاقة قيد المراجعة الإدارية
              self.render('#auth/apply-teacher', mountEl);
            }).catch(function () {
              if (tSubmitBtn) {
                tSubmitBtn.disabled = false;
                tSubmitBtn.innerHTML = '<span>إرسال طلب الانضمام للمراجعة الإدارية</span>';
              }
              if (tErrAlert && tErrText) {
                tErrText.textContent = 'تعذر الاتصال بالخادم، تحقق من اتصال الإنترنت';
                tErrAlert.style.display = 'flex';
              }
            });
          };
        }
      }

      // ----------------------------------------------------------------------
      // د) استعراض كتالوج المناهج العراقية (#curriculum)
      // ----------------------------------------------------------------------
      if (routeKey === '#curriculum') {
        var stageTabs = mountEl.querySelectorAll('.sumer-stage-tab');
        for (var t = 0; t < stageTabs.length; t++) {
          stageTabs[t].onclick = function () {
            var stg = this.getAttribute('data-stage');
            SumerStore.setCurriculumFilter(stg, null, null);
            self.render('#curriculum', mountEl);
          };
        }

        var gradeSelectEl = mountEl.querySelector('#catalog-grade-select');
        if (gradeSelectEl) {
          gradeSelectEl.onchange = function () {
            var stg = SumerStore.getState().curriculumCatalog.selectedStage;
            var grd = gradeSelectEl.value;
            var sbj = SumerStore.getState().curriculumCatalog.selectedSubject;
            SumerStore.setCurriculumFilter(stg, grd, sbj);
            self.render('#curriculum', mountEl);
          };
        }

        var searchInput = mountEl.querySelector('#catalog-search-input');
        if (searchInput) {
          searchInput.oninput = function () {
            var val = searchInput.value;
            var stg = SumerStore.getState().curriculumCatalog.selectedStage;
            var grd = SumerStore.getState().curriculumCatalog.selectedGrade;
            SumerStore.setCurriculumFilter(stg, grd, val);
            self.render('#curriculum', mountEl);
          };
        }

        var retryBtnEl = mountEl.querySelector('#catalog-retry-btn');
        if (retryBtnEl) {
          retryBtnEl.onclick = function () {
            self.fetchCatalog();
          };
        }

        var previewBtns = mountEl.querySelectorAll('.btn-preview-book');
        for (var pb = 0; pb < previewBtns.length; pb++) {
          previewBtns[pb].onclick = function () {
            var bId = this.getAttribute('data-book-id');
            var bTitle = this.getAttribute('data-book-title');
            alert('كتاب رسمي معتمد: ' + bTitle + '\nسيتم تفعيل القارئ الرقمي التفاعلي الكامل في المرحلة 7.');
          };
        }
      }
    }
  };

  return SumerGuestView;
}));
