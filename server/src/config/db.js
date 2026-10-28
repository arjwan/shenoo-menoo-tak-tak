const mongoose = require('mongoose');

async function connectDB() {
  const client = process.env.DB_CLIENT || 'mongodb';
  if (client !== 'mongodb') {
    throw new Error(client === 'mysql'
      ? 'MySQL schema tooling is available, but application services are not yet migrated. Refusing to fall back to MongoDB.'
      : 'Unsupported DB_CLIENT');
  }
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI غير موجود في ملف .env');
  }

  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

module.exports = connectDB;
