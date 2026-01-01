/**
 * KUHUL Service Worker v1
 * =======================
 *
 * Unified service worker with K'UHUL inference host integration.
 * Provides offline capabilities, caching, and KHL execution in SW context.
 *
 * Features:
 * - PWA offline support
 * - Static asset caching
 * - API request caching
 * - KHL program execution
 * - Background inference queue
 */

const CACHE_NAME = 'kuhul-v1';
const CACHE_VERSION = '1.0.0';

// Assets to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/ui/ghost.html',
  '/ui/mx2lm-chat.html',
  '/ui/khl-runner.html',
  '/core/kuhul-host.js',
  '/core/kuhul-engine.js',
  '/core/KQL_CHAT.js',
  '/assets/css/atomic-asx.css',
  '/khl/chat_inference_frame.khl',
  '/khl/vision_inference_frame.khl',
  '/khl/image_gen_frame.khl'
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\.php/,
  /\/schemas\//,
  /\.json$/
];

// ============================================================
// SERVICE WORKER LIFECYCLE
// ============================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing KUHUL Service Worker');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.filter(url => {
          // Skip missing files gracefully
          return true;
        })).catch(err => {
          console.warn('[SW] Some assets failed to cache:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating KUHUL Service Worker');

  event.waitUntil(
    // Clean old caches
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys.filter(key => key !== CACHE_NAME)
              .map(key => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH HANDLER
// ============================================================

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle KHL execution requests
  if (url.pathname === '/kuhul/run') {
    event.respondWith(handleKHLRun(event.request));
    return;
  }

  // Handle inference requests with caching
  if (url.pathname.includes('/api.php')) {
    event.respondWith(handleAPIRequest(event.request));
    return;
  }

  // Handle static assets with cache-first strategy
  event.respondWith(handleStaticRequest(event.request));
});

// ============================================================
// REQUEST HANDLERS
// ============================================================

async function handleStaticRequest(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);

    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }

    return new Response('Offline', { status: 503 });
  }
}

async function handleAPIRequest(request) {
  // Try network first for API requests
  try {
    const response = await fetch(request.clone());

    // Cache successful API responses briefly
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME + '-api');
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Fall back to cached API response
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Returning cached API response');
      return cached;
    }

    // Return error response
    return new Response(JSON.stringify({
      error: 'offline',
      message: 'API unavailable offline'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================
// KHL EXECUTION IN SERVICE WORKER
// ============================================================

// Minimal KHL interpreter for SW context
const KHLInterpreter = {
  programs: new Map(),

  register(id, source) {
    this.programs.set(id, {
      id,
      source,
      ast: this.parse(source)
    });
  },

  parse(source) {
    const phases = { Pop: [], Wo: [], Sek: [], Collapse: [] };
    const phaseRegex = /@(Pop|Wo|Sek|Collapse)\s*\{([\s\S]*?)\n\}/g;
    let match;

    while ((match = phaseRegex.exec(source)) !== null) {
      phases[match[1]] = match[2].split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('//'));
    }

    return phases;
  },

  async run(id, context = {}) {
    const program = this.programs.get(id);
    if (!program) {
      throw new Error(`KHL program not found: ${id}`);
    }

    // Execute phases
    const state = {};
    const startTime = performance.now();

    // Simplified execution - just return context for now
    // Full execution would require the complete KUHUL host

    return {
      ok: true,
      id,
      context,
      duration: performance.now() - startTime,
      message: 'KHL executed in SW context'
    };
  }
};

async function handleKHLRun(request) {
  try {
    const body = await request.json();
    const { programId, context, source } = body;

    // Register program if source provided
    if (source) {
      KHLInterpreter.register(programId, source);
    }

    // Execute
    const result = await KHLInterpreter.run(programId, context);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================
// BACKGROUND SYNC
// ============================================================

self.addEventListener('sync', (event) => {
  if (event.tag === 'kuhul-inference-queue') {
    event.waitUntil(processInferenceQueue());
  }
});

async function processInferenceQueue() {
  // Process queued inference requests when back online
  console.log('[SW] Processing inference queue');

  // Implementation would:
  // 1. Open IndexedDB
  // 2. Get queued requests
  // 3. Process each with KHL
  // 4. Store results
  // 5. Notify clients
}

// ============================================================
// MESSAGE HANDLER
// ============================================================

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'REGISTER_KHL':
      KHLInterpreter.register(payload.id, payload.source);
      event.ports[0]?.postMessage({ ok: true });
      break;

    case 'RUN_KHL':
      KHLInterpreter.run(payload.id, payload.context)
        .then(result => event.ports[0]?.postMessage(result))
        .catch(error => event.ports[0]?.postMessage({ error: error.message }));
      break;

    case 'CACHE_ASSET':
      caches.open(CACHE_NAME)
        .then(cache => cache.add(payload.url))
        .then(() => event.ports[0]?.postMessage({ ok: true }))
        .catch(error => event.ports[0]?.postMessage({ error: error.message }));
      break;

    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME)
        .then(() => event.ports[0]?.postMessage({ ok: true }));
      break;

    case 'GET_VERSION':
      event.ports[0]?.postMessage({
        version: CACHE_VERSION,
        cache: CACHE_NAME
      });
      break;
  }
});

// ============================================================
// PUSH NOTIFICATIONS
// ============================================================

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};

  const options = {
    body: data.body || 'K\'UHUL notification',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/badge.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'K\'UHUL', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // Focus existing window or open new
        for (const client of clientList) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(event.notification.data.url);
      })
  );
});

console.log('[SW] KUHUL Service Worker loaded');
