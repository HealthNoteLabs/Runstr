/**
 * NativeAmberAuth.js
 * Amber authentication using native Android deep link handling
 * 
 * This approach uses the MainActivity's deep link handler to receive
 * callbacks from Amber, bypassing the broken Capacitor App.addListener
 */

import { Capacitor } from '@capacitor/core';

// Storage key for user's public key
const PUBKEY_STORAGE_KEY = 'runstr_user_pubkey';

// Track pending authentication request
let pendingAuthResolve = null;
let pendingAuthReject = null;
let authTimeout = null;

/**
 * Check if we're on Android
 */
function isAndroid() {
  return Capacitor.getPlatform() === 'android';
}

/**
 * Store public key in localStorage
 */
function storePublicKey(pubkey) {
  if (typeof window !== 'undefined' && window.localStorage) {
    // Validate pubkey format (should be 64 character hex)
    if (pubkey && pubkey.length === 64 && /^[0-9a-f]+$/i.test(pubkey)) {
      window.localStorage.setItem(PUBKEY_STORAGE_KEY, pubkey);
      window.localStorage.setItem('userPublicKey', pubkey); // Compatibility
      window.localStorage.setItem('userPubkey', pubkey); // Compatibility
      console.log('[NativeAmberAuth] Stored pubkey:', pubkey.substring(0, 8) + '...');
      return true;
    } else {
      throw new Error('Invalid pubkey format received from Amber');
    }
  }
  return false;
}

/**
 * Get stored public key
 */
function getPublicKey() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(PUBKEY_STORAGE_KEY) || 
           window.localStorage.getItem('userPublicKey') || 
           window.localStorage.getItem('userPubkey');
  }
  return null;
}

/**
 * Setup listener for native callbacks
 */
function setupNativeListener() {
  if (typeof window === 'undefined') return;
  
  // Remove any existing listener
  if (window.amberCallbackHandler) {
    window.removeEventListener('amberCallback', window.amberCallbackHandler);
  }
  
  // Create new handler
  window.amberCallbackHandler = (event) => {
    console.log('[NativeAmberAuth] Received native callback:', event);
    
    try {
      // Parse the data from the native layer
      let data;
      if (event.detail) {
        data = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
      } else {
        // Fallback for different event structures
        data = event;
      }
      
      console.log('[NativeAmberAuth] Parsed callback data:', data);
      
      // Clear timeout
      if (authTimeout) {
        clearTimeout(authTimeout);
        authTimeout = null;
      }
      
      // Handle the callback
      if (data.error) {
        // Error from Amber
        if (pendingAuthReject) {
          pendingAuthReject(new Error('Amber error: ' + data.error));
          pendingAuthReject = null;
          pendingAuthResolve = null;
        }
      } else if (data.result) {
        // Got public key directly
        console.log('[NativeAmberAuth] Received pubkey:', data.result);
        storePublicKey(data.result);
        
        if (pendingAuthResolve) {
          pendingAuthResolve(data.result);
          pendingAuthResolve = null;
          pendingAuthReject = null;
        }
      } else if (data.event) {
        // Got event data, extract pubkey
        try {
          const eventData = JSON.parse(decodeURIComponent(data.event));
          if (eventData.pubkey) {
            console.log('[NativeAmberAuth] Extracted pubkey from event:', eventData.pubkey);
            storePublicKey(eventData.pubkey);
            
            if (pendingAuthResolve) {
              pendingAuthResolve(eventData.pubkey);
              pendingAuthResolve = null;
              pendingAuthReject = null;
            }
          }
        } catch (parseErr) {
          console.error('[NativeAmberAuth] Failed to parse event data:', parseErr);
          if (pendingAuthReject) {
            pendingAuthReject(new Error('Failed to parse event data'));
            pendingAuthReject = null;
            pendingAuthResolve = null;
          }
        }
      } else if (data.signature) {
        // Got signature (for future signing support)
        console.log('[NativeAmberAuth] Received signature:', data.signature);
        if (pendingAuthResolve) {
          pendingAuthResolve(data.signature);
          pendingAuthResolve = null;
          pendingAuthReject = null;
        }
      }
    } catch (error) {
      console.error('[NativeAmberAuth] Error handling callback:', error);
      if (pendingAuthReject) {
        pendingAuthReject(error);
        pendingAuthReject = null;
        pendingAuthResolve = null;
      }
    }
  };
  
  // Listen for the custom event from native layer
  window.addEventListener('amberCallback', window.amberCallbackHandler);
  console.log('[NativeAmberAuth] Native listener setup complete');
}

/**
 * Login with Amber using native deep link handling
 */
export async function login() {
  console.log('[NativeAmberAuth] Starting native Amber login...');
  
  if (!isAndroid()) {
    throw new Error('Amber is only available on Android');
  }
  
  // Check if already logged in
  const existingPubkey = getPublicKey();
  if (existingPubkey) {
    console.log('[NativeAmberAuth] Already logged in with pubkey:', existingPubkey.substring(0, 8) + '...');
    return existingPubkey;
  }
  
  // Setup native listener
  setupNativeListener();
  
  return new Promise((resolve, reject) => {
    // Store resolve/reject for callback
    pendingAuthResolve = resolve;
    pendingAuthReject = reject;
    
    // Set timeout
    authTimeout = setTimeout(() => {
      console.log('[NativeAmberAuth] Authentication timed out');
      pendingAuthReject = reject;
      pendingAuthResolve = null;
      reject(new Error('Amber authentication timed out after 30 seconds'));
    }, 30000);
    
    try {
      // Create proper NIP-55 URL with callback
      const callbackUrl = encodeURIComponent('runstr://callback');
      const permissions = JSON.stringify([
        {
          type: "sign_event",
          kind: 1  // Regular notes
        },
        {
          type: "sign_event", 
          kind: 31923  // Run activities
        },
        {
          type: "sign_event",
          kind: 1301  // Live activities
        },
        {
          type: "nip04_decrypt"
        }
      ]);
      
      // Build the Amber URL
      const amberUrl = `nostrsigner:?type=get_public_key&permissions=${encodeURIComponent(permissions)}&callbackUrl=${callbackUrl}`;
      
      console.log('[NativeAmberAuth] Opening Amber with URL:', amberUrl);
      
      // Open Amber
      window.open(amberUrl, '_system');
      
      console.log('[NativeAmberAuth] Waiting for callback from Amber...');
    } catch (error) {
      console.error('[NativeAmberAuth] Failed to open Amber:', error);
      clearTimeout(authTimeout);
      pendingAuthReject = null;
      pendingAuthResolve = null;
      reject(error);
    }
  });
}

/**
 * Sign event with Amber
 */
export async function signEvent(event) {
  if (!isAndroid()) {
    throw new Error('Amber signing is only available on Android');
  }
  
  if (!event.created_at) {
    event.created_at = Math.floor(Date.now() / 1000);
  }
  
  // Setup native listener
  setupNativeListener();
  
  return new Promise((resolve, reject) => {
    // Store resolve/reject for callback
    pendingAuthResolve = resolve;
    pendingAuthReject = reject;
    
    // Set timeout
    authTimeout = setTimeout(() => {
      console.log('[NativeAmberAuth] Signing timed out');
      pendingAuthReject = reject;
      pendingAuthResolve = null;
      reject(new Error('Signing timed out after 30 seconds'));
    }, 30000);
    
    try {
      // Create signing URL
      const eventJson = encodeURIComponent(JSON.stringify(event));
      const callbackUrl = encodeURIComponent('runstr://callback');
      const amberUrl = `nostrsigner:${eventJson}?type=sign_event&callbackUrl=${callbackUrl}`;
      
      console.log('[NativeAmberAuth] Opening Amber for signing...');
      window.open(amberUrl, '_system');
      
    } catch (error) {
      console.error('[NativeAmberAuth] Failed to open Amber for signing:', error);
      clearTimeout(authTimeout);
      pendingAuthReject = null;
      pendingAuthResolve = null;
      reject(error);
    }
  });
}

/**
 * Check if user is logged in
 */
function isLoggedIn() {
  const pubkey = getPublicKey();
  return !!pubkey && pubkey.length === 64;
}

/**
 * Logout
 */
export function logout() {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(PUBKEY_STORAGE_KEY);
    window.localStorage.removeItem('userPublicKey');
    window.localStorage.removeItem('userPubkey');
  }
  
  // Clear any pending auth
  if (authTimeout) {
    clearTimeout(authTimeout);
    authTimeout = null;
  }
  pendingAuthResolve = null;
  pendingAuthReject = null;
  
  console.log('[NativeAmberAuth] Logged out');
}

/**
 * Check if Amber is available
 */
export async function isAmberInstalled() {
  return isAndroid();
}

// Export as default object matching AuthService interface
export default {
  login,
  getPublicKey,
  isAuthenticated: isLoggedIn,
  signEvent,
  logout,
  isAmberInstalled
};