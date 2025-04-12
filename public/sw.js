const CACHE_NAME = 'nostr-run-club-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/App.css',
  '/src/index.css',
  '/vite.svg',
  '/icons/icon-192x192.png'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data.type === 'START_TRACKING') {
    // Do not try to start tracking in background - handled by Capacitor plugin
    // Just acknowledge the message
    if (event.source && event.source.postMessage) {
      event.source.postMessage({ type: 'TRACKING_ACKNOWLEDGEMENT' });
    }
  } else if (event.data.type === 'STOP_TRACKING') {
    // Do not try to stop tracking in background - handled by Capacitor plugin
  } else if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Improved fetch handler with cache strategies
self.addEventListener('fetch', (event) => {
  // Handle Vite HMR pings differently to prevent connection errors
  const url = new URL(event.request.url);
  
  // If this is a Vite HMR ping request, return a mock success response
  // This prevents the continuous ping errors in the console
  if (url.hostname === 'localhost' && 
      url.port === '5173' && 
      event.request.headers.get('Accept') === 'text/x-vite-ping') {
    event.respondWith(new Response('pong', { status: 200 }));
    return;
  }
  
  // Skip other cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Cache-first for CSS files to ensure consistent UI
  if (event.request.url.endsWith('.css')) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // Return cached response but update cache in background
            fetch(event.request).then(networkResponse => {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }).catch(error => {
              console.log('Failed to update cached CSS:', error);
            });
            return cachedResponse;
          }
          
          // If not in cache, fetch from network and cache
          return fetch(event.request).then(response => {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
            return response;
          });
        })
    );
    return;
  }
  
  // Network-first strategy for other requests
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
}); 