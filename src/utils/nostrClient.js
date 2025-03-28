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
 * Get or generate a signing key
 * @returns {Promise<Uint8Array>} The signing key
 */
const getSigningKey = async () => {
  if (!cachedKeyPair) {
    // Try to get from secure storage first
    try {
      const storedKey = localStorage.getItem('nostr_private_key');
      if (storedKey) {
        cachedKeyPair = new Uint8Array(JSON.parse(storedKey));
      } else {
        // Generate new key if none exists
        cachedKeyPair = generateSecretKey();
        // Store in secure storage
        localStorage.setItem('nostr_private_key', JSON.stringify(Array.from(cachedKeyPair)));
      }
    } catch (error) {
      console.error('Error managing signing key:', error);
      // Generate new key if storage fails
      cachedKeyPair = generateSecretKey();
    }
  }
  return cachedKeyPair;
};

/**
 * Get the user's public key
 * @returns {Promise<string>} The public key
 */
const getUserPublicKey = async () => {
  const sk = await getSigningKey();
  return getPublicKey(sk);
};

/**
 * Initialize the Nostr client
 * @returns {Promise<boolean>} Success status
 */
export const initializeNostr = async () => {
  try {
    // Ensure we have a signing key
    await getSigningKey();
    
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
 * Create and publish an event to the nostr network
 * @param {Object} eventTemplate Template for the event
 * @returns {Promise<Object>} The published event
 */
export const createAndPublishEvent = async (eventTemplate) => {
  try {
    // Get signing key
    const sk = await getSigningKey();
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
    
    // Wait for all publish promises to resolve
    await Promise.all(pubs);
    
    return signedEvent;
  } catch (error) {
    console.error('Error creating and publishing event:', error);
    throw error;
  }
}; 