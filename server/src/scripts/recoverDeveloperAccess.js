'use strict';

// One-time, server-side recovery utility. It never disables HTTP authentication.
// Usage: node server/src/scripts/recoverDeveloperAccess.js
// Requires the existing .env configuration and only updates/creates the developer
// account in the database selected by DB_CLIENT. Delete this utility after use.

require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const DeveloperMfa = require('../models/DeveloperMfa');

async function main() {
  const username = String(process.env.DEVELOPER_USERNAME || '').trim().toLowerCase();
  const contact = String(process.env.DEVELOPER_CONTACT || '').trim().toLowerCase();
  const password = String(process.env.DEVELOPER_PASSWORD || '');
  const fullName = String(process.env.DEVELOPER_NAME || 'Platform Developer').trim();
  if (!username || !contact || password.length < 12 || password === 'CHANGE_ME_NOW' ||
      process.env.JWT_SECRET?.length < 32 || /change-this|replace-with/i.test(process.env.JWT_SECRET || '')) {
    throw new Error('Set a unique developer username/contact, a password of at least 12 characters, and a strong JWT_SECRET in the server .env');
  }

  await connectDB();
  const existing = await User.findOne({ $or: [{ username }, { contact }] });
  const passwordHash = await bcrypt.hash(password, 12);
  let developer;
  if (existing) {
    existing.fullName = fullName;
    existing.username = username;
    existing.contact = contact;
    existing.contactType = contact.includes('@') ? 'email' : 'phone';
    existing.passwordHash = passwordHash;
    existing.role = 'developer';
    existing.status = 'active';
    existing.termsAccepted = true;
    developer = await existing.save();
  } else {
    developer = await User.create({
      fullName, username, contact,
      contactType: contact.includes('@') ? 'email' : 'phone',
      passwordHash, termsAccepted: true,
      role: 'developer', status: 'active'
    });
  }

  // Re-pairing is intentional during recovery; the first successful login will
  // require registering a new phone or FIDO credential before full access.
  await DeveloperMfa.deleteMany({ user: developer._id });
  console.log('Developer account recovered in the database selected by DB_CLIENT.');
  console.log('MFA enrollment has been reset; register a new phone or FIDO key after login.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
