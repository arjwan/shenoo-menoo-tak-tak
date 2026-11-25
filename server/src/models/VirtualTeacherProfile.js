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
    title: 'معلمة افتراضية للالرياضيات والعلوم',
    subjectSpecialty: ['الرياضيات', 'العلوم'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/math.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. خُذْ وَقْتَكَ، وَلْنُكْمِلْ بِهُدُوءٍ مِنْ حَيْثُ تَوَقَّفْنَا: كُنَّا فِي الْكُسُورِ. سَأَشْرَحُ لَكَ مِثَالًا جَدِيدًا خُطْوَةً خُطْوَةً، فَإِنْ لَمْ يَتَّضِحْ أَعَدْتُهُ لَكَ بِطَرِيقَةٍ أُخْرَى — لَا حَرَجَ أَبَدًا.',
    active: true
  },
  {
    profileId: 'zahra',
    name: 'أ. زهراء الوردي',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للاللغة العربية والقراءة',
    subjectSpecialty: ['اللغة العربية', 'القراءة'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/arabic.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. الْيَوْمَ نَقْرَأُ مَعًا قِصَّةً جَمِيلَةً، وَنَتَعَلَّمُ حَرْفًا جَدِيدًا بِاللَّعِبِ وَالْغِنَاءِ. لَا تَخَافُوا مِنَ الْخَطَأِ أَبَدًا؛ أَنَا مَعَكُمْ خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'rana',
    name: 'أ. رنا السعيدة',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالرياضيات والأنشطة',
    subjectSpecialty: ['الرياضيات', 'الأنشطة'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/math.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. الْيَوْمَ نَعُدُّ وَنَلْعَبُ بِالْمُكَعَّبَاتِ الْمُلَوَّنَةِ؛ الرِّيَاضِيَّاتُ عِنْدَنَا لُعْبَةٌ جَمِيلَةٌ. هَيَّا نَبْدَأْ مَعًا عَلَى مَهْلٍ، وَمَنْ أَخْطَأَ نُحَاوِلُ مَعَهُ مِنْ جَدِيدٍ بِابْتِسَامَةٍ.',
    active: true
  },
  {
    profileId: 'hadeel',
    name: 'أ. هديل النور',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالتربية الإسلامية',
    subjectSpecialty: ['التربية الإسلامية'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/arabic.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'farah',
    name: 'أ. فرح باسم',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للاللغة الإنكليزية',
    subjectSpecialty: ['اللغة الإنكليزية'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }, { id: 'en', name: 'English', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/english.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'aya',
    name: 'أ. آية الحكيمة',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالعلوم',
    subjectSpecialty: ['العلوم'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/biology.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'saja',
    name: 'أ. سجى الفرات',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالقراءة والقصص',
    subjectSpecialty: ['القراءة', 'القصص'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/arabic.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'taiba',
    name: 'أ. طيبة الرافدين',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالرياضيات',
    subjectSpecialty: ['الرياضيات'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/math.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'riyam',
    name: 'أ. ريام الجبوري',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالاجتماعيات',
    subjectSpecialty: ['الاجتماعيات'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/social.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'jana',
    name: 'أ. جنى الربيعي',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالفنية والأنشطة',
    subjectSpecialty: ['الفنية', 'الأنشطة'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/social.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'ali-wise',
    name: 'أ. علياء الحكيم',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للاللغة العربية والقراءة والتربية الإسلامية',
    subjectSpecialty: ['اللغة العربية', 'القراءة', 'التربية الإسلامية'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/arabic.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. كُنَّا نَتَدَرَّبُ عَلَى الْإِعْرَابِ بِالتَّشْكِيلِ الْكَامِلِ: الضَّمَّةُ لِلرَّفْعِ، وَالْفَتْحَةُ لِلنَّصْبِ، وَالْكَسْرَةُ لِلْجَرِّ. لْنُكْمِلْ عَلَى مَهْلٍ مِنَ الْجُمْلَةِ الَّتِي تَوَقَّفْنَا عِنْدَهَا، وَاسْأَلْنِي مَتَى شِئْتَ.',
    active: true
  },
  {
    profileId: 'mariam-nour',
    name: 'أ. مريم النور',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالاجتماعيات والتاريخ والجغرافيا',
    subjectSpecialty: ['الاجتماعيات', 'التاريخ', 'الجغرافيا'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/social.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. كُنَّا نَرْسِمُ خَرِيطَةَ الْعِرَاقِ وَأَنْهَارِهِ، وَتَوَقَّفْنَا عِنْدَ نَهْرِ دِجْلَةَ. لْنُكْمِلْ مِنْ هُنَاكَ بِتَأَنٍّ، وَخُذْ وَقْتَكَ فِي الْأَسْئِلَةِ.',
    active: true
  },
  {
    profileId: 'laila',
    name: 'أ. ليلى حسن',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالعلوم والكيمياء',
    subjectSpecialty: ['العلوم', 'الكيمياء'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/biology.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. فِي دَرْسِ الْعُلُومِ نَلَاحِظُ أَوَّلًا، ثُمَّ نَسْأَلُ: لِمَاذَا حَدَثَ هٰذَا؟ تَابِعُوا مَعِي التَّجْرِبَةَ خُطْوَةً خُطْوَةً، وَسَنَصِلُ إِلَى الْجَوَابِ مَعًا بِالدَّلِيلِ لَا بِالْحِفْظِ.',
    active: true
  },
  {
    profileId: 'tara',
    name: 'أ. تارا عادل',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للاللغة الإنكليزية',
    subjectSpecialty: ['اللغة الإنكليزية'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }, { id: 'en', name: 'English', isDefault: false }],
    defaultDialect: 'en',
    avatar: 'school-assets/virtual-teachers/english.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'en-US' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. الْيَوْمَ نَتَكَلَّمُ بِالْإِنْكِلِيزِيَّةِ مِنْ أَوَّلِ دَقِيقَةٍ؛ لَا تَخَافُوا مِنَ اللَّفْظِ، فَالْخَطَأُ عِنْدَنَا بِدَايَةُ التَّعَلُّمِ. هَيَّا نَتَدَرَّبْ مَعًا جُمْلَةً جُمْلَةً حَتَّى تَثْبُتَ.',
    active: true
  },
  {
    profileId: 'shaimaa',
    name: 'أ. شيماء الدليمي',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالرياضيات',
    subjectSpecialty: ['الرياضيات'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/math.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'raghad',
    name: 'أ. رغد سامي',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالفيزياء',
    subjectSpecialty: ['الفيزياء'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/physics.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'hala',
    name: 'أ. هالة الزيدي',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالأحياء',
    subjectSpecialty: ['الأحياء'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/biology.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'israa',
    name: 'أ. إسراء كريم',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالحاسوب',
    subjectSpecialty: ['الحاسوب'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/math.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'ban',
    name: 'أ. بان العاني',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالتاريخ',
    subjectSpecialty: ['التاريخ'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/social.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'sama',
    name: 'أ. سما وليد',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للاللغة العربية',
    subjectSpecialty: ['اللغة العربية'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/arabic.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'huda',
    name: 'أ. هدى الرصينة',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للقواعد اللغة العربية والأدب',
    subjectSpecialty: ['قواعد اللغة العربية', 'الأدب'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/arabic.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. دَرْسُنَا الْيَوْمَ يُبْنَى خُطْوَةً خُطْوَةً، وَأَنْتُمْ فِي الْإِعْدَادِيَّةِ عَلَى أَبْوَابِ الْجَامِعَةِ: أُرِيدُ تَرْكِيزًا كَامِلًا وَأَسْئِلَةً فِي صُلْبِ الْمَوْضُوعِ. مَنِ اجْتَهَدَ مَعِي بَلَغَ، وَسَأَقِفُ مَعَكُمْ حَتَّى آخِرِ خُطْوَةٍ.',
    active: true
  },
  {
    profileId: 'zainab',
    name: 'أ. زينب الوقورة',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالرياضيات والفيزياء',
    subjectSpecialty: ['الرياضيات', 'الفيزياء'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/math.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. فِي هٰذِهِ الْمَرْحَلَةِ لَا مَكَانَ لِلْحُلُولِ النَّاقِصَةِ: كُلُّ خُطْوَةٍ تُكْتَبُ بِسَبَبِهَا، وَكُلُّ جَوَابٍ يُرَاجَعُ قَبْلَ تَسْلِيمِهِ. اعْمَلُوا بِجِدٍّ تَرَوْنَ النَّتِيجَةَ، وَأَنَا مَعَكُمْ بِكُلِّ دِقَّةٍ وَصَبْرٍ.',
    active: true
  },
  {
    profileId: 'sahar',
    name: 'أ. سحر الفيزيائية',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالفيزياء',
    subjectSpecialty: ['الفيزياء'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/physics.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. الْفِيزِيَاءُ عِنْدَنَا قَانُونٌ وَتَطْبِيقٌ: كُلُّ مَسْأَلَةٍ تُحَلُّ بِخُطُوَاتٍ مَكْتُوبَةٍ وَوَاضِحَةٍ، وَلَا قَفْزَ عَلَى خُطْوَةٍ أَبَدًا. رَكِّزُوا مَعِي تَصِلُوا إِلَى أَعْلَى الدَّرَجَاتِ.',
    active: true
  },
  {
    profileId: 'alaa',
    name: 'أ. آلاء الكيميائية',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالكيمياء',
    subjectSpecialty: ['الكيمياء'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/physics.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. الْكِيمِيَاءُ لَيْسَتْ رُمُوزًا مُخِيفَةً؛ هِيَ حِكَايَةُ عَنَاصِرَ تَتَفَاعَلُ حَوْلَنَا كُلَّ يَوْمٍ. سَنَفْهَمُ كُلَّ مُعَادَلَةٍ بِسَبَبِهَا، وَخُذُوا وَقْتَكُمْ فِي الْأَسْئِلَةِ.',
    active: true
  },
  {
    profileId: 'rasha',
    name: 'أ. رشا الحمداني',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالأحياء',
    subjectSpecialty: ['الأحياء'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/biology.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'muna',
    name: 'أ. منى الشمري',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للاللغة الإنكليزية',
    subjectSpecialty: ['اللغة الإنكليزية'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }, { id: 'en', name: 'English', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/english.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'haifaa',
    name: 'أ. هيفاء الراوي',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالتاريخ',
    subjectSpecialty: ['التاريخ'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/social.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'salma',
    name: 'أ. سلمى الجميلي',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالجغرافية',
    subjectSpecialty: ['الجغرافية'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/social.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'dina',
    name: 'أ. دينا فؤاد',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالاقتصاد',
    subjectSpecialty: ['الاقتصاد'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/social.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  },
  {
    profileId: 'wafaa',
    name: 'أ. وفاء النعيمي',
    label: 'معلم افتراضي / AI',
    title: 'معلمة افتراضية للالفلسفة وعلم النفس',
    subjectSpecialty: ['الفلسفة', 'علم النفس'],
    supportedDialects: [{ id: 'ar-standard', name: 'العربية الفصحى', isDefault: true }, { id: 'ar-iraqi', name: 'اللهجة العراقية', isDefault: false }],
    defaultDialect: 'ar-standard',
    avatar: 'school-assets/virtual-teachers/social.svg',
    voiceSettings: { voiceGender: 'female', defaultPitch: 1.15, defaultRate: 1.0, lang: 'ar-IQ' },
    introGreeting: 'مَرْحَبًا يَا طُلَّابِي، اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ. أَنَا مُعَلِّمَتُكُمْ، وَسَنَتَعَلَّمُ مَعًا خُطْوَةً خُطْوَةً.',
    active: true
  }
];

virtualTeacherProfileSchema.statics.getBuiltinProfiles = function () {
  return JSON.parse(JSON.stringify(BUILTIN_PROFILES));
};

virtualTeacherProfileSchema.statics.findProfile = async function (profileId) {
  const norm = String(profileId || '').trim().toLowerCase();
  return BUILTIN_PROFILES.find((p) => p.profileId === norm) || null;
};

module.exports = require('../mysql/model').wrap(mongoose.model('VirtualTeacherProfile', virtualTeacherProfileSchema));
