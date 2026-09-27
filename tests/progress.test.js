import { describe, expect, it } from 'vitest';
import {
  applySession,
  computeUnlocked,
  mergeProgress,
  mergeProgressMaps,
  nextLevelToPlay,
  summarizeProgress,
} from '../src/game/progress.js';

const levels = [1, 2, 3, 4].map((number) => ({ number }));
const session = (overrides = {}) => ({
  levelNumber: 1,
  score: 1500,
  timeMs: 60_000,
  stars: 2,
  completedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('level unlocking', () => {
  it('initially only level 1 is unlocked', () => {
    expect([...computeUnlocked(levels, {})]).toEqual([1]);
  });

  it('completing a level unlocks the next one', () => {
    const unlocked = computeUnlocked(levels, { 1: { completed: true } });
    expect(unlocked.has(2)).toBe(true);
    expect(unlocked.has(3)).toBe(false);
  });

  it('completed levels stay unlocked even if earlier progress is missing (e.g. after a merge)', () => {
    const unlocked = computeUnlocked(levels, { 3: { completed: true } });
    expect(unlocked.has(3)).toBe(true);
    expect(unlocked.has(4)).toBe(true);
  });

  it('continue picks the first unlocked, uncompleted level', () => {
    expect(nextLevelToPlay(levels, { 1: { completed: true } }).number).toBe(2);
  });
});

describe('progress updates', () => {
  it('a session records completion, best score, best time and stars', () => {
    const { entry, isNewBestScore } = applySession(null, session());
    expect(entry).toMatchObject({ completed: true, bestScore: 1500, bestTimeMs: 60_000, stars: 2, completions: 1 });
    expect(isNewBestScore).toBe(true);
  });

  it('a worse replay never lowers the best values', () => {
    const first = applySession(null, session()).entry;
    const { entry, isNewBestScore } = applySession(first, session({ score: 900, timeMs: 30_000, stars: 1 }));
    expect(entry.bestScore).toBe(1500);
    expect(entry.bestTimeMs).toBe(30_000);
    expect(entry.stars).toBe(2);
    expect(entry.completions).toBe(2);
    expect(isNewBestScore).toBe(false);
  });
});

describe('sync conflict resolution', () => {
  it('merges local and remote records keeping the best of each field', () => {
    const local = { levelNumber: 1, completed: true, bestScore: 1200, bestTimeMs: 40_000, stars: 2, updatedAt: '2026-01-02' };
    const remote = { levelNumber: 1, completed: true, bestScore: 1800, bestTimeMs: 55_000, stars: 3, updatedAt: '2026-01-01' };
    expect(mergeProgress(local, remote)).toMatchObject({ bestScore: 1800, bestTimeMs: 40_000, stars: 3, completed: true, updatedAt: '2026-01-02' });
  });

  it('never loses a completion that exists on only one side', () => {
    const merged = mergeProgressMaps(
      { 1: { levelNumber: 1, completed: true, bestScore: 1000, bestTimeMs: 1, stars: 1 } },
      { 2: { levelNumber: 2, completed: true, bestScore: 900, bestTimeMs: 2, stars: 1 } },
    );
    expect(Object.keys(merged).sort()).toEqual(['1', '2']);
    expect(summarizeProgress(levels, merged)).toMatchObject({ completed: 2, stars: 2 });
  });

  it('handles null best time on one side', () => {
    expect(mergeProgress({ levelNumber: 1, bestTimeMs: null }, { levelNumber: 1, bestTimeMs: 5 }).bestTimeMs).toBe(5);
  });
});
