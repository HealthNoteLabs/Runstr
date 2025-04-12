/**
 * localStorage polyfill for Node.js environment
 * Provides a simple in-memory implementation of localStorage API
 */

class LocalStoragePolyfill {
  constructor() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }

  key(index) {
    return Object.keys(this.store)[index] || null;
  }

  get length() {
    return Object.keys(this.store).length;
  }
}

// Create and export a global localStorage instance
if (typeof global !== 'undefined') {
  global.localStorage = new LocalStoragePolyfill();
} else {
  // For environments where global is not available
  (function(window) {
    window.localStorage = new LocalStoragePolyfill();
  })(typeof window !== 'undefined' ? window : this);
}

module.exports = typeof global !== 'undefined' ? global.localStorage : 
  (typeof window !== 'undefined' ? window.localStorage : new LocalStoragePolyfill()); 