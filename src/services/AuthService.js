/**
 * AuthService.js
 * Simplified, single-method authentication service for Amber-only authentication
 * 
 * This replaces the complex authentication system with a simple, predictable API:
 * - AuthService.login() - Authenticate with Amber
 * - AuthService.getPublicKey() - Get stored public key
 * - AuthService.signEvent() - Sign a Nostr event
 * - AuthService.logout() - Clear authentication
 * 
 * CAPACITOR VERSION - Uses Capacitor APIs for Android app communication
 */

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import AmberNative from './AmberNativePlugin.js';

// Single storage key for the user's public key
const PUBKEY_STORAGE_KEY = 'runstr_user_pubkey';

// Deep link handling - Capacitor version
let _deepLinkListener = null;
const pendingRequests = new Map();
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * Process deep link callbacks from Amber
 */
function processDeepLink(url) {
  console.log('[AuthService] Processing deep link:', url);
  
  if (!url || !url.startsWith('runstr://callback')) {
    console.log('[AuthService] URL does not match callback format');
    return;
  }
  
  try {
    const urlObj = new URL(url);
    const id = urlObj.searchParams.get('id');
    const response = urlObj.searchParams.get('response');
    const req = id ? pendingRequests.get(id) : null;
    
    console.log('[AuthService] Parsed deep link - ID:', id, 'Has response:', !!response, 'Has pending request:', !!req);
    
    if (!req) {
      console.warn('[AuthService] Deep link received but no pending request found for id:', id);
      console.warn('[AuthService] Current pending requests:', Array.from(pendingRequests.keys()));
      return;
    }

    // Clear the timeout for this request
    if (req.timeout) {
      clearTimeout(req.timeout);
    }

    if (response) {
      try {
        const decoded = decodeURIComponent(response);
        console.log('[AuthService] Decoded response:', decoded);
        
        // For NIP-55, the response might be just the result string or a JSON object
        let parsed;
        try {
          parsed = JSON.parse(decoded);
        } catch (jsonError) {
          // If it's not JSON, treat it as the direct result (common for get_public_key)
          if (req.type === 'get_public_key') {
            parsed = { pubkey: decoded };
          } else if (req.type === 'sign_event') {
            parsed = { event: decoded };
          } else {
            parsed = { result: decoded };
          }
        }
        
        console.log('[AuthService] Parsed response:', parsed);
        
        // Handle different response formats based on request type
        if (req.type === 'get_public_key') {
          // For get_public_key, result should contain the pubkey
          if (parsed.result) {
            req.resolve({ pubkey: parsed.result });
          } else if (parsed.pubkey) {
            req.resolve({ pubkey: parsed.pubkey });
          } else if (typeof parsed === 'string') {
            req.resolve({ pubkey: parsed });
          } else {
            throw new Error('No pubkey found in response');
          }
        } else if (req.type === 'sign_event') {
          // For sign_event, we expect either an event or signature
          if (parsed.event) {
            const eventObj = typeof parsed.event === 'string' ? JSON.parse(parsed.event) : parsed.event;
            req.resolve(eventObj);
          } else if (parsed.result) {
            req.resolve({ sig: parsed.result });
          } else {
            req.resolve(parsed);
          }
        } else {
          req.resolve(parsed);
        }
        
      } catch (parseError) {
        console.error('[AuthService] Failed to parse Amber response:', parseError);
        req.reject(new Error('Invalid response format from Amber. Please try again.'));
      }
    } else {
      req.reject(new Error('Authentication was cancelled by user or Amber encountered an error.'));
    }
    
    pendingRequests.delete(id);
  } catch (e) {
    console.error('[AuthService] Deep link processing error:', e);
    const urlObj = new URL(url);
    const id = urlObj.searchParams.get('id');
    if (id && pendingRequests.has(id)) {
      const req = pendingRequests.get(id);
      if (req.timeout) clearTimeout(req.timeout);
      req.reject(new Error('Failed to process authentication response. Please try again.'));
      pendingRequests.delete(id);
    }
  }
}

/**
 * Setup deep link handling for Amber callbacks - Capacitor version
 */
function setupDeepLinkHandling() {
  console.log('[AuthService] Setting up Capacitor deep link handling');
  
  // Remove existing listener if any
  if (_deepLinkListener) {
    _deepLinkListener.remove();
  }
  
  // Use Capacitor App plugin for URL handling
  _deepLinkListener = App.addListener('appUrlOpen', ({ url }) => {
    console.log('[AuthService] Received app URL open event:', url);
    processDeepLink(url);
  });
}

/**
 * Generate a secure ID for requests
 */
function generateSecureId() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(2);
    crypto.getRandomValues(array);
    return array.join('');
  }
  return `${Date.now()}_${Math.random().toString(36).substring(2)}`;
}

/**
 * Check if Amber is installed - Capacitor version
 */
async function isAmberAvailable() {
  const platform = Capacitor.getPlatform();
  console.log('[AuthService] Current platform:', platform);
  
  if (platform !== 'android') {
    console.log('[AuthService] Not on Android platform');
    return false;
  }
  
  // On Capacitor Android, we can't easily check if an app is installed
  // We'll assume Amber might be available and let the URL opening fail gracefully
  return true;
}

/**
 * Request public key from Amber using NIP-55 web application format
 */
async function requestPublicKeyFromAmber() {
  return new Promise(async (resolve, reject) => {
    const id = `pubkey_${generateSecureId()}`;
    
    console.log(`[AuthService] Creating get_public_key request with ID:`, id);
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (pendingRequests.has(id)) {
        const req = pendingRequests.get(id);
        pendingRequests.delete(id);
        console.log('[AuthService] Request timed out for ID:', id);
        req.reject(new Error('Request timed out. Please ensure Amber is installed and try again.'));
      }
    }, REQUEST_TIMEOUT);
    
    pendingRequests.set(id, {
      resolve: (response) => {
        clearTimeout(timeoutId);
        console.log('[AuthService] Request resolved for ID:', id, 'Response:', response);
        resolve(response);
      },
      reject: (error) => {
        clearTimeout(timeoutId);
        console.log('[AuthService] Request rejected for ID:', id, 'Error:', error);
        reject(error);
      },
      timeout: timeoutId,
      type: 'get_public_key'
    });

    // Try exact NIP-55 Web Application format
    // Example from docs: nostrsigner:?compressionType=none&returnType=signature&type=get_public_key&callbackUrl=https://example.com/?event=
    const callbackUrl = encodeURIComponent(`runstr://callback?id=${id}`);
    const amberUri = `nostrsigner:?compressionType=none&returnType=signature&type=get_public_key&callbackUrl=${callbackUrl}`;
    
    console.log('[AuthService] Generated URI:');
    console.log(amberUri);
    console.log('[AuthService] URI Length:', amberUri.length);
    
    // Also try without callback first to see if Amber shows anything
    const simpleUri = `nostrsigner:?type=get_public_key`;
    console.log('[AuthService] Simple URI test:', simpleUri);
    
    try {
      // First try the NIP-55 documented approach using window.href (like in the example)
      console.log('[AuthService] Trying window.location.href approach...');
      window.location.href = amberUri;
      
      console.log('[AuthService] Successfully set window.location.href to Amber URI');
      
      // If that doesn't work, also try window.open as fallback
      setTimeout(() => {
        console.log('[AuthService] Trying window.open fallback...');
        try {
          const result = window.open(amberUri, '_system');
          console.log('[AuthService] window.open result:', result);
        } catch (openError) {
          console.log('[AuthService] window.open also failed:', openError);
        }
      }, 1000);
      
    } catch (e) {
      console.error('[AuthService] Failed to open Amber app:', e);
      clearTimeout(timeoutId);
      pendingRequests.delete(id);
      reject(new Error('Failed to open Amber app. Please ensure Amber is installed and try again.'));
    }
  });
}

/**
 * Sign an event using Amber with NIP-55 web application format
 */
async function signEventWithAmber(eventTemplate) {
  return new Promise(async (resolve, reject) => {
    const id = `sign_${generateSecureId()}`;
    
    console.log(`[AuthService] Creating sign_event request with ID:`, id);
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (pendingRequests.has(id)) {
        const req = pendingRequests.get(id);
        pendingRequests.delete(id);
        console.log('[AuthService] Request timed out for ID:', id);
        req.reject(new Error('Request timed out. Please ensure Amber is installed and try again.'));
      }
    }, REQUEST_TIMEOUT);
    
    pendingRequests.set(id, {
      resolve: (response) => {
        clearTimeout(timeoutId);
        console.log('[AuthService] Request resolved for ID:', id, 'Response:', response);
        resolve(response);
      },
      reject: (error) => {
        clearTimeout(timeoutId);
        console.log('[AuthService] Request rejected for ID:', id, 'Error:', error);
        reject(error);
      },
      timeout: timeoutId,
      type: 'sign_event'
    });

    // NIP-55 Web Application format for sign_event
    const encodedEvent = encodeURIComponent(JSON.stringify(eventTemplate));
    const callbackUrl = encodeURIComponent(`runstr://callback?id=${id}`);
    const amberUri = `nostrsigner:${encodedEvent}?compressionType=none&returnType=event&type=sign_event&callbackUrl=${callbackUrl}`;
    
    console.log('[AuthService] Opening Amber for signing with NIP-55 URI:', amberUri.substring(0, 100) + '...');
    
    try {
      // Use window.open which should trigger the intent on Android
      const result = window.open(amberUri, '_system');
      console.log('[AuthService] window.open result:', result);
      
      console.log('[AuthService] Successfully attempted to open Amber app for signing');
      
    } catch (e) {
      console.error('[AuthService] Failed to open Amber app:', e);
      clearTimeout(timeoutId);
      pendingRequests.delete(id);
      reject(new Error('Failed to open Amber app. Please ensure Amber is installed and try again.'));
    }
  });
}

// Deep link handling will be initialized on first use

/**
 * AuthService - Simple, unified authentication API
 */
export default class AuthService {
  /**
   * Login with Amber using native Android Intents
   * @returns {Promise<string>} The user's public key
   */
  static async login() {
    const platform = Capacitor.getPlatform();
    
    if (platform !== 'android') {
      throw new Error('Amber authentication is only available on Android devices. Please install Amber.');
    }
    
    console.log('[AuthService] Starting native Amber login process...');
    
    try {
      // Use native plugin instead of web URI approach
      const pubkey = await AmberNative.getPublicKey();
      
      // Store the public key in single location (native plugin already does this, but ensure consistency)
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(PUBKEY_STORAGE_KEY, pubkey);
        console.log('[AuthService] Ensured pubkey stored in localStorage');
      }
      
      console.log('[AuthService] Successfully authenticated with Amber via native plugin, pubkey:', pubkey.substring(0, 8) + '...');
      return pubkey;
    } catch (error) {
      console.error('[AuthService] Native Amber login failed:', error);
      throw error;
    }
  }
  
  /**
   * Get the current user's public key
   * @returns {string|null} The public key or null if not authenticated
   */
  static getPublicKey() {
    return AmberNative.getCurrentPublicKey();
  }
  
  /**
   * Check if user is authenticated
   * @returns {boolean} True if user has a stored public key
   */
  static isAuthenticated() {
    return AmberNative.isLoggedIn();
  }
  
  /**
   * Sign a Nostr event with Amber using native Android Intents
   * @param {Object} event - The event to sign
   * @returns {Promise<Object>} The signed event
   */
  static async signEvent(event) {
    const platform = Capacitor.getPlatform();
    
    if (platform !== 'android') {
      throw new Error('Amber signing is only available on Android devices.');
    }
    
    console.log('[AuthService] Signing event with native Amber plugin...');
    
    try {
      // Use native plugin instead of web URI approach
      const signedEvent = await AmberNative.signEvent(event);
      
      if (!signedEvent || !signedEvent.sig || !signedEvent.id) {
        throw new Error('Invalid signed event returned from Amber');
      }
      
      console.log('[AuthService] Successfully signed event via native plugin');
      return signedEvent;
    } catch (error) {
      console.error('[AuthService] Native Amber signing failed:', error);
      throw error;
    }
  }
  
  /**
   * Logout - clear all authentication data
   */
  static logout() {
    AmberNative.logout();
    console.log('[AuthService] User logged out via native plugin');
  }
  
  /**
   * Get the storage key used for the public key (for migration purposes)
   * @returns {string} The storage key
   */
  static getStorageKey() {
    return PUBKEY_STORAGE_KEY;
  }
}