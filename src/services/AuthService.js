/**
 * AuthService.js
 * Simplified, single-method authentication service for Amber-only authentication
 * 
 * This replaces the complex authentication system with a simple, predictable API:
 * - AuthService.login() - Authenticate with Amber
 * - AuthService.getPublicKey() - Get stored public key
 * - AuthService.signEvent() - Sign a Nostr event
 * - AuthService.logout() - Clear authentication
 */

import { Platform, Linking, AppState } from '../utils/react-native-shim.js';

// Single storage key for the user's public key
const PUBKEY_STORAGE_KEY = 'runstr_user_pubkey';

// Deep link handling
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
        const parsed = JSON.parse(decoded);
        
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid response format from Amber');
        }
        
        req.resolve(parsed);
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
    const id = new URL(url).searchParams.get('id');
    if (id && pendingRequests.has(id)) {
      const req = pendingRequests.get(id);
      if (req.timeout) clearTimeout(req.timeout);
      req.reject(new Error('Failed to process authentication response. Please try again.'));
      pendingRequests.delete(id);
    }
  }
}

/**
 * Setup deep link handling for Amber callbacks
 */
function setupDeepLinkHandling() {
  if (_deepLinkListener) _deepLinkListener.remove();
  
  let appState = AppState.currentState;
  if (appState === 'active') {
    Linking.getInitialURL().then(url => {
      if (url) processDeepLink(url);
    }).catch(err => console.warn('[AuthService] Linking error:', err));
  }
  
  const handleAppStateChange = (nextAppState) => {
    appState = nextAppState;
  };
  
  AppState.addEventListener('change', handleAppStateChange);
  _deepLinkListener = Linking.addEventListener('url', ({ url }) => processDeepLink(url));
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
 * Check if Amber is installed
 */
async function isAmberAvailable() {
  if (Platform.OS !== 'android') return false;
  
  try {
    const canOpen = await Linking.canOpenURL('nostrsigner:');
    return canOpen;
  } catch (error) {
    console.error('[AuthService] Error checking if Amber is installed:', error);
    return false;
  }
}

/**
 * Communicate with Amber app
 */
async function requestFromAmber(eventTemplate, type = 'sign') {
  return new Promise(async (resolve, reject) => {
    const id = `${type}_${generateSecureId()}`;
    
    console.log(`[AuthService] Creating ${type} request with ID:`, id);
    
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
      type
    });

    const encodedEvent = encodeURIComponent(JSON.stringify(eventTemplate));
    const callbackUrl = encodeURIComponent(`runstr://callback?id=${id}`);
    const amberUri = `nostrsigner:sign?event=${encodedEvent}&callback=${callbackUrl}`;
    
    console.log('[AuthService] Opening Amber with URI:', amberUri.substring(0, 100) + '...');
    
    try {
      await Linking.openURL(amberUri);
      console.log('[AuthService] Successfully opened Amber app');
    } catch (e) {
      console.error('[AuthService] Failed to open Amber app:', e);
      clearTimeout(timeoutId);
      pendingRequests.delete(id);
      if (e.message && e.message.includes('Activity not found')) {
        reject(new Error('Amber app not found. Please install Amber from https://github.com/greenart7c3/Amber and try again.'));
      } else {
        reject(new Error('Failed to open Amber app. Please ensure Amber is installed and try again.'));
      }
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
    if (Platform.OS !== 'android') {
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
      console.log('[AuthService] Sending authentication request to Amber...');
      const response = await requestFromAmber(authEvent, 'auth');
      
      console.log('[AuthService] Received response from Amber:', response);
      
      if (!response.pubkey) {
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
    if (Platform.OS !== 'android') {
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
      const signedEvent = await requestFromAmber(event, 'sign');
      
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