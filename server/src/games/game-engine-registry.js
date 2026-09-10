const domino = require('./domino-engine');
const tawla = require('./tawla-engine');
const chess = require('./chess-engine');
const cards = require('./cards-engine');

const registry = {
  domino,
  tawla,
  chess,
  cards
};

function createGame(type, params = {}) {
  const engine = registry[type];
  if (!engine) throw new Error('Unknown game type: ' + type);
  return engine.createGame(params);
}

function getEngine(type) {
  const engine = registry[type];
  if (!engine) throw new Error('Unknown game type: ' + type);
  return engine;
}

module.exports = { registry, createGame, getEngine, listTypes: () => Object.keys(registry) };
