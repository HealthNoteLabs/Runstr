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

    // NIP-55 Web Application format for get_public_key
    const callbackUrl = encodeURIComponent(`runstr://callback?id=${id}`);
    const amberUri = `nostrsigner:?compressionType=none&returnType=signature&type=get_public_key&callbackUrl=${callbackUrl}`;
    
    console.log('[AuthService] Opening Amber with NIP-55 URI:', amberUri);
    
    try {
      // Use window.open which should trigger the intent on Android
      const result = window.open(amberUri, '_system');
      console.log('[AuthService] window.open result:', result);
      
      console.log('[AuthService] Successfully attempted to open Amber app for public key');
      
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
   * Login with Amber
   * @returns {Promise<string>} The user's public key
   */
  static async login() {
    const platform = Capacitor.getPlatform();
    
    if (platform !== 'android') {
      throw new Error('Amber authentication is only available on Android devices. Please install Amber.');
    }
    
    if (!await isAmberAvailable()) {
      throw new Error('Amber app not found. Please install Amber from https://github.com/greenart7c3/Amber and try again.');
    }
    
    // Setup deep link handling if not already done
    setupDeepLinkHandling();
    
    // Create authentication event
    const authEvent = {
      kind: 22242, // Auth event kind
      created_at: Math.floor(Date.now() / 1000),
      content: 'Login to Runstr',
      tags: [
        ['relay', 'wss://relay.damus.io'],
        ['relay', 'wss://nos.lol'],
        ['relay', 'wss://relay.nostr.band']
      ]
    };
    
    console.log('[AuthService] Starting login process...');
    
    try {
      console.log('[AuthService] Requesting public key from Amber using NIP-55 web format...');
      const response = await requestPublicKeyFromAmber();
      
      console.log('[AuthService] Received response from Amber:', response);
      
      if (!response || !response.pubkey) {
        throw new Error('No public key received from Amber');
      }
      
      // Store the public key in single location
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(PUBKEY_STORAGE_KEY, response.pubkey);
        console.log('[AuthService] Stored pubkey in localStorage');
      }
      
      console.log('[AuthService] Successfully authenticated with Amber, pubkey:', response.pubkey);
      return response.pubkey;
    } catch (error) {
      console.error('[AuthService] Login failed:', error);
      throw error;
    }
  }
  
  /**
   * Get the current user's public key
   * @returns {string|null} The public key or null if not authenticated
   */
  static getPublicKey() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    
    return window.localStorage.getItem(PUBKEY_STORAGE_KEY);
  }
  
  /**
   * Check if user is authenticated
   * @returns {boolean} True if user has a stored public key
   */
  static isAuthenticated() {
    return !!this.getPublicKey();
  }
  
  /**
   * Sign a Nostr event with Amber
   * @param {Object} event - The event to sign
   * @returns {Promise<Object>} The signed event
   */
  static async signEvent(event) {
    const platform = Capacitor.getPlatform();
    
    if (platform !== 'android') {
      throw new Error('Amber signing is only available on Android devices.');
    }
    
    if (!await isAmberAvailable()) {
      throw new Error('Amber app not found. Please install Amber and try again.');
    }
    
    // Setup deep link handling if not already done
    setupDeepLinkHandling();
    
    if (!event.created_at) {
      event.created_at = Math.floor(Date.now() / 1000);
    }
    
    try {
      const signedEvent = await signEventWithAmber(event);
      
      if (!signedEvent || !signedEvent.sig || !signedEvent.id) {
        throw new Error('Invalid signed event returned from Amber');
      }
      
      return signedEvent;
    } catch (error) {
      console.error('[AuthService] Signing failed:', error);
      throw error;
    }
  }
  
  /**
   * Logout - clear all authentication data
   */
  static logout() {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(PUBKEY_STORAGE_KEY);
    }
    
    console.log('[AuthService] User logged out');
  }
  
  /**
   * Get the storage key used for the public key (for migration purposes)
   * @returns {string} The storage key
   */
  static getStorageKey() {
    return PUBKEY_STORAGE_KEY;
  }
}