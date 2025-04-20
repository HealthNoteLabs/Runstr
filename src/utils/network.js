import { Network } from '@capacitor/network';
import { isNativePlatform } from './platform';

// Create a central EventTarget for network events
const networkEvents = new EventTarget();

// Current connection state
let isNetworkConnected = true;
let connectionType = 'unknown';

/**
 * Initialize network monitoring
 * Call this once during app initialization
 */
export const initNetworkMonitoring = async () => {
  try {
    // Get initial network status
    const initialStatus = await Network.getStatus();
    isNetworkConnected = initialStatus.connected;
    connectionType = initialStatus.connectionType;
    
    // Set up connection listeners
    Network.addListener('networkStatusChange', status => {
      isNetworkConnected = status.connected;
      connectionType = status.connectionType;
      
      // Dispatch events
      const event = new CustomEvent('connectionChange', { 
        detail: { 
          connected: status.connected, 
          connectionType: status.connectionType 
        } 
      });
      
      networkEvents.dispatchEvent(event);
      
      // Also dispatch specific events
      if (status.connected) {
        networkEvents.dispatchEvent(new Event('online'));
      } else {
        networkEvents.dispatchEvent(new Event('offline'));
      }
    });
    
    console.log('Network monitoring initialized');
  } catch (error) {
    console.error('Error initializing network monitoring:', error);
    
    // Fallback to browser events for web
    if (!isNativePlatform) {
      window.addEventListener('online', () => {
        isNetworkConnected = true;
        connectionType = 'wifi'; // Best guess
        networkEvents.dispatchEvent(new Event('online'));
        networkEvents.dispatchEvent(new CustomEvent('connectionChange', { 
          detail: { connected: true, connectionType: 'wifi' } 
        }));
      });
      
      window.addEventListener('offline', () => {
        isNetworkConnected = false;
        connectionType = 'none';
        networkEvents.dispatchEvent(new Event('offline'));
        networkEvents.dispatchEvent(new CustomEvent('connectionChange', { 
          detail: { connected: false, connectionType: 'none' } 
        }));
      });
      
      isNetworkConnected = navigator.onLine;
    }
  }
  
  return {
    connected: isNetworkConnected,
    connectionType
  };
};

/**
 * Get current network status
 * @returns {Promise<Object>} Network status
 */
export const getNetworkStatus = async () => {
  try {
    const status = await Network.getStatus();
    return status;
  } catch (error) {
    console.error('Error getting network status:', error);
    return { 
      connected: navigator.onLine, 
      connectionType: navigator.onLine ? 'wifi' : 'none'
    };
  }
};

/**
 * Check if currently connected to a network
 * @returns {boolean} True if connected
 */
export const isConnected = () => isNetworkConnected;

/**
 * Get current connection type
 * @returns {string} Connection type ('wifi', 'cellular', 'none', 'unknown')
 */
export const getConnectionType = () => connectionType;

/**
 * Check if currently on a cellular connection
 * @returns {boolean} True if on cellular
 */
export const isCellular = () => connectionType === 'cellular';

/**
 * Check if on a WiFi connection
 * @returns {boolean} True if on WiFi
 */
export const isWifi = () => connectionType === 'wifi';

/**
 * Add listener for network connection changes
 * @param {string} event - Event type ('connectionChange', 'online', 'offline')
 * @param {Function} callback - Callback function
 */
export const addNetworkListener = (event, callback) => {
  networkEvents.addEventListener(event, callback);
};

/**
 * Remove listener for network connection changes
 * @param {string} event - Event type ('connectionChange', 'online', 'offline')
 * @param {Function} callback - Callback function
 */
export const removeNetworkListener = (event, callback) => {
  networkEvents.removeEventListener(event, callback);
};

/**
 * Remove all network listeners
 */
export const removeAllNetworkListeners = () => {
  // Cannot directly remove all listeners from EventTarget
  // This is a placeholder for when we need to clean up
  console.warn('removeAllNetworkListeners: Unable to automatically remove all listeners');
};

/**
 * Perform a fetch request with network awareness
 * @param {string|Request} input - URL or Request object
 * @param {Object} options - Fetch options
 * @param {Object} networkOptions - Network-specific options
 * @param {boolean} networkOptions.requireConnection - Whether to require a connection
 * @param {number} networkOptions.timeout - Timeout in milliseconds
 * @param {number} networkOptions.retries - Number of retries
 * @param {Function} networkOptions.onRetry - Callback on retry
 * @returns {Promise<Response>} Fetch response
 */
export const networkFetch = async (input, options = {}, networkOptions = {}) => {
  const {
    requireConnection = true,
    timeout = 10000,
    retries = 3,
    onRetry = null
  } = networkOptions;
  
  // Check connection if required
  if (requireConnection && !isNetworkConnected) {
    throw new Error('No network connection available');
  }
  
  // Add timeout to fetch
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  const fetchOptions = {
    ...options,
    signal: controller.signal
  };
  
  // Handle retries
  let attempt = 0;
  let lastError;
  
  while (attempt < retries) {
    try {
      const response = await fetch(input, fetchOptions);
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error;
      attempt++;
      
      // If this was the last attempt, don't wait
      if (attempt >= retries) {
        break;
      }
      
      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt, error);
      }
      
      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      
      // Check if we're still connected before retrying
      if (requireConnection && !isNetworkConnected) {
        throw new Error('Lost network connection during fetch retries');
      }
    }
  }
  
  clearTimeout(timeoutId);
  throw lastError || new Error('Failed to fetch after retries');
};

/**
 * Determines if we should attempt a network request based on connection status and type
 * @param {Object} options - Options
 * @param {boolean} options.allowCellular - Whether to allow on cellular
 * @param {boolean} options.requireConnection - Whether to require connection
 * @returns {boolean} Whether the network request should proceed
 */
export const shouldAttemptNetworkRequest = ({ allowCellular = true, requireConnection = true } = {}) => {
  if (requireConnection && !isNetworkConnected) {
    return false;
  }
  
  if (!allowCellular && connectionType === 'cellular') {
    return false;
  }
  
  return true;
};

/**
 * Optimize network request parameters based on connection
 * @param {Object} defaultOptions - Default request options
 * @returns {Object} Optimized options
 */
export const getOptimizedNetworkOptions = (defaultOptions = {}) => {
  const options = { ...defaultOptions };
  
  // Set timeouts based on connection type
  if (connectionType === 'cellular') {
    options.timeout = options.timeout || 15000; // Longer timeout on cellular
    options.retries = options.retries || 2; // Fewer retries on cellular
  } else if (connectionType === 'wifi') {
    options.timeout = options.timeout || 10000;
    options.retries = options.retries || 3;
  } else {
    options.timeout = options.timeout || 20000; // Longest timeout when unknown
    options.retries = options.retries || 1; // Minimal retries when unknown
  }
  
  return options;
};

// Export default for ease of use
export default {
  initNetworkMonitoring,
  getNetworkStatus,
  isConnected,
  getConnectionType,
  isCellular,
  isWifi,
  addNetworkListener,
  removeNetworkListener,
  removeAllNetworkListeners,
  networkFetch,
  shouldAttemptNetworkRequest,
  getOptimizedNetworkOptions
}; 