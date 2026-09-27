import { dimensions, placedCells, rotate } from '../engine/piece.js';
import { buildGrid, evaluateBoard, findNearestValidAnchor } from '../engine/board.js';
import { computeHint } from '../engine/hints.js';

/**
 * Game state machine. Pure: all engine rules (collision, snapping, solved
 * detection, hints) are applied here so UI components only dispatch intents.
 *
 * status: 'playing' | 'paused' | 'complete' | 'failed'
 * `event` is a monotonically numbered notification the UI turns into sound,
 * haptics, animation and screen-reader announcements.
 */
export function createGameState(level, saved = null) {
  const pieces = {};
  for (const p of level.pieces) {
    pieces[p.id] = { id: p.id, cells: p.cells, rotation: p.initialRotation ?? 0, color: p.color };
  }
  const state = {
    levelId: level.id,
    levelVersion: level.version,
    pieces,
    order: level.pieces.map((p) => p.id),
    placements: {},
    selectedId: null,
    hintsLeft: level.hints,
    hintsUsed: 0,
    mistakes: 0,
    moves: 0,
    elapsedMs: 0,
    status: 'playing',
    hint: null,
    lastHint: null,
    event: null,
    seq: 0,
  };
  if (saved && saved.levelId === level.id && saved.levelVersion === level.version) {
    for (const [id, rotation] of Object.entries(saved.rotations || {})) {
      if (pieces[id] && [0, 1, 2, 3].includes(rotation)) pieces[id] = { ...pieces[id], rotation };
    }
    const placements = {};
    for (const [id, pos] of Object.entries(saved.placements || {})) {
      if (pieces[id]) placements[id] = { x: pos.x, y: pos.y };
    }
    // Only restore placements that are still consistent with the board.
    const list = Object.entries(placements).map(([id, p]) => ({ id, cells: placedCells(pieces[id].cells, pieces[id].rotation, p.x, p.y) }));
    const { overlaps, outOfBounds } = buildGrid(level.width, level.height, list);
    if (!overlaps.length && !outOfBounds.length) state.placements = placements;
    state.hintsLeft = Math.max(0, Math.min(level.hints, saved.hintsLeft ?? level.hints));
    state.hintsUsed = saved.hintsUsed ?? 0;
    state.mistakes = saved.mistakes ?? 0;
    state.elapsedMs = saved.elapsedMs ?? 0;
    state.moves = saved.moves ?? 0;
  }
  return state;
}

export function pieceShape(state, id) {
  const p = state.pieces[id];
  return rotate(p.cells, p.rotation);
}

export function placedPieces(state) {
  return Object.entries(state.placements).map(([id, pos]) => {
    const p = state.pieces[id];
    return { id, cells: placedCells(p.cells, p.rotation, pos.x, pos.y), x: pos.x, y: pos.y };
  });
}

function occupancy(state, level) {
  return buildGrid(level.width, level.height, placedPieces(state)).grid;
}

/** Resolve a desired anchor for a piece to the nearest valid one within tolerance. */
export function resolvePlacement(state, level, id, x, y, tolerance, rotation = state.pieces[id].rotation) {
  const shape = rotate(state.pieces[id].cells, rotation);
  return findNearestValidAnchor(level.width, level.height, occupancy(state, level), shape, x, y, tolerance, id);
}

/** Anchor that centres a piece's bounding box on a board cell (tap / keyboard placement). */
export function centeredAnchor(state, id, col, row) {
  const { width, height } = dimensions(pieceShape(state, id));
  return { x: col - Math.floor((width - 1) / 2), y: row - Math.floor((height - 1) / 2) };
}

function withEvent(state, type, extra = {}) {
  const seq = state.seq + 1;
  return { ...state, seq, event: { type, seq, ...extra } };
}

export function makeGameReducer(level) {
  return function reducer(state, action) {
    const active = state.status === 'playing';
    switch (action.type) {
      case 'SELECT': {
        if (!active) return state;
        const id = action.id && state.pieces[action.id] ? action.id : null;
        if (action.toggle && id === state.selectedId) return { ...state, selectedId: null };
        return id === state.selectedId ? state : withEvent({ ...state, selectedId: id }, id ? 'select' : 'deselect', { pieceId: id });
      }

      case 'PLACE': {
        if (!active) return state;
        const { id, x, y, tolerance = 'none', countMistake = true } = action;
        if (!state.pieces[id]) return state;
        const spot = resolvePlacement(state, level, id, x, y, tolerance);
        if (!spot) {
          const next = countMistake ? { ...state, mistakes: state.mistakes + 1 } : state;
          return withEvent(next, 'invalid', { pieceId: id, x, y });
        }
        const placements = { ...state.placements, [id]: spot };
        let next = { ...state, placements, selectedId: id, moves: state.moves + 1 };
        if (state.hint && state.hint.pieceId === id) next.hint = null;
        const evaluation = evaluateBoard(level.width, level.height, placedPieces(next));
        if (evaluation.solved) {
          return withEvent({ ...next, status: 'complete', selectedId: null, hint: null }, 'complete');
        }
        return withEvent(next, 'place', { pieceId: id });
      }

      case 'REMOVE': {
        if (!active) return state;
        const id = action.id ?? state.selectedId;
        if (!id || !state.placements[id]) return state;
        const placements = { ...state.placements };
        delete placements[id];
        const next = { ...state, placements, moves: state.moves + 1 };
        if (state.hint?.type === 'remove' && state.hint.pieceId === id) next.hint = null;
        return withEvent(next, 'remove', { pieceId: id });
      }

      case 'ROTATE': {
        if (!active) return state;
        const id = action.id ?? state.selectedId;
        if (!id) return withEvent(state, 'notice', { message: 'Select a piece to rotate it.' });
        const piece = state.pieces[id];
        const rotation = (piece.rotation + action.dir + 4) % 4;
        const placement = state.placements[id];
        if (!placement) {
          return withEvent({ ...state, selectedId: id, pieces: { ...state.pieces, [id]: { ...piece, rotation } } }, 'rotate', { pieceId: id });
        }
        // Rotate a placed piece around its centre, nudging it to fit if needed.
        const before = dimensions(rotate(piece.cells, piece.rotation));
        const after = dimensions(rotate(piece.cells, rotation));
        const x = placement.x + Math.floor((before.width - after.width) / 2);
        const y = placement.y + Math.floor((before.height - after.height) / 2);
        const kick = action.tolerance === 'near' ? 'near' : 'orthogonal';
        const spot = resolvePlacement(state, level, id, x, y, kick, rotation);
        if (!spot) return withEvent({ ...state, selectedId: id }, 'blocked', { pieceId: id });
        const next = {
          ...state,
          selectedId: id,
          moves: state.moves + 1,
          pieces: { ...state.pieces, [id]: { ...piece, rotation } },
          placements: { ...state.placements, [id]: spot },
        };
        const evaluation = evaluateBoard(level.width, level.height, placedPieces(next));
        if (evaluation.solved) return withEvent({ ...next, status: 'complete', selectedId: null, hint: null }, 'complete');
        return withEvent(next, 'rotate', { pieceId: id });
      }

      case 'HINT': {
        if (!active) return state;
        const hint = computeHint({ level, pieces: state.pieces, placements: state.placements });
        const key = hint ? `${hint.type}:${hint.pieceId}:${JSON.stringify(hint.cells)}` : null;
        // Asking again before changing the board just re-shows the same hint for free.
        const repeat = key !== null && state.lastHint?.key === key && state.lastHint.moves === state.moves;
        if (!repeat && state.hintsLeft <= 0) return withEvent(state, 'notice', { message: 'No hints left for this puzzle.' });
        if (!hint) return withEvent(state, 'notice', { message: 'No hint available right now.' });
        return withEvent(
          {
            ...state,
            hint: { ...hint, seq: state.seq + 1 },
            lastHint: { key, moves: state.moves },
            hintsLeft: repeat ? state.hintsLeft : state.hintsLeft - 1,
            hintsUsed: repeat ? state.hintsUsed : state.hintsUsed + 1,
            selectedId: hint.pieceId,
          },
          'hint',
          { pieceId: hint.pieceId, hintType: hint.type },
        );
      }

      case 'CLEAR_HINT':
        return state.hint && (!action.seq || state.hint.seq === action.seq) ? { ...state, hint: null } : state;

      case 'TICK': {
        if (!active) return state;
        const elapsedMs = state.elapsedMs + action.delta;
        if (level.timeLimit && elapsedMs >= level.timeLimit * 1000) {
          return withEvent({ ...state, elapsedMs: level.timeLimit * 1000, status: 'failed', selectedId: null }, 'timeout');
        }
        return { ...state, elapsedMs };
      }

      case 'PAUSE':
        return active ? { ...state, status: 'paused' } : state;

      case 'RESUME':
        return state.status === 'paused' ? { ...state, status: 'playing' } : state;

      case 'RESET':
        return withEvent({ ...createGameState(level), seq: state.seq }, 'reset');

      default:
        return state;
    }
  };
}

export function snapshotForSave(state) {
  return {
    levelId: state.levelId,
    levelVersion: state.levelVersion,
    rotations: Object.fromEntries(Object.values(state.pieces).map((p) => [p.id, p.rotation])),
    placements: state.placements,
    hintsLeft: state.hintsLeft,
    hintsUsed: state.hintsUsed,
    mistakes: state.mistakes,
    elapsedMs: Math.round(state.elapsedMs),
    moves: state.moves,
    savedAt: new Date().toISOString(),
  };
}
