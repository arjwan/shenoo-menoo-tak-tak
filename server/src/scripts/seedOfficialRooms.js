require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const Group = require('../models/Group');

const rooms = [
  { name: 'سوالف العراق', description: 'الغرفة الكتابية العامة الرسمية لمجتمع شنو منو.', roomType: 'text' },
  { name: 'صوت شنو منو', description: 'غرفة صوتية عامة للتعارف والنقاش المحترم.', roomType: 'voice' },
  { name: 'ساحة التحديات', description: 'الغرفة الرسمية للتحديات والألعاب والمنافسات.', roomType: 'challenge', maxSpeakers: 2 }
];

connectDB().then(async () => {
  const owner = await User.findOne({ role: 'developer', status: 'active' }) || await User.findOne({ role: 'admin', status: 'active' });
  if (!owner) throw new Error('أنشئ حساب مطور أو مدير نشط أولاً');
  for (const data of rooms) await Group.findOneAndUpdate(
    { name: data.name, isOfficial: true },
    { $set: { ...data, privacy: 'public', isOfficial: true, isActive: true }, $setOnInsert: { owner: owner._id, admins: [owner._id], members: [owner._id] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log('Official rooms are ready');
  process.exit(0);
}).catch(error => { console.error(error.message); process.exit(1); });
