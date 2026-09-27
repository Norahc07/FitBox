import { getSupabase } from './client.js';

async function requireClient() {
  const sb = await getSupabase();
  if (!sb) throw new Error('Cloud sync is not configured or not reachable.');
  return sb;
}

export async function getCurrentSession() {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

export async function signInWithPassword(email, password) {
  const sb = await requireClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signUp(email, password, displayName) {
  const sb = await requireClient();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || email.split('@')[0] } },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const sb = await getSupabase();
  if (sb) await sb.auth.signOut();
}

export async function onAuthChange(callback) {
  const sb = await getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function fetchProfile(userId) {
  const sb = await getSupabase();
  if (!sb || !userId) return null;
  const { data, error } = await sb.from('profiles').select('id, display_name, role, created_at').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateDisplayName(userId, displayName) {
  const sb = await requireClient();
  const { error } = await sb.from('profiles').update({ display_name: displayName }).eq('id', userId);
  if (error) throw error;
}
