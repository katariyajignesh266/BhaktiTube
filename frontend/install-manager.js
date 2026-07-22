/**
 * PWA Install Manager
 * Handles install prompts, UI, and user preferences
 */

class PWAInstallManager {
  constructor() {
    this.deferredPrompt = null;
    this.installPopup = null;
    this.dismissCount = 0;
    this.lastDismissTime = 0;
    this.DISMISS_DELAY_DAYS = 7;
    this.MAX_DISMISSALS = 3;
  }

  /**
   * Initialize install manager
   */
  init() {
    this.createInstallPopup();
    this.setupEventListeners();
    this.checkInstallStatus();
    this.setupDownloadButton();
  }

  /**
   * Create install popup UI
   */
  createInstallPopup() {
    // Check if popup already exists
    if (document.getElementById('pwaInstallPopup')) return;

    const popupHTML = `
      <div id="pwaInstallPopup" class="pwa-install-popup" style="display: none;">
        <div class="pwa-install-backdrop"></div>
        <div class="pwa-install-card">
          <button class="pwa-install-close" id="pwaInstallClose">
            <i class="fa-solid fa-xmark"></i>
          </button>
          
          <div class="pwa-install-content">
            <div class="pwa-install-icon">
              <img src="https://res.cloudinary.com/dastne5qy/image/upload/q_auto/f_auto/v1780742623/My_Bhaktitude_website_logo_gxf2b1.png" 
                   alt="BhaktiTube Logo">
            </div>
            
            <div class="pwa-install-text">
              <h2>Install BhaktiTube</h2>
              <p>Get the full devotional experience with our app. Watch videos offline, get instant notifications, and enjoy a native-like experience.</p>
            </div>
            
            <div class="pwa-install-actions">
              <button class="pwa-install-btn-primary" id="pwaInstallBtn">
                <i class="fa-solid fa-download"></i>
                Install App
              </button>
              <button class="pwa-install-btn-secondary" id="pwaInstallLater">
                Later
              </button>
            </div>
            
            <div class="pwa-install-footer">
              <span>Available on Chrome, Edge, Brave, and more</span>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', popupHTML);
    this.installPopup = document.getElementById('pwaInstallPopup');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      console.log('[Install Manager] Install prompt captured');
      
      // Show popup after delay if not dismissed recently
      this.scheduleInstallPopup();
    });

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      console.log('[Install Manager] App installed');
      this.markAsInstalled();
      this.hideInstallPopup();
      this.updateDownloadButton(false);
      this.showInstallSuccess();
    });

    // Popup button handlers
    if (this.installPopup) {
      document.getElementById('pwaInstallBtn').addEventListener('click', () => {
        this.handleInstallClick();
      });

      document.getElementById('pwaInstallLater').addEventListener('click', () => {
        this.handleLaterClick();
      });

      document.getElementById('pwaInstallClose').addEventListener('click', () => {
        this.handleLaterClick();
      });

      document.querySelector('.pwa-install-backdrop').addEventListener('click', () => {
        this.handleLaterClick();
      });
    }
  }

  /**
   * Schedule install popup display
   */
  scheduleInstallPopup() {
    // Check if user has dismissed too many times
    if (this.dismissCount >= this.MAX_DISMISSALS) {
      console.log('[Install Manager] Max dismissals reached');
      return;
    }

    // Check if dismissed recently
    const daysSinceDismiss = (Date.now() - this.lastDismissTime) / (1000 * 60 * 60 * 24);
    if (daysSinceDismiss < this.DISMISS_DELAY_DAYS) {
      console.log('[Install Manager] Dismissed recently, waiting');
      return;
    }

    // Check if already installed
    if (this.isInstalled()) {
      console.log('[Install Manager] Already installed');
      return;
    }

    // Show popup after 3 seconds
    setTimeout(() => {
      this.showInstallPopup();
    }, 3000);
  }

  /**
   * Show install popup
   */
  showInstallPopup() {
    if (!this.installPopup) return;
    this.installPopup.style.display = 'flex';
    
    // Animate in
    requestAnimationFrame(() => {
      this.installPopup.classList.add('pwa-install-popup-visible');
    });
  }

  /**
   * Hide install popup
   */
  hideInstallPopup() {
    if (!this.installPopup) return;
    this.installPopup.classList.remove('pwa-install-popup-visible');
    
    setTimeout(() => {
      this.installPopup.style.display = 'none';
    }, 300);
  }

  /**
   * Handle install button click
   */
  async handleInstallClick() {
    if (!this.deferredPrompt) {
      // Fallback for browsers without beforeinstallprompt
      this.showBrowserInstructions();
      return;
    }

    // Show the install prompt
    this.deferredPrompt.prompt();
    
    // Wait for user choice
    const { outcome } = await this.deferredPrompt.userChoice;
    
    console.log('[Install Manager] User choice:', outcome);
    
    if (outcome === 'accepted') {
      this.markAsInstalled();
    }
    
    this.deferredPrompt = null;
    this.hideInstallPopup();
  }

  /**
   * Handle later button click
   */
  handleLaterClick() {
    this.dismissCount++;
    this.lastDismissTime = Date.now();
    this.saveDismissState();
    this.hideInstallPopup();
  }

  /**
   * Check if app is installed
   */
  isInstalled() {
    // Check if running in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        window.matchMedia('(display-mode: minimal-ui)').matches ||
                        document.referrer.includes('android-app://');
    
    // Check localStorage (only if not in standalone mode)
    const installedFlag = localStorage.getItem('bt_pwa_installed');
    
    // For local development, ignore localStorage flag
    const isLocalDev = window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === 'localhost' ||
                       window.location.protocol === 'file:';
    
    if (isLocalDev) {
      console.log('[Install Manager] Local development detected, ignoring localStorage flag');
      return isStandalone;
    }
    
    return isStandalone || installedFlag === 'true';
  }

  /**
   * Mark app as installed
   */
  markAsInstalled() {
    localStorage.setItem('bt_pwa_installed', 'true');
    this.updateDownloadButton(false);
  }

  /**
   * Reset install status (for testing)
   */
  resetInstallStatus() {
    localStorage.removeItem('bt_pwa_installed');
    localStorage.removeItem('bt_pwa_dismiss_count');
    localStorage.removeItem('bt_pwa_dismiss_time');
    this.dismissCount = 0;
    this.lastDismissTime = 0;
    this.updateDownloadButton(true);
    console.log('[Install Manager] Install status reset');
  }

  /**
   * Save dismiss state
   */
  saveDismissState() {
    localStorage.setItem('bt_pwa_dismiss_count', this.dismissCount.toString());
    localStorage.setItem('bt_pwa_dismiss_time', this.lastDismissTime.toString());
  }

  /**
   * Load dismiss state
   */
  loadDismissState() {
    this.dismissCount = parseInt(localStorage.getItem('bt_pwa_dismiss_count') || '0');
    this.lastDismissTime = parseInt(localStorage.getItem('bt_pwa_dismiss_time') || '0');
  }

  /**
   * Check install status
   */
  checkInstallStatus() {
    this.loadDismissState();
    
    console.log('[Install Manager] isInstalled:', this.isInstalled());
    console.log('[Install Manager] dismissCount:', this.dismissCount);
    console.log('[Install Manager] lastDismissTime:', this.lastDismissTime);
    
    if (this.isInstalled()) {
      console.log('[Install Manager] App is installed');
      this.updateDownloadButton(false);
    } else {
      this.updateDownloadButton(true);
      console.log('[Install Manager] Download button should be visible');
    }

    // For iOS, show instructions after delay
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      setTimeout(() => {
        if (!this.isInstalled() && this.dismissCount < this.MAX_DISMISSALS) {
          this.showIOSInstructions();
        }
      }, 5000);
    }
  }

  /**
   * Setup download button in sidebar
   */
  setupDownloadButton() {
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        this.handleInstallClick();
      });
      console.log('[Install Manager] Download button setup complete');
    } else {
      console.log('[Install Manager] Download button not found in DOM');
    }
  }

  /**
   * Update download button visibility
   */
  updateDownloadButton(show) {
    const downloadBtn = document.getElementById('downloadBtn');
    console.log('[Install Manager] updateDownloadButton called with:', show);
    console.log('[Install Manager] downloadBtn element:', downloadBtn);
    if (downloadBtn) {
      downloadBtn.style.display = show ? 'flex' : 'none';
      console.log('[Install Manager] Button display set to:', downloadBtn.style.display);
    } else {
      console.log('[Install Manager] downloadBtn element not found! Retrying in 100ms...');
      setTimeout(() => {
        const retryBtn = document.getElementById('downloadBtn');
        if (retryBtn) {
          retryBtn.style.display = show ? 'flex' : 'none';
          console.log('[Install Manager] Retry successful, button display set to:', retryBtn.style.display);
        }
      }, 100);
    }
  }

  /**
   * Show browser-specific install instructions
   */
  showBrowserInstructions() {
    const browser = this.detectBrowser();
    let instructions = '';

    switch (browser) {
      case 'chrome':
        instructions = `
          <div class="pwa-install-instructions">
            <h3>Install on Chrome</h3>
            <ol>
              <li>Click the menu icon (⋮) in the top-right corner</li>
              <li>Select "Install BhaktiTube" or "Install app"</li>
              <li>Click "Install" to confirm</li>
            </ol>
          </div>
        `;
        break;
      case 'edge':
        instructions = `
          <div class="pwa-install-instructions">
            <h3>Install on Edge</h3>
            <ol>
              <li>Click the menu icon (⋯) in the top-right corner</li>
              <li>Select "Apps" > "Install this site as an app"</li>
              <li>Click "Install" to confirm</li>
            </ol>
          </div>
        `;
        break;
      case 'firefox':
        instructions = `
          <div class="pwa-install-instructions">
            <h3>Install on Firefox</h3>
            <ol>
              <li>Click the menu icon (≡) in the top-right corner</li>
              <li>Select "Install this site as an app"</li>
              <li>Click "Install" to confirm</li>
            </ol>
          </div>
        `;
        break;
      default:
        instructions = `
          <div class="pwa-install-instructions">
            <h3>Install App</h3>
            <p>Look for the "Install" or "Add to Home Screen" option in your browser's menu.</p>
          </div>
        `;
    }

    // Replace popup content with instructions
    const content = this.installPopup.querySelector('.pwa-install-content');
    content.innerHTML = instructions + `
      <button class="pwa-install-btn-primary" id="pwaInstallCloseBtn">
        Got it
      </button>
    `;

    document.getElementById('pwaInstallCloseBtn').addEventListener('click', () => {
      this.hideInstallPopup();
    });
  }

  /**
   * Show iOS install instructions
   */
  showIOSInstructions() {
    const instructionsHTML = `
      <div id="pwaIOSInstructions" class="pwa-ios-instructions" style="display: none;">
        <div class="pwa-ios-backdrop"></div>
        <div class="pwa-ios-card">
          <button class="pwa-ios-close" id="pwaIOSClose">
            <i class="fa-solid fa-xmark"></i>
          </button>
          
          <div class="pwa-ios-content">
            <div class="pwa-ios-icon">
              <img src="https://res.cloudinary.com/dastne5qy/image/upload/q_auto/f_auto/v1780742623/My_Bhaktitude_website_logo_gxf2b1.png" 
                   alt="BhaktiTube Logo">
            </div>
            
            <h2>Add to Home Screen</h2>
            
            <div class="pwa-ios-steps">
              <div class="pwa-ios-step">
                <span class="pwa-ios-icon-small">
                  <i class="fa-solid fa-share-nodes"></i>
                </span>
                <p>Tap the Share button</p>
              </div>
              
              <div class="pwa-ios-step">
                <span class="pwa-ios-icon-small">
                  <i class="fa-solid fa-plus"></i>
                </span>
                <p>Scroll down and tap "Add to Home Screen"</p>
              </div>
              
              <div class="pwa-ios-step">
                <span class="pwa-ios-icon-small">
                  <i class="fa-solid fa-check"></i>
                </span>
                <p>Tap "Add" to install</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', instructionsHTML);
    const iosPopup = document.getElementById('pwaIOSInstructions');
    
    iosPopup.style.display = 'flex';
    requestAnimationFrame(() => {
      iosPopup.classList.add('pwa-ios-instructions-visible');
    });

    document.getElementById('pwaIOSClose').addEventListener('click', () => {
      iosPopup.classList.remove('pwa-ios-instructions-visible');
      setTimeout(() => {
        iosPopup.style.display = 'none';
      }, 300);
      this.dismissCount++;
      this.saveDismissState();
    });

    document.querySelector('.pwa-ios-backdrop').addEventListener('click', () => {
      iosPopup.classList.remove('pwa-ios-instructions-visible');
      setTimeout(() => {
        iosPopup.style.display = 'none';
      }, 300);
      this.dismissCount++;
      this.saveDismissState();
    });
  }

  /**
   * Detect browser
   */
  detectBrowser() {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
      return 'chrome';
    }
    if (userAgent.includes('edg')) {
      return 'edge';
    }
    if (userAgent.includes('firefox')) {
      return 'firefox';
    }
    if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
      return 'safari';
    }
    
    return 'other';
  }

  /**
   * Show install success notification
   */
  showInstallSuccess() {
    const successHTML = `
      <div class="pwa-install-success">
        <i class="fa-solid fa-circle-check"></i>
        <span>BhaktiTube installed successfully!</span>
      </div>
    `;

    const toast = document.createElement('div');
    toast.innerHTML = successHTML;
    toast.className = 'pwa-success-toast';
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('pwa-success-toast-visible');
    }, 100);

    setTimeout(() => {
      toast.classList.remove('pwa-success-toast-visible');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }
}

// Create and initialize instance
const installManager = new PWAInstallManager();

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    installManager.init();
  });
} else {
  installManager.init();
}

// Expose for external use
window.installManager = installManager;

// Expose reset function for testing
window.resetPWAInstall = () => installManager.resetInstallStatus();
