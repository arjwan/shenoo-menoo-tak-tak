'use strict';

// Resolve a usable Groq chat model with the production API key. The published
// model catalog alone does not guarantee access for an individual organization.
const CHAT_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-20b',
  'qwen/qwen3-32b'
];

async function availableModels(key) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: 'Bearer ' + key },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return null;
    const data = await response.json();
    return new Set((data.data || []).map(model => model.id).filter(Boolean));
  } catch (_) {
    return null;
  }
}

function unavailableModel(message) {
  return /does not exist|do not have access|model.*not found|model.*unavailable/i.test(String(message));
}

async function chatCompletion(key, payload) {
  const listed = await availableModels(key);
  const candidates = [...new Set([payload.model, ...CHAT_MODELS])]
    .filter(model => !listed || listed.has(model));
  if (!candidates.length) throw new Error('لا توجد نماذج محادثة متاحة لمفتاح Groq على الخادم');
  let lastError;
  for (const model of candidates) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ ...payload, model }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) return { data, model };
    const message = data.error?.message || data.message || 'Groq HTTP ' + response.status;
    lastError = Object.assign(new Error(message), { status: response.status === 429 ? 429 : 502 });
    // An unavailable model is the only reason to try another model. Other
    // errors (quota, invalid key, malformed request) need their real message.
    if (!unavailableModel(message)) throw lastError;
  }
  throw lastError;
}

module.exports = { chatCompletion, unavailableModel };
