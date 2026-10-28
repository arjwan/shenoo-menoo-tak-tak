'use strict';

// Mongoose retains casting, validation, defaults and domain methods. All database
// operations below use parameterized MySQL queries; no MongoDB client is opened.
const { get, set, unset, clone } = require('./data');
const registry = new Map();
const runtime = () => require('./runtime');

function projection(spec) {
  if (!spec) return null;
  const fields = typeof spec === 'object' ? { ...spec } : Object.fromEntries(spec.split(/\s+/).filter(Boolean).filter(s => !s.startsWith('+')).map(s => [s.replace(/^-/, ''), s.startsWith('-') ? 0 : 1]));
  // hydrate() treats its projection literally; unlike a MongoDB server it does
  // not automatically preserve _id in an inclusive field selection.
  if (Object.entries(fields).some(([k, v]) => k !== '_id' && !!v) && fields._id === undefined) fields._id = 1;
  return fields;
}
function project(raw, spec) {
  const fields = projection(spec);
  if (!fields || !Object.keys(fields).length) return clone(raw);
  const include = Object.entries(fields).some(([k, v]) => k !== '_id' && !!v) || (Object.keys(fields).length === 1 && fields._id === 1);
  const result = include ? {} : clone(raw);
  if (include) {
    for (const [key, value] of Object.entries(fields)) if (value && get(raw, key) !== undefined) set(result, key, clone(get(raw, key)));
    if (fields._id !== 0 && raw._id !== undefined) result._id = clone(raw._id);
  } else for (const [key, value] of Object.entries(fields)) if (!value) unset(result, key);
  return result;
}

function decorate(model, raw, spec = null, fresh = false) {
  const original = model.$original;
  const doc = fresh ? new original(raw) : original.hydrate(project(raw, spec), projection(spec));
  let version = Number(raw?.__v || 0);
  let baseline = clone(raw);
  Object.defineProperties(doc, {
    save: { configurable: true, value: async function () {
      const stored = await runtime().save(original, this, { version, baseline });
      version = Number(stored.__v || 0);
      baseline = clone(stored);
      this.__v = version;
      if (stored.createdAt) this.createdAt = stored.createdAt;
      if (stored.updatedAt) this.updatedAt = stored.updatedAt;
      this.isNew = false;
      this.$__reset();
      return this;
    } },
    populate: { configurable: true, value: async function (path, select) { await populate(model, [this], path, select, false); return this; } },
    deleteOne: { configurable: true, value: function () { return model.deleteOne({ _id: this._id }); } }
  });
  return doc;
}

function slots(value, parts) {
  if (Array.isArray(value)) return value.flatMap(v => slots(v, parts));
  if (!value) return [];
  if (parts.length === 1) return [{ parent: value, key: parts[0] }];
  return slots(value[parts[0]], parts.slice(1));
}
async function populate(model, docs, input, select, lean) {
  const specs = Array.isArray(input) ? input : typeof input === 'string' ? input.split(/\s+/).filter(Boolean).map(path => ({ path, select })) : [input];
  for (const spec of specs) {
    if (!spec?.path) throw new Error('A populate path is required');
    const path = model.schema.path(spec.path);
    const ref = path?.options.ref || path?.caster?.options.ref;
    if (!ref) throw new Error(`Unknown reference ${model.modelName}.${spec.path}`);
    const target = registry.get(ref) || require('../models/' + ref);
    const locations = docs.flatMap(d => slots(d, spec.path.split('.')));
    const ids = [...new Set(locations.flatMap(s => Array.isArray(s.parent[s.key]) ? s.parent[s.key] : [s.parent[s.key]]).filter(Boolean).map(v => String(v._id || v)))];
    let query = target.find({ _id: { $in: ids }, ...(spec.match || {}) }).select(spec.select).lean(lean);
    if (spec.options?.sort) query = query.sort(spec.options.sort);
    if (spec.populate) query = query.populate(spec.populate);
    const found = ids.length ? await query : [];
    const byId = new Map(found.map(d => [String(d._id), d]));
    for (const doc of docs) {
      const originalIds = slots(doc, spec.path.split('.')).flatMap(s => Array.isArray(s.parent[s.key]) ? s.parent[s.key].map(v => v?._id || v) : [s.parent[s.key]?._id || s.parent[s.key]]);
      if (!lean) doc.populated(spec.path, path.instance === 'Array' ? originalIds : originalIds[0], { model: target.$original });
    }
    for (const slot of locations) {
      const old = slot.parent[slot.key];
      const value = Array.isArray(old) ? old.map(v => byId.get(String(v?._id || v))).filter(Boolean) : byId.get(String(old?._id || old)) || null;
      if (slot.parent.$__) slot.parent._doc[slot.key] = value;
      else slot.parent[slot.key] = value;
    }
  }
  return docs;
}

class SQLQuery {
  constructor(model, method, filter = {}, update = null, options = {}) {
    this.model = model; this.method = method; this.filter = filter || {}; this.update = update; this.options = { ...options }; this.populates = [];
  }
  select(spec) { this.options.projection = spec; return this; }
  sort(spec) { this.options.sort = spec; return this; }
  limit(n) { this.options.limit = n; return this; }
  skip(n) { this.options.skip = n; return this; }
  lean(value = true) { this.isLean = value; return this; }
  populate(path, select) { this.populates.push([path, select]); return this; }
  setOptions(options) { Object.assign(this.options, options); return this; }
  session() { throw new Error('MongoDB sessions are unavailable in the MySQL runtime'); }
  then(resolve, reject) { return this.exec().then(resolve, reject); }
  catch(reject) { return this.exec().catch(reject); }
  finally(handler) { return this.exec().finally(handler); }
  exec() { return this.promise ??= this.execute(); }
  async execute() {
    const original = this.model.$original;
    if (this.method === 'countDocuments') return runtime().count(original, this.filter);
    let rows;
    if (['find', 'findOne', 'exists'].includes(this.method)) {
      rows = await runtime().find(original, this.filter, { ...this.options, limit: this.method === 'find' ? this.options.limit : 1 });
    } else {
      const result = await runtime().mutate(original, this.filter, this.update, this.options, this.method);
      if (!this.method.startsWith('findOneAnd')) {
        const { before, after, ...response } = result;
        return response;
      }
      const row = this.method === 'findOneAndDelete' ? result.before : this.options.new || this.options.returnDocument === 'after' ? result.after : result.before;
      rows = row ? [row] : [];
    }
    if (this.method === 'exists') return rows[0] ? { _id: rows[0]._id } : null;
    const docs = rows.map(row => this.isLean ? project(row, this.options.projection) : decorate(this.model, row, this.options.projection));
    for (const [path, select] of this.populates) await populate(this.model, docs, path, select, !!this.isLean);
    return this.method === 'find' ? docs : docs[0] || null;
  }
}

function wrap(original) {
  if (process.env.DB_CLIENT !== 'mysql') return original;
  if (registry.has(original.modelName)) return registry.get(original.modelName);
  function Model(data) { return decorate(Model, data, null, true); }
  Object.assign(Model, { modelName: original.modelName, schema: original.schema, $original: original });
  for (const [key, method] of Object.entries(original.schema.statics)) Model[key] = method.bind(Model);
  for (const method of ['find', 'findOne', 'exists', 'countDocuments', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'findOneAndUpdate', 'findOneAndDelete']) {
    Model[method] = (filter, update, options) => {
      if (['find', 'findOne'].includes(method)) return new SQLQuery(Model, method, filter, null, options).select(update);
      return new SQLQuery(Model, method, filter, update, options);
    };
  }
  Model.findById = (id, fields, options) => Model.findOne({ _id: id }, fields, options);
  Model.findByIdAndUpdate = (id, update, options) => Model.findOneAndUpdate({ _id: id }, update, options);
  Model.findByIdAndDelete = id => Model.findOneAndDelete({ _id: id });
  Model.create = async data => {
    if (Array.isArray(data)) { const docs = []; for (const item of data) docs.push(await Model.create(item)); return docs; }
    return decorate(Model, await runtime().insert(original, data));
  };
  Model.insertMany = Model.create;
  Model.hydrate = data => decorate(Model, data);
  Model.bulkWrite = async (operations, options = {}) => {
    const result = { matchedCount: 0, modifiedCount: 0, upsertedCount: 0, deletedCount: 0, insertedCount: 0 }, errors = [];
    for (let index = 0; index < operations.length; index++) {
      try {
        const [method, item] = Object.entries(operations[index])[0];
        if (method === 'insertOne') { await Model.create(item.document); result.insertedCount++; }
        else if (['updateOne', 'updateMany', 'deleteOne', 'deleteMany'].includes(method)) {
          const r = await Model[method](item.filter, item.update, item);
          for (const field of Object.keys(result)) result[field] += Number(r[field] || 0);
        } else throw new Error('Unsupported bulk operation ' + method);
      } catch (error) { errors.push({ index, error }); if (options.ordered !== false) break; }
    }
    if (errors.length) { const error = errors[0].error; error.writeErrors = errors; error.result = result; throw error; }
    return result;
  };
  Model.collection = {
    name: original.collection.name,
    collectionName: original.collection.name,
    countDocuments: Model.countDocuments,
    updateMany: Model.updateMany,
    indexes() { throw new Error('Use the versioned MySQL schema verification instead of MongoDB index APIs'); }
  };
  registry.set(original.modelName, Model);
  return Model;
}

module.exports = { wrap, registry, projection, project, SQLQuery };
