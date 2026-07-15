const CACHE_NAME = 'bhawani-enterprises-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/logo.svg',
  '/favicon.ico',
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Handler
self.addEventListener('fetch', (event) => {
  // Only cache GET requests and skip Supabase API routes to avoid caching API state
  if (event.request.method !== 'GET' || event.request.url.includes('/rest/v1') || event.request.url.includes('/auth/v1')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // If it's a static asset (js, css, images, fonts), return cached version immediately
        const isStaticAsset = /\.(js|css|png|jpg|jpeg|svg|woff2|ico)$/.test(event.request.url) || event.request.url.includes('/_next/static/');
        if (isStaticAsset) {
          return cachedResponse;
        }
      }

      // Otherwise, try network first, fallback to cache
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // Cache the new response
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // If network fails, return cached response
          return cachedResponse;
        });
    })
  );
});
