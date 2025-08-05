// Lightweight JS fallback so Node diagnostics can run without TS loader.
import NDK from '@nostr-dev-kit/ndk';
import { relays } from '../config/relays.js';

console.log('[ndkSingleton.js] Initializing NDK with relays:', relays);
const ndk = new NDK({ explicitRelayUrls: relays });

// Track dynamically added relays to avoid duplicates
const dynamicRelays = new Set();

const ndkReadyPromise = (async () => {
  console.log('[ndkSingleton.js] ndkReadyPromise: Attempting ndk.connect()...');
  try {
    await ndk.connect();
    console.log('[ndkSingleton.js] ndk.connect() successful.');
    return true;
  } catch (err) {
    console.error('[ndkSingleton.js] ndk.connect() FAILED:', err);
    return false;
  }
})();

/**
 * Add a relay to the NDK instance and connect to it
 * @param {string} relayUrl - WebSocket URL of the relay to add
 * @returns {Promise<boolean>} - True if successfully added and connected
 */
export const addRelayToNDK = async (relayUrl) => {
  if (!relayUrl || typeof relayUrl !== 'string') {
    console.warn('[ndkSingleton.js] addRelayToNDK: Invalid relay URL provided');
    return false;
  }

  // Validate WebSocket URL format
  if (!relayUrl.startsWith('ws://') && !relayUrl.startsWith('wss://')) {
    console.warn('[ndkSingleton.js] addRelayToNDK: Invalid WebSocket URL format:', relayUrl);
    return false;
  }

  // Check if relay is already added
  if (dynamicRelays.has(relayUrl)) {
    console.log('[ndkSingleton.js] addRelayToNDK: Relay already added:', relayUrl);
    return true;
  }

  try {
    // Wait for NDK to be ready first
    const isReady = await ndkReadyPromise;
    if (!isReady) {
      console.warn('[ndkSingleton.js] addRelayToNDK: NDK not ready, cannot add relay');
      return false;
    }

    console.log('[ndkSingleton.js] addRelayToNDK: Adding relay:', relayUrl);
    
    // Add relay to NDK pool
    const relay = ndk.addExplicitRelay(relayUrl);
    
    // Attempt to connect with timeout
    const connectPromise = relay.connect();
    const timeoutPromise = new Promise((resolve) => 
      setTimeout(() => resolve(false), 10000) // 10 second timeout
    );
    
    const connected = await Promise.race([connectPromise, timeoutPromise]);
    
    if (connected !== false) {
      dynamicRelays.add(relayUrl);
      console.log('[ndkSingleton.js] addRelayToNDK: Successfully connected to:', relayUrl);
      return true;
    } else {
      console.warn('[ndkSingleton.js] addRelayToNDK: Connection timeout for:', relayUrl);
      return false;
    }
  } catch (error) {
    console.error('[ndkSingleton.js] addRelayToNDK: Error adding relay:', relayUrl, error);
    return false;
  }
};

/**
 * Remove a relay from the NDK instance
 * @param {string} relayUrl - WebSocket URL of the relay to remove
 */
export const removeRelayFromNDK = async (relayUrl) => {
  if (!relayUrl || !dynamicRelays.has(relayUrl)) {
    return;
  }

  try {
    console.log('[ndkSingleton.js] removeRelayFromNDK: Removing relay:', relayUrl);
    
    // Find and disconnect the relay
    const relay = Array.from(ndk.pool.relays.values()).find(r => r.url === relayUrl);
    if (relay) {
      relay.disconnect();
      ndk.pool.relays.delete(relay.url);
    }
    
    dynamicRelays.delete(relayUrl);
    console.log('[ndkSingleton.js] removeRelayFromNDK: Successfully removed:', relayUrl);
  } catch (error) {
    console.error('[ndkSingleton.js] removeRelayFromNDK: Error removing relay:', relayUrl, error);
  }
};

/**
 * Test connection to a relay without permanently adding it
 * @param {string} relayUrl - WebSocket URL to test
 * @returns {Promise<boolean>} - True if connection successful
 */
export const testRelayConnection = async (relayUrl) => {
  if (!relayUrl || typeof relayUrl !== 'string') {
    return false;
  }

  // Validate WebSocket URL format
  if (!relayUrl.startsWith('ws://') && !relayUrl.startsWith('wss://')) {
    return false;
  }

  try {
    console.log('[ndkSingleton.js] testRelayConnection: Testing connection to:', relayUrl);
    
    // Create a temporary NDK instance for testing
    const testNdk = new NDK({ explicitRelayUrls: [relayUrl] });
    
    // Try to connect with timeout
    const connectPromise = testNdk.connect();
    const timeoutPromise = new Promise((resolve) => 
      setTimeout(() => resolve(false), 8000) // 8 second timeout
    );
    
    const result = await Promise.race([connectPromise, timeoutPromise]);
    
    // Clean up the test connection
    testNdk.pool.relays.forEach(relay => relay.disconnect());
    
    console.log('[ndkSingleton.js] testRelayConnection: Result for', relayUrl, ':', !!result);
    return !!result;
  } catch (error) {
    console.error('[ndkSingleton.js] testRelayConnection: Error testing:', relayUrl, error);
    return false;
  }
};

export { ndk, ndkReadyPromise };

export const awaitNDKReady = async (timeoutMs = 10000) => {
  console.log('[ndkSingleton.js] awaitNDKReady called, timeout:', timeoutMs);
  const result = await Promise.race([
    ndkReadyPromise,
    new Promise((res) => setTimeout(() => {
      console.log('[ndkSingleton.js] awaitNDKReady: Timeout reached.');
      res(false);
    }, timeoutMs)),
  ]);
  console.log('[ndkSingleton.js] awaitNDKReady result:', result);
  return result;
}; 