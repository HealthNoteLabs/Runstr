/**
 * AmberIntentService.js
 * Proper Android Intent-based Amber integration using native Capacitor plugin
 */

import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

// Register the native plugin
const AmberIntent = registerPlugin('AmberIntent');

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
      console.log('[AmberIntentService] Stored pubkey:', pubkey.substring(0, 8) + '...');
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
 * Login with Amber using proper Android Intents
 */
export async function login() {
  console.log('[AmberIntentService] Starting Amber login with proper Intents...');
  
  if (!isAndroid()) {
    throw new Error('Amber is only available on Android');
  }
  
  // Check if already logged in
  const existingPubkey = getPublicKey();
  if (existingPubkey) {
    console.log('[AmberIntentService] Already logged in with pubkey:', existingPubkey.substring(0, 8) + '...');
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
    
    console.log('[AmberIntentService] Requesting public key from Amber with permissions:', permissions);
    
    const result = await AmberIntent.getPublicKey({
      permissions: permissions
    });
    
    console.log('[AmberIntentService] Received result from Amber:', result);
    
    if (result.pubkey) {
      // Store the pubkey and package name
      storePublicKey(result.pubkey);
      
      // Store package name for future signing
      if (result.package) {
        window.localStorage.setItem('amber_package', result.package);
      }
      
      console.log('[AmberIntentService] Successfully authenticated with pubkey:', result.pubkey.substring(0, 8) + '...');
      return result.pubkey;
    } else {
      throw new Error('No public key received from Amber');
    }
    
  } catch (error) {
    console.error('[AmberIntentService] Login failed:', error);
    
    // User-friendly error messages
    if (error.message.includes('not found') || error.message.includes('No Activity found')) {
      throw new Error('Amber app not found. Please install Amber and try again.');
    } else if (error.message.includes('cancelled')) {
      throw new Error('Authentication was cancelled');
    } else {
      throw new Error('Authentication failed: ' + error.message);
    }
  }
}

/**
 * Sign a Nostr event with Amber using proper Android Intents
 */
export async function signEvent(event) {
  if (!isAndroid()) {
    throw new Error('Amber signing is only available on Android');
  }
  
  const currentUser = getPublicKey();
  if (!currentUser) {
    throw new Error('No user logged in. Please login first.');
  }
  
  // Add timestamp if missing
  if (!event.created_at) {
    event.created_at = Math.floor(Date.now() / 1000);
  }
  
  // Ensure pubkey is set
  if (!event.pubkey) {
    event.pubkey = currentUser;
  }
  
  try {
    const eventJson = JSON.stringify(event);
    const amberPackage = window.localStorage.getItem('amber_package');
    const id = `event_${Date.now()}`;
    
    console.log('[AmberIntentService] Signing event:', event.kind, 'with ID:', id);
    
    const result = await AmberIntent.signEvent({
      event: eventJson,
      currentUser: currentUser,
      id: id,
      package: amberPackage
    });
    
    console.log('[AmberIntentService] Received signed result:', result);
    
    if (result.signedEvent) {
      // Full signed event returned
      const signedEvent = typeof result.signedEvent === 'string' 
        ? JSON.parse(result.signedEvent) 
        : result.signedEvent;
      
      if (!signedEvent.sig || !signedEvent.id) {
        throw new Error('Invalid signed event received from Amber');
      }
      
      return signedEvent;
    } else if (result.signature) {
      // Only signature returned, construct full event
      return {
        ...event,
        sig: result.signature,
        id: result.eventId || event.id
      };
    } else {
      throw new Error('No signature or signed event received from Amber');
    }
    
  } catch (error) {
    console.error('[AmberIntentService] Event signing failed:', error);
    
    // User-friendly error messages
    if (error.message.includes('not found')) {
      throw new Error('Amber app not found. Please install Amber and try again.');
    } else if (error.message.includes('cancelled')) {
      throw new Error('Signing was cancelled');
    } else {
      throw new Error('Signing failed: ' + error.message);
    }
  }
}

/**
 * Check if Amber is installed
 */
export async function isAmberInstalled() {
  if (!isAndroid()) {
    return false;
  }
  
  try {
    const result = await AmberIntent.checkAmberInstalled();
    return result.installed;
  } catch (error) {
    console.error('[AmberIntentService] Error checking Amber installation:', error);
    return false;
  }
}

/**
 * Logout - clear all authentication data
 */
export function logout() {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(PUBKEY_STORAGE_KEY);
    window.localStorage.removeItem('userPublicKey');
    window.localStorage.removeItem('userPubkey');
    window.localStorage.removeItem('amber_package');
  }
  console.log('[AmberIntentService] Logged out');
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