import { describe, expect, it } from 'vitest';
import { createGameState, makeGameReducer } from '../src/game/gameReducer.js';
import { computeHint } from '../src/engine/hints.js';
import seedLevels from '../src/levels/seedLevels.json';

const level = seedLevels[0];

function solve(state, reducer, entries) {
  let s = state;
  for (const entry of entries) {
    const piece = s.pieces[entry.pieceId];
    const turns = (entry.rotation - piece.rotation + 4) % 4;
    for (let i = 0; i < turns; i++) s = reducer(s, { type: 'ROTATE', id: entry.pieceId, dir: 1 });
    s = reducer(s, { type: 'PLACE', id: entry.pieceId, x: entry.x, y: entry.y });
  }
  return s;
}

describe('gameplay state machine', () => {
  it('placing every solution piece completes the puzzle', () => {
    const reducer = makeGameReducer(level);
    const s = solve(createGameState(level), reducer, level.solution);
    expect(s.status).toBe('complete');
    expect(Object.keys(s.placements)).toHaveLength(level.requiredPieces);
    expect(s.mistakes).toBe(0);
  });

  it('an overlapping drop is rejected and counted as a mistake', () => {
    const reducer = makeGameReducer(level);
    const [first, second] = level.solution;
    let s = solve(createGameState(level), reducer, [first]);
    s = reducer(s, { type: 'PLACE', id: second.pieceId, x: first.x, y: first.y, tolerance: 'none' });
    expect(s.placements[second.pieceId]).toBeUndefined();
    expect(s.mistakes).toBe(1);
    expect(s.event.type).toBe('invalid');
  });

  it('removing a piece returns it to the tray', () => {
    const reducer = makeGameReducer(level);
    let s = solve(createGameState(level), reducer, [level.solution[0]]);
    s = reducer(s, { type: 'REMOVE', id: level.solution[0].pieceId });
    expect(s.placements).toEqual({});
  });

  it('hints suggest a solution placement and consume a hint', () => {
    const reducer = makeGameReducer(level);
    const s = reducer(createGameState(level), { type: 'HINT' });
    expect(s.hint.type).toBe('place');
    expect(s.hintsLeft).toBe(level.hints - 1);
    expect(s.hintsUsed).toBe(1);
  });

  it('hints point out a misplaced piece when it blocks the solution', () => {
    // 2x2 box solved by two horizontal dominoes; a vertical domino blocks both slots.
    const tiny = {
      id: 'tiny',
      width: 2,
      height: 2,
      requiredPieces: 2,
      hints: 3,
      pieces: [
        { id: 'p1', cells: [[0, 0], [1, 0]], initialRotation: 1 },
        { id: 'p2', cells: [[0, 0], [1, 0]], initialRotation: 0 },
        { id: 'p3', cells: [[0, 0]], initialRotation: 0 },
      ],
      solution: [
        { pieceId: 'p1', x: 0, y: 0, rotation: 0, cells: [[0, 0], [1, 0]] },
        { pieceId: 'p2', x: 0, y: 1, rotation: 0, cells: [[0, 1], [1, 1]] },
      ],
    };
    const state = createGameState(tiny);
    const hint = computeHint({ level: tiny, pieces: state.pieces, placements: { p1: { x: 0, y: 0 } } });
    expect(hint).toMatchObject({ type: 'remove', pieceId: 'p1' });
  });

  it('the timer stops when the time limit is reached', () => {
    const timed = { ...level, timeLimit: 10 };
    const reducer = makeGameReducer(timed);
    const s = reducer(createGameState(timed), { type: 'TICK', delta: 11_000 });
    expect(s.status).toBe('failed');
    expect(s.elapsedMs).toBe(10_000);
  });
});
