import { isSupabaseConfigured } from '../supabase/client.js';
import { fetchPublishedLevels, fetchRemoteProgress, pushProgress, pushSession } from '../supabase/api.js';
import { validateLevel } from '../levels/validator.js';
import { replaceCachedRemoteLevels } from '../storage/levelStore.js';
import { getQueue, markQueueAttempt, markSessionSynced, removeFromQueue } from '../storage/sessionStore.js';
import { getProgressMap, mergeRemoteProgress } from '../storage/progressStore.js';
import { dbGet, dbPut } from '../storage/db.js';

let inFlight = null;

function isNetworkError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed');
}

function progressDiffers(local, remote) {
  return (
    Boolean(local.completed) !== Boolean(remote.completed) ||
    (local.bestScore ?? null) !== (remote.bestScore ?? null) ||
    (local.bestTimeMs ?? null) !== (remote.bestTimeMs ?? null) ||
    (local.stars ?? 0) !== (remote.stars ?? 0)
  );
}

export async function getLastSyncedAt() {
  return (await dbGet('meta', 'lastSyncedAt'))?.value ?? null;
}

/**
 * Synchronise with Supabase. Safe to call often; concurrent calls share one run.
 *
 * 1. Download published levels (validated) into the offline level cache.
 * 2. Upload queued game sessions (idempotent by client-generated id).
 * 3. Pull remote progress and merge with local using best-of rules.
 * 4. Push any local progress that is better than what the server has.
 *
 * Queue items are only removed after the server confirms them, so progress
 * made offline is never lost.
 */
export function syncAll({ userId }) {
  if (inFlight) return inFlight;
  inFlight = runSync(userId).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runSync(userId) {
  const result = { skipped: false, levels: null, sessionsPushed: 0, progressPushed: 0, errors: [] };
  if (!isSupabaseConfigured || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return { ...result, skipped: true };
  }

  try {
    const remote = await fetchPublishedLevels();
    const valid = remote.filter((level) => validateLevel(level).valid);
    await replaceCachedRemoteLevels(valid);
    result.levels = valid.length;
  } catch (err) {
    result.errors.push(`Levels: ${err.message || err}`);
    if (isNetworkError(err)) return result;
  }

  if (!userId) return result;

  for (const item of await getQueue()) {
    try {
      if (item.type === 'session') {
        await pushSession(item.payload, userId);
        await markSessionSynced(item.payload.id);
        result.sessionsPushed++;
      }
      await removeFromQueue(item.id);
    } catch (err) {
      await markQueueAttempt(item.id, err.message || err);
      result.errors.push(`Session: ${err.message || err}`);
      if (isNetworkError(err)) return result;
    }
  }

  try {
    const remote = await fetchRemoteProgress(userId);
    const remoteMap = Object.fromEntries(remote.map((r) => [r.levelNumber, r]));
    await mergeRemoteProgress(remote);
    const local = await getProgressMap();
    for (const entry of Object.values(local)) {
      const r = remoteMap[entry.levelNumber];
      if (!entry.completed && !r) continue;
      if (!r || progressDiffers(entry, r)) {
        await pushProgress(entry);
        result.progressPushed++;
      }
    }
  } catch (err) {
    result.errors.push(`Progress: ${err.message || err}`);
  }

  if (result.errors.length === 0) await dbPut('meta', { key: 'lastSyncedAt', value: new Date().toISOString() });
  return result;
}
