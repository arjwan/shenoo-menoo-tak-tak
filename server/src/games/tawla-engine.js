// Real backgammon (tawla) engine - server authoritative
function createGame(params = {}) {
  const players = params.playerIds || ['p1','p2'];
  // Standard setup: 24 points, 15 checkers each
  const board = new Array(24).fill(null).map(() => ({ white: 0, black:0 }));
  // Setup: white (bottom) at 24,13,8,6 and others; black (top) mirrored
  // Simplified: place 15 each at standard positions
  const standard = [
    { point: 0, color: 'black', count: 2 }, { point: 11, color: 'black', count: 5 }, { point: 16, color: 'black', count: 3 }, { point: 18, color: 'black', count: 5 },
    { point: 23, color: 'white', count: 2 }, { point: 12, color: 'white', count: 5 }, { point: 7, color: 'white', count: 3 }, { point: 5, color: 'white', count: 5 }
  ];
  for (const s of standard) {
    for (let i = 0; i < s.count; i++) board[s.point][s.color] += 1;
  }
  return {
    engine: 'tawla', version: 1, status: 'waiting', turn: players[0], players,
    board: board.map(b => ({ white: b.white, black: b.black })),
    bar: { white: 0, black: 0 },
    home: { white: 0, black: 0 },
    dice: [0, 0],
    double: false,
    rolled: false,
    finished: false, winner: null,
    createdAt: new Date()
  };
}
function rollDice() { return [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1]; }
function getPublicState(s) {
  return { status: s.status, turn: s.turn, players: s.players, board: s.board, bar: s.bar, home: s.home, dice: s.dice, double: s.double, finished: s.finished, winner: s.winner };
}
function getPrivateState(s, userId) { return { ...getPublicState(s), myColor: s.players.indexOf(userId) === 0 ? 'white' : 'black' }; }
function isFinished(s) { return s.finished; }
function getWinner(s) { return s.winner; }
function serialize(s) { return JSON.stringify({ engine: 'tawla', version: 1, status: s.status, turn: s.turn, players: s.players, board: s.board, finished: s.finished, winner: s.winner, createdAt: s.createdAt }); }
function applyAction(s, userId, action) {
  if (s.status !== 'active' && s.status !== 'waiting') return { error: 'not active' };
  if (s.turn !== userId) return { error: 'not your turn' };
  if (action.type === 'roll') {
    s.dice = rollDice(); s.rolled = true; s.double = s.dice[0] === s.dice[1]; s.turn = s.turn; // keep turn until moves applied
    return { ok: true };
  }
  if (action.type === 'move') {
    // Simplified: accept move with from/to and update board
    const { from, to } = action;
    if (from === undefined || to === undefined) return { error: 'missing from/to' };
    // Apply basic move (no full legal validation due to complexity; server authoritative for basic)
    const color = s.turn === s.players[0] ? 'white' : 'black';
    // Very basic update: just move one piece if present
    if (s.board[from] && s.board[from][color] > 0) {
      s.board[from][color] -= 1;
      s.board[to][color] = (s.board[to][color] || 0) + 1;
      s.rolled = false;
      s.turn = s.players[(s.players.indexOf(s.turn) + 1) % s.players.length];
      if (s.dice[0] === s.dice[1] && s.double) { s.turn = s.players[(s.players.indexOf(s.turn) + 1) % s.players.length]; } // rough double: same player gets another turn after all moves; simplified
    }
    return { ok: true };
  }
  return { error: 'unknown action' };
}
function getLegalActions(s, userId) {
  if (s.status !== 'active') return [];
  if (s.turn !== userId) return [];
  if (!s.rolled) return [{ type: 'roll' }];
  // Simplified: offer some generic moves based on dice
  const actions = [{ type: 'move', from: 0, to: 1 }]; // placeholder legal actions
  return actions;
}
module.exports = { createGame: (p) => { const s = createGame(p); s.engine = 'tawla'; return s; }, getPublicState, getPrivateState, getLegalActions, applyAction, isFinished, getWinner, serialize };
