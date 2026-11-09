'use strict';
// Read-only live Atlas smoke check. Does not print credentials or curriculum text.
// Usage: SCHOOL_CURRICULUM_MONGO_URI=... node server/src/scripts/verify-sumer-atlas.js
const assert = require('node:assert/strict');
const { getCurriculumConnection } = require('../config/curriculum-db');
const KnowledgeSource = require('../models/SchoolKnowledgeSource');

async function main() {
  if (!process.env.SCHOOL_CURRICULUM_MONGO_URI) {
    console.error('FAIL: SCHOOL_CURRICULUM_MONGO_URI is missing');
    process.exitCode = 2;
    return;
  }
  let connection;
  try {
    connection = await getCurriculumConnection();
    const schema = KnowledgeSource.$original?.schema;
    assert.ok(schema, 'Original curriculum schema unavailable');
    const Source = connection.models.SchoolKnowledgeSource ||
      connection.model('SchoolKnowledgeSource', schema);
    const totalVerified = await Source.countDocuments({ verified: true });
    const sample = await Source.findOne({ verified: true })
      .select('stage grade subject lesson title page verified')
      .lean();
    console.log(JSON.stringify({
      connected: true,
      verifiedSources: totalVerified,
      sampleMetadata: sample ? {
        stage: sample.stage,
        grade: sample.grade,
        subject: sample.subject,
        lesson: sample.lesson,
        title: sample.title,
        page: sample.page
      } : null,
      note: 'Atlas metadata read only; no content or credentials printed'
    }, null, 2));
    if (!sample) {
      console.error('FAIL: no verified source found; integration not accepted');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('FAIL: Atlas curriculum read check:', error.code || error.name || 'UNKNOWN');
    process.exitCode = 1;
  } finally {
    if (connection) await connection.close();
  }
}
main();
