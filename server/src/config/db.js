const mongoose = require('mongoose');

async function connectDB() {
  const client = process.env.DB_CLIENT || 'mongodb';
  if (client === 'mysql') return require('../mysql/runtime').start();
  if (client !== 'mongodb') throw new Error('Unsupported DB_CLIENT');
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI غير موجود في ملف .env');
  }

  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

module.exports = connectDB;
module.exports.disconnect = async () => process.env.DB_CLIENT === 'mysql'
  ? require('../mysql/runtime').stop()
  : mongoose.disconnect();
