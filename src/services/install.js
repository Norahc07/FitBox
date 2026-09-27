// Tracks whether FitBox can be installed, is installed, or is running as the installed app.
// Imported once from main.jsx so `beforeinstallprompt` is captured even if it fires before React mounts.

const INSTALLED_KEY = 'fitbox.installed';

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

export const platform = {
  ios: /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1),
  android: /android/i.test(ua),
  inAppBrowser: /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|MicroMessenger|Line\/|TikTok|musical_ly|Snapchat|Twitter|LinkedInApp|GSA\/|; wv\)/i.test(ua),
};

function readFlag() {
  try {
    return localStorage.getItem(INSTALLED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeFlag(on) {
  try {
    if (on) localStorage.setItem(INSTALLED_KEY, '1');
    else localStorage.removeItem(INSTALLED_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    ['standalone', 'fullscreen', 'minimal-ui'].some((mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches) ||
    window.navigator.standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

let state = {
  deferred: null,
  standalone: isStandalone(),
  installedHere: readFlag(),
  justInstalled: false,
};
const listeners = new Set();

function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

export function getInstallState() {
  return state;
}

export function subscribeInstall(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** True when FitBox is running as the app or is known to be installed on this device. */
export function isInstalled(s = state) {
  return s.standalone || s.installedHere;
}

export async function promptInstall() {
  const { deferred } = state;
  if (!deferred) return false;
  deferred.prompt();
  const choice = await deferred.userChoice;
  set({ deferred: null });
  return choice.outcome === 'accepted';
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    // The browser only offers this when the app is not installed, so any earlier "installed" flag is stale.
    writeFlag(false);
    set({ deferred: e, installedHere: false });
  });
  window.addEventListener('appinstalled', () => {
    writeFlag(true);
    set({ deferred: null, installedHere: true, justInstalled: true });
  });
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', () => set({ standalone: isStandalone() }));

  // Chromium can report an installed copy of this PWA (via manifest `related_applications`).
  if (!state.standalone && 'getInstalledRelatedApps' in navigator) {
    navigator
      .getInstalledRelatedApps()
      .then((apps) => {
        if (apps.length > 0) {
          writeFlag(true);
          set({ installedHere: true });
        }
      })
      .catch(() => {});
  }
}
