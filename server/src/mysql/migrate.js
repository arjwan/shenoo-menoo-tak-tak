'use strict';

const crypto = require('node:crypto');
const { buildSchema, identifier } = require('./schema');
const JOURNAL = '_shinomino_mysql_migrations';
const MIGRATION = '001_initial_relational';

function checksum(schema) {
  return crypto.createHash('sha256').update(schema.statements.join(';\n')).digest('hex');
}

async function applySchema(connection, schema) {
  const hash = checksum(schema);
  const [[{ databaseName }]] = await connection.query('SELECT DATABASE() AS databaseName');
  if (!databaseName) throw new Error('Select an existing empty destination database first');
  const lock = 'shinomino_mysql_' + crypto.createHash('sha256').update(databaseName).digest('hex').slice(0, 40);
  const [[{ acquired }]] = await connection.execute('SELECT GET_LOCK(?, 5) AS acquired', [lock]);
  if (Number(acquired) !== 1) throw new Error('Another schema migration is running');
  try {
    const [existing] = await connection.execute('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?', [databaseName]);
    if (existing.length && !existing.some(t => t.name === JOURNAL)) {
      throw new Error('Destination database is not empty. No existing tables have been changed');
    }
    await connection.query(`CREATE TABLE IF NOT EXISTS ${identifier(JOURNAL)} (migration VARCHAR(80) NOT NULL PRIMARY KEY, checksum CHAR(64) CHARACTER SET ascii NOT NULL, completed_steps INT UNSIGNED NOT NULL DEFAULT 0, status VARCHAR(20) NOT NULL, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)) ENGINE=InnoDB`);
    const [rows] = await connection.execute(`SELECT * FROM ${identifier(JOURNAL)} WHERE migration = ?`, [MIGRATION]);
    const row = rows[0];
    if (row && row.checksum !== hash) throw new Error('Migration checksum changed; use a new migration instead of editing an applied schema');
    if (!row && existing.some(t => t.name !== JOURNAL)) throw new Error('Destination contains untracked tables; no schema changes applied');
    const expected = new Set([JOURNAL, ...schema.tables.map(t => t.name)]);
    if (existing.some(t => !expected.has(t.name))) throw new Error('Destination contains tables outside this migration');
    if (row?.status === 'complete') return { applied: 0, total: schema.statements.length, checksum: hash };
    if (!row) await connection.execute(`INSERT INTO ${identifier(JOURNAL)} (migration, checksum, status) VALUES (?, ?, ?)`, [MIGRATION, hash, 'running']);
    const start = Number(row?.completed_steps || 0);
    let step = start;
    try {
      for (; step < schema.statements.length; step++) {
        await connection.query(schema.statements[step]);
        await connection.execute(`UPDATE ${identifier(JOURNAL)} SET completed_steps = ? WHERE migration = ?`, [step + 1, MIGRATION]);
      }
      await connection.execute(`UPDATE ${identifier(JOURNAL)} SET status = ? WHERE migration = ?`, ['complete', MIGRATION]);
    } catch (cause) {
      await connection.execute(`UPDATE ${identifier(JOURNAL)} SET status = ? WHERE migration = ?`, ['failed', MIGRATION]);
      const error = new Error(`Schema stopped at statement ${step + 1}. MySQL DDL commits separately; inspect the journal before retrying. No tables were dropped`, { cause });
      error.code = cause.code;
      throw error;
    }
    return { applied: step - start, total: schema.statements.length, checksum: hash };
  } finally { await connection.execute('SELECT RELEASE_LOCK(?)', [lock]); }
}

async function verifySchema(connection, schema) {
  const problems = [];
  const [[{ databaseName }]] = await connection.query('SELECT DATABASE() AS databaseName');
  const [columns] = await connection.execute('SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType, CHARACTER_SET_NAME AS charset, IS_NULLABLE AS nullable, GENERATION_EXPRESSION AS expression FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?', [databaseName]);
  const [indexes] = await connection.execute('SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName, COLUMN_NAME AS columnName, SUB_PART AS prefix, NON_UNIQUE AS nonUnique, SEQ_IN_INDEX AS seq, INDEX_TYPE AS indexType FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ?', [databaseName]);
  const [foreignKeys] = await connection.execute('SELECT k.TABLE_NAME AS tableName, k.COLUMN_NAME AS columnName, k.REFERENCED_TABLE_NAME AS target, k.REFERENCED_COLUMN_NAME AS targetColumn, r.DELETE_RULE AS deleteRule FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL', [databaseName]);
  for (const table of schema.tables) {
    for (const column of [...table.columns, ...table.generated]) {
      const actual = columns.find(c => c.tableName === table.name && c.columnName === column.name);
      if (!actual) problems.push(`Missing column ${table.name}.${column.name}`);
      else if (actual.columnType.toLowerCase() !== column.type.split(' CHARACTER SET')[0].toLowerCase()) problems.push(`Type mismatch ${table.name}.${column.name}`);
      else if (column.type.includes('CHARACTER SET ascii') && actual.charset !== 'ascii') problems.push(`Character set mismatch ${table.name}.${column.name}`);
      else if (!column.expression && actual.nullable !== (column.nullable ? 'YES' : 'NO')) problems.push(`Nullability mismatch ${table.name}.${column.name}`);
      else if (column.expression && !actual.expression) problems.push(`Missing generated expression ${table.name}.${column.name}`);
    }
    for (const ix of [...table.indexes, { name: 'PRIMARY', columns: [table.parent ? '_row_id' : '_id'], unique: true }]) {
      const found = indexes.filter(i => i.tableName === table.name && i.indexName === ix.name).sort((a, b) => a.seq - b.seq);
      if (found.map(i => i.columnName).join('|') !== ix.columns.join('|') || found.some(i => !!Number(i.nonUnique) === !!ix.unique || Number(i.prefix || 0) !== Number(ix.prefixes?.[i.columnName] || 0)) || (ix.fulltext && found.some(i => i.indexType !== 'FULLTEXT'))) problems.push(`Index mismatch ${table.name}.${ix.name}`);
    }
  }
  for (const r of schema.relations) {
    if (!foreignKeys.some(k => k.tableName === r.table && k.columnName === r.column && k.target === r.target && k.targetColumn === r.targetColumn && k.deleteRule === r.onDelete)) problems.push(`Missing relationship ${r.table}.${r.column}`);
  }
  const [journal] = await connection.execute(`SELECT checksum, status FROM ${identifier(JOURNAL)} WHERE migration = ?`, [MIGRATION]);
  if (journal[0]?.status !== 'complete' || journal[0]?.checksum !== checksum(schema)) problems.push('Migration journal is incomplete or checksum differs');
  return problems;
}

module.exports = { MIGRATION, JOURNAL, checksum, applySchema, verifySchema, buildSchema };
