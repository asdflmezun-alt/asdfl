// ASDFL Mezunlar Derneği — service worker
// Bump CACHE_VERSION whenever a deploy should force-invalidate old caches.
const CACHE_VERSION = 'v6';
const CACHE_NAME = `asdfl-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  'index.html',
  'css/main.css',
  'css/animations.css',
  'css/fonts.css',
  'css/home.css',
  'js/bootstrap.js',
  'js/app.js',
  'js/home.js',
  'js/universities.js',
  'assets/vendor/lucide.js',
  'assets/vendor/supabase.js',
  'assets/images/logo.png',
  'assets/images/favicon.png',
  'manifest.json'
];

const STATIC_EXTENSIONS = new Set([
  'css', 'js', 'woff', 'woff2', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico'
]);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(PRECACHE_URLS.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (response.ok) await cache.put(url, response);
      } catch (err) {
        // Best-effort precache; a missing asset must not block install.
      }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never intercept Supabase/CDN calls

  // HTML navigations: prefer the network so signed-in state and data stay fresh,
  // fall back to the cache (and finally the shell) when offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
        return response;
      } catch (err) {
        const cached = await caches.match(request);
        return cached || caches.match('index.html');
      }
    })());
    return;
  }

  const ext = url.pathname.includes('.') ? url.pathname.split('.').pop().toLowerCase() : '';
  if (!STATIC_EXTENSIONS.has(ext)) return; // let everything else (e.g. sql, mjs) pass through untouched

  // Static assets: cache-first, refresh the cache in the background.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    const networkFetch = fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    }).catch(() => null);
    return cached || (await networkFetch) || Response.error();
  })());
});
