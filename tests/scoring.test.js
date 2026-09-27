import { describe, expect, it } from 'vitest';
import { calculateScore, parTimeMs, SCORING, starsForScore } from '../src/engine/scoring.js';

const beginner = { difficulty: 'beginner', requiredPieces: 15 };

describe('score calculation', () => {
  it('a fast, clean solve earns the maximum score and 3 stars', () => {
    const s = calculateScore({ ...beginner, timeMs: 10_000, hintsUsed: 0, mistakes: 0 });
    expect(s.total).toBe(s.maxScore);
    expect(s.total).toBe(SCORING.base + 500 + SCORING.maxSpeedBonus);
    expect(s.stars).toBe(3);
  });

  it('is deterministic for identical inputs', () => {
    const input = { ...beginner, timeMs: 95_000, hintsUsed: 1, mistakes: 3 };
    expect(calculateScore(input)).toEqual(calculateScore(input));
  });

  it('applies hint and mistake penalties', () => {
    const clean = calculateScore({ ...beginner, timeMs: 60_000 });
    const messy = calculateScore({ ...beginner, timeMs: 60_000, hintsUsed: 2, mistakes: 5 });
    expect(clean.total - messy.total).toBe(2 * SCORING.hintPenalty + 5 * SCORING.mistakePenalty);
  });

  it('speed bonus is full at half par, zero at double par and linear between', () => {
    const par = parTimeMs('beginner', 15);
    expect(calculateScore({ ...beginner, timeMs: par * 0.5 }).speedBonus).toBe(SCORING.maxSpeedBonus);
    expect(calculateScore({ ...beginner, timeMs: par * 2 }).speedBonus).toBe(0);
    const mid = calculateScore({ ...beginner, timeMs: par * 1.25 }).speedBonus;
    expect(mid).toBe(Math.round(SCORING.maxSpeedBonus * 0.5));
  });

  it('speed is not the only factor: a slow clean solve beats a fast solve with many hints', () => {
    const slowClean = calculateScore({ ...beginner, timeMs: 10 * 60_000 });
    const fastHints = calculateScore({ ...beginner, timeMs: 5_000, hintsUsed: 5 });
    expect(slowClean.total).toBeGreaterThan(fastHints.total);
  });

  it('never drops below the minimum score and caps mistake penalties', () => {
    const s = calculateScore({ ...beginner, timeMs: 10 ** 9, hintsUsed: 50, mistakes: 500 });
    expect(s.total).toBe(SCORING.minimumScore);
    expect(s.mistakePenalty).toBe(SCORING.maxMistakePenalty);
    expect(s.stars).toBe(1);
  });

  it('harder difficulties award a larger completion bonus', () => {
    const b = calculateScore({ difficulty: 'beginner', requiredPieces: 15, timeMs: 0 });
    const h = calculateScore({ difficulty: 'hard', requiredPieces: 15, timeMs: 0 });
    expect(h.completionBonus).toBeGreaterThan(b.completionBonus);
  });

  it('maps score ratios to stars', () => {
    expect(starsForScore(90, 100)).toBe(3);
    expect(starsForScore(70, 100)).toBe(2);
    expect(starsForScore(30, 100)).toBe(1);
  });
});
