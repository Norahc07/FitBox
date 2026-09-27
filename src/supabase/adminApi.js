import { getSupabase } from './client.js';
import { levelFromRow, levelToRow } from './mappers.js';

async function client() {
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase is not configured.');
  return sb;
}

function check({ data, error }) {
  if (error) throw error;
  return data;
}

export async function adminOverview() {
  const sb = await client();
  const rows = check(await sb.rpc('admin_overview'));
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function adminLevelStats() {
  const sb = await client();
  return check(await sb.rpc('admin_level_stats'));
}

export async function listUsers({ search = '', limit = 100 } = {}) {
  const sb = await client();
  let query = sb.from('profiles').select('id, display_name, role, created_at').order('created_at', { ascending: false }).limit(limit);
  if (search) query = query.ilike('display_name', `%${search}%`);
  return check(await query);
}

export async function setUserRole(userId, role) {
  const sb = await client();
  return check(await sb.from('profiles').update({ role }).eq('id', userId));
}

export async function listAllLevels() {
  const sb = await client();
  const rows = check(await sb.from('levels').select('*').order('number').order('version', { ascending: false }));
  return rows.map(levelFromRow);
}

export async function saveLevel(level) {
  const sb = await client();
  const row = check(await sb.from('levels').upsert(levelToRow(level)).select().single());
  return levelFromRow(row);
}

export async function setLevelPublished(id, published) {
  const sb = await client();
  const row = check(await sb.from('levels').update({ published }).eq('id', id).select().single());
  return levelFromRow(row);
}

export async function deleteLevel(id) {
  const sb = await client();
  return check(await sb.from('levels').delete().eq('id', id));
}

export async function listSessions({ limit = 100, levelNumber = null } = {}) {
  const sb = await client();
  let query = sb
    .from('game_sessions')
    .select('id, user_id, level_number, level_version, difficulty, score, time_ms, hints_used, mistakes, pieces_used, stars, completed_at, profiles:user_id(display_name)')
    .order('completed_at', { ascending: false })
    .limit(limit);
  if (levelNumber) query = query.eq('level_number', levelNumber);
  return check(await query);
}
