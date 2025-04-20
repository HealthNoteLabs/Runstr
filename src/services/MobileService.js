import { initNetworkMonitoring } from '../utils/network';
import { initAppStateMonitoring } from '../utils/appState';
import { migrateFromLocalStorage, initStorageCache } from '../utils/storage';
import { isNativePlatform, showToast } from '../utils/platform';

/**
 * Safely initialize a service with error handling
 * @param {Function} initFunction - The initialization function to call
 * @param {string} serviceName - Name of the service for logging
 * @param {boolean} critical - Whether this service is critical (should throw on failure)
 * @returns {Promise<boolean>} Whether initialization was successful
 */
const safeInitialize = async (initFunction, serviceName, critical = false) => {
  try {
    console.log(`Initializing ${serviceName}...`);
    const result = await initFunction();
    console.log(`${serviceName} initialized successfully:`, result);
    return true;
  } catch (error) {
    console.error(`Error initializing ${serviceName}:`, error);
    
    // For critical services, throw the error
    if (critical) {
      throw new Error(`Critical service ${serviceName} failed to initialize: ${error.message}`);
    }
    
    // For non-critical services, just log and continue
    return false;
  }
};

/**
 * Initialize all mobile-specific services and features
 * @returns {Promise<Object>} Initialization status for each service
 */
export const initMobileServices = async () => {
  const status = {
    storage: false,
    storageCache: false, 
    network: false,
    appState: false,
    overall: false
  };
  
  try {
    console.log('Starting mobile services initialization...');
    
    // Storage is critical - app cannot function without it
    try {
      // First try to migrate from localStorage if needed
      if (isNativePlatform) {
        await migrateFromLocalStorage().catch(err => {
          console.warn('Storage migration failed but continuing:', err);
          // Non-critical, can continue without migration
        });
        status.storage = true;
      } else {
        // On web, storage is already available via localStorage
        status.storage = true;
      }
      
      // Initialize storage cache (also critical)
      await initStorageCache();
      status.storageCache = true;
    } catch (storageError) {
      console.error('Critical storage initialization failed:', storageError);
      throw storageError; // Re-throw as this is critical
    }
    
    // Initialize network monitoring - not critical for basic app function
    status.network = await safeInitialize(
      initNetworkMonitoring,
      'network monitoring',
      false
    );
    
    // Initialize app lifecycle monitoring - not critical
    status.appState = await safeInitialize(
      initAppStateMonitoring,
      'app state monitoring',
      false
    );
    
    // Show a success toast if on native platform
    if (isNativePlatform) {
      try {
        showToast('RUNSTR initialized successfully');
      } catch (toastError) {
        console.warn('Unable to show toast, but continuing:', toastError);
      }
    }
    
    console.log('Mobile services initialization complete with status:', status);
    status.overall = true;
    return status;
  } catch (error) {
    console.error('Critical error initializing mobile services:', error);
    status.error = error.message;
    return status;
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
  try {
    // Set up app background/foreground listeners
    import('../utils/appState').then(({ addAppStateListener }) => {
      if (typeof addAppStateListener !== 'function') {
        console.warn('addAppStateListener is not a function, skipping app state listeners');
        return;
      }
      
      const foregroundHandler = (event) => {
        const { backgroundDuration } = event.detail || { backgroundDuration: 0 };
        handleAppForeground(backgroundDuration);
      };
      
      const backgroundHandler = () => {
        handleAppBackground();
      };
      
      addAppStateListener('foreground', foregroundHandler);
      addAppStateListener('background', backgroundHandler);
      
      cleanupFunctions.push(() => {
        import('../utils/appState').then(({ removeAppStateListener }) => {
          if (typeof removeAppStateListener === 'function') {
            removeAppStateListener('foreground', foregroundHandler);
            removeAppStateListener('background', backgroundHandler);
          }
        }).catch(err => console.error('Error cleaning up app state listeners:', err));
      });
    }).catch(err => console.error('Error setting up app state listeners:', err));
    
    // Set up network listeners
    import('../utils/network').then(({ addNetworkListener }) => {
      if (typeof addNetworkListener !== 'function') {
        console.warn('addNetworkListener is not a function, skipping network listeners');
        return;
      }
      
      const networkHandler = (event) => {
        const { connected } = event.detail || { connected: false };
        handleNetworkStatusChange(connected);
      };
      
      addNetworkListener('connectionChange', networkHandler);
      
      cleanupFunctions.push(() => {
        import('../utils/network').then(({ removeNetworkListener }) => {
          if (typeof removeNetworkListener === 'function') {
            removeNetworkListener('connectionChange', networkHandler);
          }
        }).catch(err => console.error('Error cleaning up network listeners:', err));
      });
    }).catch(err => console.error('Error setting up network listeners:', err));
  } catch (error) {
    console.error('Error setting up application event listeners:', error);
  }
  
  // Return a function to clean up all listeners
  return () => {
    cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.error('Error during listener cleanup:', error);
      }
    });
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