// ASDFL Mezunlar Derneği — service worker
// Bump CACHE_VERSION whenever a deploy should force-invalidate old caches.
const CACHE_VERSION = 'v42';
const CACHE_NAME = `asdfl-${CACHE_VERSION}`;
const DEV_BYPASS_CACHE = ['localhost', '127.0.0.1', '::1'].includes(self.location.hostname);

const PRECACHE_URLS = [
  'index.html',
  'imece.html',
  'mesajlar.html',
  'css/main.css?v=1.7',
  'css/animations.css',
  'css/fonts.css',
  'css/home.css?v=1.6',
  'css/topluluk.css?v=2.3',
  'css/kariyer.css?v=1.4',
  'css/imece.css?v=1.1',
  'js/bootstrap.js?v=1.2',
  'js/app.js?v=1.18',
  'css/messenger-widget.css?v=1.2',
  'js/messenger-widget.js?v=1.2',
  'css/mesajlar.css?v=1.1',
  'js/mesajlar.js?v=1.1',
  'js/home.js?v=1.5',
  'js/topluluk.js?v=1.9',
  'js/kariyer.js?v=1.4',
  'js/imece.js?v=1.0',
  'js/universities.js',
  'assets/vendor/lucide.js',
  'assets/vendor/supabase.js?v=2.108.2-1',
  'assets/images/logo.png',
  'assets/images/favicon.png',
  'manifest.json'
];

const STATIC_EXTENSIONS = new Set([
  'css', 'js', 'woff', 'woff2', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico'
]);

const NETWORK_FIRST_ASSET_SUFFIXES = [
  '/js/bootstrap.js',
  '/js/app.js',
  '/assets/vendor/supabase.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    if (DEV_BYPASS_CACHE) {
      self.skipWaiting();
      return;
    }
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

  if (DEV_BYPASS_CACHE) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // HTML navigations: prefer the network so signed-in state and data stay fresh,
  // fall back to the cache (and finally the shell) when offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
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

  // Auth başlangıcını belirleyen dosyalar iOS PWA'da eski cache'den gelmemeli.
  // Ağ yoksa aynı URL'nin cache kopyasına düşülür.
  if (NETWORK_FIRST_ASSET_SUFFIXES.some((suffix) => url.pathname.endsWith(suffix))) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-cache' });
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        return (await caches.match(request)) || Response.error();
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
