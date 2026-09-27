import { describe, expect, it } from 'vitest';
import { buildGrid, canPlace, evaluateBoard, findNearestValidAnchor, isInside } from '../src/engine/board.js';

describe('collision detection', () => {
  const placed = [{ id: 'a', cells: [[0, 0], [1, 0]] }];
  const { grid } = buildGrid(3, 3, placed);

  it('accepts a placement on free cells', () => {
    expect(canPlace(3, 3, grid, [[0, 1], [1, 1]]).ok).toBe(true);
  });

  it('rejects overlap with another piece', () => {
    expect(canPlace(3, 3, grid, [[1, 0], [2, 0]])).toEqual({ ok: false, reason: 'overlap' });
  });

  it('rejects cells outside the board', () => {
    expect(canPlace(3, 3, grid, [[2, 2], [3, 2]])).toEqual({ ok: false, reason: 'out-of-bounds' });
    expect(canPlace(3, 3, grid, [[-1, 0]]).reason).toBe('out-of-bounds');
    expect(isInside(3, 3, [[0, 0], [2, 2]])).toBe(true);
  });

  it('lets a piece move onto its own previous cells', () => {
    expect(canPlace(3, 3, grid, [[1, 0], [2, 0]], 'a').ok).toBe(true);
  });

  it('reports overlaps when building a grid', () => {
    const result = buildGrid(3, 3, [
      { id: 'a', cells: [[0, 0]] },
      { id: 'b', cells: [[0, 0]] },
    ]);
    expect(result.overlaps).toHaveLength(1);
  });
});

describe('grid snapping tolerance', () => {
  const { grid } = buildGrid(3, 3, [{ id: 'a', cells: [[0, 0]] }]);
  const domino = [[0, 0], [1, 0]];

  it('with no tolerance only the exact spot is tried', () => {
    expect(findNearestValidAnchor(3, 3, grid, domino, 0, 0, 'none')).toBeNull();
  });

  it('orthogonal tolerance nudges one cell', () => {
    expect(findNearestValidAnchor(3, 3, grid, domino, 0, 0, 'orthogonal')).toEqual({ x: 1, y: 0 });
  });

  it('near tolerance also tries diagonals', () => {
    const blocked = buildGrid(3, 3, [{ id: 'a', cells: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]] }]).grid;
    expect(findNearestValidAnchor(3, 3, blocked, [[0, 0]], 0, 0, 'orthogonal')).toBeNull();
    expect(findNearestValidAnchor(3, 3, blocked, [[0, 0]], 0, 0, 'near')).toEqual({ x: 1, y: 1 });
  });
});

describe('board validation', () => {
  const full = [
    { id: 'a', cells: [[0, 0], [1, 0]] },
    { id: 'b', cells: [[0, 1], [1, 1]] },
  ];

  it('is solved when every cell is covered', () => {
    expect(evaluateBoard(2, 2, full).solved).toBe(true);
  });

  it('is not solved when a cell is uncovered', () => {
    const result = evaluateBoard(2, 2, full.slice(0, 1));
    expect(result.solved).toBe(false);
    expect(result.covered).toBe(2);
  });

  it('accepts any set of pieces that fills the box, not just the stored solution', () => {
    const other = [
      { id: 'a', cells: [[0, 0]] },
      { id: 'b', cells: [[1, 0]] },
      { id: 'c', cells: [[0, 1], [1, 1]] },
    ];
    const result = evaluateBoard(2, 2, other);
    expect(result.solved).toBe(true);
    expect(result.count).toBe(3);
  });

  it('is not solved when pieces overlap', () => {
    const overlapping = [
      { id: 'a', cells: [[0, 0], [1, 0]] },
      { id: 'b', cells: [[1, 0], [1, 1]] },
      { id: 'c', cells: [[0, 1]] },
    ];
    expect(evaluateBoard(2, 2, overlapping).solved).toBe(false);
  });
});
