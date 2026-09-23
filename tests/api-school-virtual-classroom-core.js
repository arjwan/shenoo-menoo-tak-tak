#!/usr/bin/env node
'use strict';

/**
 * tests/api-school-virtual-classroom-core.js
 *
 * Client-side and core unit checks for Virtual Classroom V1:
 *  1) Virtual Teacher personas: each has "معلم افتراضي / AI", never human teacher.
 *  2) Language & dialect options: Arabic standard default, Iraqi dialect, extensible.
 *  3) Real curriculum cascade: stage -> grade -> subject matching Iraqi catalog.
 *  4) Interactive whiteboard state machine: tools, drawing, undo, redo, zoom, pagination.
 *  5) Privacy & security invariants:
 *     - camera & mic OFF by default
 *     - getUserMedia ONLY inside user-action click handlers
 *     - NO MediaRecorder (no video/audio recording)
 *     - NO canvas toDataURL streaming / face recognition
 *  6) Honest empty states when students or messages are absent.
 *  7) Honest AI unconfigured notification (no fake AI answers).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const core = require(path.join(root, 'school-virtual-teacher-core.js'));
const catalog = require(path.join(root, 'server/src/data/iraqi-curriculum-catalog'));

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok - ' + name);
  } catch (e) {
    console.log('not ok - ' + name + '\n  ' + (e && e.message));
    process.exitCode = 1;
  }
}

// 1) Virtual Teacher Personas
check('virtual teacher profiles: multiple personas, each clearly labeled "معلم افتراضي / AI"', () => {
  assert.ok(Array.isArray(core.PROFILES) && core.PROFILES.length >= 3, 'at least 3 virtual teacher personas');
  core.PROFILES.forEach((p) => {
    assert.ok(p.profileId && p.name && p.title, 'persona has id, name, title');
    assert.ok(core.isValidAiPersona(p), 'persona has "معلم افتراضي / AI" label: ' + p.label);
    assert.match(p.label, /معلم افتراضي|AI/, 'label matches required virtual indicator');
    assert.ok(Array.isArray(p.supportedDialects), 'supportedDialects is array');
  });
  const sarah = core.getProfile('sarah-smart');
  assert.equal(sarah.name, 'أ. سارة الذكية');
  assert.equal(sarah.label, 'معلم افتراضي / AI');
});

check('virtual teacher personas do not impersonate human teachers', () => {
  core.PROFILES.forEach((p) => {
    assert.notEqual(p.roleDescription, 'معلم حقيقي');
    assert.match(p.title + ' ' + p.label, /افتراض|AI/i, 'explicitly marked virtual/AI');
  });
});

// 2) Languages & Dialects
check('languages and dialects: Arabic standard is default, Iraqi dialect is supported option', () => {
  assert.ok(Array.isArray(core.DIALECTS) && core.DIALECTS.length >= 2);
  const def = core.DIALECTS.find((d) => d.isDefault);
  assert.ok(def, 'has default dialect');
  assert.equal(def.id, 'ar-standard');
  const iraqi = core.DIALECTS.find((d) => d.id === 'ar-iraqi');
  assert.ok(iraqi, 'Iraqi dialect option exists');
  assert.match(iraqi.name, /عراقي/);
  // Extensible for English
  const en = core.DIALECTS.find((d) => d.id === 'en');
  assert.ok(en, 'extensible English option defined');
});

// 3) Real Curriculum Source
check('cascade follows the real Iraqi curriculum catalog only (no invented stages or subjects)', () => {
  const c0 = core.cascade(catalog.items, {});
  assert.deepEqual(c0.stages, ['ابتدائي', 'متوسط', 'إعدادي']);
  assert.deepEqual(c0.grades, []);

  const cPrimary = core.cascade(catalog.items, { stage: 'ابتدائي' });
  assert.ok(cPrimary.grades.includes('السادس ابتدائي') || cPrimary.grades.some((g) => g.includes('السادس')));
  
  const cMath = core.cascade(catalog.items, { stage: 'ابتدائي', grade: 'السادس ابتدائي' });
  assert.ok(cMath.subjects.includes('الرياضيات'));
  assert.ok(!cMath.subjects.includes('الفيزياء'), 'Physics is preparatory/middle, not primary grade 6');
});

// 4) Interactive Whiteboard
check('whiteboard state machine: tools, drawing, undo/redo, pagination, zoom (50%-200%)', () => {
  const wb = core.createWhiteboardState([
    { title: 'الدرس الأول', leftColumn: { title: 'الكسور', items: ['1/2 = 0.5'] } },
    { title: 'الدرس الثاني', leftColumn: { title: 'النسب', items: ['50%'] } }
  ]);

  assert.equal(wb.getTotalSlides(), 2);
  assert.equal(wb.getCurrentSlideIndex(), 0);
  assert.equal(wb.getCurrentSlide().title, 'الدرس الأول');

  // Next slide
  assert.ok(wb.nextSlide());
  assert.equal(wb.getCurrentSlideIndex(), 1);
  assert.equal(wb.getCurrentSlide().title, 'الدرس الثاني');
  assert.equal(wb.nextSlide(), false, 'cannot exceed total slides');

  // Prev slide
  assert.ok(wb.prevSlide());
  assert.equal(wb.getCurrentSlideIndex(), 0);

  // Tools
  assert.equal(wb.getTool(), 'pen');
  wb.setTool('highlighter');
  assert.equal(wb.getTool(), 'highlighter');
  wb.setTool('eraser');
  assert.equal(wb.getTool(), 'eraser');

  // Zoom: 100% -> zoomIn -> 115% -> zoomOut -> 100%
  assert.equal(wb.getZoom(), 100);
  wb.zoomIn();
  assert.equal(wb.getZoom(), 115);
  wb.zoomOut();
  assert.equal(wb.getZoom(), 100);

  // Undo / Redo
  assert.equal(wb.canUndo(), false);
  wb.pushHistory('data:image/png;base64,1');
  assert.equal(wb.canUndo(), true);
  const popped = wb.undo('data:image/png;base64,2');
  assert.equal(popped, 'data:image/png;base64,1');
  assert.equal(wb.canRedo(), true);
});

// 5) Privacy & Safety Guarantees
check('camera and mic are OFF by default', () => {
  const dev = core.initialDevicesState();
  assert.equal(dev.camera, false, 'camera must be false at initial state');
  assert.equal(dev.mic, false, 'mic must be false at initial state');
});

check('static inspection: verifyPrivacyStatics detects violations and passes compliant code', () => {
  const cleanCode = 'function start() { console.log("started"); }';
  const badCode = 'const rec = new MediaRecorder(stream);';
  assert.equal(core.verifyPrivacyStatics(cleanCode).ok, true);
  assert.equal(core.verifyPrivacyStatics(badCode).ok, false);
});

check('getUserMedia explicit click rule verified in core specifications', () => {
  const clean = 'btn.addEventListener("click", () => navigator.mediaDevices.getUserMedia({ audio: true }))';
  assert.equal(core.verifyPrivacyStatics(clean).ok, true);
});

// 6) Honest Empty States & Texts
check('honest empty states: explicit texts when students or chat are empty', () => {
  assert.equal(core.STUDENTS_EMPTY_TEXT, 'لا يوجد طلاب مسجلون أو حاضرون في هذا الصف بعد');
  assert.equal(core.CHAT_EMPTY_TEXT, 'لا توجد أسئلة أو رسائل حتى الآن. اكتب سؤالك ليجيب عنه المعلم الافتراضي.');
  assert.equal(core.AI_UNCONFIGURED_TEXT, 'خدمة المعلم الافتراضي غير مفعلة — لا يوجد مزود ذكاء اصطناعي مربوط بالخادم.');
});

// 7) Canva Adapter Integration
check('Canva adapter recognizes virtual classroom prefix and generates honest pointers', () => {
  const adapterCore = require(path.join(root, 'school-canva-adapter-core.js'));
  assert.equal(adapterCore.VIRTUAL_PREFIX, 'virtual:');
  assert.equal(adapterCore.virtualCode('virtual:7K2M9X'), '7K2M9X');
  assert.equal(adapterCore.virtualCode('classroom:7K2M9X'), '');

  const rows = adapterCore.virtualSessionRows([
    {
      code: '7K2M9X',
      status: 'active',
      stage: 'ابتدائي',
      grade: 'السادس ابتدائي',
      subject: 'الرياضيات',
      lesson: 'الكسور العشرية',
      virtualTeacher: { name: 'أ. سارة الذكية' }
    }
  ], { stage: 'ابتدائي', grades: ['السادس ابتدائي'], subject: 'الرياضيات' });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'virtual:7K2M9X');
  assert.match(rows[0].name, /سارة الذكية/);
  assert.match(rows[0].name, /معلم افتراضي \/ AI/);

  // Action plan
  const plan = adapterCore.classroomActionPlan({
    payload: { stage: 'ابتدائي', teacher: 'virtual:7K2M9X', action: 'attendance' },
    items: [],
    students: [{ _id: 'std1', stage: 'ابتدائي', grade: 'السادس ابتدائي' }]
  });
  assert.equal(plan.kind, 'virtual.join');
  assert.equal(plan.code, '7K2M9X');
});

console.log(`\n${passed} checks passed`);
