import { describe, expect, it } from 'vitest';
import { generateLevel, generatePuzzle, planPieceSizes } from '../src/engine/generator.js';
import { canonicalKey } from '../src/engine/piece.js';
import { createRng } from '../src/engine/rng.js';
import { getProfile } from '../src/engine/difficulty.js';
import { validateSolution } from '../src/engine/solution.js';
import { validateLevel } from '../src/levels/validator.js';
import { LEVEL_CONFIGS } from '../src/levels/levelConfigs.js';
import seedLevels from '../src/levels/seedLevels.json';

describe('seeded RNG', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });
});

describe('size planning', () => {
  it('plans sizes that sum to the board area with the exact piece count', () => {
    const sizes = planPieceSizes(49, 14, getProfile('hard'), createRng(7));
    expect(sizes).toHaveLength(14);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(49);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(getProfile('hard').maxSize);
  });

  it('never plans more single squares than the difficulty allows', () => {
    for (const difficulty of ['beginner', 'intermediate', 'hard']) {
      const profile = getProfile(difficulty);
      for (let seed = 1; seed <= 50; seed++) {
        const sizes = planPieceSizes(25, 10, profile, createRng(seed));
        expect(sizes.filter((s) => s === 1).length).toBeLessThanOrEqual(profile.maxMonos);
      }
    }
  });
});

describe('level generation', () => {
  it('generates a puzzle whose stored solution tiles the board', () => {
    const puzzle = generatePuzzle({ width: 6, height: 6, requiredPieces: 12, totalPieces: 17, difficulty: 'intermediate', seed: 123 });
    expect(puzzle.pieces).toHaveLength(17);
    expect(puzzle.solution).toHaveLength(12);
    expect(validateSolution({ width: 6, height: 6, pieces: puzzle.pieces, solution: puzzle.solution }).valid).toBe(true);
  });

  it('is deterministic: the same seed gives the same puzzle', () => {
    const config = { width: 5, height: 5, requiredPieces: 10, totalPieces: 13, difficulty: 'beginner', seed: 999 };
    expect(generatePuzzle(config)).toEqual(generatePuzzle(config));
  });

  it('different seeds give different puzzles', () => {
    const base = { width: 5, height: 5, requiredPieces: 10, totalPieces: 13, difficulty: 'beginner' };
    expect(generatePuzzle({ ...base, seed: 1 }).solution).not.toEqual(generatePuzzle({ ...base, seed: 2 }).solution);
  });

  it('decoys are never interchangeable with a solution piece', () => {
    const level = generateLevel({ ...LEVEL_CONFIGS[20] });
    const solutionIds = new Set(level.solution.map((s) => s.pieceId));
    const solutionShapes = new Set(level.pieces.filter((p) => solutionIds.has(p.id)).map((p) => canonicalKey(p.cells)));
    const decoys = level.pieces.filter((p) => !solutionIds.has(p.id));
    expect(decoys).toHaveLength(level.totalPieces - level.requiredPieces);
    for (const d of decoys) expect(solutionShapes.has(canonicalKey(d.cells))).toBe(false);
  });

  it('refuses to build a puzzle without decoys', () => {
    expect(() => generatePuzzle({ width: 5, height: 5, requiredPieces: 10, totalPieces: 10, difficulty: 'beginner', seed: 1 })).toThrow();
  });
});

describe('built-in seed levels', () => {
  it('has 24 levels matching the configured specification', () => {
    expect(seedLevels).toHaveLength(24);
    seedLevels.forEach((level, i) => {
      const config = LEVEL_CONFIGS[i];
      expect(level.number).toBe(config.number);
      expect(level.width).toBe(config.width);
      expect(level.totalPieces).toBe(config.totalPieces);
      expect(level.requiredPieces).toBe(config.requiredPieces);
      expect(level.difficulty).toBe(config.difficulty);
    });
  });

  it('every built-in level passes validation', () => {
    for (const level of seedLevels) expect(validateLevel(level)).toMatchObject({ valid: true, errors: [] });
  });

  it('keeps single squares rare and uses 2–5 decoys that grow with difficulty', () => {
    const decoyRange = { beginner: [2, 3], intermediate: [3, 4], hard: [4, 5] };
    for (const level of seedLevels) {
      const monos = level.pieces.filter((p) => p.cells.length === 1).length;
      expect(monos).toBeLessThanOrEqual(getProfile(level.difficulty).maxMonos);
      const decoys = level.totalPieces - level.requiredPieces;
      const [min, max] = decoyRange[level.difficulty];
      expect(decoys).toBeGreaterThanOrEqual(min);
      expect(decoys).toBeLessThanOrEqual(max);
    }
  });

  it('bundled JSON matches regeneration from the seeds (level 1 today = level 1 tomorrow)', () => {
    for (const config of [LEVEL_CONFIGS[0], LEVEL_CONFIGS[12], LEVEL_CONFIGS[23]]) {
      const bundled = seedLevels.find((l) => l.number === config.number);
      expect(generateLevel(config)).toEqual(bundled);
    }
  });
});
