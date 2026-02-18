const CACHE_NAME = 'doge-minna-v2.0.0';
const STATIC_CACHE = 'doge-minna-static-v2.0.0';
const DYNAMIC_CACHE = 'doge-minna-dynamic-v2.0.0';
const DEV_HOSTS = new Set(['localhost', '127.0.0.1']);

function isDevHost() {
  try {
    const host = self.location && self.location.hostname;
    if (!host) return false;
    return DEV_HOSTS.has(host) || host.endsWith('.local');
  } catch (e) {
    return false;
  }
}

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/doge.svg',
  '/manifest.json',
  '/sw.js'
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache first, then network
  CACHE_FIRST: 'cache-first',
  // Network first, then cache
  NETWORK_FIRST: 'network-first',
  // Cache only
  CACHE_ONLY: 'cache-only',
  // Network only
  NETWORK_ONLY: 'network-only',
  // Stale while revalidate
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

// Asset types and their cache strategies
const ASSET_CACHE_MAP = {
  // JavaScript chunks - cache first (they change with deployments)
  '.js': CACHE_STRATEGIES.CACHE_FIRST,
  // CSS - cache first
  '.css': CACHE_STRATEGIES.CACHE_FIRST,
  // WebAssembly - cache first
  '.wasm': CACHE_STRATEGIES.CACHE_FIRST,
  // GLB models - cache first (expensive to download)
  '.glb': CACHE_STRATEGIES.CACHE_FIRST,
  // Images - cache first
  '.png': CACHE_STRATEGIES.CACHE_FIRST,
  '.jpg': CACHE_STRATEGIES.CACHE_FIRST,
  '.jpeg': CACHE_STRATEGIES.CACHE_FIRST,
  '.webp': CACHE_STRATEGIES.CACHE_FIRST,
  '.svg': CACHE_STRATEGIES.CACHE_FIRST,
  // Audio files - cache first
  '.mp3': CACHE_STRATEGIES.CACHE_FIRST,
  '.wav': CACHE_STRATEGIES.CACHE_FIRST,
  '.ogg': CACHE_STRATEGIES.CACHE_FIRST,
  // API calls - network first
  '/api/': CACHE_STRATEGIES.NETWORK_FIRST,
  // WebSocket connections - network only
  'ws': CACHE_STRATEGIES.NETWORK_ONLY,
  'wss': CACHE_STRATEGIES.NETWORK_ONLY
};

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  if (isDevHost()) {
    // Dev: do not cache, clear any existing caches
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static assets');
        return Promise.all(
          STATIC_ASSETS.map(async (asset) => {
            try {
              const response = await fetch(asset, { credentials: 'same-origin' });
              if (response.ok) {
                await cache.put(asset, response);
              }
            } catch (error) {
              console.warn('[SW] Skipped caching asset:', asset, error);
            }
          })
        );
      }),
      // Pre-cache critical assets
      caches.open(DYNAMIC_CACHE).then((cache) => {
        // Cache critical chunks that are likely to be needed immediately
        const criticalAssets = [
          '/assets/vendor-three',
          '/assets/index',
          '/assets/game-stores',
          '/assets/game-services'
        ];
        return Promise.all(
          criticalAssets.map(asset => {
            return fetch(asset).then(response => {
              if (response.ok) {
                cache.put(asset, response);
              }
            }).catch(() => {
              // Ignore fetch errors during install
            });
          })
        );
      })
    ])
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  if (isDevHost()) {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
    self.clients.claim();
    return;
  }
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map((k) => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (isDevHost()) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip external requests (except for assets we know we cache)
  if (!url.origin.includes(self.location.origin) && !url.pathname.startsWith('/assets/')) {
    return;
  }

  // Determine cache strategy based on file extension or path
  let strategy = CACHE_STRATEGIES.NETWORK_FIRST; // Default

  // Check file extension
  const pathname = url.pathname.toLowerCase();
  for (const [pattern, cacheStrategy] of Object.entries(ASSET_CACHE_MAP)) {
    if (pathname.includes(pattern)) {
      strategy = cacheStrategy;
      break;
    }
  }

  // Handle different cache strategies
  switch (strategy) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      event.respondWith(cacheFirst(event.request));
      break;
    case CACHE_STRATEGIES.NETWORK_FIRST:
      event.respondWith(networkFirst(event.request));
      break;
    case CACHE_STRATEGIES.CACHE_ONLY:
      event.respondWith(cacheOnly(event.request));
      break;
    case CACHE_STRATEGIES.NETWORK_ONLY:
      // Let the request go through normally
      break;
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      event.respondWith(staleWhileRevalidate(event.request));
      break;
    default:
      event.respondWith(networkFirst(event.request));
  }
});

// Cache-first strategy (good for static assets that change with deployments)
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    // Only cache successful responses (not partial content 206)
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Cache-first failed for:', request.url, error);
    // Return cached version if available, otherwise offline page
    const cachedResponse = await caches.match(request);
    return cachedResponse || caches.match('/');
  }
}

// Network-first strategy (good for dynamic content)
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    // Only cache successful responses (not partial content 206)
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network-first failed for:', request.url, error);
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

// Cache-only strategy
async function cacheOnly(request) {
  return caches.match(request);
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });

  return cachedResponse || fetchPromise;
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  try {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  } catch (error) {
    // Silently ignore message handling errors (often from browser extensions)
    console.log('[SW] Message handling error:', error.message);
  }
});
