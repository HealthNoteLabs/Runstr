/**
 * AmberAuth.js
 * Service for Amber authentication and signing
 */

import { Platform, Linking } from '../utils/react-native-shim';

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
    console.warn('AmberAuth: Authentication is only supported on Android');
    return false;
  }
  
  try {
    // First check if Amber is installed
    const installed = await isAmberInstalled();
    if (!installed) {
      console.error('AmberAuth: Amber app is not installed');
      return false;
    }
    
    // Create an authentication request event
    const authEvent = {
      kind: 22242, // Auth event kind
      created_at: Math.floor(Date.now() / 1000),
      content: 'Login to RUNSTR app',
      tags: [
        ['relay', 'wss://relay.damus.io'],
        ['relay', 'wss://nos.lol'],
        ['relay', 'wss://relay.nostr.band'],
        ['application', 'RUNSTR'],
        ['challenge', Math.random().toString(36).substring(2, 15)]
      ]
    };
    
    // Convert to JSON and encode for URL
    const eventJson = JSON.stringify(authEvent);
    const encodedEvent = encodeURIComponent(eventJson);
    
    // Create the URI with the nostrsigner scheme and add callback URL
    const callbackUrl = encodeURIComponent('runstr://callback');
    const amberUri = `nostrsigner:sign?event=${encodedEvent}&callback=${callbackUrl}`;
    
    console.log('AmberAuth: Opening Amber with URI');
    
    // Open Amber using the URI
    await Linking.openURL(amberUri);
    
    // Authentication success will be handled by deep linking callback
    return true;
  } catch (error) {
    console.error('AmberAuth: Error authenticating with Amber:', error);
    if (error.message && error.message.includes('Activity not found')) {
      console.error('AmberAuth: Amber app not found or not responding');
      return false;
    }
    return false;
  }
};

/**
 * Sign an event using Amber
 * @param {Object} event - The event to sign
 * @returns {Promise<boolean>} Success status
 */
const signEvent = async (event) => {
  if (Platform.OS !== 'android') {
    console.warn('Amber signing is only supported on Android');
    return false;
  }
  
  try {
    // Make sure event has required fields
    if (!event.kind || !event.content) {
      console.error('Invalid event object for signing');
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
    
    // Open Amber using the URI
    await Linking.openURL(amberUri);
    
    // Signing success will be handled by deep linking callback
    return true;
  } catch (error) {
    console.error('Error signing with Amber:', error);
    if (error.message && error.message.includes('Activity not found')) {
      console.error('Amber app not found or not responding');
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
  console.log('AmberAuth: Setting up deep link handling for Amber responses');
  
  // Set up event listener for deep links
  const linkingListener = Linking.addEventListener('url', ({ url }) => {
    console.log('AmberAuth: Received deep link URL:', url);
    
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
            
            console.log('AmberAuth: Successfully parsed Amber response:', 
              parsedResponse?.pubkey ? `pubkey: ${parsedResponse.pubkey.substring(0, 8)}...` : 'No pubkey in response');
            
            if (!parsedResponse.pubkey) {
              console.error('AmberAuth: Missing pubkey in Amber response');
            }
            
            // Call the callback with the parsed response
            callback(parsedResponse);
          } catch (error) {
            console.error('AmberAuth: Error parsing Amber response JSON:', error);
            callback(null);
          }
        } else {
          console.error('AmberAuth: No response data in callback URL');
          callback(null);
        }
      } catch (error) {
        console.error('AmberAuth: Error processing callback URL:', error);
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