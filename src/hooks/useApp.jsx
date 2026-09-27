import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SEED_LEVELS, loadLevels } from '../levels/levelRepository.js';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../storage/settingsStore.js';
import { getProgressMap, recordSessionProgress, saveUnlockedLevels } from '../storage/progressStore.js';
import { addSession, clearActiveGame, enqueue, getQueue } from '../storage/sessionStore.js';
import { clearAllStores } from '../storage/db.js';
import { computeUnlocked } from '../game/progress.js';
import { configureFeedback } from '../services/feedback.js';
import { getLastSyncedAt, syncAll } from '../services/syncService.js';
import { isSupabaseConfigured } from '../supabase/client.js';
import { fetchProfile, getCurrentSession, onAuthChange, signOut as supabaseSignOut } from '../supabase/auth.js';
import { useOnline } from './useOnline.js';

const AppContext = createContext(null);
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export function AppProvider({ children }) {
  const online = useOnline();
  const [ready, setReady] = useState(false);
  const [levels, setLevels] = useState(SEED_LEVELS);
  const [progress, setProgress] = useState({});
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [auth, setAuth] = useState({ session: null, user: null, profile: null, loading: isSupabaseConfigured });
  const [sync, setSync] = useState({ status: 'idle', lastSyncedAt: null, pending: 0, message: null });
  const userIdRef = useRef(null);
  userIdRef.current = auth.user?.id ?? null;

  const refreshPending = useCallback(async () => {
    const queue = await getQueue();
    setSync((s) => ({ ...s, pending: queue.length }));
  }, []);

  // Local-first boot: everything comes from IndexedDB + bundled levels.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, p, l, lastSyncedAt, queue] = await Promise.all([
          getSettings(),
          getProgressMap(),
          loadLevels(),
          getLastSyncedAt(),
          getQueue(),
        ]);
        if (cancelled) return;
        setSettings(s);
        configureFeedback(s);
        setProgress(p);
        setLevels(l);
        setSync((prev) => ({ ...prev, lastSyncedAt, pending: queue.length }));
      } catch (err) {
        console.error('Failed to load local data', err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = settings.reducedMotion ? 'true' : 'false';
  }, [settings.reducedMotion]);

  // Optional authentication.
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let unsubscribe = () => {};
    let cancelled = false;
    const apply = async (session) => {
      const user = session?.user ?? null;
      setAuth((a) => ({ ...a, session, user, loading: false, profile: user && a.user?.id === user.id ? a.profile : null }));
      if (!user) return;
      try {
        const profile = await fetchProfile(user.id);
        if (!cancelled) setAuth((a) => (a.user?.id === user.id ? { ...a, profile } : a));
      } catch (err) {
        console.warn('Could not load profile', err);
      }
    };
    (async () => {
      try {
        await apply(await getCurrentSession());
        unsubscribe = await onAuthChange(apply);
      } catch (err) {
        console.warn('Auth unavailable', err);
        setAuth((a) => ({ ...a, loading: false }));
      }
    })();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const reloadLocal = useCallback(async () => {
    const [p, l] = await Promise.all([getProgressMap(), loadLevels()]);
    setProgress(p);
    setLevels(l);
    await saveUnlockedLevels(computeUnlocked(l, p));
  }, []);

  const runSync = useCallback(async () => {
    if (!isSupabaseConfigured || !navigator.onLine) return null;
    setSync((s) => ({ ...s, status: 'syncing', message: null }));
    try {
      const result = await syncAll({ userId: userIdRef.current });
      await reloadLocal();
      const queue = await getQueue();
      const lastSyncedAt = await getLastSyncedAt();
      setSync({
        status: result.errors.length ? 'error' : 'synced',
        lastSyncedAt,
        pending: queue.length,
        message: result.errors[0] ?? null,
      });
      return result;
    } catch (err) {
      setSync((s) => ({ ...s, status: 'error', message: err.message || String(err) }));
      return null;
    }
  }, [reloadLocal]);

  // Sync when the app is ready, when the user changes, when connectivity returns, and periodically.
  useEffect(() => {
    if (!ready || !online || !isSupabaseConfigured || auth.loading) return undefined;
    runSync();
    const id = setInterval(runSync, SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [ready, online, auth.user?.id, auth.loading, runSync]);

  const recordCompletion = useCallback(
    async (session) => {
      await addSession(session);
      await enqueue('session', session);
      const result = await recordSessionProgress(session);
      await clearActiveGame(session.levelId);
      await reloadLocal();
      await refreshPending();
      if (navigator.onLine && userIdRef.current) runSync();
      return result;
    },
    [reloadLocal, refreshPending, runSync],
  );

  const updateSettings = useCallback(async (partial) => {
    const next = await saveSettings({ ...(await getSettings()), ...partial });
    setSettings(next);
    configureFeedback(next);
  }, []);

  const signOut = useCallback(async () => {
    await supabaseSignOut();
    setAuth({ session: null, user: null, profile: null, loading: false });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!auth.user) return;
    const profile = await fetchProfile(auth.user.id);
    setAuth((a) => ({ ...a, profile }));
  }, [auth.user]);

  const resetLocalData = useCallback(async () => {
    await clearAllStores();
    setSettings(DEFAULT_SETTINGS);
    configureFeedback(DEFAULT_SETTINGS);
    await reloadLocal();
    await refreshPending();
  }, [reloadLocal, refreshPending]);

  const unlocked = useMemo(() => computeUnlocked(levels, progress), [levels, progress]);

  const value = useMemo(
    () => ({
      ready,
      online,
      levels,
      progress,
      unlocked,
      settings,
      auth,
      isAdmin: auth.profile?.role === 'admin',
      sync,
      cloudEnabled: isSupabaseConfigured,
      recordCompletion,
      updateSettings,
      runSync,
      signOut,
      refreshProfile,
      resetLocalData,
      reloadLocal,
    }),
    [ready, online, levels, progress, unlocked, settings, auth, sync, recordCompletion, updateSettings, runSync, signOut, refreshProfile, resetLocalData, reloadLocal],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
