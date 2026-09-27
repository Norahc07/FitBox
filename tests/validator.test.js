import { describe, expect, it } from 'vitest';
import { validateLevel } from '../src/levels/validator.js';
import { mergeLevels } from '../src/levels/levelRepository.js';
import seedLevels from '../src/levels/seedLevels.json';

const clone = (v) => structuredClone(v);
const base = () => clone(seedLevels[0]);

describe('level validation', () => {
  it('accepts a valid level', () => {
    expect(validateLevel(base()).valid).toBe(true);
  });

  it('rejects a solution that does not fill the board', () => {
    const level = base();
    level.solution = level.solution.slice(1);
    level.requiredPieces = level.solution.length;
    const result = validateLevel(level);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/uncovered/);
  });

  it('rejects overlapping solution pieces', () => {
    const level = base();
    const [a, b] = level.solution;
    b.x = a.x;
    b.y = a.y;
    delete b.cells;
    const result = validateLevel(level);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/overlap|outside|uncovered/);
  });

  it('rejects a required-piece count that does not match the solution', () => {
    const level = base();
    level.requiredPieces += 1;
    const result = validateLevel(level);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/required pieces/);
  });

  it('rejects an invalid (disconnected) solution piece', () => {
    const level = base();
    const id = level.solution[0].pieceId;
    level.pieces.find((p) => p.id === id).cells = [[0, 0], [2, 0]];
    expect(validateLevel(level).valid).toBe(false);
  });

  it('rejects a puzzle without decoys', () => {
    const level = base();
    const solutionIds = new Set(level.solution.map((s) => s.pieceId));
    level.pieces = level.pieces.filter((p) => solutionIds.has(p.id));
    level.totalPieces = level.pieces.length;
    const result = validateLevel(level);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/decoy/);
  });

  it('rejects invalid metadata', () => {
    const level = base();
    level.difficulty = 'impossible';
    level.width = 2;
    level.hints = -1;
    level.timeLimit = 0;
    const result = validateLevel(level);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('rejects stored solution cells that disagree with the rotation', () => {
    const level = base();
    const entry = level.solution.find((s) => s.cells.length > 1);
    entry.rotation = (entry.rotation + 1) % 4;
    expect(validateLevel(level).valid).toBe(false);
  });
});

describe('level repository merge', () => {
  it('a newer published remote version replaces the bundled level', () => {
    const v2 = { ...clone(seedLevels[0]), id: 'level-01-v2', version: 2 };
    const merged = mergeLevels(seedLevels, [v2]);
    expect(merged.find((l) => l.number === 1).id).toBe('level-01-v2');
    expect(merged).toHaveLength(24);
  });

  it('ignores unpublished or invalid remote levels', () => {
    const draft = { ...clone(seedLevels[0]), id: 'draft', version: 5, published: false };
    const broken = { ...clone(seedLevels[1]), id: 'broken', version: 5, solution: [] };
    const merged = mergeLevels(seedLevels, [draft, broken]);
    expect(merged.find((l) => l.number === 1).id).toBe(seedLevels[0].id);
    expect(merged.find((l) => l.number === 2).id).toBe(seedLevels[1].id);
  });
});
