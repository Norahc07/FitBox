import { getSupabase } from './client.js';
import { levelFromRow, progressFromRow, sessionToRow } from './mappers.js';

export async function fetchPublishedLevels() {
  const sb = await getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('levels').select('*').eq('published', true).order('number');
  if (error) throw error;
  return data.map(levelFromRow);
}

export async function fetchRemoteProgress(userId) {
  const sb = await getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('player_progress').select('*').eq('user_id', userId);
  if (error) throw error;
  return data.map(progressFromRow);
}

/** Server-side best-of merge (see merge_progress in the migration). */
export async function pushProgress(entry) {
  const sb = await getSupabase();
  const { error } = await sb.rpc('merge_progress', {
    p_level_number: entry.levelNumber,
    p_completed: entry.completed,
    p_best_score: entry.bestScore,
    p_best_time_ms: entry.bestTimeMs,
    p_stars: entry.stars,
  });
  if (error) throw error;
}

/** Idempotent: the session id is generated on the device, duplicates are ignored. */
export async function pushSession(session, userId) {
  const sb = await getSupabase();
  const { error } = await sb
    .from('game_sessions')
    .upsert(sessionToRow(session, userId), { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function fetchLeaderboard(levelNumber, limit = 20) {
  const sb = await getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('get_leaderboard', { p_level_number: levelNumber, p_limit: limit });
  if (error) throw error;
  return data;
}
