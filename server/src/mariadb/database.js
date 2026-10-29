'use strict';

const { openConnection } = require('../mysql/connection');
let connected;
let opening;

async function connect(env = process.env) {
  if (connected) return connected;
  if (opening) return opening;
  opening = (async () => {
    let opened;
    try {
      opened = await openConnection(env);
      if (!/MariaDB/i.test(opened.info.version)) throw new Error('MariaDB is required');
      connected = opened.pool;
      return connected;
    } catch {
      if (opened) await opened.pool.end();
      throw new Error('MariaDB connection failed. Check MYSQL_* configuration, TLS and database permissions; no fallback is available.');
    } finally {
      if (opened) opened.connection.release();
      opening = null;
    }
  })();
  return opening;
}
async function close() {
  if (opening) await opening.catch(() => {});
  const pool = connected; connected = null;
  if (pool) await pool.end();
}
async function transaction(work) {
  const pool = await connect();
  const connection = await pool.getConnection();
  try {
    await connection.query("SET time_zone = '+00:00'");
    await connection.query("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally { connection.release(); }
}
async function execute(sql, values = []) {
  const pool = await connect();
  const connection = await pool.getConnection();
  try {
    await connection.query("SET time_zone = '+00:00'");
    await connection.query("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
    return await connection.execute(sql, values);
  } finally { connection.release(); }
}
module.exports = { connect, close, transaction, execute };
