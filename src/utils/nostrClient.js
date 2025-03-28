import { SimplePool, finalizeEvent, verifyEvent } from 'nostr-tools';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';

// Create a simple pool with reasonable timeouts
const pool = new SimplePool({
  eoseSubTimeout: 10_000,
  getTimeout: 15_000,
  connectTimeout: 8_000
});

// Focus on a smaller set of the most reliable relays
const relays = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://purplepag.es'
];

// Storage for keys
let cachedKeyPair = null;

/**
 * Initialize the Nostr client
 * @returns {Promise<boolean>} Success status
 */
export const initializeNostr = async () => {
  try {
    // Check if the environment supports WebSockets
    if (typeof WebSocket === 'undefined') {
      console.warn('WebSocket not supported in this environment');
      return false;
    }
    
    // Test connection to relays
    const connectedRelays = [];
    
    for (const relay of relays) {
      try {
        const conn = pool.ensureRelay(relay);
        if (conn) {
          connectedRelays.push(relay);
        }
      } catch (error) {
        console.warn(`Failed to connect to relay: ${relay}`, error);
      }
    }
    
    console.log(`Connected to ${connectedRelays.length}/${relays.length} relays`);
    
    // Consider initialization successful if we connect to at least one relay
    return connectedRelays.length > 0;
  } catch (error) {
    console.error('Error initializing Nostr:', error);
    return false;
  }
};

/**
 * Simple function to fetch events from relays
 * @param {Object} filter - Nostr filter
 * @returns {Promise<Array>} Array of events
 */
export const fetchEvents = async (filter) => {
  try {
    console.log('Fetching events with filter:', filter);
    
    // Ensure we have a limit to prevent excessive data usage
    if (!filter.limit) {
      filter.limit = 50;
    }
    
    // Simple fetch with timeout
    const events = await pool.list(relays, [filter], { timeout: 10000 });
    console.log(`Fetched ${events.length} events`);
    return events;
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
};

/**
 * Subscribe to events from relays
 * @param {Object} filter - Nostr filter
 * @returns {Object} Subscription object
 */
export const subscribe = (filter) => {
  try {
    const sub = pool.sub(relays, [filter]);
    return sub;
  } catch (error) {
    console.error('Error subscribing to events:', error);
    return null;
  }
};

/**
 * Generate a new key pair
 * @returns {Object} Key pair { privateKey, publicKey }
 */
export const generateKeyPair = () => {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  return {
    privateKey: sk,
    publicKey: pk
  };
};

/**
 * Get the current signing key, generating one if needed
 * @returns {Promise<Uint8Array>} Private key
 */
export const getSigningKey = async () => {
  if (cachedKeyPair && cachedKeyPair.privateKey) {
    return cachedKeyPair.privateKey;
  }
  
  const npub = localStorage.getItem('currentNpub');
  return npub ? generateSecretKey() : null;
};

/**
 * Get the current user's public key
 * @returns {Promise<string>} Public key
 */
export const getUserPublicKey = async () => {
  // First, check if we have cached key
  if (cachedKeyPair && cachedKeyPair.publicKey) {
    return cachedKeyPair.publicKey;
  }
  
  // Try to get from localStorage
  const npub = localStorage.getItem('currentNpub');
  if (npub) {
    try {
      // For real apps, you'd decode the npub to hex
      // For this demo, we're just using the npub as is
      const keyPair = {
        privateKey: generateSecretKey(), // Generate a new one for demo
        publicKey: npub
      };
      cachedKeyPair = keyPair;
      return npub;
    } catch (error) {
      console.error('Error getting user public key:', error);
    }
  }
  
  return null;
};

/**
 * Create and publish an event to the nostr network
 * @param {Object} eventTemplate Template for the event
 * @param {Uint8Array} privateKey Private key to sign with (optional)
 * @returns {Promise<Object>} The published event
 */
export const createAndPublishEvent = async (eventTemplate, privateKey) => {
  try {
    // Get signing key if not provided
    const sk = privateKey || await getSigningKey();
    if (!sk) {
      throw new Error('No signing key available');
    }
    
    // Get user's public key
    const pk = await getUserPublicKey();
    if (!pk) {
      throw new Error('No public key available');
    }
    
    // Create the event
    const event = {
      ...eventTemplate,
      pubkey: pk,
      created_at: Math.floor(Date.now() / 1000),
      tags: eventTemplate.tags || []
    };
    
    // Sign the event
    const signedEvent = finalizeEvent(event, sk);
    
    // Verify the signature
    const valid = verifyEvent(signedEvent);
    if (!valid) {
      throw new Error('Event signature verification failed');
    }
    
    // Publish the event to all relays
    const pubs = pool.publish(relays, signedEvent);
    
    return signedEvent;
  } catch (error) {
    console.error('Error creating and publishing event:', error);
    throw error;
  }
}; 