'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTeacherTTS, EDGE_VOICES } = require('../src/services/school-virtual-tts');
const audio = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(100)]);
function provider(id, calls) {
  return { id, label: id, synthesize: async (_text, voice) => {
    calls.push(id + ':' + voice);
    return { bytes: audio, type: 'audio/mpeg', provider: id };
  }};
}
test('Iraqi speech skips Saudi Groq and selects Iraqi neural provider', async () => {
  const calls = [];
  const tts = createTeacherTTS({ providers: [provider('groq', calls), provider('edge', calls)] });
  const result = await tts.synthesizePart('مرحبا بكم', 'iraqi-female');
  assert.equal(result.provider, 'edge');
  assert.deepEqual(calls, ['edge:iraqi-female']);
  assert.equal(EDGE_VOICES['iraqi-female'], 'ar-IQ-RanaNeural');
});
test('Standard Arabic retains existing Groq priority', async () => {
  const calls = [];
  const tts = createTeacherTTS({ providers: [provider('groq', calls), provider('edge', calls)] });
  assert.equal((await tts.synthesizePart('أهلاً', 'female')).provider, 'groq');
  assert.deepEqual(calls, ['groq:female']);
});
test('English skips Arabic-only Groq and uses English neural voice', async () => {
  const calls = [];
  const tts = createTeacherTTS({ providers: [provider('groq', calls), provider('edge', calls)] });
  assert.equal((await tts.synthesizePart('Hello', 'english-female')).provider, 'edge');
  assert.deepEqual(calls, ['edge:english-female']);
});
test('Iraqi speech falls back to another non-Saudi provider if Edge fails', async () => {
  const calls = [];
  const failing = { id: 'edge', label: 'edge', synthesize: async () => { calls.push('edge'); throw new Error('offline'); } };
  const tts = createTeacherTTS({ logger: { error() {} }, providers: [provider('groq', calls), failing, provider('openai', calls)] });
  assert.equal((await tts.synthesizePart('أهلاً', 'iraqi-female')).provider, 'openai');
  assert.deepEqual(calls, ['edge', 'openai:iraqi-female']);
});
