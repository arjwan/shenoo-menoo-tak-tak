require('dotenv').config();
const mongoose = require('mongoose');
const GameRoom = require('../models/GameRoom');

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri);
  const now = new Date();
  const result = await GameRoom.updateMany(
    { isActive: { $ne: false } },
    { $set: { isActive: false, expiresAt: null, abandonedAt: now, 'gameState.status': 'finished', 'gameState.updatedAt': now } }
  );
  console.log(`Closed ${result.modifiedCount} active game rooms.`);
  await mongoose.disconnect();
})().catch(async (error) => { console.error(error); await mongoose.disconnect().catch(() => {}); process.exit(1); });
