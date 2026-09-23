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
    // المصادقة والجلسة
    auth: {
      token: null,
      user: null,
      isAuthenticated: false
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
