import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabaseForTests } from '../src/storage/db.js';
import { getProgressMap, recordSessionProgress, mergeRemoteProgress, saveUnlockedLevels, getUnlockedLevels } from '../src/storage/progressStore.js';
import { addSession, enqueue, getQueue, getSessions, removeFromQueue, saveActiveGame, getActiveGame, clearActiveGame } from '../src/storage/sessionStore.js';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../src/storage/settingsStore.js';

const session = (overrides = {}) => ({
  id: `s-${Math.random()}`,
  levelId: 'level-01',
  levelNumber: 1,
  levelVersion: 1,
  score: 1500,
  timeMs: 50_000,
  stars: 2,
  hintsUsed: 0,
  mistakes: 1,
  piecesUsed: 15,
  completedAt: new Date().toISOString(),
  ...overrides,
});

beforeEach(async () => {
  await resetDatabaseForTests();
});

describe('offline storage (IndexedDB)', () => {
  it('returns default settings and persists changes', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    await saveSettings({ sound: false });
    expect((await getSettings()).sound).toBe(false);
  });

  it('records sessions and best progress locally', async () => {
    await addSession(session());
    await recordSessionProgress(session());
    await recordSessionProgress(session({ score: 1900, timeMs: 70_000, stars: 3 }));
    const progress = await getProgressMap();
    expect(progress[1]).toMatchObject({ completed: true, bestScore: 1900, bestTimeMs: 50_000, stars: 3, completions: 2 });
    expect(await getSessions()).toHaveLength(1);
  });

  it('keeps queued sessions until they are confirmed', async () => {
    const a = await enqueue('session', session({ id: 'a' }));
    await enqueue('session', session({ id: 'b' }));
    expect(await getQueue()).toHaveLength(2);
    await removeFromQueue(a.id);
    const remaining = await getQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].payload.id).toBe('b');
  });

  it('merges remote progress without losing better local results', async () => {
    await recordSessionProgress(session({ score: 2000, timeMs: 90_000 }));
    await mergeRemoteProgress([{ levelNumber: 1, completed: true, bestScore: 1200, bestTimeMs: 40_000, stars: 1 }]);
    const progress = await getProgressMap();
    expect(progress[1]).toMatchObject({ bestScore: 2000, bestTimeMs: 40_000 });
  });

  it('stores unlocked levels and in-progress games', async () => {
    expect(await getUnlockedLevels()).toEqual([1]);
    await saveUnlockedLevels(new Set([2, 1]));
    expect(await getUnlockedLevels()).toEqual([1, 2]);

    await saveActiveGame({ levelId: 'level-01', placements: { p1: { x: 0, y: 0 } } });
    expect((await getActiveGame('level-01')).placements.p1).toEqual({ x: 0, y: 0 });
    await clearActiveGame('level-01');
    expect(await getActiveGame('level-01')).toBeNull();
  });
});
