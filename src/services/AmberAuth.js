/**
 * AmberAuth.js
 * Service for Amber authentication and signing
 */

import { Platform, Linking } from 'react-native';

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
 * @returns {Promise<string|null>} The public key if successful, null otherwise
 */
const requestAuthentication = async () => {
  if (Platform.OS !== 'android') {
    console.warn('Amber authentication is only supported on Android');
    return null;
  }
  
  try {
    // Create an authentication request event
    const authEvent = {
      kind: 22242, // Auth event kind
      created_at: Math.floor(Date.now() / 1000),
      content: 'Login to Runstr',
      tags: [['relay', 'wss://relay.damus.io']] // Example relay
    };
    
    // Convert to JSON and encode for URL
    const eventJson = JSON.stringify(authEvent);
    const encodedEvent = encodeURIComponent(eventJson);
    
    // Create the URI with the nostrsigner scheme
    const amberUri = `nostrsigner:sign?event=${encodedEvent}`;
    
    // Open Amber using the URI
    const result = await Linking.openURL(amberUri);
    
    // The actual response will be handled by deep linking
    // We'll need to set up a listener in the app to handle the response
    
    return true;
  } catch (error) {
    console.error('Error authenticating with Amber:', error);
    return null;
  }
};

/**
 * Sign an event using Amber
 * @param {Object} event - The event to sign
 * @returns {Promise<Object|null>} The signed event if successful, null otherwise
 */
const signEvent = async (event) => {
  if (Platform.OS !== 'android') {
    console.warn('Amber signing is only supported on Android');
    return null;
  }
  
  try {
    // Convert to JSON and encode for URL
    const eventJson = JSON.stringify(event);
    const encodedEvent = encodeURIComponent(eventJson);
    
    // Create the URI with the nostrsigner scheme
    const amberUri = `nostrsigner:sign?event=${encodedEvent}`;
    
    // Open Amber using the URI
    await Linking.openURL(amberUri);
    
    // The actual response will be handled by deep linking
    // We'll need to set up a listener in the app to handle the response
    
    // For now, return a placeholder. In actual implementation,
    // this function would wait for the callback from deep linking
    return null;
  } catch (error) {
    console.error('Error signing with Amber:', error);
    return null;
  }
};

/**
 * Setup deep link handling for Amber response
 * @param {Function} callback - The callback to handle the response
 */
const setupDeepLinkHandling = (callback) => {
  // Set up event listener for deep links
  const linkingListener = Linking.addEventListener('url', ({ url }) => {
    // Handle the response from Amber
    // URL format: runstr://callback?response=...
    if (url && url.startsWith('runstr://callback')) {
      // Parse the URL to get the response
      const response = url.split('response=')[1];
      
      if (response) {
        try {
          // Decode and parse the response
          const decodedResponse = decodeURIComponent(response);
          const parsedResponse = JSON.parse(decodedResponse);
          
          // Call the callback with the parsed response
          callback(parsedResponse);
        } catch (error) {
          console.error('Error parsing Amber response:', error);
          callback(null);
        }
      } else {
        console.error('No response data in callback URL');
        callback(null);
      }
    }
  });
  
  // Return function to remove the listener
  return () => {
    linkingListener.remove();
  };
};

export default {
  isAmberInstalled,
  requestAuthentication,
  signEvent,
  setupDeepLinkHandling
}; 