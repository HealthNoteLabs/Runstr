/**
 * SimpleAmberService.js
 * Simplified Amber integration using existing Capacitor App plugin
 * Bypasses custom plugin compilation issues
 */

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Storage key for user's public key
const PUBKEY_STORAGE_KEY = 'runstr_user_pubkey';

/**
 * Check if we're running on Android platform
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
      console.log('[SimpleAmberService] Stored pubkey:', pubkey.substring(0, 8) + '...');
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
 * Simple Amber login using App.openUrl and deep links
 */
export async function login() {
  console.log('[SimpleAmberService] Starting simplified Amber login...');
  
  if (!isAndroid()) {
    throw new Error('Amber is only available on Android');
  }
  
  // Check if already logged in
  const existingPubkey = getPublicKey();
  if (existingPubkey) {
    console.log('[SimpleAmberService] Already logged in with pubkey:', existingPubkey.substring(0, 8) + '...');
    return existingPubkey;
  }
  
  try {
    // Create permissions array as JSON string
    const permissions = JSON.stringify([
      {
        type: "sign_event",
        kind: 1  // Regular notes
      },
      {
        type: "sign_event", 
        kind: 30311  // Workout events
      },
      {
        type: "nip04_decrypt"
      }
    ]);
    
    console.log('[SimpleAmberService] Opening Amber with permissions...');
    
    // Create the Amber URL with proper encoding
    const amberUrl = `nostrsigner:?type=get_public_key&permissions=${encodeURIComponent(permissions)}`;
    console.log('[SimpleAmberService] Amber URL:', amberUrl);
    
    // Open Amber using Capacitor App plugin
    await App.openUrl({ url: amberUrl });
    
    console.log('[SimpleAmberService] Amber opened, waiting for callback...');
    
    // In a real implementation, we would need to handle the callback
    // For now, just return a message indicating the process started
    throw new Error('Amber opened - callback handling not yet implemented in simple approach');
    
  } catch (error) {
    console.error('[SimpleAmberService] Login failed:', error);
    throw error;
  }
}

/**
 * Check if Amber is installed by attempting to open the scheme
 */
export async function isAmberInstalled() {
  if (!isAndroid()) {
    return false;
  }
  
  try {
    console.log('[SimpleAmberService] Testing if Amber is installed by opening nostrsigner:');
    
    // Try to open the nostrsigner scheme
    await App.openUrl({ url: 'nostrsigner:' });
    
    // If we get here without error, Amber is likely installed
    console.log('[SimpleAmberService] nostrsigner scheme opened successfully');
    return true;
    
  } catch (error) {
    console.log('[SimpleAmberService] Failed to open nostrsigner scheme:', error.message);
    return false;
  }
}

/**
 * Debug method to test App plugin functionality
 */
export async function debugApp() {
  try {
    console.log('[SimpleAmberService] Testing App plugin...');
    
    // Test if App plugin is available
    if (!App || !App.openUrl) {
      return { error: 'App plugin not available' };
    }
    
    console.log('[SimpleAmberService] App plugin available, testing URL opening...');
    
    // Test opening a simple URL first
    await App.openUrl({ url: 'https://example.com' });
    
    return {
      appPluginAvailable: true,
      urlOpeningWorks: true,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('[SimpleAmberService] Debug failed:', error);
    return {
      appPluginAvailable: !!App,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Export as default object matching interface
export default {
  login,
  getPublicKey,
  isAuthenticated: isLoggedIn,
  isAmberInstalled,
  debugApp
};