const loaders = {
  domino: () => require('./domino-engine'),
  tawla: () => require('./tawla-engine'),
  chess: () => require('./chess-engine'),
  cards: () => require('./cards-engine')
};

const registry = {};

function getEngine(type) {
  const loader = loaders[type];
  if (!loader) throw new Error('Unknown game type: ' + type);
  if (!registry[type]) registry[type] = loader();
  return registry[type];
}

function createGame(type, params = {}) {
  return getEngine(type).createGame(params);
}

module.exports = { registry, createGame, getEngine, listTypes: () => Object.keys(loaders) };
