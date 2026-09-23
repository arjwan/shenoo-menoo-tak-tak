/**
 * sumer-api.js - طبقة الاتصال الموحدة بالواجهات الخلفية لمدرسة سومر (SumerAPI)
 * Lightweight, Resilient Client Adapter for Sumer School
 *
 * Handles:
 * - Bearer Token management & headers injection
 * - JSON serialization / deserialization
 * - Server errors & HTTP statuses (401, 403, 409, 500)
 * - Network failure resilience (status 0 with user-friendly Arabic messages)
 * - Safe auth without password caching or frontend authorization spoofing
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SumerAPI = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TOKEN_STORAGE_KEYS = ['token', 'sumer_token'];

  function readStoredToken() {
    if (typeof localStorage !== 'undefined') {
      for (var i = 0; i < TOKEN_STORAGE_KEYS.length; i++) {
        try {
          var val = localStorage.getItem(TOKEN_STORAGE_KEYS[i]);
          if (val && typeof val === 'string' && val.trim().length > 0) {
            return val.trim();
          }
        } catch (e) {}
      }
    }
    if (typeof sessionStorage !== 'undefined') {
      try {
        var sVal = sessionStorage.getItem('token');
        if (sVal && typeof sVal === 'string' && sVal.trim().length > 0) {
          return sVal.trim();
        }
      } catch (e) {}
    }
    return '';
  }

  function writeStoredToken(token) {
    if (!token) return;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('token', token);
        localStorage.setItem('sumer_token', token);
      } catch (e) {}
    }
  }

  function removeStoredToken() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('sumer_token');
      } catch (e) {}
    }
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem('token');
      } catch (e) {}
    }
  }

  function SumerAPIInstance() {
    this.baseUrl = '';
    this.onUnauthorized = null;
  }

  SumerAPIInstance.prototype.getToken = function () {
    return readStoredToken();
  };

  SumerAPIInstance.prototype.setToken = function (token) {
    writeStoredToken(token);
  };

  SumerAPIInstance.prototype.clearToken = function () {
    removeStoredToken();
  };

  SumerAPIInstance.prototype.setOnUnauthorized = function (callback) {
    this.onUnauthorized = (typeof callback === 'function') ? callback : null;
  };

  /**
   * طلب HTTP أساسي موحد ومحصّن ضد انقطاع الشبكة
   */
  SumerAPIInstance.prototype.request = function (endpoint, options) {
    options = options || {};
    var method = (options.method || 'GET').toUpperCase();
    var headers = Object.assign({}, options.headers || {});
    var body = options.body;

    if (!headers['Accept']) {
      headers['Accept'] = 'application/json';
    }

    var token = options.token || this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    if (body !== undefined && body !== null) {
      if (typeof body === 'object' && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
      }
    }

    var self = this;
    var url = (this.baseUrl || '') + endpoint;

    return fetch(url, {
      method: method,
      headers: headers,
      body: body
    }).then(function (res) {
      return res.text().then(function (text) {
        var parsedData = {};
        if (text && text.trim().length > 0) {
          try {
            parsedData = JSON.parse(text);
          } catch (jsonErr) {
            parsedData = { raw: text };
          }
        }

        var isOk = res.ok && (!parsedData || parsedData.ok !== false);
        var message = (parsedData && parsedData.message) || (parsedData && parsedData.error) || '';

        // معالجة الحالات الخاصة بالرموز
        if (res.status === 401) {
          if (!message) message = 'يرجى تسجيل الدخول للوصول إلى هذه الخدمة';
          if (typeof self.onUnauthorized === 'function') {
            try { self.onUnauthorized(); } catch (_) {}
          }
        } else if (res.status === 403) {
          if (!message) message = 'لا تملك الصلاحية الكافية لإتمام هذا الإجراء';
        } else if (res.status === 409) {
          if (!message) message = 'تعارض في البيانات: الطلب مسجل مسبقاً أو غير متاح';
        } else if (!isOk && !message) {
          message = 'حدث خطأ في الخادم (' + res.status + ')';
        }

        return {
          ok: isOk,
          status: res.status,
          data: parsedData,
          message: message,
          token: parsedData ? (parsedData.token || null) : null
        };
      });
    }).catch(function (networkErr) {
      // حماية صارمة ضد فشل الشبكة وانقطاع الاتصال
      return {
        ok: false,
        status: 0,
        data: null,
        message: 'تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت والمحاولة ثانية.',
        error: networkErr ? networkErr.message : 'NetworkError'
      };
    });
  };

  // --------------------------------------------------------------------------
  // دوال الخدمات المحددة لمدرسة سومر
  // --------------------------------------------------------------------------

  /**
   * تسجيل الدخول الرسمي عبر نقطة النهاية المعتمدة
   * لا يتم حفظ كلمة المرور في أي حالة أو ذاكرة محلية
   */
  SumerAPIInstance.prototype.signin = function (identifier, password) {
    identifier = String(identifier || '').trim();
    password = String(password || '');

    if (!identifier || !password) {
      return Promise.resolve({
        ok: false,
        status: 400,
        message: 'يرجى إدخال معرّف الحساب وكلمة المرور'
      });
    }

    var self = this;
    return this.request('/api/auth/signin', {
      method: 'POST',
      body: { identifier: identifier, password: password }
    }).then(function (res) {
      if (res.ok && res.data && res.data.token) {
        self.setToken(res.data.token);
      }
      return res;
    });
  };

  /**
   * استرجاع سياق المستخدم والمدرسة الحقيقي من الخادم
   */
  SumerAPIInstance.prototype.getMe = function () {
    return this.request('/api/school/management/me');
  };

  /**
   * تسجيل طالب جديد (تحت إشراف ولي الأمر أو الحساب النشط)
   */
  SumerAPIInstance.prototype.registerStudent = function (studentData) {
    studentData = studentData || {};
    var name = String(studentData.name || '').trim();
    var stage = String(studentData.stage || '').trim();
    var grade = String(studentData.grade || '').trim();

    if (!name || !stage || !grade) {
      return Promise.resolve({
        ok: false,
        status: 400,
        message: 'اسم الطالب والمرحلة الدراسية والصف مطلوبة'
      });
    }

    return this.request('/api/school/students', {
      method: 'POST',
      body: {
        name: name,
        stage: stage,
        grade: grade,
        section: String(studentData.section || 'أ').trim(),
        subjects: Array.isArray(studentData.subjects) ? studentData.subjects : []
      }
    });
  };

  /**
   * جلب معلومات فترة التجربة المجانية للطالب من الخادم
   */
  SumerAPIInstance.prototype.getStudentTrial = function (studentId) {
    if (!studentId) {
      return Promise.resolve({ ok: false, status: 400, message: 'معرّف الطالب مطلوب' });
    }
    return this.request('/api/school/management/students/' + encodeURIComponent(studentId) + '/trial');
  };

  /**
   * تقديم طلب انضمام كمعلم جديد
   */
  SumerAPIInstance.prototype.applyTeacher = function (applicationData) {
    applicationData = applicationData || {};
    var fullName = String(applicationData.fullName || '').trim();
    var subjects = Array.isArray(applicationData.subjects)
      ? applicationData.subjects.filter(Boolean)
      : (applicationData.subject ? [String(applicationData.subject).trim()] : []);

    if (!fullName) {
      return Promise.resolve({
        ok: false,
        status: 400,
        message: 'الاسم الكامل مطلوب لتقديم الطلب'
      });
    }

    if (!subjects.length) {
      return Promise.resolve({
        ok: false,
        status: 400,
        message: 'يجب اختيار مادة أو تخصص تدريسي واحد على الأقل'
      });
    }

    return this.request('/api/school/teachers/apply', {
      method: 'POST',
      body: {
        fullName: fullName,
        phone: String(applicationData.phone || '').trim(),
        email: String(applicationData.email || '').trim(),
        subjects: subjects,
        specialties: subjects,
        stages: Array.isArray(applicationData.stages) ? applicationData.stages : (applicationData.stage ? [applicationData.stage] : []),
        grades: Array.isArray(applicationData.grades) ? applicationData.grades : (applicationData.grade ? [applicationData.grade] : []),
        sections: Array.isArray(applicationData.sections) ? applicationData.sections : ['أ'],
        qualifications: String(applicationData.qualifications || '').trim(),
        experienceYears: Number(applicationData.experienceYears || 0),
        bio: String(applicationData.bio || '').trim(),
        notes: String(applicationData.notes || '').trim()
      }
    });
  };

  /**
   * استعراض كتالوج المناهج العراقية الرسمية المعتمدة (108 كتب)
   */
  SumerAPIInstance.prototype.getCatalog = function (filters) {
    filters = filters || {};
    var queryParts = [];
    if (filters.stage) queryParts.push('stage=' + encodeURIComponent(filters.stage));
    if (filters.grade) queryParts.push('grade=' + encodeURIComponent(filters.grade));
    if (filters.subject) queryParts.push('subject=' + encodeURIComponent(filters.subject));

    var q = queryParts.length > 0 ? ('?' + queryParts.join('&')) : '';
    return this.request('/api/school/curriculum/catalog' + q);
  };

  /**
   * استرجاع شخصيات المعلمين الافتراضيين المعتمدة بالذكاء الاصطناعي
   * مع بيانات السقوط الاحتياطي الصادقة إذا لم يسجل الزائر دخوله بعد
   */
  SumerAPIInstance.prototype.getVirtualProfiles = function () {
    var fallbackProfiles = [
      {
        profileId: 'sarah-smart',
        name: 'أ. سارة الذكية',
        label: 'معلم افتراضي / AI',
        title: 'معلمة ذكاء اصطناعي متخصصة في العلوم والرياضيات وتنمية التفكير التحليلي',
        specialties: ['الرياضيات', 'العلوم', 'الكيمياء', 'الفيزياء'],
        active: true
      },
      {
        profileId: 'ali-wise',
        name: 'أ. علي الحكيم',
        label: 'معلم افتراضي / AI',
        title: 'معلم ذكاء اصطناعي متخصص في اللغة العربية، البلاغة، والتربية الإسلامية',
        specialties: ['اللغة العربية', 'القراءة', 'التربية الإسلامية'],
        active: true
      },
      {
        profileId: 'mariam-nour',
        name: 'أ. مريم النور',
        label: 'معلمة افتراضية / AI',
        title: 'معلمة ذكاء اصطناعي متخصصة في الاجتماعيات، الجغرافيا، والتاريخ العراقي الأصيل',
        specialties: ['الاجتماعيات', 'التاريخ', 'الجغرافيا'],
        active: true
      }
    ];

    if (!this.getToken()) {
      return Promise.resolve({
        ok: true,
        status: 200,
        data: { ok: true, profiles: fallbackProfiles },
        profiles: fallbackProfiles
      });
    }

    return this.request('/api/school/virtual/profiles').then(function (res) {
      if (res.ok && res.data && Array.isArray(res.data.profiles) && res.data.profiles.length > 0) {
        return {
          ok: true,
          status: res.status,
          data: res.data,
          profiles: res.data.profiles
        };
      }
      return {
        ok: true,
        status: 200,
        data: { ok: true, profiles: fallbackProfiles },
        profiles: fallbackProfiles
      };
    });
  };

  return new SumerAPIInstance();
}));
