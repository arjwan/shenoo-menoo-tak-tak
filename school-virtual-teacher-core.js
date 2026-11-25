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
      name: 'أ. سارة الذكية',
      label: 'معلم افتراضي / AI',
      roleDescription: 'معلمة الرياضيات افتراضية',
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
      roleDescription: 'معلمة اللغة العربية افتراضية',
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
      roleDescription: 'معلمة الرياضيات افتراضية',
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
      roleDescription: 'معلمة التربية الإسلامية افتراضية',
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
      roleDescription: 'معلمة اللغة الإنكليزية افتراضية',
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
      roleDescription: 'معلمة العلوم افتراضية',
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
      roleDescription: 'معلمة القراءة افتراضية',
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
      roleDescription: 'معلمة الرياضيات افتراضية',
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
      roleDescription: 'معلمة الاجتماعيات افتراضية',
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
      roleDescription: 'معلمة الفنية افتراضية',
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
      roleDescription: 'معلمة اللغة العربية افتراضية',
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
      roleDescription: 'معلمة الاجتماعيات افتراضية',
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
      roleDescription: 'معلمة العلوم افتراضية',
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
      roleDescription: 'معلمة اللغة الإنكليزية افتراضية',
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
      roleDescription: 'معلمة الرياضيات افتراضية',
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
      roleDescription: 'معلمة الفيزياء افتراضية',
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
      roleDescription: 'معلمة الأحياء افتراضية',
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
      roleDescription: 'معلمة الحاسوب افتراضية',
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
      roleDescription: 'معلمة التاريخ افتراضية',
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
      roleDescription: 'معلمة اللغة العربية افتراضية',
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
      roleDescription: 'معلمة قواعد اللغة العربية افتراضية',
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
      roleDescription: 'معلمة الرياضيات افتراضية',
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
      roleDescription: 'معلمة الفيزياء افتراضية',
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
      roleDescription: 'معلمة الكيمياء افتراضية',
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
      roleDescription: 'معلمة الأحياء افتراضية',
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
      roleDescription: 'معلمة اللغة الإنكليزية افتراضية',
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
      roleDescription: 'معلمة التاريخ افتراضية',
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
      roleDescription: 'معلمة الجغرافية افتراضية',
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
      roleDescription: 'معلمة الاقتصاد افتراضية',
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
      roleDescription: 'معلمة الفلسفة افتراضية',
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

  var DIALECTS = [
    { id: 'ar-standard', name: 'العربية الفصحى', description: 'لغة المناهج الرسمية المعتمدة', isDefault: true },
    { id: 'ar-iraqi', name: 'اللهجة العراقية', description: 'شرح مبسط ودافئ بالعامية العراقية', isDefault: false },
    { id: 'en', name: 'English', description: 'English language support (future)', isDefault: false }
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

  /**
   * Sequential server-audio playlist for one teacher answer.
   *
   * Contract (all dependencies are injected so Node tests can verify the
   * behaviour without a browser):
   *  - fetchPart(partIndex) resolves { buffer, total } or rejects with an
   *    Error carrying .status (0 = network/transient).
   *  - playBuffer(buffer) resolves when that part finished playing.
   *  - Parts play strictly in order and advance only after success, so a
   *    failed later part never replays earlier parts.
   *  - Transient failures (status 0, 429, >=500) are retried with backoff.
   *  - Device speechSynthesis is NEVER chosen here: the caller decides what
   *    to do when the result reports a first-part failure.
   * Returns { completedParts, total, failure } where failure is null on
   * success, or { atPart, status, message, autoplayBlocked }.
   */
  function createSpeechPlaylist(deps) {
    var fetchPart = deps.fetchPart;
    var playBuffer = deps.playBuffer;
    var sleep = deps.sleep || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var isCancelled = deps.isCancelled || function () { return false; };
    var maxParts = Math.max(1, deps.maxParts || 12);
    var retries = Math.max(1, deps.retries || 3);

    function isTransient(error) {
      var status = error && error.status;
      return status === 0 || status === 429 || (typeof status === 'number' && status >= 500);
    }

    return async function run() {
      var total = 1;
      var part = 0;
      var finalError = null;
      while (part < total && part < maxParts && !isCancelled()) {
        var fetched = null;
        for (var attempt = 0; attempt < retries && !isCancelled(); attempt += 1) {
          try {
            fetched = await fetchPart(part);
            break;
          } catch (partError) {
            finalError = partError;
            if (!isTransient(partError) || attempt === retries - 1) break;
            await sleep(700 * (attempt + 1));
          }
        }
        if (isCancelled()) return { completedParts: part, total: total, failure: null, cancelled: true };
        if (!fetched) break;
        total = Math.max(1, Math.min(fetched.total || 1, maxParts));
        try {
          await playBuffer(fetched.buffer);
          part += 1; // advance only after this part actually finished playing
        } catch (playError) {
          finalError = playError;
          break;
        }
      }
      return {
        completedParts: part,
        total: total,
        failure: finalError ? {
          atPart: part,
          status: finalError.status || 0,
          message: String(finalError.message || 'فشل غير معروف'),
          autoplayBlocked: Boolean(finalError.autoplay)
        } : null,
        cancelled: false
      };
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
    createSpeechPlaylist: createSpeechPlaylist,
    verifyPrivacyStatics: verifyPrivacyStatics
  };
}));
