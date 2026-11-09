'use strict';
const mongoose = require('mongoose');
let pending = null;
async function getCurriculumConnection() {
  if (pending) return pending;
  const uri = process.env.SCHOOL_CURRICULUM_MONGO_URI;
  if (!uri) { const e = new Error('CURRICULUM_DB_NOT_CONFIGURED'); e.status = 503; throw e; }
  pending = (async () => {
    const conn = mongoose.createConnection(uri, {
      readPreference: 'secondaryPreferred',
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      autoIndex: false,
      autoCreate: false
    });
    try { await conn.asPromise(); return conn; }
    catch (error) { await conn.close().catch(() => {}); throw error; }
  })();
  try { return await pending; }
  catch (error) { pending = null; throw error; }
}
// Read-only enforcement MUST be provided by the Atlas user's read role.
// readPreference alone does not restrict write permissions.
module.exports = { getCurriculumConnection };
