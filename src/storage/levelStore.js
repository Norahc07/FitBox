import { dbClear, dbGetAll, dbPut, dbGet } from './db.js';

/** Published levels downloaded from Supabase, cached for offline play. */
export async function getCachedRemoteLevels() {
  return dbGetAll('levels');
}

export async function replaceCachedRemoteLevels(levels) {
  await dbClear('levels');
  for (const level of levels) await dbPut('levels', level);
  await dbPut('meta', { key: 'levelsSyncedAt', value: new Date().toISOString() });
}

export async function getLevelsSyncedAt() {
  return (await dbGet('meta', 'levelsSyncedAt'))?.value ?? null;
}
