// Version bei Änderungen erhöhen, damit Caches sauber erneuert werden
const CACHE_NAME = 'sprach-tagebuch-v6';
const ASSETS_TO_CACHE = [
  '/captain/',
  '/captain/index.html',
  '/captain/offline.html',
  '/captain/manifest.webmanifest',
  '/captain/sw.js',
  '/captain/icon-192-v2.png',
  '/captain/icon-512-v2.png',
  // Optional: Screenshots ebenfalls cachen
  '/captain/screenshots/shot1.png',
  '/captain/screenshots/shot2.png'
];

// Install – statische Assets in den Cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate – alte Caches aufräumen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Fetch – Navigation: network-first, Fallback auf Cache, dann offline.html
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // API-Calls nicht anfassen
  if (url.hostname.includes('api.anthropic.com') ||
      url.hostname.includes('api.openai.com') ||
      url.hostname.includes('generativelanguage.googleapis.com')) {
    return;
  }

  // Seiten-Navigationen
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        return fresh;
      } catch (e) {
        const cached = await caches.match(event.request);
        // ✅ NEU: Angepasster Pfad zur Offline-Seite
        return cached || caches.match('/captain/offline.html');
      }
    })());
    return;
  }

  // Sonstige GETs: cache-first, bei Erfolg im Hintergrund aktualisieren
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchAndCache = fetch(event.request).then((resp) => {
        if (resp && resp.status === 200 && resp.type !== 'opaque') {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return resp;
      });

      return cached || fetchAndCache;
    }).catch(() =>
      new Response('Offline – keine Verbindung', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      })
    )
  );
});