/**
 * Service worker registration and update flow. Only active in production
 * builds; `npm run dev` never registers a worker so it can't cache stale code.
 */
export function registerServiceWorker({ onUpdateReady, onOfflineReady } = {}) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
      if (reg.waiting && navigator.serviceWorker.controller) onUpdateReady?.(reg);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state !== 'installed') return;
          if (navigator.serviceWorker.controller) onUpdateReady?.(reg);
          else onOfflineReady?.();
        });
      });
      // Check for a new version whenever the app regains focus.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (err) {
      console.warn('Service worker registration failed', err);
    }
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

export function activateUpdate(registration) {
  registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
}
