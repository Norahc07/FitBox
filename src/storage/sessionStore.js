import { dbDelete, dbGet, dbGetAll, dbPut } from './db.js';

export async function addSession(session) {
  return dbPut('sessions', { ...session, synced: false });
}

export async function getSessions() {
  const rows = await dbGetAll('sessions');
  return rows.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
}

export async function markSessionSynced(id) {
  const row = await dbGet('sessions', id);
  if (row) await dbPut('sessions', { ...row, synced: true });
}

/* Offline sync queue: operations waiting for a connection + signed-in user. */

export async function enqueue(type, payload) {
  const item = {
    id: `${type}:${payload.id ?? payload.levelNumber}:${Date.now()}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await dbPut('syncQueue', item);
  return item;
}

export async function getQueue() {
  const rows = await dbGetAll('syncQueue');
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeFromQueue(id) {
  return dbDelete('syncQueue', id);
}

export async function markQueueAttempt(id, error) {
  const row = await dbGet('syncQueue', id);
  if (row) await dbPut('syncQueue', { ...row, attempts: row.attempts + 1, lastError: String(error ?? '') });
}

/* In-progress games, so a refresh or app switch does not lose a puzzle. */

export async function getActiveGame(levelId) {
  return (await dbGet('activeGames', levelId)) ?? null;
}

export async function saveActiveGame(state) {
  return dbPut('activeGames', state);
}

export async function clearActiveGame(levelId) {
  return dbDelete('activeGames', levelId);
}
