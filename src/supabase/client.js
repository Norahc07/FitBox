/**
 * Supabase is optional. When the env vars are missing the app runs fully
 * offline/local. The SDK is loaded lazily so it never blocks first paint and
 * is not required for gameplay.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let clientPromise = null;

export function getSupabase() {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) =>
        createClient(url, anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        }),
      )
      .catch((err) => {
        console.warn('Supabase SDK failed to load (offline?)', err);
        clientPromise = null;
        return null;
      });
  }
  return clientPromise;
}
