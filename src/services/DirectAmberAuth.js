/**
 * DirectAmberAuth.js
 * Direct Amber authentication using only window.open without callback dependencies
 * 
 * This approach opens Amber and then asks the user to manually confirm authentication
 * since the callback system (App.addListener) is not working in the current build.
 */

import { Capacitor } from '@capacitor/core';

// Storage key for user's public key
const PUBKEY_STORAGE_KEY = 'runstr_user_pubkey';

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
      console.log('[DirectAmberAuth] Stored pubkey:', pubkey.substring(0, 8) + '...');
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
 * Check if user is logged in
 */
function isLoggedIn() {
  const pubkey = getPublicKey();
  return !!pubkey && pubkey.length === 64;
}

/**
 * Manual pubkey entry method for when callbacks don't work
 */
export function enterPubkeyManually(pubkey) {
  console.log('[DirectAmberAuth] Manual pubkey entry:', pubkey?.substring(0, 8) + '...');
  
  if (!pubkey || typeof pubkey !== 'string') {
    throw new Error('Please provide a valid public key');
  }
  
  // Remove any whitespace and ensure lowercase
  const cleanPubkey = pubkey.trim().toLowerCase();
  
  // Validate format
  if (cleanPubkey.length !== 64 || !/^[0-9a-f]+$/.test(cleanPubkey)) {
    throw new Error('Public key must be 64 hexadecimal characters');
  }
  
  storePublicKey(cleanPubkey);
  return cleanPubkey;
}

/**
 * Launch Amber directly without callback system
 */
export async function openAmberForAuth() {
  if (!isAndroid()) {
    throw new Error('Amber is only available on Android');
  }
  
  console.log('[DirectAmberAuth] Opening Amber for authentication...');
  
  try {
    // Create basic NIP-55 URL for getting public key
    // Since callbacks don't work, we'll ask user to copy their pubkey manually
    const amberUrl = 'nostrsigner:?type=get_public_key';
    
    console.log('[DirectAmberAuth] Opening Amber with:', amberUrl);
    
    // Use window.open which we know works
    window.open(amberUrl, '_system');
    
    console.log('[DirectAmberAuth] Amber should now be open. User needs to copy their public key manually.');
    
    return {
      success: true,
      message: 'Amber opened. Please copy your public key from Amber and paste it in the app.',
      requiresManualEntry: true
    };
    
  } catch (error) {
    console.error('[DirectAmberAuth] Failed to open Amber:', error);
    throw new Error('Failed to open Amber: ' + error.message);
  }
}

/**
 * Login with manual pubkey entry workflow
 */
export async function login() {
  console.log('[DirectAmberAuth] Starting direct Amber login...');
  
  // Check if already logged in
  const existingPubkey = getPublicKey();
  if (existingPubkey) {
    console.log('[DirectAmberAuth] Already logged in with pubkey:', existingPubkey.substring(0, 8) + '...');
    return existingPubkey;
  }
  
  // Open Amber and return instructions for manual entry
  const result = await openAmberForAuth();
  
  // This approach requires the UI to handle manual pubkey entry
  throw new Error('MANUAL_ENTRY_REQUIRED: Please open Amber, copy your public key, and enter it manually in the app');
}

/**
 * Simple signing approach - just open Amber with the event
 * User will need to manually confirm signing worked
 */
export async function signEvent(event) {
  if (!isAndroid()) {
    throw new Error('Amber signing is only available on Android');
  }
  
  if (!event.created_at) {
    event.created_at = Math.floor(Date.now() / 1000);
  }
  
  console.log('[DirectAmberAuth] Opening Amber for event signing...');
  
  try {
    // Create NIP-55 URL for signing
    const eventJson = encodeURIComponent(JSON.stringify(event));
    const amberUrl = `nostrsigner:${eventJson}?type=sign_event`;
    
    console.log('[DirectAmberAuth] Opening Amber for signing:', amberUrl);
    window.open(amberUrl, '_system');
    
    // Since we can't get the callback, we'll need manual confirmation
    throw new Error('MANUAL_CONFIRMATION_REQUIRED: Please confirm signing in Amber app');
    
  } catch (error) {
    console.error('[DirectAmberAuth] Signing failed:', error);
    throw error;
  }
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
  console.log('[DirectAmberAuth] Logged out');
}

/**
 * Check if Amber is available (just check if Android)
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
  isAmberInstalled,
  enterPubkeyManually,
  openAmberForAuth
};