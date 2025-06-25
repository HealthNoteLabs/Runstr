import { SimplePool, finalizeEvent, verifyEvent } from 'nostr-tools';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import { parseNaddr } from './ndkGroups.js'; // Import parseNaddr
import { relays } from '../config/relays.js'; // Import relays from config

// Add debugging for nostr-tools version
console.log('Importing nostr-tools with version:', SimplePool ? 'Available' : 'Unavailable');
console.log('SimplePool prototype methods:', SimplePool ? Object.getOwnPropertyNames(SimplePool.prototype) : 'N/A');

// Create a test pool to verify SimplePool functionality before our main pool
let testPool = null;
try {
  testPool = new SimplePool();
  console.log('Test pool created successfully:', testPool ? 'Yes' : 'No');
  console.log('Test pool methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(testPool)));
  console.log('Test pool has list method:', typeof testPool.list === 'function');
} catch (err) {
  console.error('Error creating test pool:', err);
}

// Create a simple pool with reasonable timeouts
const pool = new SimplePool({
  eoseSubTimeout: 10_000,
  getTimeout: 15_000,
  connectTimeout: 8_000
});

/**
 * Checks if there might be multiple instances of a module loaded
 */
const checkForDuplicateModules = () => {
  try {
    // This is a simplistic check that might help identify module duplication issues
    console.log('Checking for potential module duplication issues...');
    
    // Create two instances and compare their prototypes
    const testPool1 = new SimplePool();
    const testPool2 = new SimplePool();
    
    console.log('Are pool prototypes the same?', 
      Object.getPrototypeOf(testPool1) === Object.getPrototypeOf(testPool2));
    
    // Check if the main pool uses the same prototype
    console.log('Does main pool share prototype with test pools?',
      pool ? Object.getPrototypeOf(pool) === Object.getPrototypeOf(testPool1) : 'N/A');
    
    // Check module resolution if possible
    if (typeof window !== 'undefined' && typeof window.require === 'function') {
      try {
        // This will fail in environments without require.resolve
        const path = window.require.resolve('nostr-tools');
        console.log('nostr-tools resolved path:', path);
      } catch (e) {
        console.log('Cannot resolve nostr-tools path:', e.message);
      }
    } else {
      console.log('window.require not available, cannot check module resolution');
    }
    
    console.log('Duplicate module check complete');
  } catch (err) {
    console.error('Error checking for duplicate modules:', err);
  }
};

// Run the check during initialization
checkForDuplicateModules();

// Debug pool instance
console.log('Pool initialized:', pool ? 'Yes' : 'No');
console.log('Pool methods:', pool ? Object.getOwnPropertyNames(Object.getPrototypeOf(pool)) : 'None');
console.log('Pool list method type:', pool && pool.list ? typeof pool.list : 'Not available');

// Export pool for inspection from other modules
export const debugPool = pool;

// Storage for keys
let cachedKeyPair = null;

// Storage for authenticated user's public key from Amber
let amberUserPubkey = null;

// Callback for when pubkey gets updated (used by NostrContext)
let pubkeyUpdateCallback = null;

/**
 * Register a callback to be notified when the user's pubkey is updated
 * @param {Function} callback - Function to call when pubkey changes
 */
export const registerPubkeyUpdateCallback = (callback) => {
  pubkeyUpdateCallback = callback;
};

/**
 * Unregister the pubkey update callback
 */
export const unregisterPubkeyUpdateCallback = () => {
  pubkeyUpdateCallback = null;
};

/**
 * Set the authenticated user's public key from Amber
 * @param {string|null} pubkey - The user's public key or null to clear
 */
export const setAmberUserPubkey = (pubkey) => {
  if (pubkey && typeof pubkey === 'string') {
    amberUserPubkey = pubkey;
    // Also store in localStorage to ensure consistency
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('userPublicKey', pubkey);
    }
    console.log('Set Amber user pubkey and synced to localStorage:', pubkey);
    
    // Notify NostrContext if callback is registered
    if (pubkeyUpdateCallback) {
      try {
        pubkeyUpdateCallback(pubkey);
      } catch (error) {
        console.error('Error in pubkey update callback:', error);
      }
    }
  } else if (pubkey === null) {
    // Handle logout/clear case
    amberUserPubkey = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('userPublicKey');
    }
    console.log('Cleared Amber user pubkey and localStorage');
    
    // Notify NostrContext of the clearing
    if (pubkeyUpdateCallback) {
      try {
        pubkeyUpdateCallback(null);
      } catch (error) {
        console.error('Error in pubkey update callback during clear:', error);
      }
    }
  }
};

/**
 * Initialize the Nostr client with specific relays for groups
 * @returns {Promise<boolean>} Success status
 */
export const initializeNostr = async () => {
  try {
    console.log('Initializing Nostr client...');
    console.log('Current pool state:', {
      poolExists: !!pool,
      poolType: typeof pool,
      hasList: pool && typeof pool.list === 'function'
    });
    
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
      console.log('Attempting to connect to primary relay:', primaryRelay);
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
        console.log('Attempting to connect to relay:', relay);
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
    
    // Pool state after relay connections
    console.log('Pool state after connections:', {
      poolExists: !!pool,
      poolType: typeof pool,
      hasList: pool && typeof pool.list === 'function',
      connectedRelaysCount: connectedRelays.length
    });
    
    // Consider initialization successful if we connect to at least groups.0xchat.com
    // or any two relays
    return connectedRelays.includes(primaryRelay) || connectedRelays.length >= 2;
  } catch (error) {
    console.error('Error initializing Nostr:', error);
    return false;
  }
};

/**
 * Fetch group messages using proper NIP-29 format
 * @param {string} groupId - The group identifier
 * @param {string[]} groupRelays - Relays to query
 * @returns {Promise<Array>} Array of group messages
 */
export const fetchGroupMessages = async (groupId, groupRelays = ['wss://groups.0xchat.com']) => {
  try {
    // Extract the actual group ID from the compound identifier
    // NIP-29 uses just the identifier part in the 'h' tag, not the full kind:pubkey:identifier
    const groupIdParts = groupId.split(':');
    const actualGroupId = groupIdParts.length === 3 ? groupIdParts[2] : groupId;
    
    // NIP-29 uses 'h' tag for group messages, not '#e'
    const filter = {
      '#h': [actualGroupId], // NIP-29 uses h tag with group_id
      limit: 50
    };
    
    console.log(`Fetching group messages with filter:`, filter);
    console.log(`Using relays:`, groupRelays);
    
    const events = await pool.list(groupRelays, [filter]);
    
    if (!events || events.length === 0) {
      console.log(`No messages found for group ${actualGroupId}`);
      return [];
    }
    
    // Sort by created_at
    return events.sort((a, b) => a.created_at - b.created_at);
  } catch (error) {
    console.error('Error fetching group messages:', error);
    return [];
  }
};

/**
 * Fetch group metadata using the naddr string directly
 * @param {string} naddrString - The naddr to use
 * @returns {Promise<Object>} Group metadata
 */
export const fetchGroupMetadataByNaddr = async (naddrString) => {
  try {
    const groupInfo = parseNaddr(naddrString);
    if (!groupInfo) {
      throw new Error('Invalid naddr format');
    }
    
    // Add groups.0xchat.com as a primary relay for NIP-29 groups
    const groupRelays = [...new Set([
      'wss://groups.0xchat.com',
      ...(groupInfo.relays || [])
    ])];
    
    const filter = {
      kinds: [groupInfo.kind], // Typically 39000 for NIP-29 groups
      authors: [groupInfo.pubkey],
      '#d': [groupInfo.identifier]
    };
    
    console.log(`Fetching group metadata for ${naddrString} with filter:`, filter);
    console.log(`Using relays:`, groupRelays);
    
    const events = await pool.list(groupRelays, [filter]);
    
    if (!events || events.length === 0) {
      console.log(`No metadata found for group ${naddrString}`);
      return null;
    }
    
    // Sort by created_at in descending order to get the latest
    const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
    
    // Parse the content which contains the group metadata
    let metadata;
    try {
      metadata = JSON.parse(latestEvent.content);
    } catch (e) {
      console.error('Error parsing group metadata content:', e);
      metadata = { name: 'Unknown Group', about: 'Could not parse group metadata' };
    }
    
    return {
      id: latestEvent.id,
      pubkey: latestEvent.pubkey,
      created_at: latestEvent.created_at,
      kind: latestEvent.kind,
      tags: latestEvent.tags,
      metadata
    };
  } catch (error) {
    console.error('Error fetching group metadata by naddr:', error);
    return null;
  }
};

/**
 * Fetch group metadata using kind, pubkey, and identifier
 * @param {number} kind - The kind of the group (typically 39000)
 * @param {string} pubkey - The group creator's pubkey
 * @param {string} identifier - The group identifier
 * @param {string[]} groupRelays - Relays to query
 * @returns {Promise<Object>} Group metadata
 */
export const fetchGroupMetadata = async (kind, pubkey, identifier, groupRelays = ['wss://groups.0xchat.com']) => {
  try {
    const filter = {
      kinds: [kind],
      authors: [pubkey],
      '#d': [identifier]
    };
    
    console.log(`Fetching group metadata with filter:`, filter);
    console.log(`Using relays:`, groupRelays);
    
    const events = await pool.list(groupRelays, [filter]);
    
    if (!events || events.length === 0) {
      console.log(`No metadata found for group kind=${kind}, pubkey=${pubkey}, identifier=${identifier}`);
      return null;
    }
    
    // Sort by created_at in descending order to get the latest
    const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
    
    // Parse the content which contains the group metadata
    let metadata;
    try {
      metadata = JSON.parse(latestEvent.content);
    } catch (e) {
      console.error('Error parsing group metadata content:', e);
      metadata = { name: 'Unknown Group', about: 'Could not parse group metadata' };
    }
    
    return {
      id: latestEvent.id,
      pubkey: latestEvent.pubkey,
      created_at: latestEvent.created_at,
      kind: latestEvent.kind,
      tags: latestEvent.tags,
      metadata
    };
  } catch (error) {
    console.error('Error fetching group metadata:', error);
    return null;
  }
};

/**
 * Send a message to a NIP-29 group
 * @param {Object} groupInfo - Group information from parseNaddr
 * @param {string} content - Message content
 * @returns {Promise<Object|null>} The published event or null on failure
 */
export const sendGroupMessage = async (groupInfo, content) => {
  try {
    const userPubkey = await getUserPublicKey();
    if (!userPubkey) {
      throw new Error('User not authenticated with Nostr');
    }
    
    // According to NIP-29, we need to use the 'h' tag with just the identifier
    const groupIdentifier = groupInfo.identifier;
    
    // NIP-29 says any kind with an 'h' tag can be used for messages
    // We'll use kind:1 (regular notes) for compatibility
    const event = {
      kind: 1, // Regular note kind
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['h', groupIdentifier] // NIP-29 uses h tag with group_id
      ],
      content,
      pubkey: userPubkey
    };
    
    console.log(`Sending message to group ${groupIdentifier}:`, event);
    
    // Primary relay for NIP-29
    const messageRelays = [...new Set([
      'wss://groups.0xchat.com',
      ...(groupInfo.relays || [])
    ])];
    
    // Sign and publish the event
    const signedEvent = await createAndPublishEvent(event);
    
    // Also publish specifically to group relays for better delivery
    if (signedEvent) {
      pool.publish(messageRelays, signedEvent);
    }
    
    return signedEvent;
  } catch (error) {
    console.error('Error sending group message:', error);
    return null;
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
    
    // Prioritize relays based on performance metrics
    let prioritizedRelays = [...relays]; // Default to existing relays order
    
    try {
      // Load performance metrics from localStorage
      const relayPerformance = JSON.parse(localStorage.getItem('relayPerformance') || '{}');
      if (Object.keys(relayPerformance).length > 0) {
        // Calculate average response time for each relay
        const relayScores = Object.entries(relayPerformance).map(([relay, metrics]) => {
          const avgTime = metrics.count > 0 ? metrics.totalTime / metrics.count : Infinity;
          // Also factor in recent activity - prefer relays used recently
          const recencyBonus = Date.now() - (metrics.lastUpdated || 0) < 24 * 60 * 60 * 1000 ? 1 : 0.5;
          return { 
            relay, 
            score: avgTime * (1 - recencyBonus) // Lower score is better
          };
        });
        
        // Sort relays by score (fastest first)
        relayScores.sort((a, b) => a.score - b.score);
        
        // Extract just the relay URLs that exist in our relays array
        const fastRelays = relayScores
          .map(item => item.relay)
          .filter(relay => relays.includes(relay));
        
        // Combine fast relays with any remaining relays
        const remainingRelays = relays.filter(relay => !fastRelays.includes(relay));
        prioritizedRelays = [...fastRelays, ...remainingRelays];
        
        console.log('Using prioritized relays order:', prioritizedRelays.slice(0, 3), '...');
      }
    } catch (err) {
      console.warn('Error prioritizing relays:', err);
      // Fall back to default relay order
    }
    
    // Simple fetch with timeout - using prioritized relays
    const events = await pool.list(prioritizedRelays, [filter], { timeout: 10000 });
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
 * @returns {Promise<string>} Public key or null if not available
 */
export const getUserPublicKey = async () => {
  try {
    // First priority: Check if we have an Amber-authenticated pubkey cached
    if (amberUserPubkey) {
      return amberUserPubkey;
    }
    
    // Second priority: Check localStorage for stored public key
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedPubkey = window.localStorage.getItem('userPublicKey');
      if (storedPubkey) {
        // Cache it for future calls
        amberUserPubkey = storedPubkey;
        console.log('getUserPublicKey: Found pubkey in localStorage, cached for future use');
        return storedPubkey;
      }
    }
    
    console.warn('No public key found in cache or localStorage');
    return null;
  } catch (error) {
    console.error('Error in getUserPublicKey:', error);
    return null;
  }
};

/**
 * Create and publish an event to the nostr network
 * @param {Object} eventTemplate Template for the event or a pre-signed event
 * @param {Uint8Array} privateKey Private key to sign with (optional)
 * @returns {Promise<Object>} The published event
 */
export const createAndPublishEvent = async (eventTemplate, privateKey) => {
  try {
    let signedEvent;
    
    // Check if we're being passed a pre-signed event (when used as a fallback)
    if (eventTemplate.sig && eventTemplate.pubkey && eventTemplate.created_at) {
      // This is already a signed event, no need to sign it again
      signedEvent = eventTemplate;
      
      // Verify the signature to be safe
      const valid = verifyEvent(signedEvent);
      if (!valid) {
        throw new Error('Pre-signed event signature verification failed');
      }
    } else {
      // We need to sign the event ourselves
      
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
      signedEvent = finalizeEvent(event, sk);
      
      // Verify the signature
      const valid = verifyEvent(signedEvent);
      if (!valid) {
        throw new Error('Event signature verification failed');
      }
    }
    
    // Publish the event to all relays
    pool.publish(relays, signedEvent);
    
    return signedEvent;
  } catch (error) {
    console.error('Error creating and publishing event:', error);
    throw error;
  }
};

/**
 * Fallback implementation for when pool.list is not available
 * @param {string[]} relayUrls - Relay URLs to query
 * @param {Object[]} filters - Nostr filters
 * @returns {Promise<Object[]>} Array of events
 */
const fallbackList = async (relayUrls, filters) => {
  console.log('Using fallbackList function with relays:', relayUrls);
  console.log('And filters:', filters);
  
  try {
    // Create a temporary new pool for this request
    const tempPool = new SimplePool();
    console.log('Created temporary pool for fallback:', tempPool);
    console.log('Temp pool methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(tempPool)));
    
    // Try to use the list method on the new pool
    if (tempPool && typeof tempPool.list === 'function') {
      console.log('Using tempPool.list as fallback');
      const events = await tempPool.list(relayUrls, filters);
      console.log(`Fallback received ${events?.length || 0} events`);
      
      // Close the temporary pool when done
      if (typeof tempPool.close === 'function') {
        await tempPool.close();
      }
      
      return events;
    }
    
    // If that doesn't work, go even more basic with a manual WebSocket approach
    console.log('TempPool.list also not available, trying manual WebSocket approach');
    
    // This would be a more manual implementation using WebSockets directly
    // but for now we'll just log the issue and return an empty array
    console.error('Full fallback not implemented, returning empty array');
    return [];
  } catch (error) {
    console.error('Error in fallbackList:', error);
    return [];
  }
};

/**
 * Fetch the user's list of followed/joined groups from NIP-51 list event.
 * @param {string} pubkey - The user's public key.
 * @param {string[]} relayList - Relays to query.
 * @returns {Promise<Object[]>} - An array of group objects with metadata.
 */
export const fetchUserGroupList = async (pubkey, relayList = relays) => {
  try {
    console.log(`Fetching group list for pubkey: ${pubkey}`);
    console.log('Pool state in fetchUserGroupList:', {
      poolExists: !!pool,
      poolType: typeof pool,
      hasList: pool && typeof pool.list === 'function',
      listType: pool ? typeof pool.list : 'N/A',
      poolKeys: pool ? Object.keys(pool) : [],
      poolProtoKeys: pool ? Object.keys(Object.getPrototypeOf(pool)) : []
    });
    
    const filter = {
      authors: [pubkey],
      kinds: [30001], // Standard kind for NIP-51 lists
      '#d': ['groups'] // Assuming 'groups' is the convention used
      // Consider adding 'communities' or 'bookmarks' if 'groups' yields no results
    };
    
    // Add a safe wrapper to handle potential issues with pool.list
    let listEvents = [];
    if (pool && typeof pool.list === 'function') {
      console.log('Calling pool.list with filter:', filter);
      console.log('Relays:', relayList);
      listEvents = await pool.list(relayList, [filter]);
    } else {
      console.error('pool.list is not a function! Trying fallback method...');
      // Use fallback method for fetching events
      listEvents = await fallbackList(relayList, [filter]);
    }
    
    if (!listEvents || listEvents.length === 0) {
      console.log('No group list event (kind 30001, #d=groups) found.');
      // Optionally, try fetching kind 10001 or other conventions
      return [];
    }

    // Sort by created_at to get the latest list event
    const latestListEvent = listEvents.sort((a, b) => b.created_at - a.created_at)[0];
    console.log('Found list event:', latestListEvent);

    const groupIdentifiers = [];
    latestListEvent.tags.forEach(tag => {
      // Look for 'a' tags representing groups (kind:pubkey:identifier)
      if (tag[0] === 'a' && tag[1]) {
         const parts = tag[1].split(':');
         // Basic validation: check for kind, pubkey, identifier
         if (parts.length === 3 && !isNaN(parseInt(parts[0])) && parts[1]?.length === 64 && parts[2]) {
            groupIdentifiers.push({ 
              kind: parseInt(parts[0]), 
              pubkey: parts[1], 
              identifier: parts[2],
              relay: tag[2] // Optional relay hint
            });
         }
      } 
      // TODO: Potentially add support for naddr strings stored in tags if needed
    });

    console.log('Found group identifiers:', groupIdentifiers);

    if (groupIdentifiers.length === 0) {
        return [];
    }

    // Fetch metadata for each group identifier found in the list
    const groupPromises = groupIdentifiers.map(async (group) => {
      try {
        const metadata = await fetchGroupMetadata(
          group.kind,
          group.pubkey,
          group.identifier,
          group.relay ? [...relayList, group.relay] : relayList // Include relay hint if available
        );
        if (metadata) {
          // Construct naddr for navigation (if possible)
          // Note: nostr-tools encode doesn't directly support naddr from parts easily
          // We might need to store the original naddr or reconstruct it carefully
          // For now, pass the parts needed for TeamDetail
          return { 
              ...metadata, 
              // Pass identifier parts instead of trying to reconstruct naddr here
              identifierData: group 
          };
        }
        return null;
      } catch (metaError) {
         console.error(`Error fetching metadata for group ${group.identifier}:`, metaError);
         return null;
      }
    });

    const groupsWithMetadata = (await Promise.all(groupPromises)).filter(g => g !== null);
    console.log('Groups with metadata:', groupsWithMetadata);
    return groupsWithMetadata;

  } catch (error) {
    console.error('Error fetching user group list:', error);
    return [];
  }
};

// Update the group message posting function to use the correct NIP-29 format
export const postGroupMessage = async (groupId, content) => {
  try {
    // Extract the actual group ID from the compound identifier if needed
    const groupIdParts = groupId.split(':');
    const actualGroupId = groupIdParts.length === 3 ? groupIdParts[2] : groupId;
    
    const event = {
      kind: 1, // Regular note kind for compatibility
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['h', actualGroupId] // NIP-29 uses h tag with group_id
      ],
      content
    };
    
    // Create and publish the event
    return await createAndPublishEvent(event);
  } catch (error) {
    console.error('Error posting group message:', error);
    throw error;
  }
};

/**
 * Join a group by sending a proper NIP-29 join request and adding to NIP-51 list
 * @param {string} naddrString - NIP-19 naddr string for the group
 * @returns {Promise<boolean>} Success status
 */
export const joinGroup = async (naddrString) => {
  try {
    console.log(`Joining group with naddr: ${naddrString}`);
    
    if (!naddrString) {
      console.error('No naddr string provided to joinGroup');
      throw new Error('Missing group identifier');
    }
    
    const userPubkey = await getUserPublicKey();
    if (!userPubkey) {
      console.error('No user public key available - user may not be authenticated');
      throw new Error('User not authenticated with Nostr');
    }

    // Parse the naddr to get group components
    const groupInfo = parseNaddr(naddrString);
    if (!groupInfo) {
      console.error('Failed to parse naddr:', naddrString);
      throw new Error('Invalid group data - could not parse naddr');
    }

    console.log('Joining group with parsed info:', groupInfo);

    // Check if user is already a member
    const isMember = await hasJoinedGroup(naddrString);
    if (isMember) {
      console.log('User is already a member of this group, nothing to do');
      return true;
    }

    // Send NIP-29 join request (kind 9021)
    const joinRequest = {
      kind: 9021,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['h', groupInfo.identifier] // NIP-29 uses h tag with group_id
      ],
      content: 'Joining group from RUNSTR app' // Optional reason
    };

    console.log('Sending join request:', joinRequest);
    
    // Primary relay for NIP-29
    const groupRelays = [...new Set([
      'wss://groups.0xchat.com',
      ...(groupInfo.relays || [])
    ])];

    try {
      // Sign and publish join request
      const publishedRequest = await createAndPublishEvent(joinRequest);
      if (!publishedRequest) {
        throw new Error('Failed to publish join request');
      }
      
      // Also publish specifically to group relays
      pool.publish(groupRelays, publishedRequest);
      
      console.log('Join request sent successfully');
      
      // Also update the NIP-51 list for our app tracking
      await addGroupToNip51List(groupInfo);
      
      return true;
    } catch (requestError) {
      console.error('Error sending join request:', requestError);
      
      // Even if the join request fails, we can still update our local list
      console.log('Updating NIP-51 list anyway');
      await addGroupToNip51List(groupInfo);
      
      return true; // Consider it a success for the user
    }
  } catch (error) {
    console.error('Error joining group:', error);
    throw error; // Let the caller handle the error with the specific message
  }
};

/**
 * Helper function to add a group to the user's NIP-51 list
 * @param {Object} groupInfo - Group information from parseNaddr
 * @returns {Promise<boolean>} Success status
 */
const addGroupToNip51List = async (groupInfo) => {
  try {
    const userPubkey = await getUserPublicKey();
    if (!userPubkey) throw new Error('User not authenticated');
    
    // Create the a-tag for the group (kind:pubkey:identifier format for NIP-29)
    const groupTag = `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;
    
    // Fetch the user's current groups list
    const filter = {
      kinds: [30001],
      authors: [userPubkey],
      '#d': ['groups']
    };
    
    let events = await pool.list(relays, [filter]);
    const currentEvent = events.length > 0 
      ? events.sort((a, b) => b.created_at - a.created_at)[0]
      : null;
    
    // Prepare tags for the new event
    let tags = [
      ['d', 'groups']  // NIP-51 list identifier
    ];

    // If there's an existing list, copy over the existing groups
    if (currentEvent) {
      // Check if the group is already in the list
      const isInList = currentEvent.tags.some(tag => 
        tag[0] === 'a' && tag[1] === groupTag
      );
      
      if (isInList) {
        return true; // Group already in list, nothing to add
      }
      
      // Add existing group tags
      const existingTags = currentEvent.tags.filter(t => 
        t[0] !== 'd' // Skip the 'd' tag as we already added it
      );
      tags = [...tags, ...existingTags];
    }

    // Add the new group tag
    tags.push(['a', groupTag]);

    // Create and publish the new list event
    const event = {
      kind: 30001,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: ''  // NIP-51 lists typically have empty content
    };

    const publishedEvent = await createAndPublishEvent(event);
    if (!publishedEvent) {
      throw new Error('Failed to publish NIP-51 list update for join');
    }
    
    console.log('Successfully added group to NIP-51 list');
    return true;
  } catch (error) {
    console.error('Error adding group to NIP-51 list:', error);
    throw error;
  }
};

/**
 * Check if user has joined a specific group
 * @param {string} naddr - Group naddr
 * @returns {Promise<boolean>} Whether user has joined the group
 */
export const hasJoinedGroup = async (naddr) => {
  try {
    const userPubkey = await getUserPublicKey();
    if (!userPubkey) return false;

    const groupInfo = parseNaddr(naddr);
    if (!groupInfo) return false;

    // Create a new pool specifically for groups.0xchat.com
    const groupPool = new SimplePool();
    const groupRelay = 'wss://groups.0xchat.com';

    // Look for NIP-51 lists (kind 30001) containing group references
    const filter = {
      kinds: [30001],
      authors: [userPubkey],
      '#d': ['groups']
    };

    // Query the specific relay
    const events = await groupPool.list([groupRelay], [filter]);
    if (!events || events.length === 0) {
      await groupPool.close();
      return false;
    }

    // Sort by created_at to get the latest list
    const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
    const groupTag = `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;

    // Check if the group is in the list
    const isMember = latestEvent.tags.some(tag => 
      tag[0] === 'a' && tag[1] === groupTag
    );

    await groupPool.close();
    return isMember;

  } catch (error) {
    console.error('Error checking group membership:', error);
    return false;
  }
};

/**
 * Leave a group by sending a proper NIP-29 leave request and removing from NIP-51 list
 * @param {string} naddrString - NIP-19 naddr string for the group
 * @returns {Promise<boolean>} Success status
 */
export const leaveGroup = async (naddrString) => {
  try {
    console.log(`Leaving group with naddr: ${naddrString}`);
    
    if (!naddrString) {
      console.error('No naddr string provided to leaveGroup');
      throw new Error('Missing group identifier');
    }
    
    const userPubkey = await getUserPublicKey();
    if (!userPubkey) {
      console.error('No user public key available - user may not be authenticated');
      throw new Error('User not authenticated with Nostr');
    }

    // Parse the naddr to get group components
    const groupInfo = parseNaddr(naddrString);
    if (!groupInfo) {
      console.error('Failed to parse naddr:', naddrString);
      throw new Error('Invalid group data - could not parse naddr');
    }

    console.log('Leaving group with parsed info:', groupInfo);

    // Check if user is a member before proceeding
    const isMember = await hasJoinedGroup(naddrString);
    if (!isMember) {
      console.log('User is not a member of this group, nothing to do');
      return true;
    }

    // Send NIP-29 leave request (kind 9022)
    const leaveRequest = {
      kind: 9022,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['h', groupInfo.identifier] // NIP-29 uses h tag with group_id
      ],
      content: 'Leaving group from RUNSTR app' // Optional reason
    };

    console.log('Sending leave request:', leaveRequest);
    
    // Primary relay for NIP-29
    const groupRelays = [...new Set([
      'wss://groups.0xchat.com',
      ...(groupInfo.relays || [])
    ])];

    try {
      // Sign and publish leave request
      const publishedRequest = await createAndPublishEvent(leaveRequest);
      if (!publishedRequest) {
        throw new Error('Failed to publish leave request');
      }
      
      // Also publish specifically to group relays
      pool.publish(groupRelays, publishedRequest);
      
      console.log('Leave request sent successfully');
      
      // Also update the NIP-51 list for our app tracking
      await removeGroupFromNip51List(groupInfo);
      
      return true;
    } catch (requestError) {
      console.error('Error sending leave request:', requestError);
      
      // Even if the leave request fails, we'll still update our local list
      console.log('Updating NIP-51 list anyway');
      await removeGroupFromNip51List(groupInfo);
      
      return true; // Consider it a success for the user
    }
  } catch (error) {
    console.error('Error leaving group:', error);
    throw error; // Let the caller handle the error with the specific message
  }
};

/**
 * Helper function to remove a group from the user's NIP-51 list
 * @param {Object} groupInfo - Group information from parseNaddr
 * @returns {Promise<boolean>} Success status
 */
const removeGroupFromNip51List = async (groupInfo) => {
  try {
    const userPubkey = await getUserPublicKey();
    if (!userPubkey) throw new Error('User not authenticated');
    
    // Create the a-tag for the group (kind:pubkey:identifier format for NIP-29)
    const groupTag = `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;
    
    // Fetch the user's current groups list
    const filter = {
      kinds: [30001],
      authors: [userPubkey],
      '#d': ['groups']
    };
    
    let events = await pool.list(relays, [filter]);
    const currentEvent = events.length > 0 
      ? events.sort((a, b) => b.created_at - a.created_at)[0]
      : null;
    
    // If there's no list or the group isn't in the list, nothing to do
    if (!currentEvent) {
      return true;
    }
    
    // Check if the group is in the list
    const isInList = currentEvent.tags.some(tag => 
      tag[0] === 'a' && tag[1] === groupTag
    );
    
    if (!isInList) {
      return true; // Nothing to remove
    }
    
    // Prepare tags for the new event, excluding the group to remove
    let tags = [
      ['d', 'groups']  // NIP-51 list identifier
    ];

    // Add existing group tags except the one we're removing
    const filteredTags = currentEvent.tags.filter(t => 
      !(t[0] === 'a' && t[1] === groupTag)
    );
    tags = [...tags, ...filteredTags.filter(t => t[0] !== 'd')];

    // Create and publish the new list event
    const event = {
      kind: 30001,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: ''  // NIP-51 lists typically have empty content
    };

    const publishedEvent = await createAndPublishEvent(event);
    if (!publishedEvent) {
      throw new Error('Failed to publish NIP-51 list update for leave');
    }
    
    console.log('Successfully removed group from NIP-51 list');
    return true;
  } catch (error) {
    console.error('Error removing group from NIP-51 list:', error);
    throw error;
  }
};

/**
 * Check if user has joined a specific group (WebSocket implementation)
 * @param {string} naddr - Group naddr
 * @returns {Promise<boolean>} Whether user has joined the group
 */
export const hasJoinedGroupWS = async (naddr) => {
  return new Promise((resolve) => {
    try {
      // Get the user's public key
      getUserPublicKey().then(userPubkey => {
        if (!userPubkey) {
          console.log('No user public key available, not a member');
          return resolve(false);
        }
        
        // Parse the group info from naddr
        const groupInfo = parseNaddr(naddr);
        if (!groupInfo) {
          console.error('Invalid naddr format:', naddr);
          return resolve(false);
        }
        
        // Use direct WebSocket to check membership
        const groupRelay = 'wss://groups.0xchat.com';
        console.log(`Creating WebSocket to ${groupRelay} for membership check`);
        const ws = new WebSocket(groupRelay);
        let receivedEvents = false;
        let timeoutId;
        
        ws.onopen = () => {
          console.log(`Connected to ${groupRelay}, checking membership`);
          // Look for NIP-51 lists with groups
          const filter = {
            kinds: [30001],
            authors: [userPubkey],
            '#d': ['groups']
          };
          
          // Send subscription request
          ws.send(JSON.stringify(['REQ', 'membership', filter]));
          
          // Set timeout for response
          timeoutId = setTimeout(() => {
            if (!receivedEvents) {
              console.log('Membership check timeout');
              ws.close();
              resolve(false);
            }
          }, 8000);
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message[0] === 'EVENT' && message[1] === 'membership') {
              receivedEvents = true;
              const listEvent = message[2];
              const groupTag = `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;
              
              console.log('Found membership list event:', listEvent);
              console.log('Looking for group tag:', groupTag);
              
              // Check if group tag is in the list
              const isMember = listEvent.tags.some(tag => 
                tag[0] === 'a' && tag[1] === groupTag
              );
              
              if (isMember) {
                console.log('User is a member of this group');
              } else {
                console.log('User is not a member of this group');
              }
              
              clearTimeout(timeoutId);
              ws.close();
              resolve(isMember);
            } else if (message[0] === 'EOSE' && message[1] === 'membership') {
              // End of stored events
              if (!receivedEvents) {
                console.log('No membership lists found, not a member');
                clearTimeout(timeoutId);
                ws.close();
                resolve(false);
              }
            }
          } catch (error) {
            console.error('Error processing membership check:', error);
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error checking membership:', error);
          clearTimeout(timeoutId);
          ws.close();
          resolve(false);
        };
        
        ws.onclose = () => {
          clearTimeout(timeoutId);
        };
      }).catch(error => {
        console.error('Error getting user public key:', error);
        resolve(false);
      });
    } catch (error) {
      console.error('Error in hasJoinedGroupWS:', error);
      resolve(false);
    }
  });
};

/**
 * Fetch group messages using direct WebSocket (no SimplePool)
 * @param {string} groupId - The group identifier
 * @param {string[]} groupRelays - Relays to query
 * @returns {Promise<Array>} Array of group messages
 */
export const fetchGroupMessagesWS = async (groupId, groupRelays = ['wss://groups.0xchat.com']) => {
  return new Promise((resolve) => {
    try {
      // Extract the actual group ID from the compound identifier
      // NIP-29 uses just the identifier part in the 'h' tag, not the full kind:pubkey:identifier
      const groupIdParts = groupId.split(':');
      const actualGroupId = groupIdParts.length === 3 ? groupIdParts[2] : groupId;
      
      console.log(`Fetching messages for group ID: ${actualGroupId}`);
      
      // Use the first relay in the list
      const relayUrl = groupRelays[0];
      console.log(`Creating WebSocket to ${relayUrl} for messages`);
      const ws = new WebSocket(relayUrl);
      let receivedMessages = [];
      let timeoutId;
      
      ws.onopen = () => {
        console.log(`Connected to ${relayUrl}, fetching messages`);
        // Create filter for messages
        const filter = {
          '#h': [actualGroupId], // NIP-29 uses h tag
          limit: 50
        };
        
        console.log('Using filter:', filter);
        
        // Send subscription request
        ws.send(JSON.stringify(['REQ', 'messages', filter]));
        
        // Set timeout
        timeoutId = setTimeout(() => {
          console.log('Message fetch timeout');
          ws.close();
          resolve(receivedMessages); // Return whatever we got
        }, 10000);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message[0] === 'EVENT' && message[1] === 'messages') {
            console.log('Received message:', message[2]);
            receivedMessages.push(message[2]);
          } else if (message[0] === 'EOSE' && message[1] === 'messages') {
            console.log(`Received ${receivedMessages.length} messages in total`);
            // Sort by created_at
            receivedMessages.sort((a, b) => a.created_at - b.created_at);
            clearTimeout(timeoutId);
            ws.close();
            resolve(receivedMessages);
          }
        } catch (error) {
          console.error('Error processing message data:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error fetching messages:', error);
        clearTimeout(timeoutId);
        ws.close();
        resolve([]);
      };
      
      ws.onclose = () => {
        clearTimeout(timeoutId);
      };
    } catch (error) {
      console.error('Error in fetchGroupMessagesWS:', error);
      resolve([]);
    }
  });
};

/**
 * Send a message to a NIP-29 group using direct WebSocket
 * @param {Object} groupInfo - Group information from parseNaddr
 * @param {string} content - Message content
 * @returns {Promise<Object|null>} The published event or null on failure
 */
export const sendGroupMessageWS = async (groupInfo, content) => {
  try {
    console.log(`Sending message to group ${groupInfo.identifier}`);
    const userPubkey = await getUserPublicKey();
    
    if (!userPubkey) {
      console.error('No user public key available - user may not be authenticated');
      throw new Error('User not authenticated with Nostr');
    }
    
    // Create the event object for the message
    const event = {
      kind: 1, // Regular note kind for compatibility
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['h', groupInfo.identifier] // NIP-29 uses h tag with group_id
      ],
      content
    };
    
    console.log('Creating message event:', event);
    
    // Sign the event using existing function
    const signedEvent = await createAndPublishEvent(event);
    if (!signedEvent) {
      throw new Error('Failed to sign message');
    }
    
    console.log('Message signed successfully, publishing to WebSocket');
    
    // Now publish directly to primary group relay with WebSocket
    return new Promise((resolve) => {
      const relayUrl = 'wss://groups.0xchat.com';
      const ws = new WebSocket(relayUrl);
      let messagePublished = false;
      let timeoutId;
      
      ws.onopen = () => {
        console.log(`Connected to ${relayUrl}, sending message`);
        // Send EVENT message
        ws.send(JSON.stringify(['EVENT', signedEvent]));
        
        // Set timeout for response
        timeoutId = setTimeout(() => {
          console.log('Message send timeout, no confirmation received');
          ws.close();
          // Still resolve with the event so UI can update optimistically
          resolve(signedEvent);
        }, 5000);
      };
      
      ws.onmessage = (wsEvent) => {
        try {
          const message = JSON.parse(wsEvent.data);
          if (message[0] === 'OK' && message[1] === signedEvent.id) {
            messagePublished = true;
            console.log('Message published successfully to relay');
            clearTimeout(timeoutId);
            ws.close();
            resolve(signedEvent);
          }
        } catch (error) {
          console.error('Error processing relay response:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error sending message:', error);
        clearTimeout(timeoutId);
        ws.close();
        // Still resolve with the event so UI can update optimistically
        resolve(signedEvent);
      };
      
      ws.onclose = () => {
        clearTimeout(timeoutId);
        if (!messagePublished) {
          // If we didn't get a confirmation but closed normally, still return event
          resolve(signedEvent);
        }
      };
    });
  } catch (error) {
    console.error('Error sending group message:', error);
    return null;
  }
};

/**
 * Subscribe to real-time group messages using direct WebSocket
 * @param {string} groupId - The group identifier
 * @param {Function} onMessage - Callback for new messages
 * @param {Function} onError - Callback for errors
 * @returns {Object} Subscription with close method
 */
export const subscribeToGroupMessagesWS = (groupId, onMessage, onError) => {
  try {
    console.log(`Creating subscription for group: ${groupId}`);
    
    // Extract the actual group identifier
    const groupIdParts = groupId.split(':');
    const actualGroupId = groupIdParts.length === 3 ? groupIdParts[2] : groupId;
    
    console.log(`Using actual group ID: ${actualGroupId}`);
    
    // Create WebSocket connection
    const ws = new WebSocket('wss://groups.0xchat.com');
    
    ws.onopen = () => {
      console.log('Connected to relay for real-time messages');
      // Create filter for recent messages
      const filter = {
        '#h': [actualGroupId],
        since: Math.floor(Date.now() / 1000) - 10 // Last 10 seconds
      };
      
      console.log('Using subscription filter:', filter);
      
      // Send subscription
      ws.send(JSON.stringify(['REQ', 'chat', filter]));
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message[0] === 'EVENT' && message[1] === 'chat') {
          console.log('Received real-time message:', message[2]);
          // Call the callback with the new message
          onMessage(message[2]);
        }
      } catch (error) {
        console.error('Error processing subscription message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket subscription error:', error);
      if (onError) onError(error);
    };
    
    // Return an object with a close method for cleanup
    return {
      close: () => {
        console.log('Closing group messages subscription');
        ws.close();
      }
    };
  } catch (error) {
    console.error('Error creating subscription:', error);
    if (onError) onError(error);
    return {
      close: () => {}
    };
  }
};

/**
 * Join a group using direct WebSocket (no SimplePool)
 * @param {string} naddrString - NIP-19 naddr string for the group
 * @returns {Promise<boolean>} Success status
 */
export const joinGroupWS = async (naddrString) => {
  try {
    console.log(`Joining group with naddr: ${naddrString}`);
    
    if (!naddrString) {
      console.error('No naddr string provided to joinGroupWS');
      throw new Error('Missing group identifier');
    }
    
    const userPubkey = await getUserPublicKey();
    if (!userPubkey) {
      console.error('No user public key available - user may not be authenticated');
      throw new Error('User not authenticated with Nostr');
    }

    // Parse the naddr to get group info
    const groupInfo = parseNaddr(naddrString);
    if (!groupInfo) {
      console.error('Invalid naddr format:', naddrString);
      throw new Error('Invalid group identifier');
    }

    console.log('Parsed group info:', groupInfo);

    // Step 1: Create and publish the group join request event
    const joinEvent = {
      kind: 9021, // NIP-29 join request
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['h', groupInfo.identifier] // The 'h' tag identifies the group
      ],
      content: '' // No content needed for join requests
    };

    console.log('Creating join event:', joinEvent);
    
    // Sign and prepare the event using existing function
    const signedJoinEvent = await createAndPublishEvent(joinEvent);
    if (!signedJoinEvent) {
      throw new Error('Failed to sign join request');
    }
    
    console.log('Join event signed successfully');
    
    // Step 2: Publish the event to the group relay directly
    const publishSuccess = await new Promise((resolve) => {
      const relayUrl = groupInfo.relays?.[0] || 'wss://groups.0xchat.com';
      console.log(`Publishing join request to ${relayUrl}`);
      
      const ws = new WebSocket(relayUrl);
      let eventPublished = false;
      let timeoutId;
      
      ws.onopen = () => {
        console.log(`Connected to ${relayUrl}, sending join request`);
        // Send EVENT message
        ws.send(JSON.stringify(['EVENT', signedJoinEvent]));
        
        // Set timeout for response
        timeoutId = setTimeout(() => {
          console.log('Join request timeout, no confirmation received');
          ws.close();
          resolve(false);
        }, 5000);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message[0] === 'OK' && message[1] === signedJoinEvent.id) {
            eventPublished = true;
            console.log('Join request published successfully');
            clearTimeout(timeoutId);
            ws.close();
            resolve(true);
          }
        } catch (error) {
          console.error('Error processing relay response:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error publishing join request:', error);
        clearTimeout(timeoutId);
        ws.close();
        resolve(false);
      };
      
      ws.onclose = () => {
        clearTimeout(timeoutId);
        if (!eventPublished) {
          // If we didn't get a confirmation but closed normally
          resolve(false);
        }
      };
    });
    
    if (!publishSuccess) {
      console.error('Failed to publish join request to relay');
      return false;
    }
    
    // Step 3: Update NIP-51 list by adding the group with 'a' tag
    console.log('Updating NIP-51 list to include the group');
    const groupTag = `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;
    const listUpdateSuccess = await addGroupToNip51ListWS(groupTag);
    
    if (!listUpdateSuccess) {
      console.error('Failed to update NIP-51 list');
      return false;
    }
    
    console.log('Successfully joined group and updated NIP-51 list');
    return true;
  } catch (error) {
    console.error('Error joining group:', error);
    return false;
  }
};

/**
 * Add a group to the user's NIP-51 groups list using direct WebSocket
 * @param {string} groupTag - Group tag in format kind:pubkey:identifier
 * @returns {Promise<boolean>} Success status
 */
export const addGroupToNip51ListWS = async (groupTag) => {
  try {
    console.log(`Adding group ${groupTag} to NIP-51 list`);
    const userPubkey = await getUserPublicKey();
    
    if (!userPubkey) {
      console.error('No user public key available');
      throw new Error('User not authenticated with Nostr');
    }
    
    // First fetch the current groups list
    let currentList = null;
    const fetchListResult = await new Promise((resolve) => {
      const relayUrl = 'wss://groups.0xchat.com';
      console.log(`Fetching current NIP-51 list from ${relayUrl}`);
      
      const ws = new WebSocket(relayUrl);
      let receivedList = false;
      let timeoutId;
      
      ws.onopen = () => {
        console.log('Connected to relay, fetching current groups list');
        // Query for kind 30001 lists with "groups" d-tag
        const filter = {
          kinds: [30001],
          authors: [userPubkey],
          '#d': ['groups']
        };
        
        // Send subscription request
        ws.send(JSON.stringify(['REQ', 'groupslist', filter]));
        
        // Set timeout for response
        timeoutId = setTimeout(() => {
          console.log('List fetch timeout');
          ws.close();
          resolve(null);
        }, 8000);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message[0] === 'EVENT' && message[1] === 'groupslist') {
            receivedList = true;
            const listEvent = message[2];
            console.log('Found existing groups list:', listEvent);
            clearTimeout(timeoutId);
            ws.close();
            resolve(listEvent);
          } else if (message[0] === 'EOSE' && message[1] === 'groupslist') {
            // End of stored events
            if (!receivedList) {
              console.log('No existing groups list found, will create new one');
              clearTimeout(timeoutId);
              ws.close();
              resolve(null);
            }
          }
        } catch (error) {
          console.error('Error processing list:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error fetching list:', error);
        clearTimeout(timeoutId);
        ws.close();
        resolve(null);
      };
      
      ws.onclose = () => {
        clearTimeout(timeoutId);
      };
    });
    
    // Prepare tags for the new or updated list
    let tags = [];
    
    if (fetchListResult) {
      console.log('Using existing list as base');
      currentList = fetchListResult;
      // Copy existing tags
      tags = [...currentList.tags];
      
      // Check if the group is already in the list
      const groupExists = tags.some(tag => tag[0] === 'a' && tag[1] === groupTag);
      
      if (groupExists) {
        console.log('Group already in list, no update needed');
        return true;
      }
    } else {
      console.log('Creating new list');
      // Add the d tag for new list
      tags.push(['d', 'groups']);
    }
    
    // Add the new group tag
    tags.push(['a', groupTag]);
    
    // Create the updated list event
    const listEvent = {
      kind: 30001,
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
      content: ''
    };
    
    console.log('Creating updated list event:', listEvent);
    
    // Sign and prepare the event
    const signedListEvent = await createAndPublishEvent(listEvent);
    if (!signedListEvent) {
      throw new Error('Failed to sign list update');
    }
    
    console.log('List event signed successfully');
    
    // Publish the updated list
    const publishSuccess = await new Promise((resolve) => {
      const relayUrl = 'wss://groups.0xchat.com';
      console.log(`Publishing updated list to ${relayUrl}`);
      
      const ws = new WebSocket(relayUrl);
      let eventPublished = false;
      let timeoutId;
      
      ws.onopen = () => {
        console.log('Connected to relay, sending updated list');
        // Send EVENT message
        ws.send(JSON.stringify(['EVENT', signedListEvent]));
        
        // Set timeout for response
        timeoutId = setTimeout(() => {
          console.log('List update timeout, no confirmation received');
          ws.close();
          resolve(false);
        }, 5000);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message[0] === 'OK' && message[1] === signedListEvent.id) {
            eventPublished = true;
            console.log('List update published successfully');
            clearTimeout(timeoutId);
            ws.close();
            resolve(true);
          }
        } catch (error) {
          console.error('Error processing relay response:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error publishing list update:', error);
        clearTimeout(timeoutId);
        ws.close();
        resolve(false);
      };
      
      ws.onclose = () => {
        clearTimeout(timeoutId);
        if (!eventPublished) {
          resolve(false);
        }
      };
    });
    
    console.log('List update publish result:', publishSuccess);
    return publishSuccess;
  } catch (error) {
    console.error('Error updating NIP-51 groups list:', error);
    return false;
  }
};

/**
 * Leave a group using direct WebSocket (no SimplePool)
 * @param {string} naddrString - NIP-19 naddr string for the group
 * @returns {Promise<boolean>} Success status
 */
export const leaveGroupWS = async (naddrString) => {
  try {
    console.log(`Leaving group with naddr: ${naddrString}`);
    
    if (!naddrString) {
      console.error('No naddr string provided to leaveGroupWS');
      throw new Error('Missing group identifier');
    }
    
    const userPubkey = await getUserPublicKey();
    if (!userPubkey) {
      console.error('No user public key available - user may not be authenticated');
      throw new Error('User not authenticated with Nostr');
    }

    // Parse the naddr to get group info
    const groupInfo = parseNaddr(naddrString);
    if (!groupInfo) {
      console.error('Invalid naddr format:', naddrString);
      throw new Error('Invalid group identifier');
    }

    console.log('Parsed group info:', groupInfo);

    // Step 1: Create and publish the group leave event
    const leaveEvent = {
      kind: 9022, // NIP-29 leave request
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['h', groupInfo.identifier] // The 'h' tag identifies the group
      ],
      content: '' // No content needed for leave requests
    };

    console.log('Creating leave event:', leaveEvent);
    
    // Sign and prepare the event using existing function
    const signedLeaveEvent = await createAndPublishEvent(leaveEvent);
    if (!signedLeaveEvent) {
      throw new Error('Failed to sign leave request');
    }
    
    console.log('Leave event signed successfully');
    
    // Step 2: Publish the event to the group relay directly
    const publishSuccess = await new Promise((resolve) => {
      const relayUrl = groupInfo.relays?.[0] || 'wss://groups.0xchat.com';
      console.log(`Publishing leave request to ${relayUrl}`);
      
      const ws = new WebSocket(relayUrl);
      let eventPublished = false;
      let timeoutId;
      
      ws.onopen = () => {
        console.log(`Connected to ${relayUrl}, sending leave request`);
        // Send EVENT message
        ws.send(JSON.stringify(['EVENT', signedLeaveEvent]));
        
        // Set timeout for response
        timeoutId = setTimeout(() => {
          console.log('Leave request timeout, no confirmation received');
          ws.close();
          resolve(false);
        }, 5000);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message[0] === 'OK' && message[1] === signedLeaveEvent.id) {
            eventPublished = true;
            console.log('Leave request published successfully');
            clearTimeout(timeoutId);
            ws.close();
            resolve(true);
          }
        } catch (error) {
          console.error('Error processing relay response:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error publishing leave request:', error);
        clearTimeout(timeoutId);
        ws.close();
        resolve(false);
      };
      
      ws.onclose = () => {
        clearTimeout(timeoutId);
        if (!eventPublished) {
          // If we didn't get a confirmation but closed normally
          resolve(false);
        }
      };
    });
    
    if (!publishSuccess) {
      console.error('Failed to publish leave request to relay');
      return false;
    }
    
    // Step 3: Update NIP-51 list by removing the group from the list
    console.log('Updating NIP-51 list to remove the group');
    const groupTag = `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;
    const listUpdateSuccess = await removeGroupFromNip51ListWS(groupTag);
    
    if (!listUpdateSuccess) {
      console.error('Failed to update NIP-51 list');
      return false;
    }
    
    console.log('Successfully left group and updated NIP-51 list');
    return true;
  } catch (error) {
    console.error('Error leaving group:', error);
    return false;
  }
};

/**
 * Remove a group from the user's NIP-51 groups list using direct WebSocket
 * @param {string} groupTag - Group tag in format kind:pubkey:identifier
 * @returns {Promise<boolean>} Success status
 */
export const removeGroupFromNip51ListWS = async (groupTag) => {
  try {
    console.log(`Removing group ${groupTag} from NIP-51 list`);
    const userPubkey = await getUserPublicKey();
    
    if (!userPubkey) {
      console.error('No user public key available');
      throw new Error('User not authenticated with Nostr');
    }
    
    // First fetch the current groups list
    const fetchListResult = await new Promise((resolve) => {
      const relayUrl = 'wss://groups.0xchat.com';
      console.log(`Fetching current NIP-51 list from ${relayUrl}`);
      
      const ws = new WebSocket(relayUrl);
      let receivedList = false;
      let timeoutId;
      
      ws.onopen = () => {
        console.log('Connected to relay, fetching current groups list');
        // Query for kind 30001 lists with "groups" d-tag
        const filter = {
          kinds: [30001],
          authors: [userPubkey],
          '#d': ['groups']
        };
        
        // Send subscription request
        ws.send(JSON.stringify(['REQ', 'groupslist', filter]));
        
        // Set timeout for response
        timeoutId = setTimeout(() => {
          console.log('List fetch timeout');
          ws.close();
          resolve(null);
        }, 8000);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message[0] === 'EVENT' && message[1] === 'groupslist') {
            receivedList = true;
            const listEvent = message[2];
            console.log('Found existing groups list:', listEvent);
            clearTimeout(timeoutId);
            ws.close();
            resolve(listEvent);
          } else if (message[0] === 'EOSE' && message[1] === 'groupslist') {
            // End of stored events
            if (!receivedList) {
              console.log('No existing groups list found, nothing to remove');
              clearTimeout(timeoutId);
              ws.close();
              resolve(null);
            }
          }
        } catch (error) {
          console.error('Error processing list:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error fetching list:', error);
        clearTimeout(timeoutId);
        ws.close();
        resolve(null);
      };
      
      ws.onclose = () => {
        clearTimeout(timeoutId);
      };
    });
    
    // If no list was found, there's nothing to update
    if (!fetchListResult) {
      console.log('No groups list found, nothing to update');
      return true;
    }
    
    // Create a new list of tags without the group to remove
    const currentList = fetchListResult;
    const updatedTags = currentList.tags.filter(tag => 
      !(tag[0] === 'a' && tag[1] === groupTag)
    );
    
    // Check if the group was actually in the list
    if (updatedTags.length === currentList.tags.length) {
      console.log('Group not found in list, no update needed');
      return true;
    }
    
    // Create the updated list event
    const listEvent = {
      kind: 30001,
      created_at: Math.floor(Date.now() / 1000),
      tags: updatedTags,
      content: ''
    };
    
    console.log('Creating updated list event (after removal):', listEvent);
    
    // Sign and prepare the event
    const signedListEvent = await createAndPublishEvent(listEvent);
    if (!signedListEvent) {
      throw new Error('Failed to sign list update');
    }
    
    console.log('List event signed successfully');
    
    // Publish the updated list
    const publishSuccess = await new Promise((resolve) => {
      const relayUrl = 'wss://groups.0xchat.com';
      console.log(`Publishing updated list to ${relayUrl}`);
      
      const ws = new WebSocket(relayUrl);
      let eventPublished = false;
      let timeoutId;
      
      ws.onopen = () => {
        console.log('Connected to relay, sending updated list');
        // Send EVENT message
        ws.send(JSON.stringify(['EVENT', signedListEvent]));
        
        // Set timeout for response
        timeoutId = setTimeout(() => {
          console.log('List update timeout, no confirmation received');
          ws.close();
          resolve(false);
        }, 5000);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message[0] === 'OK' && message[1] === signedListEvent.id) {
            eventPublished = true;
            console.log('List update published successfully');
            clearTimeout(timeoutId);
            ws.close();
            resolve(true);
          }
        } catch (error) {
          console.error('Error processing relay response:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error publishing list update:', error);
        clearTimeout(timeoutId);
        ws.close();
        resolve(false);
      };
      
      ws.onclose = () => {
        clearTimeout(timeoutId);
        if (!eventPublished) {
          resolve(false);
        }
      };
    });
    
    console.log('List update publish result:', publishSuccess);
    return publishSuccess;
  } catch (error) {
    console.error('Error updating NIP-51 groups list:', error);
    return false;
  }
};

/**
 * Fetch a user's group list using direct WebSocket (no SimplePool)
 * @param {string} pubkey - User's public key
 * @returns {Promise<Array>} Array of group entries
 */
export const fetchUserGroupListWS = async (pubkey) => {
  try {
    console.log(`Fetching group list for user: ${pubkey}`);
    if (!pubkey) {
      console.error('No pubkey provided to fetchUserGroupListWS');
      return [];
    }
    
    // Fetch the user's NIP-51 list for groups
    return new Promise((resolve) => {
      const relayUrl = 'wss://groups.0xchat.com';
      console.log(`Creating WebSocket to ${relayUrl} for group list`);
      
      const ws = new WebSocket(relayUrl);
      let receivedList = false;
      let timeoutId;
      
      ws.onopen = () => {
        console.log(`Connected to ${relayUrl}, fetching group list`);
        // Look for NIP-51 lists with groups
        const filter = {
          kinds: [30001],
          authors: [pubkey],
          '#d': ['groups']
        };
        
        // Send subscription request
        ws.send(JSON.stringify(['REQ', 'usergroups', filter]));
        
        // Set timeout for response
        timeoutId = setTimeout(() => {
          console.log('Group list fetch timeout');
          ws.close();
          resolve([]);
        }, 8000);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message[0] === 'EVENT' && message[1] === 'usergroups') {
            receivedList = true;
            const listEvent = message[2];
            
            console.log('Found user groups list event:', listEvent);
            
            // Extract group entries with 'a' tag
            const groupEntries = [];
            for (const tag of listEvent.tags) {
              if (tag[0] === 'a') {
                const parts = tag[1].split(':');
                if (parts.length === 3) {
                  // Format: kind:pubkey:identifier
                  try {
                    // Create naddr for each group
                    const group = {
                      kind: parseInt(parts[0]),
                      pubkey: parts[1],
                      identifier: parts[2]
                    };
                    
                    // Try to encode as naddr if possible
                    try {
                      const naddr = nip19.naddrEncode({
                        kind: group.kind,
                        pubkey: group.pubkey,
                        identifier: group.identifier,
                        relays: ['wss://groups.0xchat.com']
                      });
                      
                      groupEntries.push({
                        ...group,
                        naddr,
                        groupId: `${group.kind}:${group.pubkey}:${group.identifier}`
                      });
                    } catch (encodeError) {
                      console.error('Error encoding naddr:', encodeError);
                      // Still add the group even without naddr
                      groupEntries.push({
                        ...group,
                        groupId: `${group.kind}:${group.pubkey}:${group.identifier}`
                      });
                    }
                  } catch (parseError) {
                    console.error('Error parsing group tag:', parseError);
                  }
                }
              }
            }
            
            console.log(`Found ${groupEntries.length} groups in the list`);
            clearTimeout(timeoutId);
            ws.close();
            resolve(groupEntries);
          } else if (message[0] === 'EOSE' && message[1] === 'usergroups') {
            // End of stored events
            if (!receivedList) {
              console.log('No group lists found for user');
              clearTimeout(timeoutId);
              ws.close();
              resolve([]);
            }
          }
        } catch (error) {
          console.error('Error processing group list:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error fetching group list:', error);
        clearTimeout(timeoutId);
        ws.close();
        resolve([]);
      };
      
      ws.onclose = () => {
        clearTimeout(timeoutId);
      };
    });
  } catch (error) {
    console.error('Error in fetchUserGroupListWS:', error);
    return [];
  }
}; 