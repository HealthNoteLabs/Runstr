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
  'wss://purplepag.es',
  'wss://nostr.fmt.wiz.biz',
  'wss://nostr.wine',
  'wss://eden.nostr.land',
  'wss://relay.current.fyi',
  'wss://nostr-pub.wellorder.net'
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
    
    // Make sure we have at least one active relay connection
    let connectedRelays = 0;
    for (const relay of relays) {
      try {
        pool.ensureRelay(relay);
        connectedRelays++;
      } catch (error) {
        console.warn(`Could not connect to relay: ${relay}`, error);
      }
    }
    
    if (connectedRelays === 0) {
      console.error('No relays connected, trying to reinitialize...');
      await initializeNostr();
    }
    
    // Simple fetch with increased timeout
    const events = await pool.list(relays, [filter], { timeout: 15000 });
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
  console.log('Creating subscription with filter:', filter);
  
  // Ensure we have a limit
  if (!filter.limit) {
    filter.limit = 30;
  }
  
  // Make sure filter has kinds
  if (!filter.kinds) {
    filter.kinds = [1]; // Default to text notes
  }
  
  // For better relay performance, add since if not present
  if (!filter.since) {
    // Default to last 24 hours if not specified
    filter.since = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
  }
  
  // Create subscription
  const sub = pool.sub(relays, [filter]);
  
  // Set a longer reasonable timeout to auto-close
  const timeoutId = setTimeout(() => {
    console.log('Subscription timeout reached, closing...');
    sub.unsub();
  }, 30000);
  
  return {
    on: (event, callback) => {
      sub.on(event, callback);
      return sub;
    },
    stop: () => {
      clearTimeout(timeoutId);
      sub.unsub();
    }
  };
};

/**
 * Generate and store a key pair
 * @returns {Object} Object containing public and private keys
 */
export const generateKeyPair = () => {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  cachedKeyPair = { privateKey: sk, publicKey: pk };
  return cachedKeyPair;
};

/**
 * Get the current signing key
 * @returns {string} Private key for signing
 */
export const getSigningKey = async () => {
  if (!cachedKeyPair) {
    cachedKeyPair = generateKeyPair();
  }
  return cachedKeyPair.privateKey;
};

/**
 * Get the user's public key
 * @returns {string} User's public key
 */
export const getUserPublicKey = async () => {
  try {
    // Try to get from browser extension first
    if (window.nostr) {
      try {
        const pubkey = await window.nostr.getPublicKey();
        if (pubkey) return pubkey;
      } catch (e) {
        console.log('Could not get pubkey from extension:', e);
      }
    }
    
    // Fall back to generated keypair
    if (!cachedKeyPair) {
      cachedKeyPair = generateKeyPair();
    }
    return cachedKeyPair.publicKey;
  } catch (error) {
    console.error('Error getting user public key:', error);
    return '';
  }
};

/**
 * Create and publish an event
 * @param {Object} eventTemplate - Event template 
 * @param {string} privateKey - Private key for signing
 * @returns {Promise<Object>} Published event
 */
export const createAndPublishEvent = async (eventTemplate, privateKey) => {
  try {
    const signingKey = privateKey || await getSigningKey();
    
    // Sign the event
    const signedEvent = finalizeEvent(eventTemplate, signingKey);
    
    // Verify the event signature
    const verified = verifyEvent(signedEvent);
    if (!verified) {
      throw new Error('Event verification failed');
    }
    
    // Publish to relays
    await pool.publish(relays, signedEvent, { timeout: 10000 });
    return signedEvent;
  } catch (error) {
    console.error('Error publishing event:', error);
    throw error;
  }
};

// Channel-related constants
export const GROUP_KINDS = {
  METADATA: 40,
  MESSAGE: 42,
  HIDE_MESSAGE: 43,
  MUTE_USER: 44,
  INVITE: 45
};

/**
 * Create a new channel with metadata
 * @param {Object} metadata - Channel metadata
 * @returns {Promise<Object>} Created channel event
 */
export const createChannel = async (metadata) => {
  try {
    const eventTemplate = {
      kind: GROUP_KINDS.METADATA,
      tags: [],
      content: JSON.stringify(metadata),
      created_at: Math.floor(Date.now() / 1000)
    };
    
    const privateKey = await getSigningKey();
    return await createAndPublishEvent(eventTemplate, privateKey);
  } catch (error) {
    console.error('Error creating channel:', error);
    throw error;
  }
};

/**
 * Send a message to a channel
 * @param {string} channelId - Channel ID
 * @param {string} content - Message content
 * @returns {Promise<Object>} Sent message event
 */
export const sendChannelMessage = async (channelId, content) => {
  try {
    const eventTemplate = {
      kind: GROUP_KINDS.MESSAGE,
      tags: [
        ['e', channelId, '', 'root']
      ],
      content,
      created_at: Math.floor(Date.now() / 1000)
    };
    
    const privateKey = await getSigningKey();
    return await createAndPublishEvent(eventTemplate, privateKey);
  } catch (error) {
    console.error('Error sending channel message:', error);
    throw error;
  }
};

/**
 * Fetch messages from a channel
 * @param {string} channelId - Channel ID
 * @returns {Promise<Array>} Channel messages
 */
export const fetchChannelMessages = async (channelId) => {
  try {
    const filter = {
      kinds: [GROUP_KINDS.MESSAGE],
      '#e': [channelId],
      limit: 100
    };
    
    const events = await fetchEvents(filter);
    return Array.from(events).sort((a, b) => a.created_at - b.created_at);
  } catch (error) {
    console.error('Error fetching channel messages:', error);
    return [];
  }
};

/**
 * Search for channels based on query
 * @param {string} query - Search query
 * @returns {Promise<Array>} Found channels
 */
export const searchChannels = async (query) => {
  try {
    const filter = {
      kinds: [GROUP_KINDS.METADATA],
      limit: 50
    };
    
    const events = await fetchEvents(filter);
    
    // Filter results based on query
    return Array.from(events)
      .filter(event => {
        try {
          const metadata = JSON.parse(event.content);
          return metadata.name?.toLowerCase().includes(query.toLowerCase()) ||
                 metadata.about?.toLowerCase().includes(query.toLowerCase());
        } catch {
          return false;
        }
      });
  } catch (error) {
    console.error('Error searching channels:', error);
    return [];
  }
};

/**
 * Hide a channel message
 * @param {string} messageId - Message ID to hide
 * @returns {Promise<Object>} Hide event
 */
export const hideChannelMessage = async (messageId) => {
  try {
    const eventTemplate = {
      kind: GROUP_KINDS.HIDE_MESSAGE,
      tags: [
        ['e', messageId]
      ],
      content: '',
      created_at: Math.floor(Date.now() / 1000)
    };
    
    const privateKey = await getSigningKey();
    return await createAndPublishEvent(eventTemplate, privateKey);
  } catch (error) {
    console.error('Error hiding channel message:', error);
    throw error;
  }
};

/**
 * Mute a user in a channel
 * @param {string} userPubkey - Public key of user to mute
 * @returns {Promise<Object>} Mute event
 */
export const muteChannelUser = async (userPubkey) => {
  try {
    const eventTemplate = {
      kind: GROUP_KINDS.MUTE_USER,
      tags: [
        ['p', userPubkey]
      ],
      content: '',
      created_at: Math.floor(Date.now() / 1000)
    };
    
    const privateKey = await getSigningKey();
    return await createAndPublishEvent(eventTemplate, privateKey);
  } catch (error) {
    console.error('Error muting channel user:', error);
    throw error;
  }
};

/**
 * Get list of hidden messages
 * @returns {Promise<Array>} List of hidden message IDs
 */
export const getHiddenMessages = async () => {
  try {
    const publicKey = await getUserPublicKey();
    const filter = {
      kinds: [GROUP_KINDS.HIDE_MESSAGE],
      authors: [publicKey],
      limit: 100
    };
    
    const events = await fetchEvents(filter);
    return Array.from(events).flatMap(event => 
      event.tags.filter(tag => tag[0] === 'e').map(tag => tag[1])
    );
  } catch (error) {
    console.error('Error getting hidden messages:', error);
    return [];
  }
};

/**
 * Get list of muted users
 * @returns {Promise<Array>} List of muted user pubkeys
 */
export const getMutedUsers = async () => {
  try {
    const publicKey = await getUserPublicKey();
    const filter = {
      kinds: [GROUP_KINDS.MUTE_USER],
      authors: [publicKey],
      limit: 100
    };
    
    const events = await fetchEvents(filter);
    return Array.from(events).flatMap(event => 
      event.tags.filter(tag => tag[0] === 'p').map(tag => tag[1])
    );
  } catch (error) {
    console.error('Error getting muted users:', error);
    return [];
  }
};

/**
 * Send an invite to a channel
 * @param {string} channelId - Channel ID
 * @param {string} recipientPubkey - Public key of recipient
 * @returns {Promise<Object>} Invite event
 */
export const sendChannelInvite = async (channelId, recipientPubkey) => {
  try {
    const eventTemplate = {
      kind: GROUP_KINDS.INVITE,
      tags: [
        ['e', channelId],
        ['p', recipientPubkey]
      ],
      content: '',
      created_at: Math.floor(Date.now() / 1000)
    };
    
    const privateKey = await getSigningKey();
    return await createAndPublishEvent(eventTemplate, privateKey);
  } catch (error) {
    console.error('Error sending channel invite:', error);
    throw error;
  }
};

export { pool };
