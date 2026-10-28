'use strict';

const mongoose = require('mongoose');
const { identifier: q } = require('./schema');

function get(object, path) { return path.split('.').reduce((v, k) => v?.[k], object); }
function set(object, path, value) {
  const parts = path.split('.');
  if (parts.some(k => ['__proto__', 'prototype', 'constructor'].includes(k))) throw new Error('Unsafe document path');
  let target = object;
  for (const part of parts.slice(0, -1)) target = target[part] ??= {};
  target[parts.at(-1)] = value;
}
function unset(object, path) {
  const parts = path.split('.'), target = get(object, parts.slice(0, -1).join('.'));
  if (parts.length === 1) delete object[path];
  else if (target) delete target[parts.at(-1)];
}
function clone(value) {
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value);
  if (value._bsontype === 'ObjectId') return new mongoose.Types.ObjectId(String(value));
  if (value instanceof Map) return Object.fromEntries([...value].map(([k, v]) => [k, clone(v)]));
  if (Array.isArray(value)) return value.map(clone);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
}
function encode(value, column) {
  if (value == null) return null;
  if (column.kind === 'ObjectId') return String(value._id || value);
  if (column.kind === 'Boolean') return Number(value);
  if (column.kind === 'Mixed' || column.kind === 'Map') return JSON.stringify(value);
  return value;
}
function decode(value, column) {
  if (value == null) return null;
  if (column.kind === 'ObjectId') return new mongoose.Types.ObjectId(value);
  if (column.kind === 'Boolean') return Boolean(value);
  if (column.kind === 'Date') return value instanceof Date ? value : new Date(value);
  if (column.kind === 'Mixed' || column.kind === 'Map') return typeof value === 'string' ? JSON.parse(value) : value;
  return value;
}

async function readRows(connection, schema, table, rows) {
  const docs = rows.map(row => {
    const doc = {};
    for (const column of table.columns) {
      if (['parent_id', 'position', '_row_id'].includes(column.name) && table.parent) continue;
      set(doc, column.name, decode(row[column.name], column));
    }
    return doc;
  });
  const children = schema.tables.filter(t => t.parent?.table === table.name);
  for (const child of children) {
    const key = table.parent ? '_row_id' : '_id';
    const all = [];
    for (let offset = 0; offset < rows.length; offset += 200) {
      const ids = rows.slice(offset, offset + 200).map(r => r[key]);
      if (!ids.length) continue;
      const [items] = await connection.execute(`SELECT * FROM ${q(child.name)} WHERE parent_id IN (${ids.map(() => '?').join(',')}) ORDER BY parent_id, position`, ids);
      all.push(...items);
    }
    const childDocs = await readRows(connection, schema, child, all);
    const byParent = new Map();
    all.forEach((row, i) => {
      const list = byParent.get(row.parent_id) || [];
      list.push(childDocs[i]); byParent.set(row.parent_id, list);
    });
    rows.forEach((row, i) => {
      const list = byParent.get(row[key]) || [];
      const scalar = child.columns.some(c => c.name === 'value') && child.model.endsWith('[]') && !child.columns.some(c => !['parent_id', 'position', '_row_id', 'value'].includes(c.name));
      set(docs[i], child.parent.field, child.parent.single ? list[0] || null : scalar ? list.map(d => d.value) : list);
    });
  }
  return docs;
}

async function writeDocument(connection, schema, table, doc, insert, parent = null, position = 0) {
  const rowId = parent ? new mongoose.Types.ObjectId().toString() : String(doc._id);
  const columns = table.columns;
  const values = columns.map(c => {
    if (parent && c.name === 'parent_id') return parent;
    if (parent && c.name === '_row_id') return rowId;
    if (parent && c.name === 'position') return position;
    return encode(get(doc, c.name), c);
  });
  if (insert) {
    await connection.execute(`INSERT INTO ${q(table.name)} (${columns.map(c => q(c.name)).join(',')}) VALUES (${columns.map(() => '?').join(',')})`, values);
  } else {
    const writable = columns.filter(c => c.name !== '_id');
    await connection.execute(`UPDATE ${q(table.name)} SET ${writable.map(c => q(c.name) + ' = ?').join(',')} WHERE _id = ?`, writable.map(c => encode(get(doc, c.name), c)).concat(rowId));
  }
  for (const child of schema.tables.filter(t => t.parent?.table === table.name)) {
    if (!insert) await connection.execute(`DELETE FROM ${q(child.name)} WHERE parent_id = ?`, [rowId]);
    const input = get(doc, child.parent.field);
    const entries = child.parent.single ? input == null ? [] : [input] : input || [];
    if (!Array.isArray(entries)) throw new Error(`Expected array at ${child.model}`);
    const scalar = child.columns.some(c => c.name === 'value') && child.model.endsWith('[]') && !child.columns.some(c => !['parent_id', 'position', '_row_id', 'value'].includes(c.name));
    for (let i = 0; i < entries.length; i++) await writeDocument(connection, schema, child, scalar ? { value: entries[i] } : entries[i], true, rowId, i);
  }
}

function equal(a, b) {
  if (a?._bsontype === 'ObjectId' || b?._bsontype === 'ObjectId') return String(a) === String(b);
  if (a instanceof Date || b instanceof Date) return +new Date(a) === +new Date(b);
  return JSON.stringify(a) === JSON.stringify(b);
}
function matches(value, condition) {
  if (!condition || typeof condition !== 'object' || condition._bsontype || condition instanceof Date) return equal(value, condition);
  return Object.entries(condition).every(([key, v]) => {
    if (key === '$in') return v.some(item => equal(value, item));
    if (key === '$eq') return equal(value, v);
    if (key === '$ne') return !equal(value, v);
    if (key.startsWith('$')) throw new Error(`Unsupported pull operator ${key}`);
    return matches(get(value, key), v);
  });
}
function applyUpdate(doc, update, inserting = false) {
  for (const [operator, fields] of Object.entries(update)) {
    if (!operator.startsWith('$')) { set(doc, operator, clone(fields)); continue; }
    if (operator === '$setOnInsert' && !inserting) continue;
    for (const [path, value] of Object.entries(fields)) {
      if (path === '_id' && !inserting) {
        if (!equal(doc._id, value)) throw new Error('Cannot change document _id');
        continue;
      }
      if (operator === '$set' || operator === '$setOnInsert') set(doc, path, clone(value));
      else if (operator === '$unset') unset(doc, path);
      else if (operator === '$inc') set(doc, path, Number(get(doc, path) || 0) + Number(value));
      else if (operator === '$pull') set(doc, path, (get(doc, path) || []).filter(item => !matches(item, value)));
      else if (operator === '$pop') { const list = [...(get(doc, path) || [])]; value < 0 ? list.shift() : list.pop(); set(doc, path, list); }
      else if (operator === '$push' || operator === '$addToSet') {
        const list = [...(get(doc, path) || [])];
        const items = value?.$each || [value];
        if (value?.$position !== undefined || value?.$sort !== undefined) throw new Error('Unsupported array update modifiers');
        for (const item of items) if (operator === '$push' || !list.some(old => equal(old, item))) list.push(clone(item));
        set(doc, path, value?.$slice === undefined ? list : value.$slice >= 0 ? list.slice(0, value.$slice) : list.slice(value.$slice));
      } else throw new Error(`Unsupported SQL update operator ${operator}`);
    }
  }
  return doc;
}

module.exports = { get, set, unset, clone, readRows, writeDocument, applyUpdate, equal };
