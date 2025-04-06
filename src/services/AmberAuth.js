/**
 * AmberAuth.js
 * Service for Amber authentication and signing
 */

import { Platform, Linking } from '../utils/react-native-shim';

// Keep track of authentication attempts
let authAttempts = 0;
const MAX_AUTH_ATTEMPTS = 3;
const AUTH_COOLDOWN_PERIOD = 60 * 1000; // 1 minute
let lastAuthAttempt = 0;

// Track pending requests
let pendingRequest = false;
let pendingRequestTimeout = null;

/**
 * Reset the auth attempts counter
 */
const resetAuthAttempts = () => {
  authAttempts = 0;
};

/**
 * Check if Amber is installed (will only work in native context)
 * @param {boolean} trustCache - Whether to trust cached results (default: true)
 * @returns {Promise<boolean>} Whether Amber is installed
 */
const isAmberInstalled = async (trustCache = true) => {
  if (Platform.OS !== 'android') return false;
  
  // If we've already established Amber isn't available, don't keep checking
  if (trustCache && localStorage.getItem('amberUnavailable') === 'true') {
    return false;
  }
  
  try {
    // This will check if the app can handle the nostrsigner: URI scheme
    const canOpen = await Linking.canOpenURL('nostrsigner:');
    
    if (!canOpen && trustCache) {
      // Cache the result so we don't keep trying
      localStorage.setItem('amberUnavailable', 'true');
    } else if (canOpen) {
      // Reset the cache in case Amber was installed after previous check
      localStorage.removeItem('amberUnavailable');
    }
    
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
  
  // Check if we're in cooldown period after multiple failed attempts
  const now = Date.now();
  if (authAttempts >= MAX_AUTH_ATTEMPTS && (now - lastAuthAttempt) < AUTH_COOLDOWN_PERIOD) {
    console.warn(`Amber auth in cooldown period. Please try again later.`);
    return false;
  }
  
  // Prevent multiple simultaneous requests
  if (pendingRequest) {
    console.warn('Another Amber request is already pending');
    return false;
  }
  
  try {
    pendingRequest = true;
    
    // Update auth attempts tracking
    authAttempts++;
    lastAuthAttempt = now;
    
    // Double-check if Amber is really available (bypass cache)
    const isAvailable = await isAmberInstalled(false);
    if (!isAvailable) {
      console.error('Amber is not actually available, but we tried to use it');
      pendingRequest = false;
      return false;
    }
    
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
    
    // Set a timeout to release the pending state if no response
    pendingRequestTimeout = setTimeout(() => {
      console.warn('Amber authentication timed out');
      pendingRequest = false;
      
      // Show a toast if we're running on Android
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Amber authentication timed out. Please try again.');
      }
    }, 30000); // 30 second timeout
    
    // Open Amber using the URI
    await Linking.openURL(amberUri);
    
    // Authentication success will be handled by deep linking callback
    return true;
  } catch (error) {
    console.error('Error authenticating with Amber:', error);
    
    // Clear the pending state
    pendingRequest = false;
    if (pendingRequestTimeout) {
      clearTimeout(pendingRequestTimeout);
      pendingRequestTimeout = null;
    }
    
    if (error.message && error.message.includes('Activity not found')) {
      console.error('Amber app not found or not responding');
      // Mark Amber as unavailable
      localStorage.setItem('amberUnavailable', 'true');
      return false;
    }
    return false;
  }
};

/**
 * Sign an event using Amber
 * @param {Object} event - The event to sign
 * @returns {Promise<Object>} Signed event or false if signing failed
 */
const signEvent = async (event) => {
  if (Platform.OS !== 'android') {
    console.warn('Amber signing is only supported on Android');
    return false;
  }
  
  // Prevent multiple simultaneous requests
  if (pendingRequest) {
    console.warn('Another Amber request is already pending');
    return false;
  }
  
  try {
    pendingRequest = true;
    
    // Make sure event has required fields
    if (!event.kind || !event.content) {
      console.error('Invalid event object for signing');
      pendingRequest = false;
      return false;
    }
    
    // Ensure created_at is set
    if (!event.created_at) {
      event.created_at = Math.floor(Date.now() / 1000);
    }
    
    // Convert to JSON and encode for URL
    const eventJson = JSON.stringify(event);
    const encodedEvent = encodeURIComponent(eventJson);
    
    // Create the URI with the nostrsigner scheme and add callback URL
    const callbackUrl = encodeURIComponent('runstr://callback');
    const amberUri = `nostrsigner:sign?event=${encodedEvent}&callback=${callbackUrl}`;
    
    console.log('Opening Amber to sign event');
    
    // Set a timeout to release the pending state if no response
    pendingRequestTimeout = setTimeout(() => {
      console.warn('Amber signing timed out');
      pendingRequest = false;
      
      // Show a toast if we're running on Android
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Amber signing timed out. Please try again.');
      }
    }, 30000); // 30 second timeout
    
    // Open Amber using the URI
    await Linking.openURL(amberUri);
    
    // Signing success will be handled by deep linking callback
    return true;
  } catch (error) {
    console.error('Error signing with Amber:', error);
    
    // Clear the pending state
    pendingRequest = false;
    if (pendingRequestTimeout) {
      clearTimeout(pendingRequestTimeout);
      pendingRequestTimeout = null;
    }
    
    if (error.message && error.message.includes('Activity not found')) {
      console.error('Amber app not found or not responding');
      // Mark Amber as unavailable
      localStorage.setItem('amberUnavailable', 'true');
      return false;
    }
    return false;
  }
};

/**
 * Setup deep link handling for Amber response
 * @param {Function} callback - The callback to handle the response
 */
const setupDeepLinkHandling = (callback) => {
  console.log('Setting up deep link handling for Amber responses');
  
  // Set up event listener for deep links
  const linkingListener = Linking.addEventListener('url', ({ url }) => {
    console.log('Received deep link URL:', url);
    
    // Handle the response from Amber
    // URL format: runstr://callback?response=...
    if (url && url.startsWith('runstr://callback')) {
      try {
        // Parse the URL to get the response
        const urlObj = new URL(url);
        const response = urlObj.searchParams.get('response');
        
        if (response) {
          try {
            // Decode and parse the response
            const decodedResponse = decodeURIComponent(response);
            const parsedResponse = JSON.parse(decodedResponse);
            
            console.log('Successfully parsed Amber response');
            
            // Clear pending state on successful response
            pendingRequest = false;
            if (pendingRequestTimeout) {
              clearTimeout(pendingRequestTimeout);
              pendingRequestTimeout = null;
            }
            
            // On successful auth, reset the attempts counter
            resetAuthAttempts();
            
            // Call the callback with the parsed response
            callback(parsedResponse);
          } catch (error) {
            console.error('Error parsing Amber response JSON:', error);
            callback(null);
          }
        } else {
          console.error('No response data in callback URL');
          callback(null);
        }
      } catch (error) {
        console.error('Error processing callback URL:', error);
        callback(null);
      }
      
      // Clear pending state if it's still set
      pendingRequest = false;
      if (pendingRequestTimeout) {
        clearTimeout(pendingRequestTimeout);
        pendingRequestTimeout = null;
      }
    }
  });
  
  // Return function to remove the listener
  return () => {
    linkingListener.remove();
  };
};

/**
 * Check if an Amber authentication is in progress
 * @returns {boolean} Whether an auth is in progress
 */
const isAuthenticationPending = () => {
  return pendingRequest;
};

export default {
  isAmberInstalled,
  requestAuthentication,
  signEvent,
  setupDeepLinkHandling,
  isAuthenticationPending,
  resetAuthAttempts
}; 