import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Prioritized relay list - ordered by reliability and speed
export const PRIORITIZED_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.bg',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://purplepag.es', 
  'wss://nostr.wine',
  'wss://nostr.mom'
];

// Backup relays - used if prioritized relays fail
export const BACKUP_RELAYS = [
  'wss://relay.current.fyi',
  'wss://brb.io',
  'wss://nostr.fmt.wiz.biz',
  'wss://relay.nostr.info'
];

// Export all relays for backwards compatibility
export const RELAYS = [...PRIORITIZED_RELAYS, ...BACKUP_RELAYS];

// NIP-28 Event Kinds
export const GROUP_KINDS = {
  CHANNEL_CREATION: 40,
  CHANNEL_METADATA: 41,
  CHANNEL_MESSAGE: 42,
  CHANNEL_HIDE_MESSAGE: 43,
  CHANNEL_MUTE_USER: 44
};

// Connection state tracking
let connectionState = {
  initialized: false,
  lastConnectAttempt: 0,
  connectedRelays: 0,
  connectionPromise: null
};

// Export loggedInUser as a let variable
export let loggedInUser = null;

// Initialize NDK instance with optimized settings for Android
export const ndk = isBrowser
  ? new NDK({
      explicitRelayUrls: PRIORITIZED_RELAYS.slice(0, 3), // Start with just 3 fastest relays
      enableOutboxModel: true,
      autoConnectRelays: false, // We'll handle connection manually for better control
      autoFetchUserRelays: true, // Get user's preferred relays when available
      connectionTimeout: 3500 // 3.5 seconds timeout - slightly longer for mobile networks
    })
  : null;

// Connect to additional relays as needed
const connectToAdditionalRelays = async () => {
  if (!ndk) return false;
  
  // If we already have enough relays connected, don't add more
  if (ndk.pool?.relays?.size >= 3) return true;
  
  console.log(`Adding additional relays to improve connectivity...`);
  
  // Add remaining prioritized relays
  const additionalRelays = [
    ...PRIORITIZED_RELAYS.slice(3),
    ...(ndk.pool?.relays?.size < 2 ? BACKUP_RELAYS : []) // Only use backup relays if we're really struggling
  ];
  
  // Add relays to the pool
  for (const relay of additionalRelays) {
    if (!ndk.pool.getRelay(relay)) {
      ndk.pool.addRelay(relay);
    }
  }
  
  // Wait a bit for connections to establish - longer for mobile
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  return ndk.pool?.relays?.size > 0;
};

// Initialize NDK connection with improved strategy for mobile
export const initializeNostr = async (forceReconnect = false) => {
  if (!ndk) return false;

  // Use cached connection if it's recent (within last 2 minutes) and not forced to reconnect
  const now = Date.now();
  if (
    !forceReconnect &&
    connectionState.initialized &&
    connectionState.connectedRelays > 0 &&
    now - connectionState.lastConnectAttempt < 2 * 60 * 1000
  ) {
    console.log(`Using cached connection to ${connectionState.connectedRelays} relays`);
    return true;
  }

  // If there's already a connection attempt in progress, wait for it
  if (connectionState.connectionPromise) {
    console.log('Connection already in progress, waiting...');
    return connectionState.connectionPromise;
  }

  console.log('Initializing NDK connection for Android...');
  connectionState.lastConnectAttempt = now;

  // Create a promise for the connection attempt that can be shared
  connectionState.connectionPromise = (async () => {
    let retryCount = 0;
    const maxRetries = 3; // Mobile needs more retries

    while (retryCount < maxRetries) {
      try {
        console.log(`Connecting to relays (attempt ${retryCount + 1}/${maxRetries})...`);
        
        // Use a promise race to add timeout - longer for mobile
        await Promise.race([
          ndk.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), 7000)
          )
        ]);

        // Quick check if any relays connected
        if (ndk.pool?.relays?.size > 0) {
          connectionState.initialized = true;
          connectionState.connectedRelays = ndk.pool.relays.size;
          console.log(`Successfully connected to ${ndk.pool.relays.size} relays`);
          
          // Add more relays in the background if needed for redundancy
          if (ndk.pool.relays.size < 3) {
            connectToAdditionalRelays().catch(console.error);
          }
          
          return true;
        }

        // If no relays connected, try connecting to additional relays
        const addedMore = await connectToAdditionalRelays();
        if (addedMore) {
          connectionState.initialized = true;
          connectionState.connectedRelays = ndk.pool.relays.size;
          console.log(`Connected to ${ndk.pool.relays.size} relays after adding additional relays`);
          return true;
        }

        retryCount++;
        if (retryCount < maxRetries) {
          const backoffTime = 1500 * Math.pow(1.5, retryCount); // Longer backoff for mobile
          console.log(`No relays connected. Waiting ${backoffTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        }
      } catch (err) {
        console.error('Error during connection attempt:', err);
        retryCount++;
        if (retryCount < maxRetries) {
          const backoffTime = 1500 * Math.pow(1.5, retryCount);
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        }
      }
    }

    console.error('Failed to connect after multiple attempts');
    return false;
  })();

  // Once connection attempt resolves, clear the promise
  try {
    const result = await connectionState.connectionPromise;
    connectionState.connectionPromise = null;
    return result;
  } catch (err) {
    connectionState.connectionPromise = null;
    console.error('Connection attempt failed:', err);
    return false;
  }
};

// Initialize connection when the module loads - but don't wait for it
if (ndk) {
  initializeNostr().catch((err) => {
    console.error('Failed to initialize NDK:', err);
  });
}

// Android-friendly publishing function
export const publishToNostr = async (event) => {
  if (!isBrowser) {
    console.error('Not in browser environment');
    return null;
  }

  if (!event) {
    console.error('No event provided');
    return null;
  }

  if (!ndk) {
    console.error('NDK not initialized');
    return null;
  }

  try {
    // For Android, we may need to use NIP-07 or a native signer
    const canUseNostrExtension = !!window.nostr;
    
    if (!canUseNostrExtension && !event.sig) {
      console.error('No Nostr signer available and event is not pre-signed');
      throw new Error('Authentication required. Please log in to continue.');
    }

    // Check current connection state
    if (!ndk.pool?.relays?.size) {
      console.log('No active connections found, attempting to reconnect...');
      const isConnected = await initializeNostr();
      if (!isConnected) {
        throw new Error(
          'Could not connect to the network. Please check your internet connection and try again.'
        );
      }
    } else {
      console.log(
        `Using existing connections to ${ndk.pool.relays.size} relays`
      );
    }

    let signedEvent = event;
    
    // Sign the event if not already signed and nostr extension available
    if (canUseNostrExtension && !event.sig) {
      console.log('Signing event using Nostr provider...');
      signedEvent = await window.nostr.signEvent(event);
    }
    
    console.log('Publishing event:', signedEvent);

    // Create NDK event
    const ndkEvent = new NDKEvent(ndk, signedEvent);

    // Publish with timeout - longer for mobile
    const published = await Promise.race([
      ndkEvent.publish(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Publication timeout')), 15000) // Mobile needs longer timeout
      )
    ]);

    console.log('Publication successful:', published);
    return published;
  } catch (error) {
    console.error('Error publishing to Nostr:', error);
    throw error;
  }
};

// NIP-28 Group Chat Functions

/**
 * Create a new NIP-28 channel (group) - Android-optimized version
 * @param {string|object} nameOrMetadata - Channel name or metadata object {name, about, picture}
 * @param {string} [about] - Channel description (optional if first param is object)
 * @param {string} [picture] - URL to channel picture (optional if first param is object)
 * @returns {Promise<object>} - The channel object with id and metadata
 */
export const createChannel = async (nameOrMetadata, about = "", picture = "") => {
  try {
    // Ensure connection - more retries for mobile
    const connected = await initializeNostr(true);
    if (!connected) {
      throw new Error("Unable to connect to the network. Please check your connection and try again.");
    }
    
    // Handle both parameter formats
    let name, metadata;
    
    if (typeof nameOrMetadata === 'object') {
      // If first parameter is an object with metadata
      metadata = nameOrMetadata;
      name = metadata.name;
      about = metadata.about || about;
      picture = metadata.picture || picture;
    } else {
      // If parameters are passed separately
      name = nameOrMetadata;
      metadata = { name, about, picture };
    }
    
    // Create a unique identifier for the channel
    const uniqueId = typeof crypto.randomUUID === 'function' 
      ? crypto.randomUUID() 
      : `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    
    const event = new NDKEvent(ndk);
    event.kind = GROUP_KINDS.CHANNEL_CREATION;
    
    // Set content as JSON with metadata as per NIP-28 spec
    event.content = JSON.stringify({
      name: name,
      about: about,
      picture: picture,
      relays: PRIORITIZED_RELAYS.slice(0, 5) // Include relay recommendations
    });
    
    // Add d tag for unique identifier
    event.tags = [
      ["d", uniqueId]
    ];
    
    await event.sign();
    await publishToNostr(event);
    
    // Return a channel object with id and metadata
    return {
      id: event.id,
      name: name,
      description: about,
      picture: picture,
      owner: event.pubkey,
      created_at: event.created_at
    };
  } catch (error) {
    console.error("Error creating channel:", error);
    throw error;
  }
};

/**
 * Update an existing channel's metadata
 * @param {string} channelId - Channel ID (event ID of the creation event)
 * @param {string} name - New channel name
 * @param {string} about - New channel description
 * @param {string} picture - New channel picture URL
 * @returns {Promise<boolean>} - Success status
 */
export const updateChannelMetadata = async (channelId, name, about, picture = "") => {
  try {
    await initializeNostr();
    
    const event = new NDKEvent(ndk);
    event.kind = GROUP_KINDS.CHANNEL_METADATA;
    
    // Set content as JSON with metadata
    event.content = JSON.stringify({
      name: name,
      about: about,
      picture: picture,
      relays: PRIORITIZED_RELAYS.slice(0, 5)
    });
    
    // Reference the channel with e tag
    event.tags = [
      ["e", channelId, "", "root"] // Reference to the channel as root
    ];
    
    await event.sign();
    await publishToNostr(event);
    
    return true;
  } catch (error) {
    console.error("Error updating channel metadata:", error);
    throw error;
  }
};

/**
 * Send a message to a channel
 * @param {string} channelId - Channel ID
 * @param {string} content - Message content
 * @param {Object} replyTo - Optional event to reply to (includes id and pubkey)
 * @returns {Promise<string>} - The message event ID
 */
export const sendChannelMessage = async (channelId, content, replyTo = null) => {
  try {
    await initializeNostr();
    
    const event = new NDKEvent(ndk);
    event.kind = GROUP_KINDS.CHANNEL_MESSAGE;
    event.content = content;
    event.tags = [
      ["e", channelId, "", "root"] // Reference to the channel as root
    ];
    
    if (replyTo) {
      // Add reference to the message being replied to
      event.tags.push(["e", replyTo.id, "", "reply"]);
      
      // Add reference to the author of the message being replied to (NIP-10)
      if (replyTo.pubkey) {
        event.tags.push(["p", replyTo.pubkey]);
      }
    }
    
    await event.sign();
    await publishToNostr(event);
    
    return event.id;
  } catch (error) {
    console.error("Error sending channel message:", error);
    throw error;
  }
};

/**
 * Fetch messages from a channel
 * @param {string} channelId - Channel ID
 * @param {number} limit - Maximum number of messages to fetch
 * @returns {Promise<Array>} - Array of channel messages
 */
export const fetchChannelMessages = async (channelId, limit = 50) => {
  try {
    await initializeNostr();
    
    const filter = {
      kinds: [GROUP_KINDS.CHANNEL_MESSAGE],
      "#e": [channelId],
      limit
    };
    
    const events = await ndk.fetchEvents(filter);
    return Array.from(events).sort((a, b) => a.created_at - b.created_at);
  } catch (error) {
    console.error("Error fetching channel messages:", error);
    throw error;
  }
};

/**
 * Find all available channels
 * @param {number} limit - Maximum number of channels to fetch
 * @returns {Promise<Array>} - Array of channels
 */
export const findChannels = async (limit = 50) => {
  try {
    await initializeNostr();
    
    const filter = {
      kinds: [GROUP_KINDS.CHANNEL_CREATION],
      limit
    };
    
    const events = await ndk.fetchEvents(filter);
    return Array.from(events);
  } catch (error) {
    console.error("Error finding channels:", error);
    throw error;
  }
};

/**
 * Search for channels by name or description
 * @param {string} searchTerm - Term to search for
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} - Array of matching channels
 */
export const searchChannels = async (searchTerm, limit = 50) => {
  try {
    const channels = await findChannels(limit * 2); // Get more to filter from
    
    // Convert search term to lowercase for case-insensitive comparison
    const term = searchTerm.toLowerCase();
    
    // Filter channels by search term in name or about
    return channels.filter(channel => {
      // Check content (NIP-28 JSON metadata)
      let contentMatch = false;
      try {
        const metadata = JSON.parse(channel.content);
        const nameContent = (metadata.name || "").toLowerCase();
        const aboutContent = (metadata.about || "").toLowerCase();
        contentMatch = nameContent.includes(term) || aboutContent.includes(term);
      } catch {
        // If content is not valid JSON, contentMatch remains false
      }
      
      // Check tags (fallback metadata)
      const name = channel.tags.find(tag => tag[0] === "name")?.[1]?.toLowerCase() || "";
      const about = channel.tags.find(tag => tag[0] === "about")?.[1]?.toLowerCase() || "";
      const tagMatch = name.includes(term) || about.includes(term);
      
      // Return true if either content or tags match
      return contentMatch || tagMatch;
    }).slice(0, limit);
  } catch (error) {
    console.error("Error searching channels:", error);
    throw error;
  }
};

/**
 * Hide a message (NIP-28 kind 43)
 * @param {string} messageId - ID of the message to hide
 * @param {string} reason - Optional reason for hiding
 * @returns {Promise<boolean>} - Success status
 */
export const hideChannelMessage = async (messageId, reason = "") => {
  try {
    await initializeNostr();
    
    const event = new NDKEvent(ndk);
    event.kind = GROUP_KINDS.CHANNEL_HIDE_MESSAGE;
    event.content = reason ? JSON.stringify({ reason }) : "";
    event.tags = [
      ["e", messageId] // Reference to the message being hidden
    ];
    
    await event.sign();
    await publishToNostr(event);
    
    return true;
  } catch (error) {
    console.error("Error hiding message:", error);
    throw error;
  }
};

/**
 * Mute a user in a channel (NIP-28 kind 44)
 * @param {string} userPubkey - Pubkey of the user to mute
 * @param {string} reason - Optional reason for muting
 * @returns {Promise<boolean>} - Success status
 */
export const muteChannelUser = async (userPubkey, reason = "") => {
  try {
    await initializeNostr();
    
    const event = new NDKEvent(ndk);
    event.kind = GROUP_KINDS.CHANNEL_MUTE_USER;
    event.content = reason ? JSON.stringify({ reason }) : "";
    event.tags = [
      ["p", userPubkey] // Reference to the user being muted
    ];
    
    await event.sign();
    await publishToNostr(event);
    
    return true;
  } catch (error) {
    console.error("Error muting user:", error);
    throw error;
  }
};

/**
 * Get hidden messages
 * @returns {Promise<Map>} - Map of hidden message IDs
 */
export const getHiddenMessages = async () => {
  try {
    await initializeNostr();
    
    const filter = {
      kinds: [GROUP_KINDS.CHANNEL_HIDE_MESSAGE],
      authors: [ndk.getPublicKey()]
    };
    
    const events = await ndk.fetchEvents(filter);
    const hiddenMessages = new Map();
    
    Array.from(events).forEach(event => {
      const messageId = event.tags.find(tag => tag[0] === 'e')?.[1];
      if (messageId) {
        let reason = '';
        try {
          const content = JSON.parse(event.content);
          reason = content.reason || '';
        } catch {
          // Content not JSON or no reason
        }
        hiddenMessages.set(messageId, { reason });
      }
    });
    
    return hiddenMessages;
  } catch (error) {
    console.error("Error getting hidden messages:", error);
    return new Map();
  }
};

/**
 * Get users that the user has muted
 * @returns {Promise<Map>} - Map of muted user pubkeys
 */
export const getMutedUsers = async () => {
  try {
    await initializeNostr();
    
    const filter = {
      kinds: [GROUP_KINDS.CHANNEL_MUTE_USER],
      authors: [ndk.getPublicKey()]
    };
    
    const events = await ndk.fetchEvents(filter);
    const mutedUsers = new Map();
    
    Array.from(events).forEach(event => {
      const userPubkey = event.tags.find(tag => tag[0] === 'p')?.[1];
      if (userPubkey) {
        let reason = '';
        try {
          const content = JSON.parse(event.content);
          reason = content.reason || '';
        } catch {
          // Content not JSON or no reason
        }
        mutedUsers.set(userPubkey, { reason });
      }
    });
    
    return mutedUsers;
  } catch (error) {
    console.error("Error getting muted users:", error);
    return new Map();
  }
};

/**
 * Send a direct invite to a user for a channel
 * @param {string} channelId - Channel ID to invite to
 * @param {string} toPubkey - Public key of the user to invite
 * @param {string} channelName - Name of the channel (for the invite message)
 * @returns {Promise<string>} - The invite event ID
 */
export const sendChannelInvite = async (channelId, toPubkey, channelName) => {
  try {
    await initializeNostr();
    
    const event = new NDKEvent(ndk);
    event.kind = 4; // Direct message
    
    // Create invite message with channel details
    const inviteMessage = JSON.stringify({
      type: "channel-invite",
      channelId: channelId,
      channelName: channelName,
      message: `You've been invited to join the Run Club: ${channelName}`
    });
    
    event.content = inviteMessage;
    
    // Add p tag for recipient
    event.tags = [
      ["p", toPubkey]
    ];
    
    await event.sign();
    await publishToNostr(event);
    
    return event.id;
  } catch (error) {
    console.error("Error sending channel invite:", error);
    throw error;
  }
};
