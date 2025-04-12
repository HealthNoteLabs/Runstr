/**
 * Android Storage Utilities
 * 
 * Helper functions specifically for Android storage persistence
 */

import { Platform } from './react-native-shim';

// Constants
const STORAGE_KEYS = {
  NIP29_ENABLED: 'nostr_groups_enabled',
  NIP29_PERMANENT: 'runstr_nip29_permanent',
  STORAGE_VERSION: 'android_storage_version'
};

// Storage version to track changes to storage format
const CURRENT_VERSION = '1.1';

/**
 * Ensure NIP29 is enabled, especially on Android
 * Called early in the app bootstrapping process
 */
export function ensureNIP29Enabled() {
  try {
    // Set the flag directly to true regardless of current value
    localStorage.setItem(STORAGE_KEYS.NIP29_ENABLED, 'true');
    
    // Also set a permanent flag so we remember this setting
    localStorage.setItem(STORAGE_KEYS.NIP29_PERMANENT, 'true');
    
    // Set storage version
    localStorage.setItem(STORAGE_KEYS.STORAGE_VERSION, CURRENT_VERSION);
    
    // Log for debugging
    console.log('[Android] NIP29 groups enabled by androidStorage utility');
    
    return true;
  } catch (error) {
    console.error('[Android] Error setting NIP29 flag:', error);
    return false;
  }
}

/**
 * Get a storage value with proper Android handling
 * @param {string} key - The key to retrieve
 * @param {any} defaultValue - Default value if key is not found
 * @returns {any} The stored value or default
 */
export function getStorageValue(key, defaultValue) {
  try {
    const value = localStorage.getItem(key);
    
    // For Android, ensure NIP29 is always enabled regardless of stored value
    if (Platform.OS === 'android' && key === 'nostr_groups_enabled') {
      return 'true';
    }
    
    return value !== null ? value : defaultValue;
  } catch (error) {
    console.error(`[Android] Error getting storage value for ${key}:`, error);
    return defaultValue;
  }
}

/**
 * Check if NIP29 is enabled with proper Android handling
 * @returns {boolean} Whether NIP29 is enabled
 */
export function isNIP29Enabled() {
  // For Android, force it to always return true
  if (Platform.OS === 'android') {
    return true;
  }
  
  // For other platforms, check flags
  const enabled = localStorage.getItem(STORAGE_KEYS.NIP29_ENABLED) === 'true';
  const permanent = localStorage.getItem(STORAGE_KEYS.NIP29_PERMANENT) === 'true';
  
  // If we've previously set the permanent flag, always return true
  if (permanent) {
    // Ensure the enabled flag is set correctly
    if (!enabled) {
      localStorage.setItem(STORAGE_KEYS.NIP29_ENABLED, 'true');
    }
    return true;
  }
  
  return enabled;
}

/**
 * Initialize platform-specific storage settings
 * Called during app startup
 */
export function initializeStorage() {
  // Do basic initialization for all platforms
  initStorageVersion();
  
  // Always ensure NIP29 is enabled on Android
  if (Platform.OS === 'android') {
    ensureNIP29Enabled();
  } else {
    // For other platforms, check if we have a permanent flag
    const permanent = localStorage.getItem(STORAGE_KEYS.NIP29_PERMANENT) === 'true';
    if (permanent) {
      localStorage.setItem(STORAGE_KEYS.NIP29_ENABLED, 'true');
    }
  }
}

/**
 * Initialize and verify storage version
 * @private
 */
function initStorageVersion() {
  const version = localStorage.getItem(STORAGE_KEYS.STORAGE_VERSION);
  
  // If no version or older version, perform migration
  if (!version || version !== CURRENT_VERSION) {
    console.log(`[Storage] Upgrading storage from ${version || 'none'} to ${CURRENT_VERSION}`);
    
    // If we previously had NIP29 enabled, make it permanent
    if (localStorage.getItem(STORAGE_KEYS.NIP29_ENABLED) === 'true') {
      localStorage.setItem(STORAGE_KEYS.NIP29_PERMANENT, 'true');
    }
    
    // Update to current version
    localStorage.setItem(STORAGE_KEYS.STORAGE_VERSION, CURRENT_VERSION);
  }
}

/**
 * Check if we're running on Android
 * @returns {boolean} True if running on Android
 */
export function isAndroid() {
  return Platform.OS === 'android';
}

// Initialize storage when this module is imported
initializeStorage(); 