require('dotenv').config();

const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

async function run() {
  await connectDB();

  const username = String(process.env.DEVELOPER_USERNAME || '').trim().toLowerCase();
  const contact = String(process.env.DEVELOPER_CONTACT || '').trim().toLowerCase();
  const password = String(process.env.DEVELOPER_PASSWORD || '');
  const fullName = String(process.env.DEVELOPER_NAME || 'Platform Developer').trim();

  if (!username || !contact || !password || password === 'CHANGE_ME_NOW') {
    throw new Error('اضبط بيانات حساب المطور في ملف .env أولًا');
  }

  const existing = await User.findOne({
    $or: [{ username }, { contact }]
  });

  if (existing) {
    existing.role = 'developer';
    existing.status = 'active';
    existing.passwordHash = await bcrypt.hash(password, 12);
    await existing.save();

    console.log('Developer account updated');
    process.exit(0);
  }

  await User.create({
    fullName,
    username,
    contact,
    contactType: contact.includes('@') ? 'email' : 'phone',
    passwordHash: await bcrypt.hash(password, 12),
    termsAccepted: true,
    role: 'developer',
    status: 'active'
  });

  console.log('Developer account created');
  process.exit(0);
}

run().catch(error => {
  console.error(error.message);
  process.exit(1);
});
