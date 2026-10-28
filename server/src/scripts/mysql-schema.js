#!/usr/bin/env node
'use strict';

require('dotenv').config({ quiet: true });
const { buildSchema, applySchema, verifySchema } = require('../mysql/migrate');
const { openConnection } = require('../mysql/connection');

async function main() {
  const action = process.argv[2] || 'plan';
  if (!['plan', 'sql', 'check', 'apply', 'verify'].includes(action)) throw new Error('Usage: node server/src/scripts/mysql-schema.js [plan|sql|check|apply|verify]');
  const schema = buildSchema();
  if (action === 'sql') {
    process.stdout.write('-- Candidate schema only. Application services are not yet migrated.\n' + schema.statements.join(';\n\n') + ';\n');
    return;
  }
  if (action === 'plan') {
    console.log(JSON.stringify({ models: schema.models, tables: schema.tables.length, relationships: schema.relations.length, statements: schema.statements.length, notes: schema.notes, runtimeReady: false }, null, 2));
    return;
  }
  const { pool, connection, info } = await openConnection();
  try {
    if (action === 'check') console.log(JSON.stringify({ ok: true, version: info.version, runtimeReady: false }));
    if (action === 'apply') console.log(JSON.stringify(await applySchema(connection, schema)));
    if (action === 'verify') {
      const problems = await verifySchema(connection, schema);
      console.log(JSON.stringify({ ok: !problems.length, problems, runtimeReady: false }, null, 2));
      if (problems.length) process.exitCode = 1;
    }
  } finally { connection.release(); await pool.end(); }
}

main().catch(error => {
  // Driver messages can contain usernames and SQL values. Keep credentials out of logs.
  const known = /^(Missing MYSQL_|Invalid MYSQL_|MYSQL_SSL_MODE|This migration|Usage:|Select an existing|Another schema|Destination |Migration checksum|Schema stopped)/.test(error.message);
  console.error(known ? error.message : `MySQL operation failed (${error.code || 'UNKNOWN'}). Check server-side connection settings`);
  process.exitCode = 1;
});
