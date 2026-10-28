'use strict';

const { openConnection } = require('./connection');
const { buildSchema, verifySchema } = require('./migrate');
const { identifier: q } = require('./schema');
const { compileFilter } = require('./filter');
const { readRows, writeDocument, clone, applyUpdate, equal, get } = require('./data');
let current;

async function start() {
  if (current) return;
  if (process.env.MYSQL_RUNTIME_EXPERIMENTAL !== 'true') throw new Error('MySQL runtime is experimental. MYSQL_RUNTIME_EXPERIMENTAL=true is required in an isolated test environment');
  const opened = await openConnection();
  try {
    const schema = buildSchema();
    const problems = await verifySchema(opened.connection, schema);
    if (problems.length) throw new Error('MySQL schema verification failed: ' + problems.join('; '));
    current = { pool: opened.pool, schema };
  } catch (error) { await opened.pool.end(); throw error; }
  finally { opened.connection.release(); }
}
async function stop() { const old = current; current = null; if (old) await old.pool.end(); }
function state() { if (!current) throw new Error('MySQL runtime is not connected'); return current; }
function tableFor(model) {
  const table = state().schema.tables.find(t => !t.parent && t.model === model.modelName);
  if (!table) throw new Error('Unmapped SQL model: ' + model.modelName);
  return table;
}
async function transaction(work) {
  const { pool } = state();
  for (let attempt = 0; ; attempt++) {
    const c = await pool.getConnection();
    try {
      await c.query("SET time_zone = '+00:00'");
      await c.beginTransaction();
      const result = await work(c);
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback().catch(() => {});
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code) && attempt < 2) continue;
      if (error.code === 'ER_DUP_ENTRY') {
        const duplicate = new Error('Duplicate value for a unique account or record field');
        duplicate.code = 11000;
        throw duplicate;
      }
      throw error;
    } finally { c.release(); }
  }
}
async function select(c, model, filter = {}, options = {}, locked = false) {
  const table = tableFor(model), schema = state().schema;
  const cast = model.find(filter).cast(model);
  const where = compileFilter(schema, table, cast);
  let sql = `SELECT r.* FROM ${q(table.name)} r WHERE ${where.sql}`;
  if (options.sort) {
    const sort = typeof options.sort === 'string' ? Object.fromEntries(options.sort.split(/\s+/).filter(Boolean).map(k => [k.replace(/^-/, ''), k.startsWith('-') ? -1 : 1])) : options.sort;
    sql += ' ORDER BY ' + Object.entries(sort).map(([field, direction]) => {
      if (!table.columns.some(c => c.name === field)) throw new Error('Unsupported SQL sort field: ' + field);
      return 'r.' + q(field) + (Number(direction) < 0 ? ' DESC' : ' ASC');
    }).join(', ');
  }
  const limit = options.limit == null ? null : Number(options.limit);
  const skip = Number(options.skip || 0);
  if (!Number.isSafeInteger(skip) || skip < 0 || (limit !== null && (!Number.isSafeInteger(limit) || limit < 0))) throw new Error('Invalid SQL pagination');
  if (limit) sql += ` LIMIT ${limit}`;
  else if (skip) sql += ' LIMIT 18446744073709551615';
  if (skip) sql += ` OFFSET ${skip}`;
  if (locked) sql += ' FOR UPDATE';
  const [rows] = await c.execute(sql, where.values);
  return readRows(c, schema, table, rows);
}
async function find(model, filter, options) { return transaction(c => select(c, model, filter, options)); }
async function count(model, filter = {}) {
  return transaction(async c => {
    const table = tableFor(model);
    const where = compileFilter(state().schema, table, model.find(filter).cast(model));
    const [[row]] = await c.execute(`SELECT COUNT(*) AS count FROM ${q(table.name)} r WHERE ${where.sql}`, where.values);
    return Number(row.count);
  });
}
function plain(doc) { return doc.toObject({ depopulate: true, flattenMaps: true, virtuals: false }); }
async function prepare(model, data, fresh) {
  const doc = new model(data);
  if (model.schema.options.timestamps) {
    const now = new Date();
    if (fresh && !doc.createdAt) doc.createdAt = now;
    doc.updatedAt = now;
  }
  await doc.validate();
  return plain(doc);
}
async function insert(model, data) {
  const doc = await prepare(model, data, true);
  doc.__v = 0;
  await transaction(c => writeDocument(c, state().schema, tableFor(model), doc, true));
  return doc;
}
async function save(model, doc, snapshot) {
  await doc.validate();
  if (doc.isNew) return insert(model, plain(doc));
  // Apply only changed fields. Projected documents cannot overwrite unseen fields.
  const update = doc.getChanges();
  return transaction(async c => {
    const [stored] = await select(c, model, { _id: doc._id }, { limit: 1 }, true);
    if (!stored) throw new Error('Document no longer exists');
    const changedPaths = [...Object.keys(update.$set || {}), ...Object.keys(update.$unset || {})].filter(p => p !== '__v');
    if (Number(stored.__v || 0) !== Number(snapshot.version || 0) && changedPaths.some(p => !equal(get(stored, p), get(snapshot.baseline, p)))) {
      const error = new Error('Record changed in another request; reload it before saving');
      error.name = 'VersionError'; throw error;
    }
    const updated = await prepare(model, applyUpdate(stored, update), false);
    updated.__v = Number(stored.__v || 0) + 1;
    await writeDocument(c, state().schema, tableFor(model), updated, false);
    return updated;
  });
}
async function mutate(model, filter, update, options = {}, mode = 'updateOne') {
  return transaction(async c => {
    const rows = await select(c, model, filter, { ...options, limit: mode.endsWith('Many') ? undefined : 1 }, true);
    const before = clone(rows[0] || null);
    if (mode.startsWith('delete') || mode === 'findOneAndDelete') {
      const table = tableFor(model);
      for (const row of rows) await c.execute(`DELETE FROM ${q(table.name)} WHERE _id = ?`, [String(row._id)]);
      return { deletedCount: rows.length, before };
    }
    if (!rows.length && options.upsert) {
      const seed = {};
      for (const [key, value] of Object.entries(filter)) {
        if (key.startsWith('$') || (value && typeof value === 'object' && !(value instanceof Date) && !value._bsontype)) continue;
        require('./data').set(seed, key, clone(value));
      }
      const fresh = await prepare(model, applyUpdate(seed, update, true), true);
      fresh.__v = 0;
      await writeDocument(c, state().schema, tableFor(model), fresh, true);
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: fresh._id, before: null, after: fresh };
    }
    let after;
    for (const row of rows) {
      const version = Number(row.__v || 0);
      after = await prepare(model, applyUpdate(row, update), false);
      after.__v = version + 1;
      await writeDocument(c, state().schema, tableFor(model), after, false);
    }
    return { acknowledged: true, matchedCount: rows.length, modifiedCount: rows.length, upsertedCount: 0, upsertedId: null, before, after: after || null };
  });
}
async function countOptional(names) {
  return transaction(async c => {
    const [tables] = await c.query('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
    const table = names.find(n => tables.some(t => t.name === n));
    if (!table) return 0;
    const [[row]] = await c.query(`SELECT COUNT(*) AS count FROM ${q(table)}`);
    return Number(row.count);
  });
}

module.exports = { start, stop, state, tableFor, transaction, find, count, insert, save, mutate, countOptional, plain };
