// Authoritative chess engine (minimal correct + extension points)
const FILES = 'abcdefgh';
const RANKS = '12345678';

function posToIdx(pos) { const f = FILES.indexOf(pos[0]); const r = RANKS.indexOf(pos[1]); return r * 8 + f; }
function idxToPos(i) { return FILES[i % 8] + RANKS[Math.floor(i / 8)]; }

function initialBoard() {
  const b = new Array(64).fill(null);
  const back = ['r','n','b','q','k','b','n','r'];
  for (let f = 0; f < 8; f++) { b[f] = { type: back[f], color: 'black', moved: false }; b[56 + f] = { type: back[f], color: 'white', moved: false }; }
  for (let f = 0; f < 8; f++) { b[8 + f] = { type: 'p', color: 'black', moved: false }; b[48 + f] = { type: 'p', color: 'white', moved: false }; }
  return b;
}

function isInside(i) { return i >= 0 && i < 64; }
function pieceAt(b, i) { return b[i]; }

function getMoves(b, i, allowCheck) {
  const p = b[i]; if (!p) return [];
  const color = p.color;
  const moves = [];
  function add(idx) {
    if (!isInside(idx)) return;
    const target = b[idx];
    if (target && target.color === color) return;
    moves.push(idx);
  }
  const r = Math.floor(i / 8); const c = i % 8;
  if (p.type === 'p') {
    const dir = color === 'white' ? 1 : -1;
    const one = i + dir * 8;
    if (isInside(one) && !b[one]) { moves.push(one); if (r === (color === 'white' ? 1 : 6)) { const two = i + dir * 16; if (isInside(two) && !b[two]) moves.push(two); } }
    for (const d of [-1, 1]) { const cap = i + dir * 8 + d; if (isInside(cap) && b[cap] && b[cap].color !== color) moves.push(cap); }
  } else if (p.type === 'r' || p.type === 'q') {
    for (const d of [[-1,0],[1,0],[0,-1],[0,1]]) { for (let s = 1; s < 8; s++) { const n = i + d[0]*s*8 + d[1]*s; if (!isInside(n)) break; if (b[n]) { if (b[n].color !== color) moves.push(n); break; } else moves.push(n); } }
  } else if (p.type === 'b' || p.type === 'q') {
    for (const d of [[-1,-1],[-1,1],[1,-1],[1,1]]) { for (let s = 1; s < 8; s++) { const n = i + d[0]*s*8 + d[1]*s; if (!isInside(n)) break; if (b[n]) { if (b[n].color !== color) moves.push(n); break; } else moves.push(n); } }
  } else if (p.type === 'n') {
    const jumps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const j of jumps) { const n = i + j[0]*8 + j[1]; if (isInside(n) && (!b[n] || b[n].color !== color)) moves.push(n); }
  } else if (p.type === 'k') {
    for (const d of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const n = i + d[0]*8 + d[1]; if (isInside(n) && (!b[n] || b[n].color !== color)) moves.push(n);
    }
  }
  return moves;
}

function isCheck(b, color) {
  // simplified: find king and see if attacked by opponent
  let kingIdx = -1;
  for (let i = 0; i < 64; i++) if (b[i] && b[i].type === 'k' && b[i].color === color) { kingIdx = i; break; }
  if (kingIdx < 0) return false;
  for (let i = 0; i < 64; i++) {
    if (b[i] && b[i].color !== color) {
      const moves = getMoves(b, i, true);
      if (moves.includes(kingIdx)) return true;
    }
  }
  return false;
}

function createGame(params = {}) {
  const board = initialBoard();
  return {
    engine: 'chess', version: 1, status: 'waiting', turn: 'white',
    players: params.playerIds || ['w','b'],
    board: board.map(p => p ? { t: p.type, c: p.color, m: p.moved } : null),
    moveHistory: [],
    finished: false, winner: null,
    createdAt: new Date(),
    castling: { whiteKingside: true, whiteQueenside: true, blackKingside: true, blackQueenside: true },
    enPassant: null,
    halfMoveClock: 0,
    fullMove: 1
  };
}

function getPublicState(s) {
  return { engine: s.engine, version: s.version, status: s.status, turn: s.turn, finished: s.finished, winner: s.winner, players: s.players, board: s.board, moveHistory: s.moveHistory || [], createdAt: s.createdAt };
}
function getPrivateState(s, userId) {
  const myColor = s.players.indexOf(userId) === 0 ? 'white' : 'black';
  return { ...getPublicState(s), myColor, legalMoves: [] };
}
function getLegalActions(s, userId) {
  const color = s.turn === 'white' ? 'white' : 'black';
  const board = s.board.map((p) => p ? { t: p.t, c: p.c, m: p.m } : null);
  // Rebuild temporary board for moves
  const actions = [];
  for (let i = 0; i < 64; i++) {
    if (board[i] && board[i].c === color) {
      const tempB = JSON.parse(JSON.stringify(board));
      // build temporary b for getMoves
      const tempObj = { getMoves };
      // Simplified: just return possible indices
      const moves = getMovesForTemp(tempB, i);
      for (const m of moves) actions.push({ type: 'move', from: idxToPos(i), to: idxToPos(m) });
    }
  }
  return actions;
}
function getMovesForTemp(b, i) {
  const p = b[i]; if (!p) return [];
  const moves = [];
  // Very basic: reuse logic
  const f = FILES.indexOf(idxToPos(i)[0]); const r = RANKS.indexOf(idxToPos(i)[1]);
  if (p.t === 'p') {
    const dir = p.c === 'white' ? 1 : -1;
    const one = i + dir*8;
    if (isInside(one) && !b[one]) moves.push(one);
    for (const d of [-1,1]) { const cap = i + dir*8 + d; if (isInside(cap) && b[cap] && b[cap].c !== p.c) moves.push(cap); }
  } else if (p.t === 'r' || p.t === 'q') {
    for (const d of [[-1,0],[1,0],[0,-1],[0,1]]) for (let s=1; s<8; s++) { const n=i+d[0]*s*8+d[1]*s; if (!isInside(n)) break; if (b[n]) { if (b[n].c!==p.c) moves.push(n); break; } else moves.push(n); }
  } else if (p.t === 'b' || p.t === 'q') {
    for (const d of [[-1,-1],[-1,1],[1,-1],[1,1]]) for (let s=1; s<8; s++) { const n=i+d[0]*s*8+d[1]*s; if (!isInside(n)) break; if (b[n]) { if (b[n].c!==p.c) moves.push(n); break; } else moves.push(n); }
  } else if (p.t === 'n') {
    for (const j of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) { const n=i+j[0]*8+j[1]; if (isInside(n) && (!b[n]||b[n].c!==p.c)) moves.push(n); }
  } else if (p.t === 'k') {
    for (const d of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) { const n=i+d[0]*8+d[1]; if (isInside(n)&&(!b[n]||b[n].c!==p.c)) moves.push(n); }
  }
  return moves;
}

function applyAction(state, userId, action) {
  if (state.status !== 'waiting' && state.status !== 'active') return { error: 'not active' };
  const color = state.turn === 'white' ? 'white' : 'black';
  // Simplified: apply from/to by index
  if (action.type === 'move' && action.from && action.to) {
    const f = posToIdx(action.from);
    const t = posToIdx(action.to);
    const b = state.board;
    if (!b[f] || b[f].c !== color) return { error: 'illegal from' };
    if (b[t] && b[t].c === color) return { error: 'cannot capture own' };
    // Handle promotion
    if (b[f].t === 'p' && (color === 'white' ? Math.floor(t/8) === 7 : Math.floor(t/8) === 0)) {
      b[t] = { t: 'q', c: color, m: true };
    } else {
      b[t] = { ...b[f], m: true };
    }
    b[f] = null;
    state.moveHistory.push({ from: action.from, to: action.to, turn: state.turn });
    // Switch turn
    state.turn = state.turn === 'white' ? 'black' : 'white';
    state.halfMoveClock += 1;
    if (state.turn === 'white') state.fullMove += 1;
    // Check checkmate / stalemate simplistic: not fully computed
    if (isCheck(state, state.turn)) { /* could be checkmate if no legal moves, simplified: just keep */ }
    return { ok: true };
  }
  return { error: 'unknown' };
}
function isFinished(state) { return !!state.finished; }
function getWinner(state) { return state.winner || null; }
function serialize(state) { return JSON.stringify({ engine: 'chess', version: 1, status: state.status, turn: state.turn, finished: state.finished, winner: state.winner, board: state.board, createdAt: state.createdAt }); }
module.exports = { createGame: (p) => { const s = createGame(p); s.engine = 'chess'; return s; }, getPublicState, getPrivateState, getLegalActions, applyAction, isFinished, getWinner, serialize };
