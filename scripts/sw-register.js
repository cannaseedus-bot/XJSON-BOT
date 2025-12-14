/**
 * SERVICE WORKER REGISTRATION
 * ===========================
 * Registers and manages the service worker lifecycle
 */

const SWManager = {
  registration: null,
  updateAvailable: false,

  /**
   * Initialize and register service worker
   */
  async init() {
    if (!('serviceWorker' in navigator)) {
      console.log('⚠️  Service Workers not supported');
      return { success: false, reason: 'not_supported' };
    }

    try {
      console.log('🔧 Registering Service Worker...');

      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });

      console.log('✅ Service Worker registered:', this.registration.scope);

      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        this.handleUpdate(this.registration.installing);
      });

      // Check for updates periodically
      setInterval(() => {
        this.registration.update();
      }, 60 * 60 * 1000); // Check every hour

      // Listen for controller change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 Service Worker controller changed');
        if (this.updateAvailable) {
          this.showUpdateNotification();
        }
      });

      // Get cache info
      this.getCacheInfo();

      return { success: true, registration: this.registration };
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Handle service worker updates
   */
  handleUpdate(worker) {
    console.log('🔄 Service Worker update found');

    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        // New service worker is installed but waiting
        this.updateAvailable = true;
        this.showUpdateNotification();
      }
    });
  },

  /**
   * Show update notification to user
   */
  showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'sw-update-notification';
    notification.innerHTML = `
      <div class="sw-update-content">
        <span>🎉 New version available!</span>
        <button onclick="SWManager.applyUpdate()">Update Now</button>
        <button onclick="this.parentElement.parentElement.remove()">Later</button>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .sw-update-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #16f2aa 0%, #0ea578 100%);
        color: #0a0f1c;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
      }

      .sw-update-content {
        display: flex;
        align-items: center;
        gap: 15px;
        font-weight: 600;
      }

      .sw-update-content button {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
      }

      .sw-update-content button:first-of-type {
        background: #0a0f1c;
        color: #16f2aa;
      }

      .sw-update-content button:last-of-type {
        background: rgba(10, 15, 28, 0.2);
        color: #0a0f1c;
      }

      .sw-update-content button:hover {
        transform: scale(1.05);
      }

      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(notification);
  },

  /**
   * Apply service worker update
   */
  applyUpdate() {
    if (!this.registration?.waiting) {
      console.log('⚠️  No waiting service worker');
      return;
    }

    // Tell the service worker to skip waiting
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Reload the page when the new service worker activates
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  },

  /**
   * Unregister service worker
   */
  async unregister() {
    if (!this.registration) {
      console.log('⚠️  No service worker registered');
      return { success: false };
    }

    try {
      const success = await this.registration.unregister();
      if (success) {
        console.log('✅ Service Worker unregistered');
        return { success: true };
      } else {
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Failed to unregister:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Clear all caches
   */
  async clearCache() {
    if (!this.registration) {
      console.log('⚠️  No service worker registered');
      return { success: false };
    }

    try {
      // Send message to service worker
      if (this.registration.active) {
        this.registration.active.postMessage({ type: 'CLEAR_CACHE' });
      }

      // Also clear manually
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));

      console.log('✅ All caches cleared');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get cache information
   */
  async getCacheInfo() {
    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;
      let itemCount = 0;

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        itemCount += keys.length;

        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
      }

      const info = {
        cacheCount: cacheNames.length,
        itemCount: itemCount,
        totalSize: totalSize,
        formattedSize: this.formatBytes(totalSize)
      };

      console.log('📦 Cache info:', info);
      return info;
    } catch (error) {
      console.error('❌ Failed to get cache info:', error);
      return null;
    }
  },

  /**
   * Precache specific URLs
   */
  async precacheUrls(urls) {
    if (!this.registration?.active) {
      console.log('⚠️  No active service worker');
      return { success: false };
    }

    try {
      this.registration.active.postMessage({
        type: 'CACHE_URLS',
        data: { urls }
      });

      console.log(`✅ Precaching ${urls.length} URLs`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to precache URLs:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Check if offline
   */
  isOffline() {
    return !navigator.onLine;
  },

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
};

// Auto-initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    SWManager.init();
  });
} else {
  SWManager.init();
}

// Monitor online/offline status
window.addEventListener('online', () => {
  console.log('🌐 Back online!');
  document.body.classList.remove('offline');
});

window.addEventListener('offline', () => {
  console.log('📡 Offline mode');
  document.body.classList.add('offline');
});

// Expose globally
window.SWManager = SWManager;

console.log('🔧 Service Worker Manager v1.0 - LOADED');
