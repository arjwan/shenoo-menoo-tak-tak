'use strict';

// This is a schema conversion tool, not a replacement for Mongoose's runtime.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

function identifier(value) {
  if (typeof value !== 'string' || !value || value.includes('\0')) throw new Error('Invalid SQL identifier');
  return '`' + value.replaceAll('`', '``') + '`';
}
function name(value) {
  const clean = value.replace(/[^a-zA-Z0-9_]/g, '_');
  return clean.length <= 60 ? clean : clean.slice(0, 47) + '_' + crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}
function literal(value) {
  // Hex literals avoid dependence on NO_BACKSLASH_ESCAPES and quote modes.
  return "CONVERT(X'" + Buffer.from(String(value), 'utf8').toString('hex') + "' USING utf8mb4)";
}
function loadModels() {
  for (const file of fs.readdirSync(path.join(__dirname, '../models')).filter(f => f.endsWith('.js')).sort()) {
    require(path.join(__dirname, '../models', file));
  }
  return mongoose.modelNames().sort().map(n => mongoose.model(n));
}
function sqlType(p, indexed = false) {
  switch (p.instance) {
    case 'ObjectId': return 'CHAR(24) CHARACTER SET ascii COLLATE ascii_bin';
    case 'String': {
      const max = Number(p.options.maxlength || p.options.maxLength || 0);
      if (indexed) return `VARCHAR(${Math.max(1, max || 255)})`;
      return max && max <= 2000 ? `VARCHAR(${max})` : 'LONGTEXT';
    }
    case 'Number': return 'DOUBLE';
    case 'Boolean': return 'TINYINT(1)';
    case 'Date': return 'DATETIME(3)';
    case 'Mixed': case 'Map': return 'JSON';
    default: throw new Error(`Unsupported schema type ${p.instance}`);
  }
}

function buildSchema(models = loadModels()) {
  const tables = [], relations = [], notes = [];
  const modelTables = new Map(models.map(m => [m.modelName, name(m.collection.name)]));
  function convert(schema, tableName, parent = null, source = '') {
    const indexes = schema.indexes();
    const indexed = new Set(indexes.flatMap(([keys]) => Object.entries(keys).filter(([, v]) => v !== 'text').map(([k]) => k)));
    const table = { name: tableName, model: source, parent, columns: [], indexes: [], generated: [] };
    tables.push(table);
    if (parent) {
      table.columns.push({ name: 'parent_id', type: 'CHAR(24) CHARACTER SET ascii COLLATE ascii_bin', nullable: false });
      table.columns.push({ name: 'position', type: 'INT UNSIGNED', nullable: false });
      // Every array row has an independent id so nested arrays retain their parent.
      table.columns.push({ name: '_row_id', type: 'CHAR(24) CHARACTER SET ascii COLLATE ascii_bin', nullable: false });
      relations.push({ table: tableName, column: 'parent_id', target: parent.table, targetColumn: parent.column, onDelete: 'CASCADE' });
    }
    for (const [field, p] of Object.entries(schema.paths)) {
      if (p.$isSchemaMap || field.endsWith('.$*')) {
        if (field.endsWith('.$*')) continue;
      }
      if (p.instance === 'Array') {
        const childName = name(tableName + '__' + field);
        const parentKey = parent ? '_row_id' : '_id';
        const childSchema = p.schema || new mongoose.Schema({ value: { ...p.caster.options, type: mongoose.Schema.Types[p.caster.instance] } }, { _id: false, versionKey: false });
        const child = convert(childSchema, childName, { table: tableName, column: parentKey, field }, source + '.' + field + '[]');
        child.indexes.push({ name: name('ix_' + childName + '_parent'), columns: ['parent_id', 'position'], unique: true });
        if (!p.schema && indexed.has(field)) child.indexes.push({ name: name('ix_' + childName + '_value'), columns: ['value'], unique: false });
        if (!p.schema && indexes.some(([keys]) => keys[field] === 'text')) child.indexes.push({ name: name('ft_' + childName + '_value'), columns: ['value'], fulltext: true });
        continue;
      }
      if (p.instance === 'Embedded') {
        const childName = name(tableName + '__' + field);
        const child = convert(p.schema, childName, { table: tableName, column: parent ? '_row_id' : '_id', field, single: true }, source + '.' + field);
        child.indexes.push({ name: name('ix_' + childName + '_parent'), columns: ['parent_id'], unique: true });
        continue;
      }
      if (field.length > 64) throw new Error(`Column name exceeds MySQL limit: ${source}.${field}`);
      const column = { name: field, type: sqlType(p, indexed.has(field)), nullable: field !== '_id' && !p.isRequired, kind: p.instance };
      table.columns.push(column);
      if (p.options.ref) {
        const target = modelTables.get(p.options.ref);
        if (!target) throw new Error(`Unknown reference: ${source}.${field} -> ${p.options.ref}`);
        relations.push({ table: tableName, column: field, target, targetColumn: '_id', onDelete: 'RESTRICT' });
      }
    }
    function partialExpression(filter) {
      return Object.entries(filter).map(([field, condition]) => {
        const c = table.columns.find(c => c.name === field);
        if (!c) throw new Error(`Unknown partial index field ${source}.${field}`);
        const id = identifier(field);
        if (condition === null) return `${id} IS NULL`;
        if (!condition || typeof condition !== 'object') throw new Error(`Unsupported partial index on ${source}.${field}`);
        return Object.entries(condition).map(([op, value]) => {
          if (op === '$type' && (value === 'string' || value === 'objectId')) return `${id} IS NOT NULL`;
          if (op === '$gt' && typeof value === 'string') return `${id} > ${literal(value)}`;
          throw new Error(`Unsupported partial-index operator ${op} on ${source}.${field}`);
        }).join(' AND ');
      }).join(' AND ');
    }
    for (const [keys, options] of indexes) {
      const fields = Object.keys(keys);
      if (fields.some(f => !table.columns.some(c => c.name === f))) {
        // Scalar array indexes are created on the normalized child above.
        if (fields.length === 1 && schema.path(fields[0])?.instance === 'Array') continue;
        if (Object.values(keys).every(v => v === 'text')) {
          const scalars = fields.filter(f => table.columns.some(c => c.name === f));
          if (scalars.length) table.indexes.push({ name: name('ft_' + tableName), columns: scalars, fulltext: true });
          notes.push(`${source}: full-text array fields use their child table and require a UNION in the search service.`);
          continue;
        }
        throw new Error(`Index requires explicit relational conversion: ${source} ${JSON.stringify(keys)}`);
      }
      const indexName = name(options.name || 'ix_' + tableName + '_' + fields.join('_') + (options.unique ? '_unique' : ''));
      const cols = fields.map((field, i) => {
        if (!options.partialFilterExpression) return field;
        const original = table.columns.find(c => c.name === field);
        const generatedName = name('_idx_' + indexName + '_' + i);
        table.generated.push({ name: generatedName, type: original.type, expression: `CASE WHEN ${partialExpression(options.partialFilterExpression)} THEN ${identifier(field)} ELSE NULL END` });
        return generatedName;
      });
      table.indexes.push({ name: indexName, columns: cols, unique: !!options.unique, fulltext: Object.values(keys).every(v => v === 'text') });
    }
    return table;
  }
  for (const model of models) convert(model.schema, modelTables.get(model.modelName), null, model.modelName);
  const statements = [];
  for (const table of tables) {
    const definitions = table.columns.map(c => `${identifier(c.name)} ${c.type}${c.nullable ? ' NULL' : ' NOT NULL'}`);
    definitions.push(...table.generated.map(c => `${identifier(c.name)} ${c.type} GENERATED ALWAYS AS (${c.expression}) STORED`));
    definitions.push(`PRIMARY KEY (${identifier(table.parent ? '_row_id' : '_id')})`);
    for (const ix of table.indexes) {
      if (!ix.fulltext) {
        const parts = ix.columns.map(n => {
          const c = [...table.columns, ...table.generated].find(c => c.name === n);
          const match = c.type.match(/(?:VAR)?CHAR\((\d+)\)/);
          return { name: n, chars: match ? Number(match[1]) : null, bytesPerChar: c.type.includes('ascii') ? 1 : 4 };
        });
        const size = parts.reduce((sum, p) => sum + (p.chars ? p.chars * p.bytesPerChar : 8), 0);
        if (size > 3072) {
          if (ix.unique) throw new Error(`Unique key exceeds MySQL byte limit: ${table.name}.${ix.name}`);
          // Prefixes only affect lookup performance, never uniqueness or stored data.
          const stringParts = parts.filter(p => p.chars);
          const budget = 3072 - (parts.length - stringParts.length) * 8;
          ix.prefixes = Object.fromEntries(stringParts.map(p => [p.name, Math.min(p.chars, Math.floor(budget / stringParts.length / p.bytesPerChar))]));
        }
      }
      definitions.push(`${ix.fulltext ? 'FULLTEXT ' : ix.unique ? 'UNIQUE ' : ''}KEY ${identifier(ix.name)} (${ix.columns.map(c => identifier(c) + (ix.prefixes?.[c] ? `(${ix.prefixes[c]})` : '')).join(', ')})`);
    }
    statements.push(`CREATE TABLE ${identifier(table.name)} (\n  ${definitions.join(',\n  ')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC`);
  }
  for (const r of relations) {
    const constraint = name('fk_' + r.table + '_' + r.column);
    statements.push(`ALTER TABLE ${identifier(r.table)} ADD CONSTRAINT ${identifier(constraint)} FOREIGN KEY (${identifier(r.column)}) REFERENCES ${identifier(r.target)} (${identifier(r.targetColumn)}) ON DELETE ${r.onDelete}`);
  }
  return { version: 1, models: models.length, tables, relations, notes, statements };
}

module.exports = { identifier, name, literal, loadModels, sqlType, buildSchema };
