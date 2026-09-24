'use strict';

/**
 * server/src/scripts/verify-school-tts.js
 *
 * Production gate: prove the virtual teacher's Arabic voice works from THIS
 * server before publishing/restarting. Uses the exact provider chain the
 * classroom route uses (Groq Orpheus -> local edge-tts -> OpenAI), so the
 * deploy fails loudly when no provider can synthesize Arabic.
 *
 * Prints SCHOOL_TTS_PROBE=PASS provider=... bytes=... on success.
 * Never prints API keys. Run from the repository root (where .env lives):
 *   node server/src/scripts/verify-school-tts.js
 */
const path = require('path');

// Load .env from the repository root regardless of the caller's cwd.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { createTeacherTTS, isValidAudioBytes } = require('../services/school-virtual-tts');

const PROBE_TEXT = 'مرحباً بكم في مدرسة سومر. هذا اختبار حقيقي لصوت المعلم الافتراضي من الخادم، ليتأكد أن الصوت العربي يعمل قبل النشر.';

function fail(reason) {
  console.error('SCHOOL_TTS_PROBE=FAIL ' + reason);
  process.exit(1);
}

(async () => {
  const quiet = { error: () => {} }; // keep single-provider noise out of CI logs
  const tts = createTeacherTTS({ logger: { ...console, ...quiet, error: (m) => console.error(String(m).slice(0, 200)) } });

  const providerIds = tts.providerIds();
  if (!providerIds.length) fail('no provider configured (missing GROQ_API_KEY/OPENAI_API_KEY and no local edge-tts binary)');
  process.stderr.write('configured providers: ' + providerIds.join(',') + '\n');

  const parts = tts.speechParts(PROBE_TEXT);
  if (!parts.length) fail('speech splitting produced no parts');

  let audio;
  try {
    audio = await tts.synthesizePart(parts[0], 'male');
  } catch (error) {
    fail(String(error.message).slice(0, 400));
    return;
  }

  if (!isValidAudioBytes(audio.bytes)) fail('provider returned bytes that are not valid WAV/MP3 (bytes=' + audio.bytes.length + ')');
  if (!['audio/wav', 'audio/mpeg'].includes(audio.type)) fail('unexpected content type ' + audio.type);

  console.log('SCHOOL_TTS_PROBE=PASS provider=' + audio.provider + ' bytes=' + audio.bytes.length + ' type=' + audio.type + ' parts=' + parts.length);
})().catch((error) => fail(error.message));
