/**
 * sumer-state.js - مخزن الحالة التفاعلي المركزي لمدرسة سومر الموحدة (SumerStore)
 * Central Reactive State Store (Zero-DOM, Node & Browser compatible)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SumerStore = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_STATE = {
    // المصادقة والجلسة (لا تخزن كلمات المرور مطلقاً)
    auth: {
      token: null,
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null
    },

    // سياق المدرسة الحقيقي المستمد حصراً من الخادم (/api/school/management/me)
    schoolContext: {
      role: 'guest',
      isTeacher: false,
      isGuardian: false,
      isStudent: false,
      isManager: false,
      isDeveloper: false,
      teacher: null,
      guardian: null,
      studentProfile: null,
      students: []
    },

    // حالة التجربة المجانية للطالب (30 يوماً محسوبة من الخادم)
    trial: {
      active: false,
      startedAt: null,
      endsAt: null,
      daysRemaining: 0,
      studentId: null,
      trialStatus: null
    },

    // حالة تقديم طلب انضمام المعلم
    teacherApplication: {
      status: 'idle', // 'idle' | 'submitting' | 'pending' | 'success' | 'conflict' | 'error'
      submittedAt: null,
      application: null,
      error: null
    },

    // كتالوج المناهج العراقية الرسمية المعتمدة
    curriculumCatalog: {
      items: [],
      version: null,
      loading: false,
      error: null,
      selectedStage: null,
      selectedGrade: null,
      selectedSubject: null
    },

    // مساحة العمل النشطة
    activeWorkspace: 'welcome',
    activeRoute: '#welcome',

    // الابن النشط لولي الأمر
    activeChildId: null,

    // سياق المنهج المختار
    curriculum: {
      selectedStage: null,
      selectedGrade: null,
      selectedSubject: null,
      selectedBookId: null,
      selectedPage: 1
    },

    // سياق الحصة والصف
    classroom: {
      activeRoomCode: null,
      roomType: null, // 'live' | 'virtual'
      isLive: false,
      // الكاميرا والمايكروفون مغلقان دائماً وافتراضياً وفق مبادئ الخصوصية الصارمة
      mediaStatus: {
        mic: false,
        camera: false,
        screen: false
      }
    },

    // حالة الواجهة والشبكة
    ui: {
      theme: 'light',
      sidebarCollapsed: false,
      drawerOpen: false,
      loading: false,
      loadingMessage: '',
      error: null
    }
  };

  function clone(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      return Object.assign({}, obj);
    }
  }

  function SumerStoreInstance() {
    this.state = clone(DEFAULT_STATE);
    this.listeners = [];
  }

  SumerStoreInstance.prototype.init = function (options) {
    options = options || {};
    var savedTheme = 'light';
    var savedToken = null;

    if (typeof localStorage !== 'undefined') {
      try {
        savedTheme = localStorage.getItem('sumer_theme') || 'light';
        savedToken = localStorage.getItem('token') || localStorage.getItem('sumer_token');
      } catch (e) {}
    }

    this.state.ui.theme = savedTheme;
    if (savedToken) {
      this.state.auth.token = savedToken;
      this.state.auth.isAuthenticated = true;
    }

    if (options.initialContext) {
      this.setSchoolContext(options.initialContext);
    }

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }

    this.notify();
    return this;
  };

  SumerStoreInstance.prototype.getState = function () {
    return this.state;
  };

  SumerStoreInstance.prototype.setState = function (updater) {
    if (typeof updater === 'function') {
      this.state = updater(this.state);
    } else if (typeof updater === 'object' && updater !== null) {
      // دمج سطحي آمن
      for (var key in updater) {
        if (Object.prototype.hasOwnProperty.call(updater, key)) {
          if (typeof updater[key] === 'object' && updater[key] !== null && !Array.isArray(updater[key])) {
            this.state[key] = Object.assign({}, this.state[key], updater[key]);
          } else {
            this.state[key] = updater[key];
          }
        }
      }
    }
    this.notify();
  };

  SumerStoreInstance.prototype.subscribe = function (listener) {
    var self = this;
    if (typeof listener !== 'function') return function () {};
    this.listeners.push(listener);
    return function () {
      self.listeners = self.listeners.filter(function (l) { return l !== listener; });
    };
  };

  SumerStoreInstance.prototype.notify = function () {
    var stateSnapshot = this.getState();
    for (var i = 0; i < this.listeners.length; i++) {
      try {
        this.listeners[i](stateSnapshot);
      } catch (e) {
        console.error('SumerStore listener error:', e);
      }
    }
  };

  // --------------------------------------------------------------------------
  // دوال تعديل وإدارة المصادقة (Auth Actions)
  // --------------------------------------------------------------------------
  SumerStoreInstance.prototype.setAuth = function (authData) {
    authData = authData || {};
    // حماية صارمة: منع تخزين كلمة المرور نهائياً
    var sanitized = {
      token: (authData.token !== undefined) ? authData.token : this.state.auth.token,
      user: (authData.user !== undefined) ? authData.user : this.state.auth.user,
      isAuthenticated: (authData.isAuthenticated !== undefined)
        ? Boolean(authData.isAuthenticated)
        : Boolean(authData.token || this.state.auth.token),
      loading: Boolean(authData.loading),
      error: authData.error || null
    };

    this.state.auth = Object.assign({}, this.state.auth, sanitized);
    this.notify();
  };

  // --------------------------------------------------------------------------
  // دوال إدارة التجربة المجانية (Trial Actions)
  // --------------------------------------------------------------------------
  SumerStoreInstance.prototype.setTrial = function (trialData) {
    trialData = trialData || {};
    this.state.trial = {
      active: (trialData.active !== undefined) ? Boolean(trialData.active) : Boolean(trialData.isTrialActive),
      startedAt: trialData.startedAt || trialData.trialStartedAt || null,
      endsAt: trialData.endsAt || trialData.trialEndsAt || null,
      daysRemaining: Number(trialData.daysRemaining || 0),
      studentId: trialData.studentId || null,
      trialStatus: trialData.trialStatus || (trialData.active ? 'active' : 'expired')
    };
    this.notify();
  };

  // --------------------------------------------------------------------------
  // دوال إدارة طلب انضمام المعلم (Teacher Application Actions)
  // --------------------------------------------------------------------------
  SumerStoreInstance.prototype.setTeacherApplication = function (appData) {
    appData = appData || {};
    this.state.teacherApplication = {
      status: appData.status || 'idle',
      submittedAt: appData.submittedAt || (appData.status === 'pending' ? new Date().toISOString() : null),
      application: appData.application || null,
      error: appData.error || null
    };
    this.notify();
  };

  // --------------------------------------------------------------------------
  // دوال إدارة كتالوج المناهج العراقية (Curriculum Catalog Actions)
  // --------------------------------------------------------------------------
  SumerStoreInstance.prototype.setCurriculumCatalog = function (catalogData) {
    catalogData = catalogData || {};
    this.state.curriculumCatalog = Object.assign({}, this.state.curriculumCatalog, {
      items: Array.isArray(catalogData.items) ? catalogData.items : this.state.curriculumCatalog.items,
      version: catalogData.version || this.state.curriculumCatalog.version,
      loading: (catalogData.loading !== undefined) ? Boolean(catalogData.loading) : this.state.curriculumCatalog.loading,
      error: (catalogData.error !== undefined) ? catalogData.error : this.state.curriculumCatalog.error
    });
    this.notify();
  };

  SumerStoreInstance.prototype.setCurriculumFilter = function (stage, grade, subject) {
    this.state.curriculumCatalog.selectedStage = stage || null;
    this.state.curriculumCatalog.selectedGrade = grade || null;
    this.state.curriculumCatalog.selectedSubject = subject || null;

    this.state.curriculum.selectedStage = stage || null;
    this.state.curriculum.selectedGrade = grade || null;
    this.state.curriculum.selectedSubject = subject || null;

    this.notify();
  };

  // --------------------------------------------------------------------------
  // دوال الثيم والعرض
  // --------------------------------------------------------------------------
  SumerStoreInstance.prototype.setTheme = function (theme) {
    theme = (theme === 'dark') ? 'dark' : 'light';
    this.state.ui.theme = theme;
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem('sumer_theme', theme); } catch (e) {}
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    this.notify();
  };

  SumerStoreInstance.prototype.toggleTheme = function () {
    var nextTheme = this.state.ui.theme === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
    return nextTheme;
  };

  SumerStoreInstance.prototype.setSchoolContext = function (context, user) {
    if (!context) return;
    this.state.schoolContext = Object.assign({}, DEFAULT_STATE.schoolContext, context);
    if (user) {
      this.state.auth.user = user;
      this.state.auth.isAuthenticated = true;
    }
    // ضبط الابن النشط لولي الأمر تلقائياً إن وجد
    if (this.state.schoolContext.isGuardian && Array.isArray(this.state.schoolContext.students) && this.state.schoolContext.students.length > 0) {
      if (!this.state.activeChildId) {
        this.state.activeChildId = String(this.state.schoolContext.students[0]._id || this.state.schoolContext.students[0].id || '');
      }
    }
    this.notify();
  };

  SumerStoreInstance.prototype.setActiveChild = function (childId) {
    this.state.activeChildId = String(childId || '');
    this.notify();
  };

  SumerStoreInstance.prototype.getActiveChild = function () {
    if (!this.state.activeChildId || !this.state.schoolContext.students) return null;
    var id = this.state.activeChildId;
    return this.state.schoolContext.students.find(function (s) {
      return String(s._id || s.id) === id;
    }) || null;
  };

  SumerStoreInstance.prototype.setLoading = function (loading, message) {
    this.state.ui.loading = Boolean(loading);
    this.state.ui.loadingMessage = message || '';
    this.notify();
  };

  SumerStoreInstance.prototype.setError = function (error) {
    this.state.ui.error = error;
    this.notify();
  };

  SumerStoreInstance.prototype.setDrawer = function (open) {
    this.state.ui.drawerOpen = Boolean(open);
    this.notify();
  };

  SumerStoreInstance.prototype.logout = function () {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('sumer_token');
      } catch (e) {}
    }
    this.state = clone(DEFAULT_STATE);
    this.notify();
    if (typeof window !== 'undefined' && window.location) {
      window.location.hash = '#welcome';
    }
  };

  return new SumerStoreInstance();
}));
