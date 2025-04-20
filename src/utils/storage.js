import { Preferences } from '@capacitor/preferences';
import { isNativePlatform } from './platform';

// In-memory cache for synchronous-like operations
let storageCache = {};

/**
 * Initialize the storage cache for synchronous-like operations
 * @returns {Promise<void>}
 */
export const initStorageCache = async () => {
  try {
    // Get all keys first
    const { keys } = await Preferences.keys();
    
    // Populate cache with all existing values
    const fetchPromises = keys.map(async (key) => {
      const { value } = await Preferences.get({ key });
      if (value !== null) {
        storageCache[key] = value;
      }
    });
    
    await Promise.all(fetchPromises);
    console.log('Storage cache initialized with', Object.keys(storageCache).length, 'items');
  } catch (error) {
    console.error('Failed to initialize storage cache:', error);
    throw error;
  }
};

/**
 * Get item from storage
 * @param {string} key - The key to retrieve
 * @returns {Promise<string|null>} The value or null if not found
 */
export const getItem = async (key) => {
  if (isNativePlatform) {
    try {
      const { value } = await Preferences.get({ key });
      return value;
    } catch (error) {
      console.error(`Error getting ${key} from Preferences:`, error);
      return null;
    }
  } else {
    return localStorage.getItem(key);
  }
};

/**
 * Get JSON item from storage
 * @param {string} key - The key to retrieve
 * @param {any} defaultValue - Default value if key not found or parsing fails
 * @returns {Promise<any>} The parsed value or defaultValue
 */
export const getJSON = async (key, defaultValue = null) => {
  const value = await getItem(key);
  if (value === null) return defaultValue;
  
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error(`Error parsing JSON for ${key}:`, error);
    return defaultValue;
  }
};

/**
 * Set JSON item in storage
 * @param {string} key - The key to set
 * @param {any} value - The value to store (will be stringified)
 * @returns {Promise<void>}
 */
export const setJSON = async (key, value) => {
  try {
    const jsonString = JSON.stringify(value);
    await setItem(key, jsonString);
  } catch (error) {
    console.error(`Error saving JSON for ${key}:`, error);
    throw error;
  }
};

/**
 * Set item in storage
 * @param {string} key - The key to set
 * @param {string} value - The value to store
 * @returns {Promise<void>}
 */
export const setItem = async (key, value) => {
  if (isNativePlatform) {
    try {
      await Preferences.set({ key, value });
      // Update cache for sync operations
      storageCache[key] = value;
    } catch (error) {
      console.error(`Error setting ${key} in Preferences:`, error);
      throw error;
    }
  } else {
    localStorage.setItem(key, value);
  }
};

/**
 * Remove item from storage
 * @param {string} key - The key to remove
 * @returns {Promise<void>}
 */
export const removeItem = async (key) => {
  if (isNativePlatform) {
    try {
      await Preferences.remove({ key });
      // Update cache for sync operations
      delete storageCache[key];
    } catch (error) {
      console.error(`Error removing ${key} from Preferences:`, error);
      throw error;
    }
  } else {
    localStorage.removeItem(key);
  }
};

/**
 * Clear all storage
 * @returns {Promise<void>}
 */
export const clear = async () => {
  if (isNativePlatform) {
    try {
      await Preferences.clear();
      // Clear cache
      storageCache = {};
    } catch (error) {
      console.error('Error clearing Preferences:', error);
      throw error;
    }
  } else {
    localStorage.clear();
  }
};

/**
 * Get all keys in storage
 * @returns {Promise<string[]>} Array of keys
 */
export const keys = async () => {
  if (isNativePlatform) {
    try {
      const { keys } = await Preferences.keys();
      return keys;
    } catch (error) {
      console.error('Error getting keys from Preferences:', error);
      return [];
    }
  } else {
    return Object.keys(localStorage);
  }
};

/**
 * Get item from storage synchronously (uses cache when on native)
 * @param {string} key - The key to retrieve
 * @returns {string|null} The value or null if not found
 */
export const getItemSync = (key) => {
  if (isNativePlatform) {
    return key in storageCache ? storageCache[key] : null;
  } else {
    return localStorage.getItem(key);
  }
};

/**
 * Set item in storage synchronously (updates cache and schedules async update)
 * @param {string} key - The key to set
 * @param {string} value - The value to store
 */
export const setItemSync = (key, value) => {
  if (isNativePlatform) {
    // Update cache immediately
    storageCache[key] = value;
    // Schedule async update
    setTimeout(() => {
      Preferences.set({ key, value }).catch(error => {
        console.error(`Error setting ${key} in Preferences (background):`, error);
      });
    }, 0);
  } else {
    localStorage.setItem(key, value);
  }
};

/**
 * Remove item from storage synchronously
 * @param {string} key - The key to remove
 */
export const removeItemSync = (key) => {
  if (isNativePlatform) {
    // Update cache immediately
    delete storageCache[key];
    // Schedule async update
    setTimeout(() => {
      Preferences.remove({ key }).catch(error => {
        console.error(`Error removing ${key} from Preferences (background):`, error);
      });
    }, 0);
  } else {
    localStorage.removeItem(key);
  }
};

/**
 * Migrate data from localStorage to Capacitor Preferences
 * @returns {Promise<void>}
 */
export const migrateFromLocalStorage = async () => {
  if (!isNativePlatform) {
    console.log('Not on native platform, skipping migration');
    return;
  }
  
  try {
    console.log('Starting migration from localStorage to Preferences...');
    
    // Check if we've already migrated
    const migrationCompleted = await getItem('_storage_migration_completed');
    if (migrationCompleted === 'true') {
      console.log('Migration already completed');
      return;
    }
    
    // Get all localStorage items
    const itemCount = localStorage.length;
    console.log(`Found ${itemCount} items in localStorage`);
    
    if (itemCount === 0) {
      console.log('No items to migrate');
      await setItem('_storage_migration_completed', 'true');
      return;
    }
    
    // Migrate each item
    for (let i = 0; i < itemCount; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      const value = localStorage.getItem(key);
      if (value === null) continue;
      
      console.log(`Migrating ${key}`);
      await setItem(key, value);
    }
    
    console.log('Migration completed successfully');
    await setItem('_storage_migration_completed', 'true');
  } catch (error) {
    console.error('Error during storage migration:', error);
    throw error;
  }
};

// Export default for ease of use
export default {
  setItem,
  getItem,
  getJSON,
  setJSON,
  removeItem,
  clear,
  keys,
  migrateFromLocalStorage,
  // Sync versions
  initStorageCache,
  getItemSync,
  setItemSync,
  removeItemSync
}; 