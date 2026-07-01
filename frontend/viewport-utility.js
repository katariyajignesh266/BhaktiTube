/**
 * Dynamic Viewport Utility for Chrome Mobile and All Mobile Browsers
 * 
 * This utility provides real-time viewport tracking to handle:
 * - Chrome Android dynamic address bar (expanding/collapsing)
 * - Safe area insets for notched devices
 * - Virtual keyboard opening/closing
 * - Orientation changes
 * - Foldable device size changes
 * 
 * Usage:
 * import { ViewportUtility } from './viewport-utility.js';
 * const viewport = new ViewportUtility();
 * viewport.init();
 */

class ViewportUtility {
  constructor() {
    this.visualViewport = null;
    this.resizeObserver = null;
    this.resizeCallbacks = [];
    this.currentViewport = {
      width: 0,
      height: 0,
      scale: 1,
      safeAreaTop: 0,
      safeAreaBottom: 0,
      safeAreaLeft: 0,
      safeAreaRight: 0
    };
    this.isInitialized = false;
  }

  /**
   * Initialize the viewport utility
   */
  init() {
    if (this.isInitialized) return;
    
    this.setupVisualViewport();
    this.setupCSSCustomProperties();
    this.setupResizeObserver();
    this.setupEventListeners();
    this.updateViewport();
    
    this.isInitialized = true;
    console.log('Viewport Utility initialized');
  }

  /**
   * Setup visualViewport API for real-time tracking
   */
  setupVisualViewport() {
    if (window.visualViewport) {
      this.visualViewport = window.visualViewport;
      
      // Listen to visualViewport changes
      this.visualViewport.addEventListener('resize', this.handleViewportResize.bind(this));
      this.visualViewport.addEventListener('scroll', this.handleViewportScroll.bind(this));
    }
  }

  /**
   * Setup CSS custom properties for dynamic values
   */
  setupCSSCustomProperties() {
    const root = document.documentElement;
    
    // Set initial safe area insets
    root.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top, 0px)');
    root.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom, 0px)');
    root.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left, 0px)');
    root.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right, 0px)');
    
    // Set dynamic viewport properties
    root.style.setProperty('--dynamic-viewport-width', '100vw');
    root.style.setProperty('--dynamic-viewport-height', '100dvh');
  }

  /**
   * Setup ResizeObserver for container changes
   */
  setupResizeObserver() {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          this.handleContainerResize(entry);
        }
      });
    }
  }

  /**
   * Setup event listeners for viewport changes
   */
  setupEventListeners() {
    // Window resize
    window.addEventListener('resize', this.handleWindowResize.bind(this));
    
    // Orientation change
    window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
    
    // Virtual keyboard detection
    window.addEventListener('resize', this.handleVirtualKeyboard.bind(this));
    
    // Focus/blur for keyboard detection
    document.addEventListener('focusin', this.handleFocusIn.bind(this));
    document.addEventListener('focusout', this.handleFocusOut.bind(this));
  }

  /**
   * Handle visualViewport resize events
   */
  handleViewportResize() {
    if (!this.visualViewport) return;
    
    this.updateViewport();
    this.notifyCallbacks();
  }

  /**
   * Handle visualViewport scroll events
   */
  handleViewportScroll() {
    if (!this.visualViewport) return;
    
    this.updateViewport();
  }

  /**
   * Handle window resize events
   */
  handleWindowResize() {
    this.updateViewport();
    this.notifyCallbacks();
  }

  /**
   * Handle orientation change
   */
  handleOrientationChange() {
    // Delay to allow browser to complete orientation change
    setTimeout(() => {
      this.updateViewport();
      this.notifyCallbacks();
    }, 100);
  }

  /**
   * Handle virtual keyboard opening/closing
   */
  handleVirtualKeyboard() {
    const currentHeight = window.innerHeight;
    const previousHeight = this.currentViewport.height;
    
    // If height decreased significantly, keyboard is likely open
    if (previousHeight > 0 && currentHeight < previousHeight - 100) {
      document.body.classList.add('keyboard-open');
    } else if (previousHeight > 0 && currentHeight > previousHeight + 100) {
      document.body.classList.remove('keyboard-open');
    }
    
    this.updateViewport();
  }

  /**
   * Handle focus in (keyboard might open)
   */
  handleFocusIn(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      document.body.classList.add('keyboard-pending');
    }
  }

  /**
   * Handle focus out (keyboard might close)
   */
  handleFocusOut(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      document.body.classList.remove('keyboard-pending');
    }
  }

  /**
   * Handle container resize from ResizeObserver
   */
  handleContainerResize(entry) {
    this.updateViewport();
    this.notifyCallbacks();
  }

  /**
   * Update current viewport measurements
   */
  updateViewport() {
    const root = document.documentElement;
    
    // Get viewport dimensions
    let width, height, scale;
    
    if (this.visualViewport) {
      width = this.visualViewport.width;
      height = this.visualViewport.height;
      scale = this.visualViewport.scale;
    } else {
      width = window.innerWidth;
      height = window.innerHeight;
      scale = 1;
    }
    
    // Get safe area insets
    const safeAreaTop = parseInt(getComputedStyle(root).getPropertyValue('--safe-area-inset-top')) || 0;
    const safeAreaBottom = parseInt(getComputedStyle(root).getPropertyValue('--safe-area-inset-bottom')) || 0;
    const safeAreaLeft = parseInt(getComputedStyle(root).getPropertyValue('--safe-area-inset-left')) || 0;
    const safeAreaRight = parseInt(getComputedStyle(root).getPropertyValue('--safe-area-inset-right')) || 0;
    
    // Update current viewport state
    this.currentViewport = {
      width,
      height,
      scale,
      safeAreaTop,
      safeAreaBottom,
      safeAreaLeft,
      safeAreaRight
    };
    
    // Update CSS custom properties
    root.style.setProperty('--viewport-width', `${width}px`);
    root.style.setProperty('--viewport-height', `${height}px`);
    root.style.setProperty('--viewport-scale', scale);
    
    // Calculate usable height (excluding safe areas)
    const usableHeight = height - safeAreaTop - safeAreaBottom;
    root.style.setProperty('--usable-viewport-height', `${usableHeight}px`);
    
    // Update for keyboard if open
    if (document.body.classList.contains('keyboard-open')) {
      root.style.setProperty('--viewport-height-with-keyboard', `${height}px`);
    }
  }

  /**
   * Add callback for viewport changes
   */
  onResize(callback) {
    if (typeof callback === 'function') {
      this.resizeCallbacks.push(callback);
    }
  }

  /**
   * Remove callback
   */
  offResize(callback) {
    const index = this.resizeCallbacks.indexOf(callback);
    if (index > -1) {
      this.resizeCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all registered callbacks
   */
  notifyCallbacks() {
    this.resizeCallbacks.forEach(callback => {
      try {
        callback(this.currentViewport);
      } catch (error) {
        console.error('Viewport callback error:', error);
      }
    });
  }

  /**
   * Start observing a specific element
   */
  observeElement(element) {
    if (this.resizeObserver && element) {
      this.resizeObserver.observe(element);
    }
  }

  /**
   * Stop observing an element
   */
  unobserveElement(element) {
    if (this.resizeObserver && element) {
      this.resizeObserver.unobserve(element);
    }
  }

  /**
   * Get current viewport info
   */
  getViewport() {
    return { ...this.currentViewport };
  }

  /**
   * Get usable viewport height (excluding safe areas)
   */
  getUsableHeight() {
    return this.currentViewport.height - this.currentViewport.safeAreaTop - this.currentViewport.safeAreaBottom;
  }

  /**
   * Destroy the viewport utility
   */
  destroy() {
    if (this.visualViewport) {
      this.visualViewport.removeEventListener('resize', this.handleViewportResize.bind(this));
      this.visualViewport.removeEventListener('scroll', this.handleViewportScroll.bind(this));
    }
    
    window.removeEventListener('resize', this.handleWindowResize.bind(this));
    window.removeEventListener('orientationchange', this.handleOrientationChange.bind(this));
    document.removeEventListener('focusin', this.handleFocusIn.bind(this));
    document.removeEventListener('focusout', this.handleFocusOut.bind(this));
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    this.resizeCallbacks = [];
    this.isInitialized = false;
  }
}

// Export for ES modules
export { ViewportUtility };

// Also export as singleton for easy access
const viewportUtility = new ViewportUtility();
export default viewportUtility;
