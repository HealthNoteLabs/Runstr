import { SimplePool, finalizeEvent, verifyEvent } from 'nostr-tools';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';

// Create a relay pool with optimized settings for mobile
const pool = new SimplePool({
  eoseSubTimeout: 15_000, // Increased timeout for mobile networks
  getTimeout: 20_000,
  connectTimeout: 5_000
});

// List of reliable relays for mobile connections
const relays = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.current.fyi',
  'wss://purplepag.es',
  'wss://nostr.wine',
  'wss://relay.nostr.bg',
  'wss://relay.snort.social',
  'wss://nostr.fmt.wiz.biz',
  'wss://nostr.mutinywallet.com'
];

// Android storage for keys (simulating native storage)
let cachedKeyPair = null;

/**
 * Initialize connection to Nostr network with mobile optimization
 * @returns {Promise<boolean>} Connection success status
 */
export const initializeNostr = async () => {
  try {
    console.log('Initializing Nostr for Android...');
    
    // Mobile-optimized approach: test only one relay with a minimal filter
    const testEvents = await pool.list([relays[0]], [
      {
        kinds: [1],
        limit: 1
      }
    ], {
      // Lower timeout for initial check
      timeout: 5000
    });
    
    return testEvents && testEvents.length > 0;
  } catch (error) {
    console.error('Failed to initialize Nostr connection on Android:', error);
    return false;
  }
};

/**
 * Fetch events from relays based on filter - optimized for mobile
 * @param {Object} filter - Nostr filter
 * @returns {Promise<Set>} Set of events
 */
export const fetchEvents = async (filter) => {
  try {
    // For mobile: add timeouts and limit results
    const options = {
      timeout: 10_000 // 10 seconds max to avoid battery drain
    };
    
    if (!filter.limit) {
      filter.limit = 50; // Ensure we always have a reasonable limit for mobile
    }
    
    const events = await pool.list(relays, [filter], options);
    return new Set(events);
  } catch (error) {
    console.error('Error fetching events on mobile:', error);
    return new Set();
  }
};

/**
 * Subscribe to events from relays - mobile optimized
 * @param {Object} filter - Nostr filter
 * @returns {Object} Subscription object
 */
export const subscribe = (filter) => {
  // Always ensure a limit for mobile subscriptions
  if (!filter.limit) {
    filter.limit = 30;
  }
  
  const sub = pool.sub(relays, [filter]);
  
  // Create an event handler interface
  const eventHandlers = {
    'event': [],
    'eose': []
  };
  
  sub.on('event', (event) => {
    eventHandlers['event'].forEach(handler => handler(event));
  });
  
  sub.on('eose', () => {
    eventHandlers['eose'].forEach(handler => handler());
  });
  
  // Mobile-optimized subscription with built-in timeout
  const timeoutId = setTimeout(() => {
    console.log('Mobile subscription timeout reached, closing...');
    sub.unsub();
  }, 30000); // 30 seconds max for mobile battery preservation
  
  return {
    on: (event, callback) => {
      if (eventHandlers[event]) {
        eventHandlers[event].push(callback);
      }
      return sub;
    },
    off: (event, callback) => {
      if (eventHandlers[event]) {
        eventHandlers[event] = eventHandlers[event].filter(cb => cb !== callback);
      }
      return sub;
    },
    stop: () => {
      clearTimeout(timeoutId);
      sub.unsub();
    }
  };
};

/**
 * Create and publish an event - modified for Android
 * @param {Object} eventTemplate - Event template 
 * @param {string} privateKey - Private key for signing
 * @returns {Promise<Object>} Published event
 */
export const createAndPublishEvent = async (eventTemplate, privateKey) => {
  try {
    // For Android, we need to handle key management differently
    const signingKey = privateKey || await getSigningKey();
    
    // Sign the event
    const signedEvent = finalizeEvent(eventTemplate, signingKey);
    
    // Verify the event signature
    const verified = verifyEvent(signedEvent);
    if (!verified) {
      throw new Error('Event verification failed');
    }
    
    // Mobile-optimized publish with timeout
    await pool.publish(relays, signedEvent, { timeout: 10000 });
    return signedEvent;
  } catch (error) {
    console.error('Error publishing event on Android:', error);
    throw error;
  }
};

/**
 * Generate and store a key pair for Android
 * @returns {Object} Object containing public and private keys
 */
export const generateKeyPair = () => {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  cachedKeyPair = { privateKey: sk, publicKey: pk };
  return cachedKeyPair;
};

/**
 * Get the current signing key for Android 
 * @returns {string} Private key for signing
 */
export const getSigningKey = async () => {
  // In a real Android app, this would use secure device storage
  if (!cachedKeyPair) {
    cachedKeyPair = generateKeyPair();
  }
  return cachedKeyPair.privateKey;
};

/**
 * Get the user's public key for Android
 * @returns {string} User's public key
 */
export const getUserPublicKey = async () => {
  // In a real Android app, this would use secure device storage
  if (!cachedKeyPair) {
    cachedKeyPair = generateKeyPair();
  }
  return cachedKeyPair.publicKey;
};

export { pool };

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
