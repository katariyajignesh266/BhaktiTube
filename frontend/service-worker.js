const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `bhaktitube-${CACHE_VERSION}`;

// Cache names for different strategies
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE = `${CACHE_NAME}-dynamic`;
const IMAGE_CACHE = `${CACHE_NAME}-images`;
const API_CACHE = `${CACHE_NAME}-api`;

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/frontend/index.html',
  '/frontend/shorts.html',
  '/frontend/channel.html',
  '/frontend/offline.html',
  '/frontend/manifest.json',
  '/frontend/theme-system.css',
  '/frontend/responsive-system.css',
  '/frontend/viewport-fix.css',
  '/frontend/style.css',
  '/frontend/channel-card.css',
  '/frontend/channel-card-themes.css',
  '/frontend/premium-channel-feed.css',
  '/frontend/all-channels-feed.css',
  '/frontend/shorts.css',
  '/frontend/channel.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://www.youtube.com/iframe_api'
];

// Never cache these routes
const NEVER_CACHE = [
  '/api/',
  '/admin/',
  '/backend/',
  '/login',
  '/signup'
];

// Cache size limits
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_CACHE_SIZE = 20 * 1024 * 1024; // 20MB

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker:', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.map(url => {
          // Handle relative URLs
          return new Request(url, { credentials: 'same-origin' });
        })).catch(err => {
          console.warn('[SW] Some assets failed to cache:', err);
          // Continue even if some assets fail
          return Promise.resolve();
        });
      }),
      // Skip waiting to activate new SW immediately
      self.skipWaiting()
    ])
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker:', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== IMAGE_CACHE &&
                cacheName !== API_CACHE &&
                !cacheName.startsWith(`bhaktitube-${CACHE_VERSION}`)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim all clients immediately
      self.clients.claim()
    ])
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other protocols
  if (!url.protocol.startsWith('http')) return;

  // Skip never-cache routes
  if (NEVER_CACHE.some(path => url.pathname.includes(path))) {
    event.respondWith(fetch(request));
    return;
  }

  // Handle different types of requests with appropriate strategies
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    // HTML pages - Network First with Offline Fallback
    event.respondWith(networkFirst(request, STATIC_CACHE));
  } else if (url.pathname.match(/\.(css|js)$/)) {
    // CSS/JS - Stale While Revalidate
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  } else if (url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico)$/)) {
    // Images - Cache First with size limit
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE));
  } else if (url.hostname.includes('cloudinary.com') || url.hostname.includes('youtube.com')) {
    // External media - Cache First
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE));
  } else if (url.pathname.startsWith('/api/') || url.pathname.includes('firebase')) {
    // API calls - Network First with short cache
    event.respondWith(networkFirst(request, API_CACHE, 5 * 60 * 1000)); // 5 minutes
  } else {
    // Default - Network First
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
  }
});

// Network First strategy
async function networkFirst(request, cacheName, maxAge = 24 * 60 * 60 * 1000) {
  const cache = await caches.open(cacheName);
  
  try {
    const networkResponse = await fetch(request);
    
    // Only cache successful responses
    if (networkResponse.ok && networkResponse.type === 'basic') {
      // Clone before caching
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Check if cache is still valid
      const cachedDate = cachedResponse.headers.get('date');
      if (cachedDate) {
        const age = Date.now() - new Date(cachedDate).getTime();
        if (age > maxAge) {
          // Cache is stale, try to refresh in background
          event.waitUntil(refreshCache(request, cacheName));
        }
      }
      return cachedResponse;
    }
    
    // Return offline page for HTML requests
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/frontend/offline.html');
    }
    
    throw error;
  }
}

// Cache First strategy
async function cacheFirst(request, cacheName, maxSize = MAX_CACHE_SIZE) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Check cache size before adding
      await enforceCacheSize(cacheName, maxSize);
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Cache and network failed:', request.url);
    throw error;
  }
}

// Stale While Revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Fetch in background
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      cache.put(request, responseToCache);
    }
    return networkResponse;
  }).catch((error) => {
    console.log('[SW] Background fetch failed:', error);
    return cachedResponse || Promise.reject(error);
  });
  
  // Return cached version immediately if available
  return cachedResponse || fetchPromise;
}

// Refresh cache in background
async function refreshCache(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
  } catch (error) {
    console.log('[SW] Background refresh failed:', error);
  }
}

// Enforce cache size limit
async function enforceCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  let totalSize = 0;
  
  // Calculate current size
  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.blob();
      totalSize += blob.size;
    }
  }
  
  // If over limit, remove oldest entries
  if (totalSize > maxSize) {
    console.log('[SW] Cache size limit reached, cleaning up:', cacheName);
    const entries = [];
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        entries.push({
          request,
          size: blob.size,
          date: response.headers.get('date') || Date.now().toString()
        });
      }
    }
    
    // Sort by date (oldest first)
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Remove oldest entries until under limit
    let currentSize = totalSize;
    for (const entry of entries) {
      if (currentSize <= maxSize) break;
      await cache.delete(entry.request);
      currentSize -= entry.size;
    }
  }
}

// Background Sync for failed requests
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-failed-requests') {
    event.waitUntil(syncFailedRequests());
  }
});

async function syncFailedRequests() {
  // Get failed requests from IndexedDB
  // This would integrate with your background sync queue
  console.log('[SW] Syncing failed requests');
}

// Push notification support
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  if (event.data) {
    const options = event.data.json();
    event.waitUntil(
      self.registration.showNotification(options.title || 'BhaktiTube', {
        body: options.body || 'You have a new notification',
        icon: '/frontend/icons/icon-192x192.png',
        badge: '/frontend/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: options.data || {},
        actions: [
          {
            action: 'open',
            title: 'Open',
            icon: '/frontend/icons/icon-96x96.png'
          },
          {
            action: 'close',
            title: 'Close'
          }
        ]
      })
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url === '/frontend/index.html' && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow('/frontend/index.html');
        }
      })
    );
  }
});

// Message handling for manual cache updates
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

// Periodic background sync (Chrome only)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);
  
  if (event.tag === 'content-update') {
    event.waitUntil(updateContent());
  }
});

async function updateContent() {
  // Fetch latest content and update cache
  console.log('[SW] Updating content in background');
}
