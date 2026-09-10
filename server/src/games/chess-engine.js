// Authoritative chess engine using chess.js (BSD-3-Clause, Jeff Hlywa)
const { Chess } = require('chess.js');

function createGame(params = {}) {
  const chess = new Chess();
  return {
    engine: 'chess', version: 2,
    status: 'waiting',
    turn: 'white',
    players: params.playerIds || ['w', 'b'],
    board: boardFromChess(chess),
    gameState: {
      status: 'waiting',
      turn: 'white',
      moveCount: 0,
      updatedAt: new Date()
    },
    finished: false,
    winner: null,
    finishReason: '',
    history: [],
    ch: chess,
    createdAt: new Date()
  };
}

function boardFromChess(chess) {
  const board = [];
  const fen = chess.fen();
  const parts = fen.split(' ');
  const rows = parts[0].split('/');
  for (let r = 0; r < 8; r++) {
    const rowStr = rows[r] || '';
    let file = 0;
    for (const ch of rowStr) {
      if (/\d+/.test(ch)) {
        const count = parseInt(ch, 10);
        for (let i = 0; i < count; i++) board.push(null);
        file += count;
      } else {
        board.push({ type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? 'white' : 'black', moved: true, file: file, rank: 7 - r });
        file += 1;
      }
    }
  }
  return board;
}

function getPublicState(s) {
  const ch = s.ch || new Chess();
  return {
    engine: s.engine,
    version: s.version,
    status: s.status,
    turn: s.turn,
    finished: s.finished,
    winner: s.winner,
    finishReason: s.finishReason || '',
    board: s.board || boardFromChess(ch),
    moveHistory: s.history || [],
    createdAt: s.createdAt
  };
}

function getPrivateState(s, userId) {
  const color = s.players.indexOf(userId) === 0 ? 'white' : 'black';
  return { ...getPublicState(s), myColor: color, canMove: s.turn === color && !s.finished };
}

function getLegalActions(s, userId) {
  if (s.status !== 'active' && s.status !== 'waiting') return [];
  const color = s.turn === 'white' ? 'white' : 'black';
  if (s.turn !== (s.players.indexOf(userId) === 0 ? 'white' : 'black')) return [];
  const ch = s.ch || new Chess();
  try {
    const moves = ch.moves({ verbose: true });
    return moves.map(m => ({ type: 'move', from: m.from, to: m.to, promotion: m.promotion || null }));
  } catch (e) {
    return [];
  }
}

function applyAction(state, userId, action) {
  if (state.status !== 'active' && state.status !== 'waiting') return { error: 'not active' };
  const myColor = state.players.indexOf(userId) === 0 ? 'white' : 'black';
  if (state.turn !== myColor) return { error: 'not your turn' };
  const ch = state.ch || new Chess();
  try {
    if (action.type === 'move' && action.from && action.to) {
      const moveStr = action.from + action.to + (action.promotion || '');
      const result = ch.move(moveStr);
      if (!result) return { error: 'illegal move' };
      state.history.push({ from: result.from, to: result.to, promotion: result.promotion || null, piece: result.piece || null });
      state.board = boardFromChess(ch);
      state.turn = ch.turn();
      state.gameState = state.gameState || { status: 'active', turn: state.turn, moveCount: (state.history.length || 0), updatedAt: new Date() };
      state.gameState.status = ch.isCheckmate() ? 'finished' : (ch.isDraw() ? 'draw' : 'active');
      state.gameState.turn = state.turn;
      state.gameState.moveCount = state.history.length;
      state.gameState.updatedAt = new Date();
      if (ch.isCheckmate()) { state.finished = true; state.winner = myColor; state.finishReason = 'checkmate'; }
      else if (ch.isDraw()) { state.finished = true; state.winner = 'draw'; state.finishReason = 'draw'; }
      else if (ch.isStalemate()) { state.finished = true; state.winner = 'draw'; state.finishReason = 'stalemate'; }
      else if (ch.isInsufficientMaterial()) { state.finished = true; state.winner = 'draw'; state.finishReason = 'insufficient_material'; }
      return { ok: true };
    }
    return { error: 'unknown action' };
  } catch (e) {
    return { error: e.message || 'invalid' };
  }
}

function isFinished(state) { return !!state.finished; }
function getWinner(state) { return state.winner || null; }
function serialize(state) {
  const ch = state.ch || new Chess();
  return JSON.stringify({
    engine: 'chess',
    version: 2,
    status: state.status,
    turn: state.turn,
    finished: state.finished,
    winner: state.winner,
    finishReason: state.finishReason || '',
    board: state.board,
    history: state.history || [],
    fen: ch.fen(),
    createdAt: state.createdAt
  });
}
module.exports = { createGame: (p) => { const s = createGame(p); s.engine = 'chess'; return s; }, getPublicState, getPrivateState, getLegalActions, applyAction, isFinished, getWinner, serialize };
