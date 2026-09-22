'use strict';

/**
 * school-virtual-teacher-core.js
 *
 * Core pure functions and rules for AI Virtual Teacher Classroom (V1).
 * Runs both in Node (tests/backend) and in the browser (client).
 *
 * Privacy & Safety Guarantees:
 * - Personas are clearly labeled "معلم افتراضي / AI".
 * - Personas never impersonate real human teachers.
 * - Camera and Mic are OFF by default.
 * - getUserMedia runs ONLY on explicit user clicks.
 * - NO video/audio recording (MediaRecorder is forbidden).
 * - NO photo capture or face recognition/analysis.
 * - Real curriculum catalog only; no fake curriculum.
 * - Honest empty states when students or messages are absent.
 * - If AI provider is not configured, honest notification without simulated answers.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SchoolVirtualTeacherCore = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  var CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

  var PROFILES = [
    {
      profileId: 'sarah-smart',
      name: 'ست زهراء',
      label: 'معلم افتراضي / AI',
      roleDescription: 'معلم رياضيات وعلوم افتراضي',
      title: 'معلمة افتراضية للرياضيات والعلوم',
      subjectSpecialty: ['الرياضيات', 'العلوم'],
      supportedDialects: ['ar-standard', 'ar-iraqi', 'en'],
      defaultDialect: 'ar-standard',
      avatar: '/sumer-school/assets/virtual-teachers/zahraa.webp',
      voiceSettings: { voiceGender: 'female', defaultPitch: 1.05, defaultRate: 1.0, lang: 'ar-IQ' },
      introGreeting: 'أهلاً بكم يا أبطال، اليوم سنتعلم بطريقة سهلة وتفاعلية خطوة بخطوة.',
      active: true
    },
    {
      profileId: 'ali-wise',
      name: 'أستاذ أحمد',
      label: 'معلم افتراضي / AI',
      roleDescription: 'معلم لغة عربية وإسلامية افتراضي',
      title: 'معلم افتراضي للغة العربية والتربية الإسلامية',
      subjectSpecialty: ['اللغة العربية', 'القراءة', 'قواعد اللغة العربية', 'التربية الإسلامية', 'القرآن الكريم'],
      supportedDialects: ['ar-standard', 'ar-iraqi', 'en'],
      defaultDialect: 'ar-standard',
      avatar: '/sumer-school/assets/virtual-teachers/ahmed.webp',
      voiceSettings: { voiceGender: 'male', defaultPitch: 0.95, defaultRate: 1.0, lang: 'ar-IQ' },
      introGreeting: 'مرحباً بكم أعزائي الطلبة، لنستكشف معاً جمال لغتنا العربية ومعانيها.',
      active: true
    },
    {
      profileId: 'mariam-nour',
      name: 'ست علياء',
      label: 'معلم افتراضي / AI',
      roleDescription: 'معلمة اجتماعيات وتاريخ افتراضية',
      title: 'معلمة افتراضية للاجتماعيات والتاريخ والجغرافيا',
      subjectSpecialty: ['الاجتماعيات', 'التاريخ', 'الجغرافيا', 'الوطنية'],
      supportedDialects: ['ar-standard', 'ar-iraqi', 'en'],
      defaultDialect: 'ar-standard',
      avatar: '/sumer-school/assets/virtual-teachers/alyaa.webp',
      voiceSettings: { voiceGender: 'female', defaultPitch: 1.0, defaultRate: 0.95, lang: 'ar-IQ' },
      introGreeting: 'أهلاً بكم في حصتنا، لنتعرف اليوم على تاريخ وحضارة بلادنا العريقة.',
      active: true
    },
    {
      profileId: 'omar-digital', name: 'أستاذ عمر', label: 'معلم افتراضي / AI',
      roleDescription: 'معلم لغة إنجليزية وحاسوب افتراضي', title: 'معلم افتراضي للغة الإنجليزية والحاسوب',
      subjectSpecialty: ['اللغة الإنجليزية', 'الحاسوب'], supportedDialects: ['ar-standard', 'ar-iraqi', 'en'], defaultDialect: 'ar-standard',
      avatar: '/sumer-school/assets/virtual-teachers/omar.webp', voiceSettings: { voiceGender: 'male', defaultPitch: 0.98, defaultRate: 1.0, lang: 'ar-IQ' },
      introGreeting: 'أهلاً بكم، سنتعلم الإنجليزية والحاسوب بخطوات واضحة وتطبيقات عملية.', active: true
    },
    {
      profileId: 'kawthar-lab', name: 'ست كوثر', label: 'معلم افتراضي / AI',
      roleDescription: 'معلمة أحياء وكيمياء افتراضية', title: 'معلمة افتراضية للأحياء والكيمياء',
      subjectSpecialty: ['الأحياء', 'الكيمياء'], supportedDialects: ['ar-standard', 'ar-iraqi'], defaultDialect: 'ar-standard',
      avatar: '/sumer-school/assets/virtual-teachers/kawthar.webp', voiceSettings: { voiceGender: 'female', defaultPitch: 1.02, defaultRate: 0.96, lang: 'ar-IQ' },
      introGreeting: 'مرحباً يا أبطال، سنفهم الأحياء والكيمياء من خلال أمثلة قريبة وتجارب آمنة.', active: true
    },
    {
      profileId: 'ali-physics', name: 'أستاذ علي', label: 'معلم افتراضي / AI',
      roleDescription: 'معلم فيزياء ورياضيات افتراضي', title: 'معلم افتراضي للفيزياء والرياضيات',
      subjectSpecialty: ['الفيزياء', 'الرياضيات'], supportedDialects: ['ar-standard', 'ar-iraqi'], defaultDialect: 'ar-standard',
      avatar: '/sumer-school/assets/virtual-teachers/ali.webp', voiceSettings: { voiceGender: 'male', defaultPitch: 0.94, defaultRate: 0.96, lang: 'ar-IQ' },
      introGreeting: 'أهلاً بكم، سنحوّل مسائل الفيزياء والرياضيات إلى أفكار بسيطة خطوة بخطوة.', active: true
    }
  ];

  var DIALECTS = [
    { id: 'ar-standard', name: 'العربية الفصحى', description: 'لغة المناهج الرسمية المعتمدة', isDefault: true },
    { id: 'ar-iraqi', name: 'اللهجة العراقية', description: 'شرح مبسط ودافئ بالعامية العراقية', isDefault: false },
    { id: 'en', name: 'English (قريباً)', description: 'English language support (future)', isDefault: false }
  ];

  var STUDENTS_EMPTY_TEXT = 'لا يوجد طلاب مسجلون أو حاضرون في هذا الصف بعد';
  var CHAT_EMPTY_TEXT = 'لا توجد أسئلة أو رسائل حتى الآن. اكتب سؤالك ليجيب عنه المعلم الافتراضي.';
  var AI_UNCONFIGURED_TEXT = 'خدمة المعلم الافتراضي غير مفعلة — لا يوجد مزود ذكاء اصطناعي مربوط بالخادم.';

  function normalizeCode(v) {
    var c = String(v || '').trim().toUpperCase();
    return /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(c) ? c : '';
  }

  function codeFromSearch(search) {
    if (!search) return '';
    var match = /[?&]code=([23456789a-zA-Z]{6})(?:&|#|$)/.exec(search);
    return match ? normalizeCode(match[1]) : '';
  }

  function getProfile(profileId) {
    var norm = String(profileId || '').trim().toLowerCase();
    for (var i = 0; i < PROFILES.length; i += 1) {
      if (PROFILES[i].profileId === norm) return PROFILES[i];
    }
    return PROFILES[0];
  }

  function getDialect(dialectId) {
    var norm = String(dialectId || '').trim();
    for (var i = 0; i < DIALECTS.length; i += 1) {
      if (DIALECTS[i].id === norm) return DIALECTS[i];
    }
    return DIALECTS[0];
  }

  /**
   * Cascade filters for curriculum catalog items:
   * stage -> grade -> subject -> lesson
   */
  function cascade(catalogItems, selection) {
    catalogItems = Array.isArray(catalogItems) ? catalogItems : [];
    selection = selection || {};

    var stages = ['ابتدائي', 'متوسط', 'إعدادي'];
    var grades = [];
    var subjects = [];

    if (selection.stage) {
      var stageItems = catalogItems.filter(function (it) {
        return it.stage === selection.stage;
      });
      var gradeSet = {};
      stageItems.forEach(function (it) {
        if (it.grade && !gradeSet[it.grade]) {
          gradeSet[it.grade] = true;
          grades.push(it.grade);
        }
      });
    }

    if (selection.stage && selection.grade) {
      var gradeNorm = String(selection.grade).replace(/\s+/g, '');
      var gradeItems = catalogItems.filter(function (it) {
        if (it.stage !== selection.stage) return false;
        var itGrade = String(it.grade || '').replace(/\s+/g, '');
        return itGrade === gradeNorm || itGrade.includes(gradeNorm) || gradeNorm.includes(itGrade);
      });
      var subjectSet = {};
      gradeItems.forEach(function (it) {
        if (it.subject && !subjectSet[it.subject]) {
          subjectSet[it.subject] = true;
          subjects.push(it.subject);
        }
      });
    }

    return {
      stages: stages,
      grades: grades,
      subjects: subjects
    };
  }

  /** Initial devices state: strictly OFF by default */
  function initialDevicesState() {
    return {
      camera: false,
      mic: false
    };
  }

  /** Check that persona label carries "معلم افتراضي / AI" */
  function isValidAiPersona(persona) {
    if (!persona || typeof persona !== 'object') return false;
    var label = String(persona.label || '');
    return label.indexOf('معلم افتراضي') !== -1 || label.indexOf('AI') !== -1;
  }

  /**
   * Whiteboard state manager
   */
  function createWhiteboardState(initialSlides) {
    var slides = Array.isArray(initialSlides) && initialSlides.length ? initialSlides : [
      {
        title: 'السبورة التعليمية',
        subtitle: 'حصة تفاعلية مع المعلم الافتراضي',
        leftColumn: { title: 'محتوى الدرس', items: [] },
        rightColumn: { title: 'أمثلة وتطبيقات', items: [], diagram: '' },
        example: '',
        note: '',
        drawing: ''
      }
    ];

    var currentSlide = 0;
    var zoom = 100; // percent: 50% to 200%
    var tool = 'pen'; // 'select' | 'pen' | 'highlighter' | 'eraser'
    var color = '#1565c0'; // current drawing color
    var strokeSize = 3;
    var history = []; // undo stack of serialized canvas images/strokes
    var redoStack = [];

    return {
      getSlides: function () { return slides; },
      getCurrentSlideIndex: function () { return currentSlide; },
      getCurrentSlide: function () { return slides[currentSlide] || slides[0]; },
      getTotalSlides: function () { return slides.length; },
      nextSlide: function () {
        if (currentSlide < slides.length - 1) {
          currentSlide += 1;
          return true;
        }
        return false;
      },
      prevSlide: function () {
        if (currentSlide > 0) {
          currentSlide -= 1;
          return true;
        }
        return false;
      },
      setSlide: function (idx) {
        if (typeof idx === 'number' && idx >= 0 && idx < slides.length) {
          currentSlide = idx;
          return true;
        }
        return false;
      },
      getZoom: function () { return zoom; },
      zoomIn: function () {
        if (zoom < 200) { zoom = Math.min(200, zoom + 15); return zoom; }
        return zoom;
      },
      zoomOut: function () {
        if (zoom > 50) { zoom = Math.max(50, zoom - 15); return zoom; }
        return zoom;
      },
      resetZoom: function () { zoom = 100; return zoom; },
      getTool: function () { return tool; },
      setTool: function (t) {
        if (['select', 'pen', 'highlighter', 'eraser'].indexOf(t) !== -1) {
          tool = t;
          if (t === 'highlighter') strokeSize = 16;
          else if (t === 'eraser') strokeSize = 24;
          else strokeSize = 3;
          return true;
        }
        return false;
      },
      getColor: function () { return color; },
      setColor: function (c) {
        if (typeof c === 'string' && c) { color = c; return true; }
        return false;
      },
      getStrokeSize: function () { return strokeSize; },
      pushHistory: function (dataUrl) {
        history.push(dataUrl);
        if (history.length > 30) history.shift();
        redoStack = [];
      },
      canUndo: function () { return history.length > 0; },
      canRedo: function () { return redoStack.length > 0; },
      undo: function (currentDataUrl) {
        if (history.length === 0) return null;
        if (currentDataUrl) redoStack.push(currentDataUrl);
        return history.pop();
      },
      redo: function (currentDataUrl) {
        if (redoStack.length === 0) return null;
        if (currentDataUrl) history.push(currentDataUrl);
        return redoStack.pop();
      },
      clearDrawing: function () {
        slides[currentSlide].drawing = '';
        history = [];
        redoStack = [];
      }
    };
  }

  /** Static code verification helper to assert privacy and security invariants */
  function verifyPrivacyStatics(codeString) {
    var violations = [];
    // Must NOT construct or invoke MediaRecorder (e.g. new MediaRecorder)
    if (/new\s+MediaRecorder|\.startRecording|MediaRecorder\.isTypeSupported/i.test(codeString)) {
      violations.push('MediaRecorder forbidden in V1');
    }
    // Must NOT contain FaceDetector / face-api
    if (/new\s+FaceDetector|faceapi\.|faceRecognition/i.test(codeString)) {
      violations.push('Face recognition/analysis forbidden');
    }
    return {
      ok: violations.length === 0,
      violations: violations
    };
  }

  return {
    PROFILES: PROFILES,
    DIALECTS: DIALECTS,
    STUDENTS_EMPTY_TEXT: STUDENTS_EMPTY_TEXT,
    CHAT_EMPTY_TEXT: CHAT_EMPTY_TEXT,
    AI_UNCONFIGURED_TEXT: AI_UNCONFIGURED_TEXT,
    normalizeCode: normalizeCode,
    codeFromSearch: codeFromSearch,
    getProfile: getProfile,
    getDialect: getDialect,
    cascade: cascade,
    initialDevicesState: initialDevicesState,
    isValidAiPersona: isValidAiPersona,
    createWhiteboardState: createWhiteboardState,
    verifyPrivacyStatics: verifyPrivacyStatics
  };
}));
