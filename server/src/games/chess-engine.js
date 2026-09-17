// Server-authoritative chess engine. Only FEN and plain data are persisted.
const { Chess } = require('chess.js');

function chessOf(state) { try { return new Chess(state && state.fen ? state.fen : undefined); } catch (_) { return new Chess(); } }
function boardFromChess(chess) { return chess.board().flatMap((row, rowIndex) => row.map((piece, file) => piece ? { type: piece.type, color: piece.color === 'w' ? 'white' : 'black', file, rank: 7 - rowIndex } : null)); }
function colorFor(state, userId) { return String(state.players && state.players[0]) === String(userId) ? 'white' : String(state.players && state.players[1]) === String(userId) ? 'black' : null; }
function sync(state, chess) { state.fen = chess.fen(); state.board = boardFromChess(chess); state.turn = chess.turn() === 'w' ? 'white' : 'black'; state.moveCount = (state.history || []).length; state.updatedAt = new Date(); }

function createGame(params = {}) {
  const chess = new Chess(), players = (params.playerIds || ['w', 'b']).map(String).slice(0, 2);
  return { engine: 'chess', version: 3, status: 'waiting', turn: 'white', players, fen: chess.fen(), board: boardFromChess(chess), moveCount: 0, finished: false, winner: null, finishReason: '', history: [], createdAt: new Date() };
}
function getPublicState(state) {
  const chess = chessOf(state); sync(state, chess);
  return { engine: state.engine, version: state.version, status: state.status, turn: state.turn, players: state.players, finished: state.finished, winner: state.winner, finishReason: state.finishReason || '', board: state.board, moveHistory: state.history || [], moveCount: state.moveCount || 0, check: chess.inCheck(), createdAt: state.createdAt };
}
function getPrivateState(state, userId) { const myColor = colorFor(state, userId); return { myColor, turn: state.turn === myColor, canMove: state.turn === myColor && !state.finished }; }
function getLegalActions(state, userId) {
  if (!['active', 'waiting'].includes(state.status) || state.finished) return [];
  const myColor = colorFor(state, userId); if (!myColor || state.turn !== myColor) return [];
  return chessOf(state).moves({ verbose: true }).map(move => ({ type: 'move', from: move.from, to: move.to, promotion: move.promotion || null }));
}
function finishFromBoard(state, chess, movingColor) {
  if (chess.isCheckmate()) { state.finished = true; state.status = 'finished'; state.winner = movingColor; state.finishReason = 'checkmate'; }
  else if (chess.isStalemate()) { state.finished = true; state.status = 'finished'; state.winner = 'draw'; state.finishReason = 'stalemate'; }
  else if (chess.isInsufficientMaterial()) { state.finished = true; state.status = 'finished'; state.winner = 'draw'; state.finishReason = 'insufficient_material'; }
  else if (chess.isThreefoldRepetition()) { state.finished = true; state.status = 'finished'; state.winner = 'draw'; state.finishReason = 'threefold_repetition'; }
  else if (chess.isDrawByFiftyMoves()) { state.finished = true; state.status = 'finished'; state.winner = 'draw'; state.finishReason = 'fifty_move_rule'; }
}
function applyAction(state, userId, action = {}) {
  if (!['active', 'waiting'].includes(state.status) || state.finished) return { error: 'اللعبة غير نشطة' };
  const myColor = colorFor(state, userId); if (!myColor) return { error: 'أنت لست لاعبًا في هذه المباراة' };
  if (action.type === 'resign') { state.finished = true; state.status = 'finished'; state.winner = myColor === 'white' ? 'black' : 'white'; state.finishReason = 'resignation'; state.updatedAt = new Date(); return { ok: true, state }; }
  if (state.turn !== myColor) return { error: 'ليس دورك' };
  if (action.type !== 'move' || !action.from || !action.to) return { error: 'حركة غير معروفة' };
  try {
    const chess = chessOf(state), result = chess.move({ from: action.from, to: action.to, promotion: action.promotion || 'q' });
    if (!result) return { error: 'نقلة غير قانونية' };
    state.history = Array.isArray(state.history) ? state.history : [];
    state.history.push({ from: result.from, to: result.to, piece: result.piece, color: result.color === 'w' ? 'white' : 'black', captured: result.captured || null, promotion: result.promotion || null, san: result.san, flags: result.flags });
    sync(state, chess); state.status = state.status === 'waiting' ? 'active' : state.status; finishFromBoard(state, chess, myColor);
    return { ok: true, state };
  } catch (error) { return { error: error.message || 'نقلة غير قانونية' }; }
}
function isFinished(state) { return !!state.finished; }
function getWinner(state) { return state.winner || null; }
function serialize(state) { return JSON.stringify({ ...state, board: boardFromChess(chessOf(state)) }); }
module.exports = { createGame, getPublicState, getPrivateState, getLegalActions, applyAction, isFinished, getWinner, serialize };
