'use strict';

/**
 * Arabic teacher speech for the AI Virtual Classroom.
 *
 * Design contract:
 *  - Server-side audio only: the browser speechSynthesis is a last-resort UI
 *    fallback, never part of this service.
 *  - Provider chain, first healthy provider wins:
 *      1. groq    canopylabs/orpheus-arabic-saudi (fahad / lulwa) — highest
 *                 quality; requires one-time terms acceptance by the Groq org
 *                 admin, so a 400 model_terms_required must not kill speech.
 *      2. edge    local edge-tts CLI (Microsoft neural voices, Iraqi
 *                 ar-IQ-BasselNeural / ar-IQ-RanaNeural) — always-available
 *                 server voice with no API key.
 *      3. openai  gpt-4o-mini-tts — only useful while credits remain.
 *  - Text is split into parts on Arabic/ASCII sentence boundaries, never
 *    mid-word, respecting each provider's input length limit.
 *  - Every audio payload is validated (non-empty, RIFF/WAVE or MPEG/ID3
 *    header) so a JSON error body can never be cached as audio.
 *  - API keys never appear in thrown messages or logs.
 *
 * The module is a factory (createTeacherTTS) so tests inject mock providers.
 */

const { execFile } = require('child_process');
const fs = require('fs');

const GROQ_SPEECH_URL = 'https://api.groq.com/openai/v1/audio/speech';
const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech';

// Conservative per-request input limits (chars). Groq Orpheus accepts more,
// but shorter parts also keep single requests under provider timeouts.
const PROVIDER_MAX_CHARS = { groq: 900, edge: 900, openai: 900 };
const MAX_TEXT_CHARS = 4000; // matches VirtualClassroomMessage.text storage cap
const MAX_PARTS = 12;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MIN_AUDIO_BYTES = 64; // anything smaller is an error body, not audio
const TRANSIENT_RETRY_ATTEMPTS = 2;
const TRANSIENT_RETRY_DELAY_MS = 700;

const DEFAULT_EDGE_BIN = '/home/opc/.local/tts/venv/bin/edge-tts';
const EDGE_VOICES = { male: 'ar-IQ-BasselNeural', female: 'ar-IQ-RanaNeural', 'english-female': 'en-US-JennyNeural' };

function redact(message, secrets) {
  let safe = String(message || '');
  for (const secret of secrets) {
    if (secret) safe = safe.split(secret).join('***');
  }
  return safe;
}

function isTransientStatus(status) {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Validate that bytes look like real audio, never a JSON/XML error body. */
function isValidAudioBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < MIN_AUDIO_BYTES || bytes.length > MAX_AUDIO_BYTES) return false;
  const head = bytes.subarray(0, 12);
  const isWav = head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WAVE';
  const isMpegFrame = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
  const isId3 = head.subarray(0, 3).toString('latin1') === 'ID3';
  return isWav || isMpegFrame || isId3;
}

/**
 * Split text into speakable parts on sentence boundaries (., !, ?, Arabic
 * ؟،؛ and newlines), then on word boundaries, without cutting a word and
 * without exceeding limit chars per part. Covers the full stored answer.
 */
function splitSpeechParts(text, limit) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_CHARS);
  if (!clean) return [];
  const maxChars = Math.max(80, Math.min(Number(limit) || PROVIDER_MAX_CHARS.groq, MAX_TEXT_CHARS));

  // Sentence-level split keeps prosody natural per request.
  const sentences = clean.split(/(?<=[.!?\u061F\u060C\u061B\u061D\n])\s+/).filter(Boolean);
  const parts = [];
  let current = '';
  const pushCurrent = () => { if (current.trim()) parts.push(current.trim()); current = ''; };

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      // Long sentence: pack whole words up to the limit.
      pushCurrent();
      let wordBuffer = '';
      for (const word of sentence.split(' ')) {
        if (wordBuffer && wordBuffer.length + 1 + word.length > maxChars) {
          parts.push(wordBuffer);
          wordBuffer = word;
        } else {
          wordBuffer = wordBuffer ? wordBuffer + ' ' + word : word;
        }
      }
      if (wordBuffer) parts.push(wordBuffer);
      continue;
    }
    if (current && current.length + 1 + sentence.length > maxChars) pushCurrent();
    current = current ? current + ' ' + sentence : sentence;
  }
  pushCurrent();
  return parts.slice(0, MAX_PARTS);
}

async function requestRemoteSpeech({ url, key, payload, timeoutMs, secrets, label }) {
  let lastError = null;
  for (let attempt = 0; attempt <= TRANSIENT_RETRY_ATTEMPTS; attempt += 1) {
    if (attempt) await sleep(TRANSIENT_RETRY_DELAY_MS * attempt);
    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload())
      });
      if (response.ok) {
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!isValidAudioBytes(bytes)) {
          throw new Error(`${label} أعاد ملف صوت غير صالح (bytes=${bytes.length})`);
        }
        return { bytes, type: payload.responseFormatHint === 'mp3' ? 'audio/mpeg' : 'audio/wav' };
      }
      let detail = '';
      try {
        const body = await response.json();
        detail = (body && body.error && (body.error.message || body.error.code)) || (body && body.message) || '';
      } catch (_) { /* non-JSON body */ }
      const error = new Error(`${label} TTS HTTP ${response.status}${detail ? ': ' + detail : ''}`);
      error.status = response.status;
      error.transient = isTransientStatus(response.status);
      throw error;
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        error.status = 0;
        error.transient = true;
        error.message = `${label} TTS انتهت مهلة الطلب`;
      }
      if (!error.transient) throw error;
      lastError = error;
    }
  }
  lastError.message = redact(lastError.message, secrets);
  throw lastError;
}

function runEdgeTts(bin, voice, text, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      ['--voice', voice, '--text', text, '--write-media', '-'],
      { timeout: timeoutMs, maxBuffer: MAX_AUDIO_BYTES, encoding: 'buffer' },
      (error, stdout) => {
        if (error) {
          const err = new Error(`edge-tts فشل: ${redact(error.message, [])}`.slice(0, 300));
          err.status = 0;
          err.transient = true; // local CLI failures are worth one retry round
          reject(err);
          return;
        }
        resolve(stdout);
      }
    );
  });
}

/**
 * Build a TTS engine. Options exist for dependency injection in tests:
 *   providers — ordered list of { id, label, maxChars, synthesize(text, voice) }
 *   logger    — console-like sink
 */
function createTeacherTTS(options = {}) {
  const logger = options.logger || console;
  const customProviders = options.providers;
  const secrets = [];

  const defaultProviders = () => {
    const list = [];
    if (process.env.GROQ_API_KEY) {
      const key = process.env.GROQ_API_KEY;
      secrets.push(key);
      list.push({
        id: 'groq',
        label: 'groq',
        maxChars: PROVIDER_MAX_CHARS.groq,
        synthesize: (text, voice) => requestRemoteSpeech({
          url: GROQ_SPEECH_URL,
          key,
          secrets,
          label: 'groq',
          timeoutMs: 30000,
          payload: () => ({
            model: 'canopylabs/orpheus-arabic-saudi',
            voice: voice === 'male' ? 'fahad' : 'lulwa',
            input: text,
            response_format: 'wav'
          })
        }).then((result) => ({ ...result, type: 'audio/wav', provider: 'groq' }))
      });
    }
    const edgeBin = process.env.SCHOOL_TTS_EDGE_BIN || DEFAULT_EDGE_BIN;
    if (fs.existsSync(edgeBin)) {
      list.push({
        id: 'edge',
        label: 'edge-tts',
        maxChars: PROVIDER_MAX_CHARS.edge,
        synthesize: async (text, voice) => {
          let lastError = null;
          for (let attempt = 0; attempt <= TRANSIENT_RETRY_ATTEMPTS; attempt += 1) {
            if (attempt) await sleep(TRANSIENT_RETRY_DELAY_MS * attempt);
            try {
              const bytes = await runEdgeTts(edgeBin, EDGE_VOICES[voice === 'english-female' ? 'english-female' : (voice === 'male' ? 'male' : 'female')], text, 45000);
              if (!isValidAudioBytes(bytes)) throw new Error(`edge-tts أعاد ملف صوت غير صالح (bytes=${bytes.length})`);
              return { bytes, type: 'audio/mpeg', provider: 'edge' };
            } catch (error) {
              if (!error.transient) throw error;
              lastError = error;
            }
          }
          throw lastError;
        }
      });
    }
    if (process.env.OPENAI_API_KEY) {
      const key = process.env.OPENAI_API_KEY;
      secrets.push(key);
      list.push({
        id: 'openai',
        label: 'openai',
        maxChars: PROVIDER_MAX_CHARS.openai,
        synthesize: (text, voice) => requestRemoteSpeech({
          url: OPENAI_SPEECH_URL,
          key,
          secrets,
          label: 'openai',
          timeoutMs: 30000,
          payload: () => ({
            model: 'gpt-4o-mini-tts',
            voice: 'alloy',
            input: text,
            response_format: 'mp3',
            instructions: voice === 'english-female' ? 'Speak clearly in English for an Iraqi school lesson with a warm female voice.' : 'Speak clearly in Arabic for an Iraqi school lesson.'
          })
        }).then((result) => ({ ...result, type: 'audio/mpeg', provider: 'openai' }))
      });
    }
    return list;
  };

  const getProviders = () => (customProviders || defaultProviders());

  return {
    /** Names of configured providers, for diagnostics without secrets. */
    providerIds() {
      return getProviders().map((p) => p.id);
    },

    isConfigured() {
      return getProviders().length > 0;
    },

    speechParts(text, limit) {
      return splitSpeechParts(text, limit);
    },

    /**
     * Synthesize one part through the provider chain. Throws an Error whose
     * message contains every provider failure (secret-free) and status 502.
     */
    async synthesizePart(text, voice) {
      const providers = getProviders();
      if (!providers.length) {
        const error = new Error('مزود الصوت غير مفعّل على الخادم (لا يوجد مفتاح Groq/OpenAI ولا محرك صوت محلي)');
        error.status = 503;
        throw error;
      }
      const failures = [];
      for (const provider of providers) {
        try {
          if (voice === 'english-female' && provider.id === 'groq') continue;
          const audio = await provider.synthesize(String(text), voice);
          if (!isValidAudioBytes(audio.bytes)) throw new Error(`${provider.label} أعاد ملف صوت غير صالح`);
          return audio;
        } catch (error) {
          failures.push(`${provider.label}: ${error.message}`);
          logger.error('[school-virtual-tts]', `${provider.label} ${error.message}`);
        }
      }
      const error = new Error('تعذر توليد صوت المعلم من الخادم — ' + failures.join(' | '));
      error.status = 502;
      error.providerFailures = failures;
      throw error;
    }
  };
}

const defaultEngine = createTeacherTTS();

module.exports = {
  createTeacherTTS,
  splitSpeechParts,
  isValidAudioBytes,
  defaultEngine,
  MAX_PARTS,
  MAX_TEXT_CHARS,
  PROVIDER_MAX_CHARS,
  EDGE_VOICES
};
