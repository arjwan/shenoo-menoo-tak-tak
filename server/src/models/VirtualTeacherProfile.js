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
    name: 'أ. سارة الذكية',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للرياضيات والعلوم',
    subjectSpecialty: ['الرياضيات', 'العلوم', 'كيمياء', 'فيزياء', 'أحياء'],
    supportedDialects: [
      { id: 'ar-standard', name: 'العربية الفصحى', isDefault: true },
      { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false },
      { id: 'en', name: 'English (قريباً)', isDefault: false }
    ],
    defaultDialect: 'ar-standard',
    avatar: '',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.05, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'أهلاً بكم يا أبطال، اليوم سنتعلم معاً بطريقة سهلة وتفاعلية خطوة بخطوة.',
    active: true
  },
  {
    profileId: 'ali-wise',
    name: 'أ. علي الحكيم',
    label: 'معلم افتراضي / AI',
    title: 'معلم افتراضي للغة العربية والتربية الإسلامية',
    subjectSpecialty: ['اللغة العربية', 'القراءة', 'قواعد اللغة العربية', 'التربية الإسلامية', 'القرآن الكريم'],
    supportedDialects: [
      { id: 'ar-standard', name: 'العربية الفصحى', isDefault: true },
      { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false },
      { id: 'en', name: 'English (قريباً)', isDefault: false }
    ],
    defaultDialect: 'ar-standard',
    avatar: '',
    voiceSettings: { voiceGender: 'male', defaultPitch: 0.95, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مرحباً بكم أعزائي الطلبة، لنستكشف معاً جمال لغتنا ومعانيها القيمة.',
    active: true
  },
  {
    profileId: 'mariam-nour',
    name: 'أ. مريم النور',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للاجتماعيات والتاريخ والجغرافيا',
    subjectSpecialty: ['الاجتماعيات', 'التاريخ', 'الجغرافيا', 'الوطنية'],
    supportedDialects: [
      { id: 'ar-standard', name: 'العربية الفصحى', isDefault: true },
      { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false },
      { id: 'en', name: 'English (قريباً)', isDefault: false }
    ],
    defaultDialect: 'ar-standard',
    avatar: '',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.0, defaultRate: 0.95, lang: 'ar-IQ' },
    introGreeting: 'أهلاً بكم في حصتنا، لنتعرف اليوم على تاريخ وحضارة بلادنا العريقة.',
    active: true
  }
];

virtualTeacherProfileSchema.statics.getBuiltinProfiles = function () {
  return JSON.parse(JSON.stringify(BUILTIN_PROFILES));
};

virtualTeacherProfileSchema.statics.findProfile = async function (profileId) {
  const norm = String(profileId || '').trim().toLowerCase();
  const dbProfile = await this.findOne({ profileId: norm, active: true }).lean();
  if (dbProfile) return dbProfile;
  return BUILTIN_PROFILES.find((p) => p.profileId === norm) || null;
};

module.exports = mongoose.model('VirtualTeacherProfile', virtualTeacherProfileSchema);
