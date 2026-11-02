'use strict';

const mongoose = require('mongoose');

async function connectDB() {
  const uri = String(process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();
  if (!uri) throw new Error('MONGODB_URI is required; configure the existing MongoDB connection in the hosting environment.');
  mongoose.set('strictQuery', true);
  mongoose.connection.on('error', (error) => console.error('MongoDB connection error:', error.message));
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 10000),
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 20),
    minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 0)
  });
  console.log('MongoDB connected');
  return mongoose.connection;
}

module.exports = connectDB;
module.exports.disconnect = async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};
