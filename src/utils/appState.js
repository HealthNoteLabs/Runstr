import { App } from '@capacitor/app';
import { isNativePlatform } from './platform';

// Create a central EventTarget for app state events
const appStateEvents = new EventTarget();

// Current app state
let isActive = true;
let lastBackgroundedTime = null;
let lastResumedTime = null;

/**
 * Initialize app lifecycle monitoring
 * Call this once during app initialization
 */
export const initAppStateMonitoring = async () => {
  try {
    // Set up app state listeners
    App.addListener('appStateChange', ({ isActive: newIsActive }) => {
      const previousState = isActive;
      isActive = newIsActive;
      
      if (newIsActive && !previousState) {
        // App came to foreground
        lastResumedTime = Date.now();
        
        // Calculate time spent in background
        const backgroundDuration = lastBackgroundedTime
          ? Math.floor((lastResumedTime - lastBackgroundedTime) / 1000)
          : 0;
        
        // Dispatch foreground event
        const event = new CustomEvent('foreground', {
          detail: {
            backgroundDuration,
            lastBackgroundedTime,
            resumeTime: lastResumedTime
          }
        });
        appStateEvents.dispatchEvent(event);
        
        // Also dispatch the generic state change event
        appStateEvents.dispatchEvent(new CustomEvent('stateChange', {
          detail: { isActive: true }
        }));
      } else if (!newIsActive && previousState) {
        // App went to background
        lastBackgroundedTime = Date.now();
        
        // Dispatch background event
        const event = new CustomEvent('background', {
          detail: {
            backgroundTime: lastBackgroundedTime
          }
        });
        appStateEvents.dispatchEvent(event);
        
        // Also dispatch the generic state change event
        appStateEvents.dispatchEvent(new CustomEvent('stateChange', {
          detail: { isActive: false }
        }));
      }
    });
    
    // Listen for back button events
    App.addListener('backButton', () => {
      const event = new CustomEvent('backButton');
      appStateEvents.dispatchEvent(event);
    });
    
    console.log('App state monitoring initialized');
    return true;
  } catch (error) {
    console.error('Error initializing app state monitoring:', error);
    
    // Fallback to web events
    if (!isNativePlatform) {
      // Document visibility state for web
      document.addEventListener('visibilitychange', () => {
        const newIsActive = !document.hidden;
        const previousState = isActive;
        isActive = newIsActive;
        
        if (newIsActive && !previousState) {
          // Page became visible
          lastResumedTime = Date.now();
          
          // Calculate time spent in background
          const backgroundDuration = lastBackgroundedTime
            ? Math.floor((lastResumedTime - lastBackgroundedTime) / 1000)
            : 0;
          
          // Dispatch foreground event
          const event = new CustomEvent('foreground', {
            detail: {
              backgroundDuration,
              lastBackgroundedTime,
              resumeTime: lastResumedTime
            }
          });
          appStateEvents.dispatchEvent(event);
          
          // Also dispatch the generic state change event
          appStateEvents.dispatchEvent(new CustomEvent('stateChange', {
            detail: { isActive: true }
          }));
        } else if (!newIsActive && previousState) {
          // Page became hidden
          lastBackgroundedTime = Date.now();
          
          // Dispatch background event
          const event = new CustomEvent('background', {
            detail: {
              backgroundTime: lastBackgroundedTime
            }
          });
          appStateEvents.dispatchEvent(event);
          
          // Also dispatch the generic state change event
          appStateEvents.dispatchEvent(new CustomEvent('stateChange', {
            detail: { isActive: false }
          }));
        }
      });
      
      // Set initial state
      isActive = !document.hidden;
    }
    
    return false;
  }
};

/**
 * Check if the app is active in the foreground
 * @returns {boolean} True if the app is active
 */
export const isAppActive = () => isActive;

/**
 * Get the time the app last went to background
 * @returns {number|null} Timestamp or null if never backgrounded
 */
export const getLastBackgroundedTime = () => lastBackgroundedTime;

/**
 * Get the time the app was last resumed
 * @returns {number|null} Timestamp or null if never resumed
 */
export const getLastResumedTime = () => lastResumedTime;

/**
 * Get the duration the app has been in the foreground (since last resume)
 * @returns {number} Duration in seconds
 */
export const getForegroundDuration = () => {
  if (!lastResumedTime) return 0;
  return Math.floor((Date.now() - lastResumedTime) / 1000);
};

/**
 * Add listener for app state events
 * @param {string} event - Event type ('stateChange', 'foreground', 'background', 'backButton')
 * @param {Function} callback - Callback function
 */
export const addAppStateListener = (event, callback) => {
  appStateEvents.addEventListener(event, callback);
};

/**
 * Remove listener for app state events
 * @param {string} event - Event type ('stateChange', 'foreground', 'background', 'backButton')
 * @param {Function} callback - Callback function
 */
export const removeAppStateListener = (event, callback) => {
  appStateEvents.removeEventListener(event, callback);
};

/**
 * Exit the app
 * Only works on native platforms
 */
export const exitApp = async () => {
  if (isNativePlatform) {
    await App.exitApp();
  } else {
    console.warn('exitApp is only available on native platforms');
  }
};

/**
 * Minimize the app
 * Only works on native platforms
 */
export const minimizeApp = async () => {
  if (isNativePlatform) {
    await App.minimizeApp();
  } else {
    console.warn('minimizeApp is only available on native platforms');
  }
};

/**
 * Get info about the app
 * @returns {Promise<Object>} App info
 */
export const getAppInfo = async () => {
  if (isNativePlatform) {
    try {
      const info = await App.getInfo();
      return info;
    } catch (error) {
      console.error('Error getting app info:', error);
      return null;
    }
  }
  
  // Fallback for web
  return {
    name: document.title,
    id: window.location.hostname,
    version: 'web',
    build: 'web'
  };
};

/**
 * Get the launch URL used to open the app (deep link)
 * @returns {Promise<Object>} Launch URL info
 */
export const getLaunchUrl = async () => {
  if (isNativePlatform) {
    try {
      const result = await App.getLaunchUrl();
      return result;
    } catch (error) {
      console.error('Error getting launch URL:', error);
      return { url: '' };
    }
  }
  
  // Fallback for web
  return { url: window.location.href };
};

/**
 * Handle custom back button behavior
 * @param {Function} callback - Callback to execute on back button press
 * @returns {Function} Function to remove the handler
 */
export const handleBackButton = (callback) => {
  const handler = (event) => {
    event.preventDefault();
    callback();
  };
  
  addAppStateListener('backButton', handler);
  
  // Return a function to remove the handler
  return () => {
    removeAppStateListener('backButton', handler);
  };
};

// Export default for ease of use
export default {
  initAppStateMonitoring,
  isAppActive,
  getLastBackgroundedTime,
  getLastResumedTime,
  getForegroundDuration,
  addAppStateListener,
  removeAppStateListener,
  exitApp,
  minimizeApp,
  getAppInfo,
  getLaunchUrl,
  handleBackButton
}; 