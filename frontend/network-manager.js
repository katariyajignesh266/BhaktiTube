/**
 * Network Status Manager
 * Detects network changes and shows elegant toast notifications
 */

class NetworkManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.toastContainer = null;
    this.toastQueue = [];
    this.isShowingToast = false;
  }

  /**
   * Initialize network manager
   */
  init() {
    this.createToastContainer();
    this.setupEventListeners();
    this.checkInitialConnection();
  }

  /**
   * Create toast container
   */
  createToastContainer() {
    if (document.getElementById('networkToastContainer')) return;

    const containerHTML = `
      <div id="networkToastContainer" class="network-toast-container"></div>
    `;

    document.body.insertAdjacentHTML('beforeend', containerHTML);
    this.toastContainer = document.getElementById('networkToastContainer');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    window.addEventListener('online', () => {
      this.handleOnline();
    });

    window.addEventListener('offline', () => {
      this.handleOffline();
    });

    // Listen for connection quality changes (Chrome only)
    if (navigator.connection) {
      navigator.connection.addEventListener('change', () => {
        this.handleConnectionChange();
      });
    }
  }

  /**
   * Check initial connection
   */
  checkInitialConnection() {
    if (!this.isOnline) {
      this.showOfflineToast();
    } else {
      this.checkConnectionQuality();
    }
  }

  /**
   * Handle online event
   */
  handleOnline() {
    this.isOnline = true;
    console.log('[Network Manager] Connection restored');
    this.showOnlineToast();
    this.checkConnectionQuality();
  }

  /**
   * Handle offline event
   */
  handleOffline() {
    this.isOnline = false;
    console.log('[Network Manager] Connection lost');
    this.showOfflineToast();
  }

  /**
   * Handle connection quality change
   */
  handleConnectionChange() {
    const connection = navigator.connection;
    const effectiveType = connection.effectiveType;
    const downlink = connection.downlink;

    console.log('[Network Manager] Connection quality changed:', {
      effectiveType,
      downlink,
      rtt: connection.rtt
    });

    // Show slow network warning if needed
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      this.showSlowNetworkToast();
    }
  }

  /**
   * Check connection quality
   */
  checkConnectionQuality() {
    if (!navigator.connection) return;

    const connection = navigator.connection;
    const effectiveType = connection.effectiveType;

    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      this.showSlowNetworkToast();
    }
  }

  /**
   * Show offline toast
   */
  showOfflineToast() {
    this.showToast({
      type: 'offline',
      icon: 'fa-wifi',
      title: 'You\'re offline',
      message: 'Check your internet connection',
      duration: 0, // Don't auto-dismiss
      persistent: true
    });
  }

  /**
   * Show online toast
   */
  showOnlineToast() {
    this.showToast({
      type: 'online',
      icon: 'fa-check-circle',
      title: 'Back online',
      message: 'Your connection has been restored',
      duration: 3000
    });
  }

  /**
   * Show slow network toast
   */
  showSlowNetworkToast() {
    this.showToast({
      type: 'warning',
      icon: 'fa-triangle-exclamation',
      title: 'Slow connection',
      message: 'Your network is slower than usual',
      duration: 5000
    });
  }

  /**
   * Show toast notification
   */
  showToast(options) {
    const toast = {
      id: Date.now(),
      type: options.type || 'info',
      icon: options.icon || 'fa-info-circle',
      title: options.title || '',
      message: options.message || '',
      duration: options.duration || 3000,
      persistent: options.persistent || false
    };

    this.toastQueue.push(toast);
    this.processToastQueue();
  }

  /**
   * Process toast queue
   */
  processToastQueue() {
    if (this.isShowingToast || this.toastQueue.length === 0) return;

    const toast = this.toastQueue.shift();
    this.displayToast(toast);
  }

  /**
   * Display toast
   */
  displayToast(toast) {
    this.isShowingToast = true;

    const toastHTML = `
      <div class="network-toast network-toast-${toast.type}" id="toast-${toast.id}">
        <div class="network-toast-icon">
          <i class="fa-solid ${toast.icon}"></i>
        </div>
        <div class="network-toast-content">
          <div class="network-toast-title">${toast.title}</div>
          <div class="network-toast-message">${toast.message}</div>
        </div>
        ${!toast.persistent ? `
          <button class="network-toast-close" onclick="networkManager.dismissToast(${toast.id})">
            <i class="fa-solid fa-xmark"></i>
          </button>
        ` : ''}
      </div>
    `;

    this.toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    const toastElement = document.getElementById(`toast-${toast.id}`);

    // Animate in
    requestAnimationFrame(() => {
      toastElement.classList.add('network-toast-visible');
    });

    // Auto-dismiss if not persistent
    if (!toast.persistent && toast.duration > 0) {
      setTimeout(() => {
        this.dismissToast(toast.id);
      }, toast.duration);
    }
  }

  /**
   * Dismiss toast
   */
  dismissToast(toastId) {
    const toastElement = document.getElementById(`toast-${toastId}`);
    if (!toastElement) return;

    toastElement.classList.remove('network-toast-visible');

    setTimeout(() => {
      toastElement.remove();
      this.isShowingToast = false;
      this.processToastQueue();
    }, 300);
  }

  /**
   * Clear all toasts
   */
  clearAllToasts() {
    this.toastQueue = [];
    this.toastContainer.innerHTML = '';
    this.isShowingToast = false;
  }

  /**
   * Get current network status
   */
  getStatus() {
    const status = {
      isOnline: navigator.onLine,
      type: 'unknown'
    };

    if (navigator.connection) {
      status.type = navigator.connection.effectiveType;
      status.downlink = navigator.connection.downlink;
      status.rtt = navigator.connection.rtt;
    }

    return status;
  }
}

// Create and initialize instance
const networkManager = new NetworkManager();

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    networkManager.init();
  });
} else {
  networkManager.init();
}

// Expose for external use
window.networkManager = networkManager;
