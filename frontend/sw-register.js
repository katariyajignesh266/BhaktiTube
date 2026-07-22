/**
 * Service Worker Registration Module
 * Handles registration, updates, and lifecycle management
 */

const SW_VERSION = 'v1.0.0';
const SW_FILE = './service-worker.js';

class ServiceWorkerManager {
  constructor() {
    this.registration = null;
    this.isUpdateAvailable = false;
    this.isInstalled = false;
  }

  /**
   * Register the Service Worker
   */
  async register() {
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW Manager] Service Worker not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register(SW_FILE, {
        scope: './'
      });

      console.log('[SW Manager] Service Worker registered:', this.registration.scope);
      this.isInstalled = true;

      // Handle updates
      this.registration.addEventListener('updatefound', () => {
        this.handleUpdateFound();
      });

      // Check for waiting SW
      if (this.registration.waiting) {
        this.isUpdateAvailable = true;
        this.notifyUpdateAvailable();
      }

      // Listen for controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW Manager] Controller changed - new SW active');
        window.location.reload();
      });

      return true;
    } catch (error) {
      console.error('[SW Manager] Registration failed:', error);
      return false;
    }
  }

  /**
   * Handle Service Worker update found
   */
  handleUpdateFound() {
    const newWorker = this.registration.installing;
    
    newWorker.addEventListener('statechange', () => {
      console.log('[SW Manager] Worker state:', newWorker.state);
      
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        this.isUpdateAvailable = true;
        this.notifyUpdateAvailable();
      }
    });
  }

  /**
   * Notify that an update is available
   */
  notifyUpdateAvailable() {
    // Dispatch custom event for UI to handle
    window.dispatchEvent(new CustomEvent('sw-update-available', {
      detail: {
        version: SW_VERSION,
        registration: this.registration
      }
    }));
  }

  /**
   * Skip waiting and activate new SW
   */
  async activateUpdate() {
    if (this.registration && this.registration.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  /**
   * Check if app is running as PWA
   */
  isPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.matchMedia('(display-mode: minimal-ui)').matches ||
           document.referrer.includes('android-app://');
  }

  /**
   * Get current SW state
   */
  getState() {
    return {
      isInstalled: this.isInstalled,
      isUpdateAvailable: this.isUpdateAvailable,
      isPWA: this.isPWA(),
      hasController: !!navigator.serviceWorker.controller
    };
  }
}

// Create singleton instance
const swManager = new ServiceWorkerManager();

// Auto-register on load
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    swManager.register();
  });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = swManager;
}
