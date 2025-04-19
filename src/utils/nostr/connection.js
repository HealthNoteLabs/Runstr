import { SimplePool } from 'nostr-tools';

// Focus on a smaller set of the most reliable relays
export const relays = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://purplepag.es',
  'wss://groups.0xchat.com'  // NIP-29 group support
];

// Create a simple pool with reasonable timeouts
export const pool = new SimplePool({
  eoseSubTimeout: 10_000,
  getTimeout: 15_000,
  connectTimeout: 8_000
});

/**
 * Initialize the Nostr client with specific relays for groups
 * @returns {Promise<boolean>} Success status
 */
export const initializeNostr = async () => {
  try {
    // Check if the environment supports WebSockets
    if (typeof WebSocket === 'undefined') {
      console.warn('WebSocket not supported in this environment');
      return false;
    }
    
    // Ensure we have the primary NIP-29 relay
    const primaryRelay = 'wss://groups.0xchat.com';
    if (!relays.includes(primaryRelay)) {
      relays.unshift(primaryRelay);
    }
    
    // Test connection to relays with priority on groups.0xchat.com
    const connectedRelays = [];
    
    // Try primary relay first
    try {
      const conn = await pool.ensureRelay(primaryRelay);
      if (conn) {
        connectedRelays.push(primaryRelay);
        console.log('Connected to primary groups relay:', primaryRelay);
      }
    } catch (error) {
      console.warn(`Failed to connect to primary relay: ${primaryRelay}`, error);
    }
    
    // Then try other relays
    for (const relay of relays) {
      if (relay === primaryRelay) continue; // Skip primary, already tried
      
      try {
        const conn = await pool.ensureRelay(relay);
        if (conn) {
          connectedRelays.push(relay);
        }
      } catch (error) {
        console.warn(`Failed to connect to relay: ${relay}`, error);
      }
    }
    
    console.log(`Connected to ${connectedRelays.length}/${relays.length} relays`);
    console.log('Connected relays:', connectedRelays);
    
    // Consider initialization successful if we connect to at least groups.0xchat.com
    // or any two relays
    return connectedRelays.includes(primaryRelay) || connectedRelays.length >= 2;
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