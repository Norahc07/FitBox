import { normalize } from './piece.js';

/**
 * Shape library used by the generator.
 * tier 1 = simple (square, line, rectangle, basic L/T)
 * tier 2 = irregular (S/Z, J, plus, staircase, U, P)
 * tier 3 = complex / chiral pentominoes that look alike (F, N, Y, Q, Z5 …)
 */
const RAW_SHAPES = [
  { key: 'mono', name: 'Square', tier: 1, cells: [[0, 0]] },
  { key: 'domino', name: 'Rectangle', tier: 1, cells: [[0, 0], [1, 0]] },

  { key: 'I3', name: 'Line', tier: 1, cells: [[0, 0], [1, 0], [2, 0]] },
  { key: 'V3', name: 'Corner', tier: 1, cells: [[0, 0], [0, 1], [1, 1]] },

  { key: 'O4', name: 'Square', tier: 1, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { key: 'I4', name: 'Line', tier: 1, cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { key: 'L4', name: 'L', tier: 1, cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  { key: 'T4', name: 'T', tier: 1, cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { key: 'J4', name: 'J', tier: 2, cells: [[1, 0], [1, 1], [1, 2], [0, 2]] },
  { key: 'S4', name: 'S', tier: 2, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { key: 'Z4', name: 'Z', tier: 2, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },

  { key: 'I5', name: 'Long line', tier: 1, cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
  { key: 'X5', name: 'Plus', tier: 2, cells: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]] },
  { key: 'P5', name: 'P', tier: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]] },
  { key: 'U5', name: 'U', tier: 2, cells: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
  { key: 'V5', name: 'Big corner', tier: 2, cells: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]] },
  { key: 'W5', name: 'Staircase', tier: 2, cells: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]] },
  { key: 'T5', name: 'Tall T', tier: 2, cells: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]] },
  { key: 'Q5', name: 'Q', tier: 3, cells: [[0, 0], [1, 0], [0, 1], [1, 1], [1, 2]] },
  { key: 'L5', name: 'Long L', tier: 3, cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]] },
  { key: 'J5', name: 'Long J', tier: 3, cells: [[1, 0], [1, 1], [1, 2], [1, 3], [0, 3]] },
  { key: 'N5', name: 'N', tier: 3, cells: [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3]] },
  { key: 'N5m', name: 'Reverse N', tier: 3, cells: [[1, 0], [1, 1], [0, 1], [0, 2], [0, 3]] },
  { key: 'F5', name: 'F', tier: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]] },
  { key: 'F5m', name: 'Reverse F', tier: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1], [1, 2]] },
  { key: 'Y5', name: 'Y', tier: 3, cells: [[1, 0], [0, 1], [1, 1], [1, 2], [1, 3]] },
  { key: 'Y5m', name: 'Reverse Y', tier: 3, cells: [[0, 0], [0, 1], [1, 1], [0, 2], [0, 3]] },
  { key: 'Z5', name: 'Big Z', tier: 3, cells: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]] },
  { key: 'S5', name: 'Big S', tier: 3, cells: [[2, 0], [1, 0], [1, 1], [1, 2], [0, 2]] },

  { key: 'R6', name: 'Block', tier: 1, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
];

export const SHAPES = RAW_SHAPES.map((s) => ({ ...s, cells: normalize(s.cells), size: s.cells.length }));

export const SHAPES_BY_KEY = Object.fromEntries(SHAPES.map((s) => [s.key, s]));

export function shapesOfSize(size, maxTier = 3) {
  return SHAPES.filter((s) => s.size === size && s.tier <= maxTier);
}
