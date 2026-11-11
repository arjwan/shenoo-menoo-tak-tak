'use strict';

// Database selection is explicit. Never silently fall back between engines.
async function connectDB() {
  if (process.env.DB_CLIENT === 'mongodb') {
    const uri = process.env.MONGODB_URI || '';
    const database = process.env.MONGODB_DB_NAME || '';
    if (!/^mongodb(?:\+srv)?:\/\//.test(uri) || !database || !/^[a-zA-Z0-9_-]+$/.test(database)) {
      throw new Error('MongoDB requires MONGODB_URI and an explicit MONGODB_DB_NAME');
    }
    const mongoose = require('mongoose');
    // Specifying dbName prevents an unintended connection to the URI default.
    await mongoose.connect(uri, {
      dbName: database,
      serverSelectionTimeoutMS: 10000,
      autoIndex: false
    });
    return mongoose.connection;
  }

  if (process.env.DB_CLIENT !== 'mysql') {
    throw new Error('Set DB_CLIENT to mysql or mongodb explicitly; automatic fallback is disabled.');
  }
  if (process.env.MYSQL_RUNTIME_EXPERIMENTAL !== 'true') {
    throw new Error('Legacy runtime is experimental; the remaining service repositories must be ported before production acceptance.');
  }
  const native = require('../mariadb/database');
  await native.connect();
  try { return await require('../mysql/runtime').start(); }
  catch (error) { await native.close(); throw error; }
}

module.exports = connectDB;
module.exports.disconnect = async () => {
  if (process.env.DB_CLIENT === 'mongodb') {
    await require('mongoose').disconnect();
    return;
  }
  await require('../mysql/runtime').stop();
  await require('../mariadb/database').close();
};
