/**
 * AmberAuth.js
 * Service for Amber authentication and signing
 */

import { Platform, Linking, AppState } from '../utils/react-native-shim.js';

let _deepLinkListener = null;
const pendingRequests = new Map();
const REQUEST_TIMEOUT = 60000; // 60 second timeout for authentication requests
let authenticationState = { isLoggedIn: false, publicKey: null };

function processDeepLink(url) {
  if (!url || !url.startsWith('runstr://callback')) return;
  try {
    const urlObj = new URL(url);
    const id = urlObj.searchParams.get('id');
    const response = urlObj.searchParams.get('response');
    const req = id ? pendingRequests.get(id) : null;
    
    if (!req) {
      console.warn('Deep link received but no pending request found for id:', id);
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
        
        // Validate response structure
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid response format from Amber');
        }
        
        // Update authentication state if this was a pubkey request
        if (req.type === 'pubkey' && parsed.pubkey) {
          authenticationState.isLoggedIn = true;
          authenticationState.publicKey = parsed.pubkey;
        }
        
        req.resolve(parsed);
      } catch (parseError) {
        console.error('Failed to parse Amber response:', parseError);
        req.reject(new Error('Invalid response format from Amber. Please try again.'));
      }
    } else {
      req.reject(new Error('Authentication was cancelled by user or Amber encountered an error.'));
    }
    pendingRequests.delete(id);
  } catch (e) {
    console.error('Deep link processing error:', e);
    const id = new URL(url).searchParams.get('id');
    if (id && pendingRequests.has(id)) {
      const req = pendingRequests.get(id);
      if (req.timeout) clearTimeout(req.timeout);
      req.reject(new Error('Failed to process authentication response. Please try again.'));
      pendingRequests.delete(id);
    }
  }
}

const setupDeepLinkHandling = () => {
  if (_deepLinkListener) _deepLinkListener.remove();
  
  // AppState check to avoid processing initial URL multiple times
  let appState = AppState.currentState;
  if (appState === 'active') {
      Linking.getInitialURL().then(url => {
        if (url) processDeepLink(url);
      }).catch(err => console.warn('RN-Linking an error occurred', err));
  }
  
  const handleAppStateChange = (nextAppState) => {
    if (appState.match(/inactive|background/) && nextAppState === 'active') {
      // App has come to the foreground
    }
    appState = nextAppState;
  };
  
  AppState.addEventListener('change', handleAppStateChange);
  _deepLinkListener = Linking.addEventListener('url', ({ url }) => processDeepLink(url));
};

const generateSecureId = () => {
  // Use crypto.getRandomValues for secure ID generation
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(2);
    crypto.getRandomValues(array);
    return array.join('');
  }
  // Fallback for environments without crypto.getRandomValues
  return `${Date.now()}_${Math.random().toString(36).substring(2)}`;
};

const getPublicKey = () => {
  return new Promise(async (resolve, reject) => {
    if (Platform.OS !== 'android') {
      return reject(new Error('Amber authentication is only available on Android devices. Please install Amber from https://github.com/greenart7c3/Amber'));
    }
    
    const id = `pubkey_${generateSecureId()}`;
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (pendingRequests.has(id)) {
        const req = pendingRequests.get(id);
        pendingRequests.delete(id);
        req.reject(new Error('Authentication request timed out. Please ensure Amber is installed and try again.'));
      }
    }, REQUEST_TIMEOUT);
    
    pendingRequests.set(id, {
      resolve: (signedAuthEvent) => {
        clearTimeout(timeoutId);
        resolve(signedAuthEvent.pubkey);
      },
      reject: (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
      timeout: timeoutId,
      type: 'pubkey'
    });

    const authEvent = {
      kind: 22242,
      created_at: Math.floor(Date.now() / 1000),
      content: 'Login to Runstr',
      tags: [['relay', 'wss://relay.damus.io']]
    };
    const encodedEvent = encodeURIComponent(JSON.stringify(authEvent));
    const callbackUrl = encodeURIComponent(`runstr://callback?id=${id}`);
    const amberUri = `nostrsigner:sign?event=${encodedEvent}&callback=${callbackUrl}`;
    
    try {
      await Linking.openURL(amberUri);
    } catch (e) {
      clearTimeout(timeoutId);
      pendingRequests.delete(id);
      if (e.message && e.message.includes('Activity not found')) {
        reject(new Error('Amber app not found. Please install Amber from https://github.com/greenart7c3/Amber and try again.'));
      } else {
        reject(new Error('Failed to open Amber app. Please ensure Amber is installed and try again.'));
      }
    }
  });
};

const signEvent = (event) => {
  return new Promise(async (resolve, reject) => {
    if (Platform.OS !== 'android') {
      return reject(new Error('Amber signing is only available on Android devices. Please install Amber from https://github.com/greenart7c3/Amber'));
    }
    
    const id = `sign_${generateSecureId()}`;
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (pendingRequests.has(id)) {
        const req = pendingRequests.get(id);
        pendingRequests.delete(id);
        req.reject(new Error('Signing request timed out. Please ensure Amber is running and try again.'));
      }
    }, REQUEST_TIMEOUT);
    
    pendingRequests.set(id, {
      resolve: (signedEvent) => {
        clearTimeout(timeoutId);
        resolve(signedEvent);
      },
      reject: (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
      timeout: timeoutId,
      type: 'sign'
    });

    if (!event.created_at) event.created_at = Math.floor(Date.now() / 1000);
    
    const encodedEvent = encodeURIComponent(JSON.stringify(event));
    const callbackUrl = encodeURIComponent(`runstr://callback?id=${id}`);
    const amberUri = `nostrsigner:sign?event=${encodedEvent}&callback=${callbackUrl}`;
    
    try {
      await Linking.openURL(amberUri);
    } catch (e) {
      clearTimeout(timeoutId);
      pendingRequests.delete(id);
      if (e.message && e.message.includes('Activity not found')) {
        reject(new Error('Amber app not found. Please install Amber from https://github.com/greenart7c3/Amber and try again.'));
      } else {
        reject(new Error('Failed to open Amber app for signing. Please ensure Amber is installed and try again.'));
      }
    }
  });
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
    // Create an authentication request event
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
    
    // Convert to JSON and encode for URL
    const eventJson = JSON.stringify(authEvent);
    const encodedEvent = encodeURIComponent(eventJson);
    
    // Create the URI with the nostrsigner scheme and add callback URL
    const callbackUrl = encodeURIComponent('runstr://callback');
    const amberUri = `nostrsigner:sign?event=${encodedEvent}&callback=${callbackUrl}`;
    
    console.log('Opening Amber with URI:', amberUri);
    
    // Open Amber using the URI
    await Linking.openURL(amberUri);
    
    // Authentication success will be handled by deep linking callback
    return true;
  } catch (error) {
    console.error('Error authenticating with Amber:', error);
    if (error.message && error.message.includes('Activity not found')) {
      console.error('Amber app not found or not responding');
      return false;
    }
    return false;
  }
};

// Check if user is currently authenticated
const isLoggedIn = () => {
  return authenticationState.isLoggedIn && authenticationState.publicKey !== null;
};

// Get current authenticated public key
const getCurrentPublicKey = () => {
  return authenticationState.publicKey;
};

// Clear authentication state (for logout)
const clearAuthenticationState = () => {
  authenticationState.isLoggedIn = false;
  authenticationState.publicKey = null;
};

// Retry authentication with exponential backoff
const retryAuthentication = async (maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Authentication attempt ${attempt}/${maxRetries}`);
      const pubkey = await getPublicKey();
      return pubkey;
    } catch (error) {
      console.error(`Authentication attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error(`Authentication failed after ${maxRetries} attempts. ${error.message}`);
      }
      
      // Exponential backoff: wait 2^attempt seconds
      const delayMs = Math.pow(2, attempt) * 1000;
      console.log(`Waiting ${delayMs/1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
};

export default {
  isLoggedIn,
  getCurrentPublicKey,
  clearAuthenticationState,
  retryAuthentication,
  signEvent,
  isAmberInstalled,
  requestAuthentication,
  setupDeepLinkHandling,
  getPublicKey
}; 