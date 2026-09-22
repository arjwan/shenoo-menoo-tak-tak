'use strict';

// VirtualTeacherProfile: represents an AI virtual teacher persona.
// Important rules:
// - Every persona MUST clearly carry the label "معلم افتراضي / AI".
// - Personas must NOT impersonate real human teachers.
// - Personas are AI/virtual entities, NOT human user accounts.
const mongoose = require('mongoose');

const virtualTeacherProfileSchema = new mongoose.Schema({
  profileId: { type: String, required: true, unique: true, trim: true, lowercase: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  label: { type: String, default: 'معلم افتراضي / AI', trim: true },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  subjectSpecialty: [{ type: String, trim: true }],
  supportedDialects: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    isDefault: { type: Boolean, default: false }
  }],
  defaultDialect: { type: String, default: 'ar-standard' },
  avatar: { type: String, default: '' },
  voiceSettings: {
    voiceGender: { type: String, enum: ['female', 'male'], default: 'female' },
    defaultPitch: { type: Number, default: 1.0 },
    defaultRate: { type: Number, default: 1.0 },
    lang: { type: String, default: 'ar-IQ' }
  },
  introGreeting: { type: String, default: '', trim: true, maxlength: 500 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const BUILTIN_PROFILES = [
  {
    profileId: 'sarah-smart',
    name: 'ست زهراء',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للرياضيات والعلوم',
    subjectSpecialty: ['الرياضيات', 'العلوم'],
    supportedDialects: [
      { id: 'ar-standard', name: 'العربية الفصحى', isDefault: true },
      { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false },
      { id: 'en', name: 'English (قريباً)', isDefault: false }
    ],
    defaultDialect: 'ar-standard',
    avatar: '/sumer-school/assets/virtual-teachers/zahraa.webp',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.05, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'أهلاً بكم يا أبطال، اليوم سنتعلم معاً بطريقة سهلة وتفاعلية خطوة بخطوة.',
    active: true
  },
  {
    profileId: 'ali-wise',
    name: 'أستاذ أحمد',
    label: 'معلم افتراضي / AI',
    title: 'معلم افتراضي للغة العربية والتربية الإسلامية',
    subjectSpecialty: ['اللغة العربية', 'القراءة', 'قواعد اللغة العربية', 'التربية الإسلامية', 'القرآن الكريم'],
    supportedDialects: [
      { id: 'ar-standard', name: 'العربية الفصحى', isDefault: true },
      { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false },
      { id: 'en', name: 'English (قريباً)', isDefault: false }
    ],
    defaultDialect: 'ar-standard',
    avatar: '/sumer-school/assets/virtual-teachers/ahmed.webp',
    voiceSettings: { voiceGender: 'male', defaultPitch: 0.95, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مرحباً بكم أعزائي الطلبة، لنستكشف معاً جمال لغتنا ومعانيها القيمة.',
    active: true
  },
  {
    profileId: 'mariam-nour',
    name: 'ست علياء',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للاجتماعيات والتاريخ والجغرافيا',
    subjectSpecialty: ['الاجتماعيات', 'التاريخ', 'الجغرافيا', 'الوطنية'],
    supportedDialects: [
      { id: 'ar-standard', name: 'العربية الفصحى', isDefault: true },
      { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false },
      { id: 'en', name: 'English (قريباً)', isDefault: false }
    ],
    defaultDialect: 'ar-standard',
    avatar: '/sumer-school/assets/virtual-teachers/alyaa.webp',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.0, defaultRate: 0.95, lang: 'ar-IQ' },
    introGreeting: 'أهلاً بكم في حصتنا، لنتعرف اليوم على تاريخ وحضارة بلادنا العريقة.',
    active: true
  },
  {
    profileId: 'omar-digital',
    name: 'أستاذ عمر',
    label: 'معلم افتراضي / AI',
    title: 'معلم افتراضي للغة الإنجليزية والحاسوب',
    subjectSpecialty: ['اللغة الإنجليزية', 'الحاسوب'],
    supportedDialects: [
      { id: 'ar-standard', name: 'العربية الفصحى', isDefault: true },
      { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false },
      { id: 'en', name: 'English', isDefault: false }
    ],
    defaultDialect: 'ar-standard',
    avatar: '/sumer-school/assets/virtual-teachers/omar.webp',
    voiceSettings: { voiceGender: 'male', defaultPitch: 0.98, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'أهلاً بكم، سنتعلم الإنجليزية والحاسوب بخطوات واضحة وتطبيقات عملية.',
    active: true
  },
  {
    profileId: 'kawthar-lab',
    name: 'ست كوثر',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للأحياء والكيمياء',
    subjectSpecialty: ['الأحياء', 'الكيمياء'],
    supportedDialects: [
      { id: 'ar-standard', name: 'العربية الفصحى', isDefault: true },
      { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }
    ],
    defaultDialect: 'ar-standard',
    avatar: '/sumer-school/assets/virtual-teachers/kawthar.webp',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.02, defaultRate: 0.96, lang: 'ar-IQ' },
    introGreeting: 'مرحباً يا أبطال، سنفهم الأحياء والكيمياء من خلال أمثلة قريبة وتجارب آمنة.',
    active: true
  },
  {
    profileId: 'ali-physics',
    name: 'أستاذ علي',
    label: 'معلم افتراضي / AI',
    title: 'معلم افتراضي للفيزياء والرياضيات',
    subjectSpecialty: ['الفيزياء', 'الرياضيات'],
    supportedDialects: [
      { id: 'ar-standard', name: 'العربية الفصحى', isDefault: true },
      { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }
    ],
    defaultDialect: 'ar-standard',
    avatar: '/sumer-school/assets/virtual-teachers/ali.webp',
    voiceSettings: { voiceGender: 'male', defaultPitch: 0.94, defaultRate: 0.96, lang: 'ar-IQ' },
    introGreeting: 'أهلاً بكم، سنحوّل مسائل الفيزياء والرياضيات إلى أفكار بسيطة خطوة بخطوة.',
    active: true
  }
];

virtualTeacherProfileSchema.statics.getBuiltinProfiles = function () {
  return JSON.parse(JSON.stringify(BUILTIN_PROFILES));
};

virtualTeacherProfileSchema.statics.findProfile = async function (profileId) {
  const norm = String(profileId || '').trim().toLowerCase();
  const builtinProfile = BUILTIN_PROFILES.find((p) => p.profileId === norm);
  if (builtinProfile) return JSON.parse(JSON.stringify(builtinProfile));
  const dbProfile = await this.findOne({ profileId: norm, active: true }).lean();
  if (dbProfile) return dbProfile;
  return null;
};

module.exports = mongoose.model('VirtualTeacherProfile', virtualTeacherProfileSchema);
