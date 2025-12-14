/**
 * SERVICE WORKER - K'UHUL PWA CACHING
 * ====================================
 * Enables offline functionality and performance optimization
 * Implements caching strategies for different asset types
 */

const CACHE_NAME = 'kuhul-v1.0.0';
const RUNTIME_CACHE = 'kuhul-runtime-v1';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/atomic-asx.css',
  '/core/kuhul-engine.js',
  '/core/agent-factory.js',
  '/core/agents-registry.json',
  '/core/colab-bridge.js',
  '/ui/mx2lm-chat.html',
  '/ui/training-dashboard.html',
  '/ui/agent-hive-demo.html',
  '/scripts/mx2lm-chat-app.js',
  '/docs/multi-hive-stack.html'
];

// API endpoints to never cache
const NO_CACHE_URLS = [
  '/api/',
  'chrome-extension://',
  'extension://'
];

/**
 * Install Event - Precache critical assets
 */
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Service Worker: Caching app shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker: Installation complete');
        return self.skipWaiting(); // Activate immediately
      })
      .catch(error => {
        console.error('❌ Service Worker: Installation failed', error);
      })
  );
});

/**
 * Activate Event - Clean up old caches
 */
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Activating...');

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              // Remove old versions
              return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
            })
            .map(cacheName => {
              console.log(`🗑️  Service Worker: Deleting old cache ${cacheName}`);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Activation complete');
        return self.clients.claim(); // Take control immediately
      })
  );
});

/**
 * Fetch Event - Implement caching strategies
 */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip caching for API calls and extensions
  if (NO_CACHE_URLS.some(pattern => url.href.includes(pattern))) {
    return;
  }

  // Different strategies for different asset types
  if (request.method === 'GET') {
    if (isHTML(request)) {
      event.respondWith(networkFirstStrategy(request));
    } else if (isImage(request)) {
      event.respondWith(cacheFirstStrategy(request));
    } else if (isScript(request) || isStyle(request)) {
      event.respondWith(staleWhileRevalidateStrategy(request));
    } else {
      event.respondWith(cacheFirstStrategy(request));
    }
  }
});

/**
 * Message Event - Handle commands from clients
 */
self.addEventListener('message', event => {
  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_URLS':
      cacheUrls(data.urls);
      break;

    case 'CLEAR_CACHE':
      clearAllCaches();
      break;

    case 'GET_CACHE_SIZE':
      getCacheSize().then(size => {
        event.ports[0].postMessage({ type: 'CACHE_SIZE', size });
      });
      break;

    default:
      console.log('Unknown message type:', type);
  }
});

// Caching Strategies

/**
 * Network First - Try network, fallback to cache (good for HTML)
 */
async function networkFirstStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    // Try network first
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log('📦 Serving from cache:', request.url);
      return cachedResponse;
    }

    // Return offline page if available
    const offlineResponse = await cache.match('/offline.html');
    if (offlineResponse) {
      return offlineResponse;
    }

    // Last resort: return error response
    return new Response('Network error and no cache available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Cache First - Check cache first, fallback to network (good for static assets)
 */
async function cacheFirstStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('Cache and network both failed:', error);
    return new Response('Resource not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Stale While Revalidate - Return cache immediately, update in background
 * (good for CSS/JS that can be slightly stale)
 */
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  // Fetch new version in background
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(error => {
    console.error('Background fetch failed:', error);
    return cachedResponse;
  });

  // Return cached version immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }

  // Otherwise wait for network
  return fetchPromise;
}

// Helper Functions

function isHTML(request) {
  return request.headers.get('Accept')?.includes('text/html');
}

function isImage(request) {
  return request.destination === 'image' ||
         /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(request.url);
}

function isScript(request) {
  return request.destination === 'script' ||
         /\.js$/i.test(request.url);
}

function isStyle(request) {
  return request.destination === 'style' ||
         /\.css$/i.test(request.url);
}

async function cacheUrls(urls) {
  const cache = await caches.open(RUNTIME_CACHE);

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
        console.log('✅ Cached:', url);
      }
    } catch (error) {
      console.error('Failed to cache:', url, error);
    }
  }
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
  console.log('🗑️  All caches cleared');
}

async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }

  return totalSize;
}

// Background Sync (if supported)
if ('sync' in self.registration) {
  self.addEventListener('sync', event => {
    console.log('🔄 Background sync:', event.tag);

    if (event.tag === 'sync-training-jobs') {
      event.waitUntil(syncTrainingJobs());
    }
  });
}

async function syncTrainingJobs() {
  // Sync training job status when back online
  try {
    const response = await fetch('/api/training/sync');
    console.log('✅ Training jobs synced');
  } catch (error) {
    console.error('Failed to sync training jobs:', error);
  }
}

// Push Notifications (if supported)
if ('push' in self.registration) {
  self.addEventListener('push', event => {
    const data = event.data?.json() || {};

    const options = {
      body: data.body || 'New notification',
      icon: '/assets/icons/icon-192.png',
      badge: '/assets/icons/badge-96.png',
      vibrate: [200, 100, 200],
      data: data,
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'K\'UHUL', options)
    );
  });

  self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'view') {
      event.waitUntil(
        clients.openWindow(event.notification.data.url || '/')
      );
    }
  });
}

// Periodic Background Sync (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', event => {
    console.log('🔄 Periodic sync:', event.tag);

    if (event.tag === 'check-training-status') {
      event.waitUntil(checkTrainingStatus());
    }
  });
}

async function checkTrainingStatus() {
  try {
    const response = await fetch('/api/training/active');
    const jobs = await response.json();

    // Send notifications for completed jobs
    jobs.filter(job => job.status === 'completed').forEach(job => {
      self.registration.showNotification('Training Complete!', {
        body: `Job "${job.name}" has finished training`,
        icon: '/assets/icons/icon-192.png'
      });
    });
  } catch (error) {
    console.error('Failed to check training status:', error);
  }
}

console.log('🔧 Service Worker v1.0.0 - LOADED');
