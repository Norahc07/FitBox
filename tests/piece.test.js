import { describe, expect, it } from 'vitest';
import {
  canonicalKey,
  cellsKey,
  dimensions,
  isChiral,
  isConnected,
  isValidPieceCells,
  mirror,
  normalize,
  rotate,
  rotateCCW,
  rotateCW,
  uniqueRotations,
} from '../src/engine/piece.js';

const T = [[0, 0], [1, 0], [2, 0], [1, 1]];
const L = [[0, 0], [0, 1], [0, 2], [1, 2]];
const O = [[0, 0], [1, 0], [0, 1], [1, 1]];

describe('piece normalization', () => {
  it('translates cells so the minimum x and y are zero', () => {
    expect(normalize([[3, 5], [4, 5], [3, 6]])).toEqual([[3 - 3, 0], [1, 0], [0, 1]]);
  });

  it('sorts cells row-major regardless of input order', () => {
    expect(normalize([[1, 1], [0, 0], [1, 0]])).toEqual([[0, 0], [1, 0], [1, 1]]);
  });

  it('handles negative coordinates', () => {
    expect(normalize([[-2, -1], [-1, -1]])).toEqual([[0, 0], [1, 0]]);
  });
});

describe('piece rotation', () => {
  it('rotates a horizontal domino clockwise into a vertical one', () => {
    expect(rotateCW([[0, 0], [1, 0]])).toEqual([[0, 0], [0, 1]]);
  });

  it('rotates the T piece clockwise so its stem points left', () => {
    // ###      .#
    // .#   ->  ##
    //          .#
    expect(rotateCW(T)).toEqual([[1, 0], [0, 1], [1, 1], [1, 2]]);
  });

  it('counter-clockwise undoes clockwise', () => {
    expect(rotateCCW(rotateCW(L))).toEqual(normalize(L));
  });

  it('four clockwise turns return to the original shape', () => {
    expect(rotate(L, 4)).toEqual(normalize(L));
    expect(rotate(T, -1)).toEqual(rotateCCW(T));
  });

  it('swaps width and height on a quarter turn', () => {
    expect(dimensions(L)).toEqual({ width: 2, height: 3 });
    expect(dimensions(rotateCW(L))).toEqual({ width: 3, height: 2 });
  });

  it('counts unique orientations correctly', () => {
    expect(uniqueRotations(O)).toHaveLength(1);
    expect(uniqueRotations([[0, 0], [1, 0]])).toHaveLength(2);
    expect(uniqueRotations(T)).toHaveLength(4);
  });
});

describe('shape identity', () => {
  it('canonical key is rotation invariant', () => {
    expect(canonicalKey(rotate(L, 1))).toBe(canonicalKey(L));
    expect(canonicalKey(rotate(L, 3))).toBe(canonicalKey(L));
  });

  it('a mirrored L (J) is a different shape because pieces cannot flip', () => {
    expect(isChiral(L)).toBe(true);
    expect(canonicalKey(mirror(L))).not.toBe(canonicalKey(L));
    expect(isChiral(T)).toBe(false);
  });

  it('cellsKey distinguishes orientations', () => {
    expect(cellsKey(L)).not.toBe(cellsKey(rotateCW(L)));
  });
});

describe('piece validity', () => {
  it('detects connected and disconnected shapes', () => {
    expect(isConnected(T)).toBe(true);
    expect(isConnected([[0, 0], [2, 0]])).toBe(false);
    expect(isConnected([[0, 0], [1, 1]])).toBe(false); // diagonal only
  });

  it('rejects duplicates, empties and non-integer cells', () => {
    expect(isValidPieceCells(T)).toBe(true);
    expect(isValidPieceCells([])).toBe(false);
    expect(isValidPieceCells([[0, 0], [0, 0]])).toBe(false);
    expect(isValidPieceCells([[0, 0.5]])).toBe(false);
  });
});
