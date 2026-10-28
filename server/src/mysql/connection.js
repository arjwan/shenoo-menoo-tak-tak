'use strict';

const fs = require('node:fs');

function connectionOptions(env = process.env) {
  for (const key of ['MYSQL_HOST', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD']) {
    if (!env[key]) throw new Error(`Missing ${key}`);
  }
  const port = Number(env.MYSQL_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid MYSQL_PORT');
  const sslMode = env.MYSQL_SSL_MODE || 'required';
  if (!['required', 'disabled'].includes(sslMode)) throw new Error('MYSQL_SSL_MODE must be required or disabled');
  const options = {
    host: env.MYSQL_HOST, port, database: env.MYSQL_DATABASE,
    user: env.MYSQL_USER, password: env.MYSQL_PASSWORD,
    charset: 'utf8mb4', timezone: 'Z', connectionLimit: 4,
    connectTimeout: 10000, waitForConnections: true, queueLimit: 20,
    multipleStatements: false, supportBigNumbers: true, bigNumberStrings: true,
    enableKeepAlive: true
  };
  if (sslMode === 'required') options.ssl = {
    rejectUnauthorized: true,
    ...(env.MYSQL_SSL_CA_FILE ? { ca: fs.readFileSync(env.MYSQL_SSL_CA_FILE, 'utf8') } : {})
  };
  return options;
}

async function openConnection(env = process.env) {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool(connectionOptions(env));
  try {
    const connection = await pool.getConnection();
    try {
      await connection.query("SET time_zone = '+00:00'");
      await connection.query("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
      const [[info]] = await connection.query('SELECT VERSION() AS version, DATABASE() AS databaseName');
      if (/mariadb/i.test(info.version) || Number(info.version.split('.')[0]) < 8) throw new Error('This migration targets MySQL 8 or newer; the server version is unsupported');
      return { pool, connection, info };
    } catch (error) { connection.release(); throw error; }
  } catch (error) { await pool.end(); throw error; }
}

module.exports = { connectionOptions, openConnection };
