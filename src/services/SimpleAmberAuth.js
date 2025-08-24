/**
 * SimpleAmberAuth.js
 * Simplified Amber authentication using only Capacitor's built-in App plugin
 * 
 * This follows the pattern used by Amethyst - simple Intent launching
 * without complex native plugins or deep link handling.
 */

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

// Storage key for user's public key
const PUBKEY_STORAGE_KEY = 'runstr_user_pubkey';

// Simple pending request tracking
let pendingRequest = null;
let appUrlListener = null;

/**
 * Check if we're on Android
 */
function isAndroid() {
  return Capacitor.getPlatform() === 'android';
}

/**
 * Setup URL listener for Amber callbacks
 */
function setupUrlListener() {
  if (appUrlListener) {
    appUrlListener.remove();
  }
  
  appUrlListener = App.addListener('appUrlOpen', (event) => {
    console.log('[SimpleAmberAuth] Received URL:', event.url);
    
    if (event.url && event.url.startsWith('runstr://callback') && pendingRequest) {
      try {
        const url = new URL(event.url);
        const result = url.searchParams.get('result');
        const error = url.searchParams.get('error');
        
        if (error) {
          pendingRequest.reject(new Error('Amber error: ' + error));
        } else if (result) {
          // Amber returns the pubkey directly in result
          storePublicKey(result);
          pendingRequest.resolve(result);
        } else {
          pendingRequest.reject(new Error('No result from Amber'));
        }
        
        pendingRequest = null;
      } catch (err) {
        console.error('[SimpleAmberAuth] URL parsing error:', err);
        if (pendingRequest) {
          pendingRequest.reject(new Error('Failed to parse Amber response'));
          pendingRequest = null;
        }
      }
    }
  });
}

/**
 * Launch Amber with simple Intent approach (like Amethyst does)
 */
async function launchAmber() {
  if (!isAndroid()) {
    throw new Error('Amber is only available on Android');
  }
  
  // Setup URL listener
  setupUrlListener();
  
  return new Promise((resolve, reject) => {
    // Set pending request
    pendingRequest = { resolve, reject };
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequest) {
        pendingRequest.reject(new Error('Amber request timed out'));
        pendingRequest = null;
      }
    }, 30000);
    
    // Create simple nostrsigner URI (like Amethyst)
    const amberUrl = `nostrsigner:?type=get_public_key&callbackUrl=${encodeURIComponent('runstr://callback')}`;
    
    console.log('[SimpleAmberAuth] Launching Amber with URL:', amberUrl);
    
    // Use Capacitor's built-in way to open URLs
    // This will trigger Android Intent system
    window.open(amberUrl, '_system');
  });
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
      console.log('[SimpleAmberAuth] Stored pubkey:', pubkey.substring(0, 8) + '...');
    } else {
      throw new Error('Invalid pubkey format received from Amber');
    }
  }
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
 * Check if user is logged in
 */
function isLoggedIn() {
  const pubkey = getPublicKey();
  return !!pubkey && pubkey.length === 64;
}

/**
 * Login with Amber (main function)
 */
export async function login() {
  console.log('[SimpleAmberAuth] Starting Amber login...');
  
  // Check if already logged in
  const existingPubkey = getPublicKey();
  if (existingPubkey) {
    console.log('[SimpleAmberAuth] Already logged in with pubkey:', existingPubkey.substring(0, 8) + '...');
    return existingPubkey;
  }
  
  // Launch Amber
  try {
    const pubkey = await launchAmber();
    console.log('[SimpleAmberAuth] Successfully got pubkey from Amber:', pubkey.substring(0, 8) + '...');
    return pubkey;
  } catch (error) {
    console.error('[SimpleAmberAuth] Login failed:', error);
    throw error;
  }
}

/**
 * Sign event with Amber (simplified)
 */
export async function signEvent(event) {
  if (!isAndroid()) {
    throw new Error('Amber signing is only available on Android');
  }
  
  if (!event.created_at) {
    event.created_at = Math.floor(Date.now() / 1000);
  }
  
  return new Promise((resolve, reject) => {
    // Set pending request for signing
    pendingRequest = { resolve, reject };
    
    // Timeout
    setTimeout(() => {
      if (pendingRequest) {
        pendingRequest.reject(new Error('Signing request timed out'));
        pendingRequest = null;
      }
    }, 30000);
    
    // Create signing URL
    const eventJson = JSON.stringify(event);
    const amberUrl = `nostrsigner:${encodeURIComponent(eventJson)}?type=sign_event&callbackUrl=${encodeURIComponent('runstr://callback')}`;
    
    console.log('[SimpleAmberAuth] Launching Amber for signing...');
    window.open(amberUrl, '_system');
  });
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
  console.log('[SimpleAmberAuth] Logged out');
}

/**
 * Check if Amber might be available (simple check)
 */
export async function isAmberAvailable() {
  // On web, we can't really check, so assume it might be available on Android
  return isAndroid();
}

// Export as default object matching AuthService interface
export default {
  login,
  getPublicKey,
  isAuthenticated: isLoggedIn,
  signEvent,
  logout,
  isAmberInstalled: isAmberAvailable
};