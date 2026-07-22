/**
 * App Update Manager
 * Detects and handles PWA updates with elegant UI
 */

class AppUpdateManager {
  constructor() {
    this.updatePopup = null;
    this.isUpdateAvailable = false;
    this.newVersion = null;
  }

  /**
   * Initialize update manager
   */
  init() {
    this.createUpdatePopup();
    this.setupEventListeners();
  }

  /**
   * Create update popup UI
   */
  createUpdatePopup() {
    if (document.getElementById('pwaUpdatePopup')) return;

    const popupHTML = `
      <div id="pwaUpdatePopup" class="pwa-update-popup" style="display: none;">
        <div class="pwa-update-backdrop"></div>
        <div class="pwa-update-card">
          <button class="pwa-update-close" id="pwaUpdateClose">
            <i class="fa-solid fa-xmark"></i>
          </button>
          
          <div class="pwa-update-content">
            <div class="pwa-update-icon">
              <i class="fa-solid fa-rotate"></i>
            </div>
            
            <div class="pwa-update-text">
              <h2>New Version Available</h2>
              <p>A new version of BhaktiTube is ready with improvements and bug fixes.</p>
              <p class="pwa-update-version" id="pwaUpdateVersion"></p>
            </div>
            
            <div class="pwa-update-actions">
              <button class="pwa-update-btn-primary" id="pwaUpdateNow">
                <i class="fa-solid fa-download"></i>
                Update Now
              </button>
              <button class="pwa-update-btn-secondary" id="pwaUpdateLater">
                Later
              </button>
            </div>
            
            <div class="pwa-update-footer">
              <label class="pwa-update-auto">
                <input type="checkbox" id="pwaAutoUpdate" checked>
                <span>Auto-update in the background</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', popupHTML);
    this.updatePopup = document.getElementById('pwaUpdatePopup');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for Service Worker update event
    window.addEventListener('sw-update-available', (event) => {
      console.log('[Update Manager] Update available:', event.detail);
      this.handleUpdateAvailable(event.detail);
    });

    // Popup button handlers
    if (this.updatePopup) {
      document.getElementById('pwaUpdateNow').addEventListener('click', () => {
        this.handleUpdateNow();
      });

      document.getElementById('pwaUpdateLater').addEventListener('click', () => {
        this.handleUpdateLater();
      });

      document.getElementById('pwaUpdateClose').addEventListener('click', () => {
        this.handleUpdateLater();
      });

      document.querySelector('.pwa-update-backdrop').addEventListener('click', () => {
        this.handleUpdateLater();
      });

      document.getElementById('pwaAutoUpdate').addEventListener('change', (e) => {
        localStorage.setItem('bt_pwa_auto_update', e.target.checked.toString());
      });
    }

    // Check for updates periodically
    setInterval(() => {
      this.checkForUpdates();
    }, 15 * 60 * 1000); // Every 15 minutes
  }

  /**
   * Handle update available event
   */
  handleUpdateAvailable(detail) {
    this.isUpdateAvailable = true;
    this.newVersion = detail.version || 'latest';
    
    // Update version display
    const versionElement = document.getElementById('pwaUpdateVersion');
    if (versionElement) {
      versionElement.textContent = `Version: ${this.newVersion}`;
    }

    // Check auto-update preference
    const autoUpdate = localStorage.getItem('bt_pwa_auto_update') !== 'false';
    
    if (autoUpdate) {
      // Auto-update after a short delay
      setTimeout(() => {
        this.showUpdatePopup();
      }, 5000);
    } else {
      // Show immediately
      this.showUpdatePopup();
    }
  }

  /**
   * Show update popup
   */
  showUpdatePopup() {
    if (!this.updatePopup || !this.isUpdateAvailable) return;
    
    this.updatePopup.style.display = 'flex';
    
    requestAnimationFrame(() => {
      this.updatePopup.classList.add('pwa-update-popup-visible');
    });
  }

  /**
   * Hide update popup
   */
  hideUpdatePopup() {
    if (!this.updatePopup) return;
    
    this.updatePopup.classList.remove('pwa-update-popup-visible');
    
    setTimeout(() => {
      this.updatePopup.style.display = 'none';
    }, 300);
  }

  /**
   * Handle update now button
   */
  handleUpdateNow() {
    const button = document.getElementById('pwaUpdateNow');
    const buttonText = button.querySelector('span') || button;
    
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
    
    // Activate the new Service Worker
    if (window.swManager && swManager.registration && swManager.registration.waiting) {
      swManager.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Fallback: reload the page
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }

  /**
   * Handle later button
   */
  handleUpdateLater() {
    this.hideUpdatePopup();
    
    // Schedule reminder after 1 hour
    setTimeout(() => {
      if (this.isUpdateAvailable) {
        this.showUpdatePopup();
      }
    }, 60 * 60 * 1000);
  }

  /**
   * Check for updates manually
   */
  async checkForUpdates() {
    if (!('serviceWorker' in navigator)) return;
    
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
      }
    } catch (error) {
      console.error('[Update Manager] Update check failed:', error);
    }
  }

  /**
   * Force update check
   */
  forceUpdateCheck() {
    return this.checkForUpdates();
  }
}

// Create and initialize instance
const updateManager = new AppUpdateManager();

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    updateManager.init();
  });
} else {
  updateManager.init();
}

// Expose for external use
window.updateManager = updateManager;
