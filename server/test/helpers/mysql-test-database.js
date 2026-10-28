'use strict';

module.exports = async function setupMySQLTest(expectedName) {
  const assert = require('node:assert/strict');
  assert.equal(process.env.MYSQL_INTEGRATION_TEST, '1');
  assert.equal(process.env.MYSQL_DATABASE, expectedName);
  assert.match(expectedName, /^shinomino_[a-z]+_test$/);
  assert.ok(['localhost', '127.0.0.1'].includes(process.env.MYSQL_HOST));
  assert.equal(process.env.DB_CLIENT, 'mysql');
  const mysql = require('mysql2/promise');
  const admin = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD });
  try { await admin.query('CREATE DATABASE `' + expectedName + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin'); } finally { await admin.end(); }
  const { buildSchema, applySchema } = require('../../src/mysql/migrate');
  const opened = await require('../../src/mysql/connection').openConnection();
  try { await applySchema(opened.connection, buildSchema()); } finally { opened.connection.release(); await opened.pool.end(); }
  await require('../../src/config/db')();
};
