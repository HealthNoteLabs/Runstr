import { initNetworkMonitoring } from '../utils/network';
import { initAppStateMonitoring } from '../utils/appState';
import { migrateFromLocalStorage, initStorageCache } from '../utils/storage';
import { isNativePlatform, showToast } from '../utils/platform';

/**
 * Initialize all mobile-specific services and features
 * @returns {Promise<boolean>} Whether initialization was successful
 */
export const initMobileServices = async () => {
  try {
    console.log('Initializing mobile services...');
    
    // Initialize storage first (needed by other services)
    await migrateFromLocalStorage();
    await initStorageCache();
    
    // Initialize network monitoring
    const networkState = await initNetworkMonitoring();
    console.log('Network state:', networkState);
    
    // Initialize app lifecycle monitoring
    const appState = await initAppStateMonitoring();
    console.log('App state monitoring initialized:', appState);
    
    // Show a success toast if on native platform
    if (isNativePlatform) {
      showToast('RUNSTR initialized successfully');
    }
    
    console.log('Mobile services initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing mobile services:', error);
    return false;
  }
};

/**
 * Handle app being backgrounded
 * @returns {Promise<void>}
 */
export const handleAppBackground = async () => {
  try {
    console.log('App going to background, cleaning up resources...');
    
    // Clean up any resources that should be released when app is backgrounded
    // This might include closing connections, stopping timers, etc.
    
    // Handle state persistence if needed
    
    console.log('App background cleanup complete');
  } catch (error) {
    console.error('Error during app background cleanup:', error);
  }
};

/**
 * Handle app returning to foreground
 * @param {number} backgroundDuration - Duration app was in background (seconds)
 * @returns {Promise<void>}
 */
export const handleAppForeground = async (backgroundDuration) => {
  try {
    console.log(`App returning to foreground after ${backgroundDuration} seconds`);
    
    // Re-initialize resources that may have been cleaned up
    // Refresh data if app was backgrounded for a long time
    
    if (backgroundDuration > 300) { // 5 minutes
      console.log('App was backgrounded for over 5 minutes, refreshing data...');
      // Refresh stale data
    }
    
    console.log('App foreground restoration complete');
  } catch (error) {
    console.error('Error during app foreground restoration:', error);
  }
};

/**
 * Handle network status changes
 * @param {boolean} isConnected - Whether the device is connected to a network
 * @returns {Promise<void>}
 */
export const handleNetworkStatusChange = async (isConnected) => {
  try {
    if (isConnected) {
      console.log('Network connection restored, syncing pending data...');
      // Process any pending operations that require network
    } else {
      console.log('Network connection lost, switching to offline mode...');
      // Enable offline mode
    }
  } catch (error) {
    console.error('Error handling network status change:', error);
  }
};

/**
 * Set up all application event listeners
 * @returns {Function} Function to remove all listeners
 */
export const setupAppEventListeners = () => {
  const cleanupFunctions = [];
  
  // Import dynamically to avoid circular dependencies
  import('../utils/appState').then(({ addAppStateListener }) => {
    // Set up app background/foreground listeners
    const foregroundHandler = (event) => {
      const { backgroundDuration } = event.detail;
      handleAppForeground(backgroundDuration);
    };
    
    const backgroundHandler = () => {
      handleAppBackground();
    };
    
    addAppStateListener('foreground', foregroundHandler);
    addAppStateListener('background', backgroundHandler);
    
    cleanupFunctions.push(() => {
      import('../utils/appState').then(({ removeAppStateListener }) => {
        removeAppStateListener('foreground', foregroundHandler);
        removeAppStateListener('background', backgroundHandler);
      });
    });
  });
  
  // Set up network listeners
  import('../utils/network').then(({ addNetworkListener }) => {
    const networkHandler = (event) => {
      const { connected } = event.detail;
      handleNetworkStatusChange(connected);
    };
    
    addNetworkListener('connectionChange', networkHandler);
    
    cleanupFunctions.push(() => {
      import('../utils/network').then(({ removeNetworkListener }) => {
        removeNetworkListener('connectionChange', networkHandler);
      });
    });
  });
  
  // Return a function to clean up all listeners
  return () => {
    cleanupFunctions.forEach(cleanup => cleanup());
  };
};

// Export a single object for convenience
export default {
  initMobileServices,
  handleAppBackground,
  handleAppForeground,
  handleNetworkStatusChange,
  setupAppEventListeners
}; 