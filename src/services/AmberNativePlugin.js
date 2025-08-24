/**
 * AmberNativePlugin.js
 * JavaScript interface for native Android Amber integration via Capacitor plugin
 * 
 * This replaces the web-based URI approach with native Android Intents
 * that properly support NIP-55 putExtra parameters that Amber expects.
 */

import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

// Register the native plugin
const AmberPlugin = registerPlugin('AmberPlugin');

// Storage key for consistent pubkey storage
const PUBKEY_STORAGE_KEY = 'runstr_user_pubkey';

/**
 * Check if we're running on Android platform
 */
function isAndroid() {
  return Capacitor.getPlatform() === 'android';
}

/**
 * Check if Amber is installed on the device
 * @returns {Promise<boolean>}
 */
export async function isAmberInstalled() {
  if (!isAndroid()) {
    console.log('[AmberNative] Not on Android platform');
    return false;
  }
  
  try {
    const result = await AmberPlugin.isAmberInstalled();
    console.log('[AmberNative] Amber installation check:', result.installed);
    return result.installed;
  } catch (error) {
    console.error('[AmberNative] Error checking Amber installation:', error);
    return false;
  }
}

/**
 * Open Amber in the Play Store
 */
export async function openAmberInPlayStore() {
  if (!isAndroid()) {
    throw new Error('Play Store is only available on Android');
  }
  
  try {
    await AmberPlugin.openAmberInPlayStore();
    console.log('[AmberNative] Opened Amber in Play Store');
  } catch (error) {
    console.error('[AmberNative] Failed to open Play Store:', error);
    throw new Error('Failed to open Play Store: ' + error.message);
  }
}

/**
 * Get public key from Amber using native Android Intents
 * @returns {Promise<string>} The user's public key
 */
export async function getPublicKey() {
  if (!isAndroid()) {
    throw new Error('Amber authentication is only available on Android devices');
  }
  
  // Check if we already have a stored pubkey
  const existingPubkey = getCurrentPublicKey();
  if (existingPubkey) {
    console.log('[AmberNative] Using existing stored pubkey');
    return existingPubkey;
  }
  
  // Check if Amber is installed
  const amberInstalled = await isAmberInstalled();
  if (!amberInstalled) {
    throw new Error('Amber app not found. Please install Amber and try again.');
  }
  
  try {
    console.log('[AmberNative] Requesting public key from Amber using native Intent...');
    
    const result = await AmberPlugin.getPublicKey({
      requestType: 'get_public_key'
    });
    
    console.log('[AmberNative] Received result from Amber:', result);
    
    // Extract pubkey from various possible response formats
    const pubkey = result.pubkey || result.result;
    
    if (!pubkey || pubkey.length !== 64) {
      throw new Error('Invalid public key received from Amber');
    }
    
    // Store the pubkey
    storePublicKey(pubkey);
    
    console.log('[AmberNative] Successfully authenticated with pubkey:', pubkey.substring(0, 8) + '...');
    return pubkey;
    
  } catch (error) {
    console.error('[AmberNative] Public key request failed:', error);
    
    // User-friendly error messages
    if (error.message.includes('not found')) {
      throw new Error('Amber app not found. Please install Amber and try again.');
    } else if (error.message.includes('cancelled')) {
      throw new Error('Authentication was cancelled');
    } else {
      throw new Error('Authentication failed: ' + error.message);
    }
  }
}

/**
 * Sign a Nostr event using Amber
 * @param {Object} event - The event to sign
 * @returns {Promise<Object>} The signed event
 */
export async function signEvent(event) {
  if (!isAndroid()) {
    throw new Error('Amber signing is only available on Android devices');
  }
  
  // Check if Amber is installed
  const amberInstalled = await isAmberInstalled();
  if (!amberInstalled) {
    throw new Error('Amber app not found. Please install Amber and try again.');
  }
  
  // Add timestamp if missing
  if (!event.created_at) {
    event.created_at = Math.floor(Date.now() / 1000);
  }
  
  try {
    console.log('[AmberNative] Signing event with Amber using native Intent...');
    console.log('[AmberNative] Event kind:', event.kind, 'Content preview:', event.content?.substring(0, 50) + '...');
    
    const result = await AmberPlugin.signEvent({
      event: JSON.stringify(event),
      currentUser: getCurrentPublicKey() || '',
      requestType: 'sign_event'
    });
    
    console.log('[AmberNative] Received signed event from Amber:', result);
    
    // Handle different response formats
    if (result.event) {
      // Full signed event returned
      const signedEvent = typeof result.event === 'string' 
        ? JSON.parse(result.event) 
        : result.event;
      
      if (!signedEvent.sig || !signedEvent.id) {
        throw new Error('Invalid signed event received from Amber');
      }
      
      return signedEvent;
    } else if (result.signature) {
      // Only signature returned, need to construct full event
      return {
        ...event,
        sig: result.signature,
        id: result.id || event.id
      };
    } else {
      throw new Error('No signature or signed event received from Amber');
    }
    
  } catch (error) {
    console.error('[AmberNative] Event signing failed:', error);
    
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
 * Encrypt text using NIP-04 with Amber
 * @param {string} plaintext - Text to encrypt
 * @param {string} recipientPubkey - Recipient's public key
 * @returns {Promise<string>} Encrypted text
 */
export async function nip04Encrypt(plaintext, recipientPubkey) {
  if (!isAndroid()) {
    throw new Error('Amber encryption is only available on Android devices');
  }
  
  // Check if Amber is installed
  const amberInstalled = await isAmberInstalled();
  if (!amberInstalled) {
    throw new Error('Amber app not found. Please install Amber and try again.');
  }
  
  try {
    console.log('[AmberNative] Encrypting text with Amber...');
    
    const result = await AmberPlugin.encrypt({
      plaintext: plaintext,
      recipientPubkey: recipientPubkey,
      currentUser: getCurrentPublicKey() || '',
      requestType: 'nip04_encrypt'
    });
    
    const encrypted = result.result || result.encrypted;
    
    if (!encrypted) {
      throw new Error('No encrypted text received from Amber');
    }
    
    return encrypted;
    
  } catch (error) {
    console.error('[AmberNative] Encryption failed:', error);
    throw new Error('Encryption failed: ' + error.message);
  }
}

/**
 * Store public key in localStorage
 * @param {string} pubkey - The public key to store
 */
function storePublicKey(pubkey) {
  if (typeof window !== 'undefined' && window.localStorage) {
    // Store in multiple keys for compatibility
    window.localStorage.setItem(PUBKEY_STORAGE_KEY, pubkey);
    window.localStorage.setItem('userPublicKey', pubkey);
    window.localStorage.setItem('userPubkey', pubkey);
    console.log('[AmberNative] Stored pubkey in localStorage');
  }
}

/**
 * Get stored public key
 * @returns {string|null} The stored public key or null
 */
export function getCurrentPublicKey() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(PUBKEY_STORAGE_KEY) || 
           window.localStorage.getItem('userPublicKey') || 
           window.localStorage.getItem('userPubkey');
  }
  return null;
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if user has a stored public key
 */
export function isLoggedIn() {
  const pubkey = getCurrentPublicKey();
  return !!pubkey && pubkey.length === 64;
}

/**
 * Clear authentication state (logout)
 */
export function logout() {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(PUBKEY_STORAGE_KEY);
    window.localStorage.removeItem('userPublicKey');
    window.localStorage.removeItem('userPubkey');
    console.log('[AmberNative] Cleared authentication state');
  }
}

/**
 * Create a workout event for Nostr
 * @param {Object} workoutData - Workout data
 * @returns {Object} Nostr event ready for signing
 */
export function createWorkoutEvent(workoutData) {
  const { distance, duration, avgPace, activity = 'running' } = workoutData;
  
  return {
    kind: 30311, // Custom kind for workout events  
    created_at: Math.floor(Date.now() / 1000),
    content: `Completed ${activity} workout with RUNSTR 🏃`,
    tags: [
      ['d', `workout-${Date.now()}`],
      ['activity', activity],
      ['distance', distance.toString(), 'meters'],
      ['duration', duration.toString(), 'seconds'],
      ['pace', avgPace.toString(), 'min/km'],
      ['client', 'RUNSTR']
    ]
  };
}

// Export default interface matching AmberAuth.js for easy replacement
export default {
  isLoggedIn,
  getCurrentPublicKey,
  clearAuthenticationState: logout,
  signEvent,
  isAmberInstalled,
  requestAuthentication: getPublicKey,
  getPublicKey,
  nip04Encrypt,
  openAmberInPlayStore,
  createWorkoutEvent
};