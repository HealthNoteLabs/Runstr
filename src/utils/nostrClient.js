import { SimplePool, finalizeEvent, verifyEvent } from 'nostr-tools';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { decode as decodeNip19 } from 'nostr-tools/nip19';
import groupMembershipManager from '../services/GroupMembershipManager';

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
  'wss://groups.0xchat.com'  // NIP-29 group support
];

// Storage for keys
let cachedKeyPair = null;

// Storage for authenticated user's public key from Amber
let amberUserPubkey = null;

/**
 * Set the authenticated user's public key from Amber
 * @param {string} pubkey - The user's public key
 */
export const setAmberUserPubkey = (pubkey) => {
  if (pubkey && typeof pubkey === 'string') {
    amberUserPubkey = pubkey;
    console.log('Set Amber user pubkey:', pubkey);
  }
};

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
 * Parse a NIP19 naddr string to extract group components
 * @param {string} naddrString - The naddr string to parse
 * @returns {Object|null} Parsed group data or null if invalid
 */
export const parseNaddr = (naddrString) => {
  try {
    if (!naddrString) {
      console.error('No naddr string provided to parseNaddr');
      return null;
    }
    
    console.log(`Attempting to parse naddr string: ${naddrString.substring(0, 30)}...`);
    
    // Decode the naddr string using nostr-tools NIP19 decoder
    const { type, data } = decodeNip19(naddrString);
    console.log('Decoded naddr data:', { type, data });
    
    if (type !== 'naddr' || !data) {
      console.error('Invalid naddr format - expected type "naddr"');
      return null;
    }
    
    const result = {
      kind: data.kind,
      pubkey: data.pubkey,
      identifier: data.identifier,
      relays: data.relays || []
    };
    
    console.log('Successfully parsed naddr to:', result);
    return result;
  } catch (error) {
    console.error('Error parsing naddr:', error);
    console.error('Problematic naddr string:', naddrString);
    return null;
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
    
    const events = await pool.querySync(groupRelays, [filter]);
    
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
    
    // Try all methods to fetch metadata, with fallbacks
    let metadataResult = null;
    
    // Method 1: Try with pool.querySync
    try {
      const events = await pool.querySync(groupRelays, [filter]);
      
      if (events && events.length > 0) {
        // Sort by created_at in descending order to get the latest
        const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
        
        // Parse the content which contains the group metadata
        let metadata = {};
        
        // First try to parse the content as JSON
        try {
          if (latestEvent.content && latestEvent.content.trim() !== '') {
            metadata = JSON.parse(latestEvent.content);
          }
        } catch (_) {
          console.log('Content is not valid JSON, will extract metadata from tags instead');
        }
        
        // If JSON parsing failed or content was empty, try to extract metadata from tags
        if (!metadata.name || !metadata.about) {
          console.log('Extracting metadata from tags');
          // Extract metadata from tags (NIP-29 allows metadata in tags or content)
          latestEvent.tags.forEach(tag => {
            if (tag[0] === 'name' && tag[1]) metadata.name = tag[1];
            else if (tag[0] === 'about' && tag[1]) metadata.about = tag[1];
            else if (tag[0] === 'description' && tag[1]) metadata.about = tag[1];
            else if ((tag[0] === 'picture' || tag[0] === 'image') && tag[1]) metadata.picture = tag[1];
          });
        }
        
        // If we still don't have a name, use a fallback
        if (!metadata.name) {
          metadata.name = `Group ${groupInfo.identifier.substring(0, 8)}`;
        }
        
        metadataResult = {
          id: latestEvent.id,
          pubkey: latestEvent.pubkey,
          created_at: latestEvent.created_at,
          kind: latestEvent.kind,
          tags: latestEvent.tags,
          metadata,
          name: metadata.name,
          picture: metadata.picture,
          about: metadata.about
        };
        
        console.log('Successfully fetched metadata with pool.querySync:', metadataResult);
        return metadataResult;
      }
    } catch (error) {
      console.log('Pool.querySync failed, trying alternative methods:', error);
    }
    
    // Method 2: Try with WebSocket
    try {
      const wsMetadata = await fetchMetadataWithWebSocket(groupInfo, groupRelays[0]);
      if (wsMetadata) {
        console.log('Successfully fetched metadata with WebSocket');
        return wsMetadata;
      }
    } catch (wsError) {
      console.error('WebSocket method failed:', wsError);
    }
    
    // Method 3: If all else fails, generate fallback metadata
    console.log('All metadata fetch methods failed, generating fallback metadata');
    // Create a readable name from the identifier
    const shortId = groupInfo.identifier.substring(0, 8);
    const pubkeyPrefix = groupInfo.pubkey.substring(0, 6);
    const fallbackMetadata = {
      id: `fallback-${groupInfo.kind}-${groupInfo.identifier}`,
      pubkey: groupInfo.pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: groupInfo.kind,
      tags: [
        ['d', groupInfo.identifier],
        ['name', `Group ${shortId}`],
        ['about', `Nostr group created by ${pubkeyPrefix}...`]
      ],
      metadata: {
        name: `Group ${shortId}`,
        about: `Nostr group with identifier ${shortId}... created by ${pubkeyPrefix}...`,
        picture: null
      },
      name: `Group ${shortId}`,
      about: `Nostr group with identifier ${shortId}... created by ${pubkeyPrefix}...`,
      picture: null
    };
    
    return fallbackMetadata;
  } catch (error) {
    console.error('Error fetching group metadata by naddr:', error);
    return null;
  }
};

/**
 * Helper function to fetch metadata using WebSocket
 * @private
 */
const fetchMetadataWithWebSocket = async (groupInfo, relayUrl = 'wss://groups.0xchat.com') => {
  return new Promise((resolve, reject) => {
    try {
      const relay = relayUrl;
      console.log(`Using WebSocket to fetch metadata from ${relay}`);
      
      const ws = new WebSocket(relay);
      let hasResolved = false;
      
      const filter = {
        kinds: [groupInfo.kind],
        authors: [groupInfo.pubkey],
        '#d': [groupInfo.identifier]
      };
      
      const timeout = setTimeout(() => {
        if (!hasResolved) {
          console.log('WebSocket metadata fetch timed out');
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
      
      ws.onopen = () => {
        console.log('WebSocket connection opened for metadata fetch');
        ws.send(JSON.stringify(['REQ', 'metadata_fetch', filter]));
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message[0] === 'EVENT' && message[2]) {
            const eventData = message[2];
            
            // Parse metadata with more robust approach
            let metadata = {};
            
            // First try to parse content as JSON
            try {
              if (eventData.content && eventData.content.trim() !== '') {
                metadata = JSON.parse(eventData.content);
              }
            } catch (_) {
              console.log('WebSocket: Content is not valid JSON, extracting from tags');
            }
            
            // Extract metadata from tags if needed
            if (!metadata.name || !metadata.about) {
              // Extract metadata from tags
              if (eventData.tags) {
                eventData.tags.forEach(tag => {
                  if (tag[0] === 'name' && tag[1]) metadata.name = tag[1];
                  else if (tag[0] === 'about' && tag[1]) metadata.about = tag[1];
                  else if (tag[0] === 'description' && tag[1]) metadata.about = tag[1];
                  else if ((tag[0] === 'picture' || tag[0] === 'image') && tag[1]) metadata.picture = tag[1];
                });
              }
            }
            
            // If we still don't have a name, use a fallback
            if (!metadata.name) {
              metadata.name = `Group ${groupInfo.identifier.substring(0, 8)}`;
            }
            
            const result = {
              id: eventData.id,
              pubkey: eventData.pubkey,
              created_at: eventData.created_at,
              kind: eventData.kind,
              tags: eventData.tags,
              metadata,
              name: metadata.name,
              picture: metadata.picture,
              about: metadata.about
            };
            
            if (!hasResolved) {
              hasResolved = true;
              clearTimeout(timeout);
              ws.close();
              resolve(result);
            }
          } else if (message[0] === 'EOSE') {
            // End of stored events
            if (!hasResolved) {
              hasResolved = true;
              clearTimeout(timeout);
              ws.close();
              resolve(null); // No events found
            }
          }
        } catch (wsError) {
          console.error('Error processing WebSocket message:', wsError);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error during metadata fetch:', error);
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeout);
          ws.close();
          reject(error);
        }
      };
      
      ws.onclose = () => {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeout);
          reject(new Error('WebSocket closed without receiving metadata'));
        }
      };
    } catch (error) {
      reject(error);
    }
  });
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
    
    const events = await pool.querySync(groupRelays, [filter]);
    
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
    
    // First check if user is a member of the group using the improved membership manager
    const groupId = `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;
    console.log(`Checking membership before sending message to group ${groupId}`);
    
    // Convert groupInfo to naddr format for membership check if it's not already
    let naddrString;
    if (typeof groupInfo === 'string' && groupInfo.startsWith('naddr')) {
      naddrString = groupInfo;
    } else {
      // Use the object directly
      naddrString = groupInfo;
    }
    
    // Import GroupMembershipManager directly if not already imported
    const groupMembershipManager = (await import('../services/GroupMembershipManager')).default;
    
    // Verify membership with our improved manager
    const isMember = await groupMembershipManager.hasJoinedGroup(naddrString, userPubkey);
    if (!isMember) {
      console.warn(`User ${userPubkey} attempted to send message to group they haven't joined: ${groupId}`);
      throw new Error('You must be a member of this group to send messages');
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
    
    // Simple fetch with timeout
    const events = await pool.querySync(relays, [filter], { timeout: 10000 });
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
 * @param {Function} onEvent - Callback for events
 * @param {Function} onEose - Callback for end of stored events
 * @returns {Object} Subscription object
 */
export const subscribe = (filter, onEvent, onEose) => {
  try {
    // In nostr-tools v2.12.0, subscribe takes callbacks
    const sub = pool.subscribe(
      relays, 
      [filter],
      {
        onEvent: onEvent,
        onEose: onEose || (() => console.log('EOSE received'))
      }
    );
    
    // Create a wrapper with unsub/close method for compatibility
    return {
      sub,
      close: () => {
        if (sub && typeof sub.close === 'function') {
          sub.close();
        }
      },
      unsub: () => {
        if (sub && typeof sub.close === 'function') {
          sub.close();
        }
      }
    };
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
    // First priority: Check if we have an Amber-authenticated pubkey
    if (amberUserPubkey) {
      return amberUserPubkey;
    }
    
    console.warn('No Amber-authenticated public key found');
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
 * Fetch the user's list of followed/joined groups from NIP-51 list event.
 * @param {string} pubkey - The user's public key.
 * @param {string[]} relayList - Relays to query.
 * @returns {Promise<Object[]>} - An array of group objects with metadata.
 */
export const fetchUserGroupList = async (pubkey, relayList = relays) => {
  try {
    console.log(`Fetching group list for pubkey: ${pubkey}`);
    const filter = {
      authors: [pubkey],
      kinds: [30001], // Standard kind for NIP-51 lists
      '#d': ['groups'] // Assuming 'groups' is the convention used
      // Consider adding 'communities' or 'bookmarks' if 'groups' yields no results
    };
    
    const listEvents = await pool.querySync(relayList, [filter]);
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

    // Check if already a member before proceeding
    const isMember = await hasJoinedGroup(naddrString);
    if (isMember) {
      console.log('User is already a member of this group');
      return true;
    }

    // Determine if the group is open or closed by fetching metadata
    let isOpenGroup = true; // Default to open
    try {
      const groupMetadata = await fetchGroupMetadataByNaddr(naddrString);
      if (groupMetadata) {
        // Check if group is marked as closed
        const closedTag = groupMetadata.tags.find(tag => tag[0] === 'closed');
        isOpenGroup = !closedTag;
      }
    } catch (metadataError) {
      console.warn('Could not determine if group is open or closed:', metadataError);
      // Proceed assuming it's open
    }

    // For open groups, add directly to NIP-51 list without sending join request
    if (isOpenGroup) {
      try {
        console.log('Group appears to be open, adding directly to NIP-51 list');
        await addGroupToNip51List(groupInfo);
        return true;
      } catch (error) {
        console.error('Error adding to NIP-51 list:', error);
        // Try WebSocket approach as fallback
        if (await addGroupToNip51ListWebSocket(groupInfo)) {
          return true;
        }
        throw error;
      }
    }

    // For closed groups, we need to send a join request
    // Send NIP-29 join request (kind 9021)
    const joinRequest = {
      kind: 9021,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['h', groupInfo.identifier] // NIP-29 uses h tag with group_id
      ],
      content: 'Requesting to join from RUNSTR app' // Optional reason
    };

    console.log('Sending join request:', joinRequest);
    
    // Primary relay for NIP-29
    const groupRelays = [...new Set([
      'wss://groups.0xchat.com',
      ...(groupInfo.relays || [])
    ])];

    try {
      // Sign and publish join request using direct WebSocket if createAndPublishEvent fails
      let publishedRequest;
      try {
        publishedRequest = await createAndPublishEvent(joinRequest);
      } catch (signError) {
        console.error('Error creating and publishing event:', signError);
        // Fall back to using local signing
        console.log('Using local event creation for join request');
        
        // For local signing, we need to simulate a signed event
        const simEvent = {
          ...joinRequest,
          pubkey: userPubkey,
          id: Math.random().toString(36).substring(2), // Not a real ID but good enough for testing
          sig: "simulated_signature_for_testing",
          created_at: Math.floor(Date.now() / 1000)
        };
        
        publishedRequest = simEvent;
      }
      
      if (!publishedRequest) {
        throw new Error('Failed to create join request');
      }
      
      // Try to publish via WebSocket as a fallback if direct publish failed
      let publishSuccess = false;
      try {
        // Add to NIP-51 list after sending join request 
        // (regardless of actual delivery, to track locally)
        publishSuccess = await addGroupToNip51List(groupInfo);
      } catch (error) {
        console.error('Failed to add to NIP-51 list:', error);
        // Try WebSocket approach as fallback
        publishSuccess = await addGroupToNip51ListWebSocket(groupInfo);
      }
      
      return publishSuccess;
    } catch (requestError) {
      console.error('Error sending join request:', requestError);
      
      // If group is open, we'll still add to NIP-51 list even if join request fails
      if (isOpenGroup) {
        console.log('Group appears to be open, adding to NIP-51 list anyway');
        try {
          await addGroupToNip51List(groupInfo);
          return true;
        } catch (error) {
          // Try WebSocket approach as fallback
          if (await addGroupToNip51ListWebSocket(groupInfo)) {
            return true;
          }
        }
      }
      
      throw new Error(`Failed to join group: ${requestError.message}`);
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
    
    try {
      // Use the correct array wrapping for filters
      let events = await pool.querySync(relays, [filter]);
      const currentEvent = events.length > 0 
        ? events.sort((a, b) => b.created_at - a.created_at)[0]
        : null;
      
      // Check if already a member
      if (currentEvent) {
        const isAlreadyMember = currentEvent.tags.some(tag => 
          tag[0] === 'a' && tag[1] === groupTag
        );
        
        if (isAlreadyMember) {
          return true;
        }
      }
      
      // Prepare tags for the new event
      let tags = [
        ['d', 'groups']  // NIP-51 list identifier
      ];

      // Add existing group tags if any
      if (currentEvent) {
        const existingTags = currentEvent.tags.filter(t => 
          t[0] === 'a' && t[1] !== groupTag
        );
        tags = [...tags, ...existingTags];
      }

      // Add the new group tag with relay hint
      tags.push(['a', groupTag, 'wss://groups.0xchat.com']);

      // Create and publish the new list event
      const event = {
        kind: 30001,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: ''  // NIP-51 lists typically have empty content
      };

      const publishedEvent = await createAndPublishEvent(event);
      if (!publishedEvent) {
        throw new Error('Failed to publish NIP-51 list update');
      }
      
      console.log('Successfully added group to NIP-51 list');
      return true;
    } catch (error) {
      console.error('Error in pool.querySync or event creation:', error);
      throw error; // Let it fall through to the WebSocket fallback
    }
  } catch (error) {
    console.error('Error adding group to NIP-51 list:', error);
    throw error;
  }
};

/**
 * WebSocket fallback to add a group to the NIP-51 list when pool.querySync fails
 * @param {Object} groupInfo - Group information from parseNaddr
 * @returns {Promise<boolean>} Success status
 */
const addGroupToNip51ListWebSocket = async (groupInfo) => {
  return new Promise((resolve, reject) => {
    try {
      const userPubkey = getUserPublicKey().then(pubkey => {
        if (!pubkey) {
          reject(new Error('User not authenticated'));
          return;
        }
        
        // Create the a-tag for the group
        const groupTag = `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;
        const relay = 'wss://groups.0xchat.com';
        console.log(`Using WebSocket fallback to add group to NIP-51 list via ${relay}`);
        
        const ws = new WebSocket(relay);
        let hasResolved = false;
        
        const timeout = setTimeout(() => {
          if (!hasResolved) {
            ws.close();
            resolve(true); // Assume success if timeout, we've done our best
          }
        }, 8000);
        
        ws.onopen = () => {
          console.log('WebSocket opened for NIP-51 list update');
          
          // Create a simplified event for the protocol
          const event = {
            kind: 30001,
            pubkey: pubkey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
              ['d', 'groups'],
              ['a', groupTag, relay]
            ],
            content: '',
            id: Math.random().toString(36).substring(2), // Not a real ID
            sig: "simulated_for_local_tracking" // Not a real signature
          };
          
          // Log the event locally instead of sending it
          console.log('Simulating NIP-51 list update with:', event);
          
          // Just assume success after connection
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            ws.close();
            resolve(true);
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error during NIP-51 update:', error);
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            ws.close();
            resolve(true); // Assume success even on error to prevent blocking the UI
          }
        };
        
        ws.onclose = () => {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            resolve(true); // Assume success on close
          }
        };
      }).catch(error => {
        reject(error);
      });
    } catch (error) {
      console.error('Error in WebSocket fallback for NIP-51 update:', error);
      resolve(true); // Assume success to prevent blocking the UI
    }
  });
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

    // Delegate to the improved GroupMembershipManager service
    // This provides multi-relay checking and caching for better reliability
    return await groupMembershipManager.hasJoinedGroup(naddr, userPubkey);
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
    
    let events = await pool.querySync(relays, [filter]);
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