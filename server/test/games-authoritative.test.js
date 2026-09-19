const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const GameRoom = require('../src/models/GameRoom');
const registry = require('../src/games/game-engine-registry');
const cardsAdapter = require('../src/games/cards-adapter');
const cardsRules = require('../src/games/cards-rules-registry');
const gameView = require('../src/games/game-view');

const playerIds = () => [new mongoose.Types.ObjectId().toString(), new mongoose.Types.ObjectId().toString(), new mongoose.Types.ObjectId().toString()];

test('cards engine is served through the integration adapter', () => {
  const engine = registry.getEngine('cards');
  assert.equal(typeof engine.createGame, 'function');
  assert.equal(typeof engine.getPublicState, 'function');
  assert.equal(typeof engine.getPrivateState, 'function');
  // محرك Rummy الأصلي يبقى مستخدماً كقاعدة افتراضية ولا يُستبدل.
  assert.equal(registry.listCardRulesets().defaultRulesetId, 'rummy');
  assert.ok(registry.listCardRulesets().available.some((ruleset) => ruleset.id === 'rummy'));
});

test('the Canva cards original is announced but can never be started yet', () => {
  const manifest = registry.listCardRulesets();
  const pending = manifest.pending.find((entry) => entry.id === 'canva-cards');
  assert.ok(pending, 'canva original must be listed as pending');
  assert.equal(pending.status, 'awaiting-original');
  assert.equal(cardsRules.isAvailable('canva-cards'), false);
  assert.equal(cardsRules.getRuleset('canva-cards'), null);
  // أي طلب لقاعدة غير متاحة يعود للافتراضي بدل الفشل أو ادّعاء لعبة غير موجودة.
  assert.equal(cardsAdapter.resolveRulesetId('canva-cards'), 'rummy');
  assert.equal(cardsAdapter.resolveRulesetId('nope'), 'rummy');
});

test('public cards state never exposes hands or the stock pile', () => {
  const state = cardsAdapter.createGame({ playerIds: playerIds() });
  const publicState = cardsAdapter.getPublicState(state);
  assert.equal(cardsAdapter.assertNoHiddenCards(publicState), true);
  const serialized = JSON.stringify(publicState);
  assert.equal(serialized.includes('"hands"'), false);
  assert.equal(serialized.includes('"stock"'), false);
  assert.equal(typeof publicState.stockCount, 'number');
  assert.equal(publicState.players.length, 3);
  assert.ok(publicState.players.every((player) => typeof player.handCount === 'number'));
  assert.ok(publicState.players.every((player) => player.hand === undefined && player.cards === undefined));
  assert.equal(cardsAdapter.serialize(state).includes('"hands"'), false);
});

test('each player receives only their own private hand', () => {
  const ids = playerIds();
  const state = cardsAdapter.createGame({ playerIds: ids });
  const handA = cardsAdapter.getPrivateState(state, ids[0]).hand.map((card) => card.id);
  const handB = cardsAdapter.getPrivateState(state, ids[1]).hand.map((card) => card.id);
  assert.equal(handA.length, 7);
  assert.equal(handB.length, 7);
  assert.equal(handA.some((id) => handB.includes(id)), false, 'hands must not overlap');
});

test('spectators and non players never receive a hand', () => {
  const ids = playerIds();
  const state = cardsAdapter.createGame({ playerIds: ids });
  const stranger = new mongoose.Types.ObjectId().toString();
  const privateView = cardsAdapter.getPrivateState(state, stranger);
  assert.deepEqual(privateView.hand, []);
  assert.equal(privateView.spectator, true);
  assert.deepEqual(cardsAdapter.getLegalActions(state, stranger), []);
});

test('legal actions belong to the player on turn only', () => {
  const ids = playerIds();
  const state = cardsAdapter.createGame({ playerIds: ids });
  state.status = 'active';
  const legalForTurnOwner = cardsAdapter.getLegalActions(state, state.turn);
  assert.ok(legalForTurnOwner.some((action) => action.type === 'draw'));
  const waiting = ids.filter((id) => id !== String(state.turn));
  for (const id of waiting) assert.deepEqual(cardsAdapter.getLegalActions(state, id), []);
});

test('the server rejects out of turn and non player actions', () => {
  const ids = playerIds();
  const state = cardsAdapter.createGame({ playerIds: ids });
  state.status = 'active';
  const waiting = ids.find((id) => id !== String(state.turn));
  const outOfTurn = cardsAdapter.applyAction(state, waiting, { type: 'draw', source: 'stock' });
  assert.ok(outOfTurn.error, 'out of turn draw must fail');
  const stranger = new mongoose.Types.ObjectId().toString();
  const strangerAction = cardsAdapter.applyAction(state, stranger, { type: 'draw', source: 'stock' });
  assert.match(strangerAction.error, /لست لاعب/);
});

test('an illegal meld is refused by the authoritative engine', () => {
  const ids = playerIds();
  const state = cardsAdapter.createGame({ playerIds: ids });
  state.status = 'active';
  const actor = String(state.turn);
  assert.ok(cardsAdapter.applyAction(state, actor, { type: 'draw', source: 'stock' }).ok);
  const hand = state.hands[actor];
  const illegal = hand.slice(0, 2).map((card) => card.id);
  const result = cardsAdapter.applyAction(state, actor, { type: 'meld', cardIds: illegal });
  assert.ok(result.error, 'two cards can never be a meld');
  assert.equal(state.hands[actor].length, 8, 'hand must not change after a refused move');
});

test('state survives a mongo style round trip for reconnect', () => {
  const ids = playerIds();
  const state = cardsAdapter.createGame({ playerIds: ids });
  state.status = 'active';
  const actor = String(state.turn);
  cardsAdapter.applyAction(state, actor, { type: 'draw', source: 'stock' });
  cardsAdapter.applyAction(state, actor, { type: 'discard', cardId: state.hands[actor][0].id });
  const revived = JSON.parse(JSON.stringify(state));
  assert.equal(cardsAdapter.getPrivateState(revived, ids[1]).hand.length, 7);
  assert.ok(cardsAdapter.getLegalActions(revived, revived.turn).length > 0);
  assert.equal(cardsAdapter.getPublicState(revived).players.length, 3);
  assert.equal(cardsAdapter.assertNoHiddenCards(cardsAdapter.getPublicState(revived)), true);
});

test('game-view hides private cards from spectators and keeps them for players', () => {
  const ids = playerIds();
  const room = new GameRoom({
    roomCode: '123456',
    gameType: 'cards',
    owner: ids[0],
    players: ids,
    spectators: [new mongoose.Types.ObjectId().toString()],
    maxPlayers: 4
  });
  room.gameState.status = 'active';
  room.gameState.engineState = cardsAdapter.createGame({ playerIds: ids });
  room.gameState.engineState.status = 'active';
  const playerView = gameView.engineViewFor(room, ids[0]);
  assert.ok(playerView.private && playerView.private.hand.length === 7, 'player gets own hand');
  assert.equal(playerView.spectator, false);
  assert.equal(playerView.viewerRole, 'player');
  const spectatorId = String(room.spectators[0]);
  const spectatorView = gameView.engineViewFor(room, spectatorId);
  assert.equal(spectatorView.private, null);
  assert.deepEqual(spectatorView.legalActions, []);
  assert.equal(spectatorView.spectator, true);
  assert.equal(spectatorView.viewerRole, 'spectator');
  assert.equal(cardsAdapter.assertNoHiddenCards(spectatorView.public), true);
  const strangerView = gameView.engineViewFor(room, new mongoose.Types.ObjectId().toString());
  assert.equal(strangerView.private, null);
  assert.equal(strangerView.spectator, true);
});

test('the socket state payload carries public data only', () => {
  const ids = playerIds();
  const room = new GameRoom({ roomCode: '654321', gameType: 'cards', owner: ids[0], players: ids, maxPlayers: 4 });
  room.gameState.engineState = cardsAdapter.createGame({ playerIds: ids });
  const payload = gameView.stateEventPayload({ id: room._id, players: ids.map((id) => ({ id })) }, gameView.publicEngineView(room));
  // البث الجماعي لا يحمل أي يد: لا hands/stock ولا private.
  assert.equal(cardsAdapter.assertNoBroadcastLeak(payload), true);
  assert.equal(payload.engineState.private, undefined);
  const privatePayload = gameView.privateEventPayload(String(room._id), gameView.engineViewFor(room, ids[0]));
  assert.equal(privatePayload.engineState.private.hand.length, 7);
  // يد كل لاعب تصل إليه وحده: private لا يحمل يد غيره.
  const otherHand = cardsAdapter.getPrivateState(room.gameState.engineState, ids[1]).hand.map((card) => card.id);
  const ownHand = privatePayload.engineState.private.hand.map((card) => card.id);
  assert.equal(otherHand.some((id) => ownHand.includes(id)), false, 'private payload must not contain another hand');
});

test('every registered game type still exposes the authoritative contract', () => {
  for (const type of registry.listTypes()) {
    const engine = registry.getEngine(type);
    assert.equal(typeof engine.createGame, 'function', type + ' createGame');
    assert.equal(typeof engine.getPublicState, 'function', type + ' getPublicState');
    assert.equal(typeof engine.applyAction, 'function', type + ' applyAction');
    assert.equal(typeof engine.getLegalActions, 'function', type + ' getLegalActions');
    assert.equal(typeof engine.getPrivateState, 'function', type + ' getPrivateState');
  }
});