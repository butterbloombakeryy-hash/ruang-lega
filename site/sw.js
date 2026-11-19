const CACHE_NAME = 'ruang-lega-v1-9-auto';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/ruang-lega.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('ruang-lega-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function cleanupRuangLegaCaches() {
  let removed = 0;
  const keys = await caches.keys();
  for (const key of keys) {
    if (key.startsWith('ruang-lega-') && key !== CACHE_NAME) {
      if (await caches.delete(key)) removed++;
    }
  }

  const activeCache = await caches.open(CACHE_NAME);
  const keepUrls = new Set(APP_SHELL.map((path) => new URL(path, self.registration.scope).href));
  const requests = await activeCache.keys();
  for (const request of requests) {
    if (!keepUrls.has(request.url) && await activeCache.delete(request)) removed++;
  }
  return removed;
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag !== 'ruang-lega-cache-cleanup') return;
  event.waitUntil(
    cleanupRuangLegaCaches().then(async (removed) => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        client.postMessage({
          type: 'RUANG_LEGA_AUTO_CACHE_CLEANUP',
          trigger: 'Jadwal background 24 jam',
          removed
        });
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
