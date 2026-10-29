async function connectDB() {
  if (process.env.DB_CLIENT !== 'mysql') throw new Error('Only MariaDB is supported. Configure MYSQL_* and DB_CLIENT=mysql; there is no MongoDB fallback.');
  // Keep the existing unfinished adapter behind its original explicit guard.
  // This is NOT native-service acceptance and must not be enabled by bootstrap.
  if (process.env.MYSQL_RUNTIME_EXPERIMENTAL !== 'true') throw new Error('Legacy runtime is experimental; the remaining service repositories must be ported before production acceptance.');
  const native = require('../mariadb/database');
  await native.connect();
  try { return await require('../mysql/runtime').start(); }
  catch (error) { await native.close(); throw error; }
}

module.exports = connectDB;
module.exports.disconnect = async () => {
  await require('../mysql/runtime').stop();
  await require('../mariadb/database').close();
};
