// سجل قواعد ألعاب الورق (ruleset registry).
// محرك الورق الحالي (Rummy / groups-and-runs) يبقى القاعدة الافتراضية كما هي.
// أي أصل ورق جديد (مثل أصل Canva القادم) يُسجَّل هنا كقاعدة مستقلة، ويستهلكه
// cards-adapter بدون استبدال محرك Rummy أو حذف الأصل القديم.
const defaultRulesetId = 'rummy';

const rulesets = new Map();

function registerRuleset(id, ruleset) {
  const key = String(id || '').trim();
  const engine = ruleset && ruleset.engine;
  if (!key || !engine || typeof engine.createGame !== 'function') return null;
  const entry = {
    id: key,
    label: String(ruleset.label || key),
    status: ruleset.status || 'available',
    engine,
    games: Array.isArray(ruleset.games) ? ruleset.games : []
  };
  rulesets.set(key, entry);
  return entry;
}

function isAvailable(id) {
  const entry = rulesets.get(String(id || ''));
  return Boolean(entry && entry.status === 'available' && entry.engine && typeof entry.engine.createGame === 'function');
}

function getRuleset(id) {
  const entry = rulesets.get(String(id || ''));
  return isAvailable(entry && entry.id) ? entry : null;
}

// الأصول التي أُعلنت ولم تُرفع بعد. لا تُعاد أبداً كمحرك قابل للعب، حتى لا يدّعي
// الخادم وجود لعبة غير موجودة. بعد رفع أصل Canva تُضاف ألعابه وقواعده هنا.
const pendingOriginals = [
  {
    id: 'canva-cards',
    label: 'أصل الورق الجديد (Canva)',
    status: 'awaiting-original',
    games: [],
    note: 'لم يُرفع أصل الورق الجديد (Canva) إلى المستودع بعد. بعد رفعه تُسجَّل ألعابه وقواعده هنا كقواعد تشغيل مستقلة دون المساس بمحرك Rummy.'
  }
];

function listRulesets() {
  const available = Array.from(rulesets.values())
    .filter((entry) => entry.status === 'available')
    .map((entry) => ({ id: entry.id, label: entry.label, status: 'available', games: entry.games }));
  const pending = pendingOriginals.map((entry) => ({ ...entry }));
  return { defaultRulesetId, available, pending };
}

registerRuleset('rummy', {
  label: 'أوراق المجموعات والتسلسل (Rummy)',
  status: 'available',
  games: ['groups-and-runs'],
  engine: require('./cards-engine')
});

module.exports = { defaultRulesetId, registerRuleset, getRuleset, isAvailable, listRulesets, pendingOriginals };