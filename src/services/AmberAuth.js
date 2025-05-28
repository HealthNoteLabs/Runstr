/**
 * AmberAuth.js
 * Service for Amber authentication and signing
 */

import { Platform, Linking } from '../utils/react-native-shim.js';

// Connection state management
let amberConnectionState = {
  isConnected: false,
  lastActivity: null,
  pubkey: null,
  connectionId: null
};

// Store pending callbacks for sign operations
const pendingCallbacks = new Map();

// Generate unique ID for tracking requests
const generateRequestId = () => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Check if Amber is installed (will only work in native context)
const isAmberInstalled = async () => {
  if (Platform.OS !== 'android') return false;
  
  try {
    // This will check if the app can handle the nostrsigner: URI scheme
    const canOpen = await Linking.canOpenURL('nostrsigner:');
    return canOpen;
  } catch (error) {
    console.error('Error checking if Amber is installed:', error);
    return false;
  }
};

/**
 * Check if Amber connection is still valid
 * @returns {boolean} Connection validity
 */
const isConnectionValid = () => {
  // Consider connection invalid if no activity for more than 5 minutes
  const MAX_IDLE_TIME = 5 * 60 * 1000; // 5 minutes
  
  if (!amberConnectionState.isConnected || !amberConnectionState.lastActivity) {
    return false;
  }
  
  const timeSinceLastActivity = Date.now() - amberConnectionState.lastActivity;
  return timeSinceLastActivity < MAX_IDLE_TIME;
};

/**
 * Reset connection state
 */
const resetConnection = () => {
  console.log('[AmberAuth] Resetting connection state');
  amberConnectionState = {
    isConnected: false,
    lastActivity: null,
    pubkey: null,
    connectionId: null
  };
  
  // Clear any pending callbacks
  pendingCallbacks.clear();
  
  // Clear stored Amber data
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('amberPubkey');
    localStorage.removeItem('amberConnectionId');
  }
};

/**
 * Request authentication using Amber
 * This will open Amber and prompt the user for authentication
 * @returns {Promise<boolean>} Success status
 */
const requestAuthentication = async () => {
  if (Platform.OS !== 'android') {
    console.warn('Amber authentication is only supported on Android');
    return false;
  }
  
  try {
    // Reset connection if it's stale
    if (!isConnectionValid()) {
      resetConnection();
    }
    
    // Generate a unique request ID
    const requestId = generateRequestId();
    amberConnectionState.connectionId = requestId;
    
    // Create an authentication request event
    const authEvent = {
      kind: 22242, // Auth event kind
      created_at: Math.floor(Date.now() / 1000),
      content: 'Login to Runstr',
      tags: [
        ['relay', 'wss://relay.damus.io'],
        ['relay', 'wss://nos.lol'],
        ['relay', 'wss://relay.nostr.band'],
        ['app', 'Runstr'],
        ['request_id', requestId]
      ]
    };
    
    // Convert to JSON and encode for URL
    const eventJson = JSON.stringify(authEvent);
    const encodedEvent = encodeURIComponent(eventJson);
    
    // Create the URI with the nostrsigner scheme and add callback URL
    const callbackUrl = encodeURIComponent('runstr://callback');
    const amberUri = `nostrsigner:sign?event=${encodedEvent}&callback=${callbackUrl}&return_to=${callbackUrl}`;
    
    console.log('[AmberAuth] Opening Amber for authentication with request ID:', requestId);
    
    // Create a promise that will resolve when we get the callback
    const authPromise = new Promise((resolve, reject) => {
      pendingCallbacks.set(requestId, { resolve, reject, type: 'auth' });
      
      // Set a timeout for the authentication
      setTimeout(() => {
        if (pendingCallbacks.has(requestId)) {
          pendingCallbacks.delete(requestId);
          reject(new Error('Authentication timeout'));
        }
      }, 60000); // 60 second timeout
    });
    
    // Open Amber using the URI
    await Linking.openURL(amberUri);
    
    // Wait for the authentication to complete
    return authPromise;
  } catch (error) {
    console.error('[AmberAuth] Error authenticating with Amber:', error);
    if (error.message && error.message.includes('Activity not found')) {
      console.error('[AmberAuth] Amber app not found or not responding');
      return false;
    }
    return false;
  }
};

/**
 * Sign an event using Amber
 * @param {Object} event - The event to sign
 * @returns {Promise<Object>} Signed event
 */
const signEvent = async (event) => {
  if (Platform.OS !== 'android') {
    console.warn('Amber signing is only supported on Android');
    return null;
  }
  
  try {
    // Check if connection is valid, prompt for re-authentication if not
    if (!isConnectionValid()) {
      console.log('[AmberAuth] Connection invalid, requesting re-authentication');
      const reauth = await requestAuthentication();
      if (!reauth) {
        throw new Error('Re-authentication failed');
      }
    }
    
    // Make sure event has required fields
    if (!event.kind || event.content === undefined) {
      console.error('[AmberAuth] Invalid event object for signing');
      return null;
    }
    
    // Ensure created_at is set
    if (!event.created_at) {
      event.created_at = Math.floor(Date.now() / 1000);
    }
    
    // Generate a unique request ID
    const requestId = generateRequestId();
    
    // Add request ID to event tags for tracking
    if (!event.tags) event.tags = [];
    event.tags.push(['request_id', requestId]);
    
    // Convert to JSON and encode for URL
    const eventJson = JSON.stringify(event);
    const encodedEvent = encodeURIComponent(eventJson);
    
    // Create the URI with the nostrsigner scheme and add callback URL
    const callbackUrl = encodeURIComponent('runstr://callback');
    const amberUri = `nostrsigner:sign?event=${encodedEvent}&callback=${callbackUrl}&return_to=${callbackUrl}`;
    
    console.log('[AmberAuth] Opening Amber to sign event with request ID:', requestId);
    
    // Create a promise that will resolve when we get the callback
    const signPromise = new Promise((resolve, reject) => {
      pendingCallbacks.set(requestId, { resolve, reject, type: 'sign', originalEvent: event });
      
      // Set a timeout for the signing
      setTimeout(() => {
        if (pendingCallbacks.has(requestId)) {
          pendingCallbacks.delete(requestId);
          reject(new Error('Signing timeout'));
        }
      }, 30000); // 30 second timeout
    });
    
    // Open Amber using the URI
    await Linking.openURL(amberUri);
    
    // Wait for the signing to complete
    return signPromise;
  } catch (error) {
    console.error('[AmberAuth] Error signing with Amber:', error);
    if (error.message && error.message.includes('Activity not found')) {
      console.error('[AmberAuth] Amber app not found or not responding');
      
      // Reset connection on critical errors
      resetConnection();
    }
    return null;
  }
};

/**
 * Setup deep link handling for Amber response
 * @param {Function} callback - The callback to handle the response
 */
const setupDeepLinkHandling = (callback) => {
  console.log('[AmberAuth] Setting up deep link handling for Amber responses');
  
  // Set up event listener for deep links
  const linkingListener = Linking.addEventListener('url', ({ url }) => {
    console.log('[AmberAuth] Received deep link URL:', url);
    
    // Handle the response from Amber
    // URL format: runstr://callback?response=...
    if (url && url.startsWith('runstr://callback')) {
      try {
        // Update last activity
        amberConnectionState.lastActivity = Date.now();
        
        // Parse the URL to get the response
        const urlObj = new URL(url);
        const response = urlObj.searchParams.get('response');
        const error = urlObj.searchParams.get('error');
        
        if (error) {
          console.error('[AmberAuth] Amber returned error:', error);
          
          // Handle specific error cases
          if (error.includes('permission') || error.includes('denied')) {
            resetConnection();
          }
          
          // Call error callbacks
          pendingCallbacks.forEach((cb, id) => {
            cb.reject(new Error(error));
            pendingCallbacks.delete(id);
          });
          
          callback({ error });
          return;
        }
        
        if (response) {
          try {
            // Decode and parse the response
            const decodedResponse = decodeURIComponent(response);
            const parsedResponse = JSON.parse(decodedResponse);
            
            console.log('[AmberAuth] Successfully parsed Amber response');
            
            // Extract request ID if present
            const requestId = parsedResponse.tags?.find(tag => tag[0] === 'request_id')?.[1];
            
            // Handle authentication response
            if (parsedResponse.pubkey && !parsedResponse.sig) {
              amberConnectionState.isConnected = true;
              amberConnectionState.pubkey = parsedResponse.pubkey;
              
              // Store in localStorage for persistence
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('amberPubkey', parsedResponse.pubkey);
                localStorage.setItem('amberConnectionId', amberConnectionState.connectionId);
              }
              
              // Resolve pending auth callback
              if (requestId && pendingCallbacks.has(requestId)) {
                const cb = pendingCallbacks.get(requestId);
                if (cb.type === 'auth') {
                  cb.resolve(true);
                  pendingCallbacks.delete(requestId);
                }
              }
            }
            
            // Handle signed event response
            if (parsedResponse.sig) {
              // Resolve pending sign callback
              if (requestId && pendingCallbacks.has(requestId)) {
                const cb = pendingCallbacks.get(requestId);
                if (cb.type === 'sign') {
                  // Merge the signature into the original event
                  const signedEvent = { ...cb.originalEvent, ...parsedResponse };
                  cb.resolve(signedEvent);
                  pendingCallbacks.delete(requestId);
                }
              }
            }
            
            // Call the general callback
            callback(parsedResponse);
          } catch (error) {
            console.error('[AmberAuth] Error parsing Amber response JSON:', error);
            
            // Reject all pending callbacks
            pendingCallbacks.forEach((cb, id) => {
              cb.reject(error);
              pendingCallbacks.delete(id);
            });
            
            callback(null);
          }
        } else {
          console.error('[AmberAuth] No response data in callback URL');
          callback(null);
        }
      } catch (error) {
        console.error('[AmberAuth] Error processing callback URL:', error);
        
        // Reject all pending callbacks
        pendingCallbacks.forEach((cb, id) => {
          cb.reject(error);
          pendingCallbacks.delete(id);
        });
        
        callback(null);
      }
    }
  });
  
  // Return function to remove the listener
  return () => {
    linkingListener.remove();
  };
};

/**
 * Get current Amber connection state
 */
const getConnectionState = () => {
  return {
    ...amberConnectionState,
    isValid: isConnectionValid()
  };
};

/**
 * Restore connection from stored data
 */
const restoreConnection = () => {
  if (typeof localStorage !== 'undefined') {
    const storedPubkey = localStorage.getItem('amberPubkey');
    const storedConnectionId = localStorage.getItem('amberConnectionId');
    
    if (storedPubkey && storedConnectionId) {
      amberConnectionState.pubkey = storedPubkey;
      amberConnectionState.connectionId = storedConnectionId;
      amberConnectionState.isConnected = true;
      amberConnectionState.lastActivity = Date.now();
      
      console.log('[AmberAuth] Restored connection from storage');
      return true;
    }
  }
  return false;
};

// Simple stub of AmberAuth for diagnostic scripts running outside the mobile app.
export default {
  isLoggedIn: () => amberConnectionState.isConnected && isConnectionValid(),
  signEvent,
  isAmberInstalled,
  requestAuthentication,
  setupDeepLinkHandling,
  resetConnection,
  getConnectionState,
  restoreConnection
}; 