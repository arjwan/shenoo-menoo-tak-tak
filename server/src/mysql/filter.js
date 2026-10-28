'use strict';

const { identifier: q, literal } = require('./schema');

function scalar(value) {
  if (value === undefined) throw new Error('Undefined SQL filter value');
  if (value?._bsontype === 'ObjectId') return String(value);
  if (typeof value === 'boolean') return Number(value);
  if (value === null || value instanceof Date || ['string', 'number'].includes(typeof value)) return value;
  throw new Error('Unsupported SQL filter value');
}

function compileFilter(schema, table, filter = {}, alias = 'r') {
  const values = [];
  let nextAlias = 0;
  const bind = value => { values.push(scalar(value)); return '?'; };
  const key = (a, c) => `${q(a)}.${q(c)}`;
  function field(t, a, path, condition) {
    const exact = t.columns.find(c => c.name === path);
    if (exact) return compare(key(a, path), condition);
    const child = schema.tables.filter(c => c.parent?.table === t.name && (path === c.parent.field || path.startsWith(c.parent.field + '.'))).sort((x, y) => y.parent.field.length - x.parent.field.length)[0];
    if (child) {
      const ca = 'j' + nextAlias++;
      const join = `${key(ca, 'parent_id')} = ${key(a, t.parent ? '_row_id' : '_id')}`;
      const rest = path.slice(child.parent.field.length).replace(/^\./, '');
      const exists = predicate => `EXISTS (SELECT 1 FROM ${q(child.name)} ${q(ca)} WHERE ${join} AND (${predicate}))`;
      const count = () => `(SELECT COUNT(*) FROM ${q(child.name)} ${q(ca)} WHERE ${join})`;
      if (!rest && condition && typeof condition === 'object' && !Array.isArray(condition) && !condition._bsontype) {
        return Object.entries(condition).map(([op, v]) => {
          if (op === '$elemMatch') return exists(group(child, ca, v));
          if (op === '$size') return `${count()} = ${bind(v)}`;
          if (op === '$all') {
            if (!Array.isArray(v)) throw new Error('$all requires an array');
            return v.length ? v.map(item => exists(field(child, ca, 'value', item))).join(' AND ') : 'FALSE';
          }
          if (op === '$ne' || op === '$nin') return `NOT (${exists(field(child, ca, 'value', { [op === '$ne' ? '$eq' : '$in']: v }))})`;
          if (op === '$exists') throw new Error('Array field existence requires an explicit position');
          return exists(field(child, ca, 'value', { [op]: v }));
        }).map(s => `(${s})`).join(' AND ');
      }
      if (!rest && Array.isArray(condition)) {
        return `${count()} = ${bind(condition.length)} AND ` + condition.map((v, i) => exists(`${key(ca, 'position')} = ${bind(i)} AND ${field(child, ca, 'value', v)}`)).concat('TRUE').join(' AND ');
      }
      if (/^\d+(\.|$)/.test(rest)) {
        const [position, ...tail] = rest.split('.');
        const positionSQL = `${key(ca, 'position')} = ${bind(Number(position))}`;
        if (condition && Object.hasOwn(condition, '$exists')) {
          if (tail.length) throw new Error('Nested positional existence is not supported');
          return (condition.$exists ? '' : 'NOT ') + exists(positionSQL);
        }
        return exists(`${positionSQL} AND ${field(child, ca, tail.join('.') || 'value', condition)}`);
      }
      if (!rest && child.parent.single) return exists(group(child, ca, condition));
      return exists(field(child, ca, rest || 'value', condition));
    }
    const json = t.columns.filter(c => c.kind === 'Mixed' || c.kind === 'Map').find(c => path.startsWith(c.name + '.'));
    if (json) {
      const parts = path.slice(json.name.length + 1).split('.');
      if (parts.some(p => !/^[a-zA-Z0-9_]+$/.test(p))) throw new Error('Invalid JSON query path');
      const jsonPath = '$.' + parts.map(p => '"' + p + '"').join('.');
      const extracted = `JSON_EXTRACT(${key(a, json.name)}, ${literal(jsonPath)})`;
      const expression = `(CASE WHEN JSON_TYPE(${extracted}) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(${extracted}) END)`;
      const normalize = v => {
        if (typeof v === 'boolean') return String(v);
        if (v instanceof RegExp || v instanceof Date || v?._bsontype) return v;
        if (Array.isArray(v)) return v.map(normalize);
        if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalize(x)]));
        return v;
      };
      return compare(expression, normalize(condition));
    }
    throw new Error(`Unknown SQL query field ${t.model}.${path}`);
  }
  function compare(expression, condition) {
    if (condition instanceof RegExp) return regex(expression, condition.source, condition.flags);
    if (condition === null) return `${expression} IS NULL`;
    if (typeof condition !== 'object' || condition instanceof Date || condition?._bsontype) return `${expression} = ${bind(condition)}`;
    const flags = condition.$options || '';
    return Object.entries(condition).filter(([op]) => op !== '$options').map(([op, v]) => {
      if (op === '$eq') return compare(expression, v);
      if (op === '$ne') return v === null ? `${expression} IS NOT NULL` : `(${expression} IS NULL OR ${expression} <> ${bind(v)})`;
      if (op === '$in' || op === '$nin') {
        if (!Array.isArray(v)) throw new Error(`${op} requires an array`);
        const match = v.length ? v.map(item => compare(expression, item)).map(s => `(${s})`).join(' OR ') : 'FALSE';
        return op === '$in' ? `(${match})` : `NOT COALESCE((${match}), FALSE)`;
      }
      if (op === '$regex') return regex(expression, v instanceof RegExp ? v.source : v, flags || v.flags || '');
      if (op === '$not') return `NOT COALESCE((${compare(expression, v)}), FALSE)`;
      const comparison = { $gt: '>', $gte: '>=', $lt: '<', $lte: '<=' }[op];
      if (comparison) return `${expression} ${comparison} ${bind(v)}`;
      // SQL NULL does not encode MongoDB's missing-versus-null distinction.
      throw new Error(`Unsupported SQL filter operator ${op}`);
    }).map(s => `(${s})`).join(' AND ') || 'TRUE';
  }
  function regex(expression, pattern, flags) {
    if (/[^iums]/.test(flags)) throw new Error('Unsupported regular expression flags');
    return `REGEXP_LIKE(${expression}, ${bind(pattern)}, ${bind((flags.includes('i') ? 'i' : 'c') + (flags.includes('m') ? 'm' : '') + (flags.includes('s') ? 'n' : ''))})`;
  }
  function group(t, a, conditions) {
    return Object.entries(conditions).map(([path, condition]) => {
      if (path === '$or' || path === '$and' || path === '$nor') {
        if (!Array.isArray(condition)) throw new Error(`${path} requires an array`);
        const joined = condition.map(c => `(${group(t, a, c)})`).join(path === '$and' ? ' AND ' : ' OR ') || (path === '$and' ? 'TRUE' : 'FALSE');
        return path === '$nor' ? `NOT (${joined})` : joined;
      }
      if (path === '$expr') {
        const expr = condition.$eq;
        if (!Array.isArray(expr) || !expr[0]?.$size || typeof expr[0].$size !== 'string') throw new Error('Unsupported SQL expression');
        return field(t, a, expr[0].$size.replace(/^\$/, ''), { $size: expr[1] });
      }
      if (path.startsWith('$')) throw new Error(`Unsupported SQL query operator ${path}`);
      return field(t, a, path, condition);
    }).map(s => `(${s})`).join(' AND ') || 'TRUE';
  }
  const sql = group(table, alias, filter);
  return { sql, values };
}

module.exports = { compileFilter, scalar };
