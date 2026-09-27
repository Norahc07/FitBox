import { dbGet, dbGetAll, dbPut } from './db.js';
import { applySession, mergeProgress } from '../game/progress.js';

export async function getProgressMap() {
  const rows = await dbGetAll('progress');
  return Object.fromEntries(rows.map((r) => [r.levelNumber, r]));
}

export async function getProgress(levelNumber) {
  return (await dbGet('progress', levelNumber)) ?? null;
}

export async function saveProgress(entry) {
  return dbPut('progress', entry);
}

/** Apply a completed session to local progress and persist it. */
export async function recordSessionProgress(session) {
  const current = await getProgress(session.levelNumber);
  const result = applySession(current, session);
  await saveProgress(result.entry);
  return { ...result, previous: current };
}

/** Merge a remote record into local storage using best-of conflict resolution. */
export async function mergeRemoteProgress(remoteEntries) {
  const merged = [];
  for (const remote of remoteEntries) {
    const local = await getProgress(remote.levelNumber);
    const entry = mergeProgress(local, remote);
    await saveProgress(entry);
    merged.push(entry);
  }
  return merged;
}

export async function saveUnlockedLevels(numbers) {
  return dbPut('meta', { key: 'unlockedLevels', value: [...numbers].sort((a, b) => a - b) });
}

export async function getUnlockedLevels() {
  return (await dbGet('meta', 'unlockedLevels'))?.value ?? [1];
}
