/* FitBox service worker — generated at build time from pwa/sw-template.js. */
/* eslint-disable no-restricted-globals */
const CACHE_VERSION = '__CACHE_VERSION__';
const BASE = '__BASE__';
const PRECACHE_URLS = __PRECACHE_MANIFEST__;

const PRECACHE = `fitbox-precache-${CACHE_VERSION}`;
const RUNTIME = 'fitbox-runtime';
const INDEX_URL = `${BASE}index.html`;
const NAVIGATION_TIMEOUT_MS = 3500;

// Install: cache the complete app shell (HTML, JS, CSS, icons, level data).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

// The page asks a waiting worker to take over when the player accepts an update.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Activate: drop caches from previous versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('fitbox-precache-') && k !== PRECACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

async function networkFirstNavigation(request) {
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NAVIGATION_TIMEOUT_MS)),
    ]);
    if (response && response.ok) return response;
    throw new Error(`HTTP ${response && response.status}`);
  } catch {
    // Offline (or slow): every route is served by the cached single-page app shell.
    const cached = (await caches.match(INDEX_URL, { ignoreSearch: true })) || (await caches.match(BASE));
    return cached || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: false });
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.type === 'basic') {
    const cache = await caches.open(RUNTIME);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Only same-origin requests are handled; Supabase and other APIs go straight to the network.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
