// NDK Group Client - Specialized for NIP-29 group functionality
import NDK from '@nostr-dev-kit/ndk';
import { decode as decodeNip19 } from 'nostr-tools/nip19';
import { getUserPublicKey } from './nostrClient'; // Import the existing auth function

// Use the same relays as in nostr.js for consistency
const relays = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://purplepag.es',
  'wss://groups.0xchat.com',  // Primary NIP-29 group support
  'wss://relay.0xchat.com'
];

// Initialize NDK instance
const ndk = new NDK({
  explicitRelayUrls: relays
});

// Lazy connection - only connect when needed
let connected = false;
export const ensureConnected = async () => {
  if (!connected) {
    console.log("NDK: Connecting to relays...");
    try {
      await ndk.connect();
      connected = true;
      console.log("NDK: Connected successfully");
    } catch (error) {
      console.error("NDK: Connection error:", error);
      throw error;
    }
  }
  return connected;
};

/**
 * Get the current user's pubkey using the app's existing authentication
 * @returns {Promise<string|null>} The user's pubkey or null
 */
const getCurrentUserPubkey = async () => {
  try {
    // Use the existing authentication mechanism
    const pubkey = await getUserPublicKey();
    if (!pubkey) {
      console.log("NDK: No authenticated user found");
    }
    return pubkey;
  } catch (error) {
    console.error("NDK: Error getting current user pubkey:", error);
    return null;
  }
};

/**
 * Parse naddr string using NDK (reuses the logic from nostrClient for consistency)
 * @param {string} naddrString - The naddr string to parse
 * @returns {Object|null} Parsed group data or null if invalid
 */
export const parseNaddrNDK = (naddrString) => {
  try {
    if (!naddrString) {
      console.error('NDK: No naddr string provided');
      return null;
    }
    
    console.log(`NDK: Attempting to parse naddr string: ${naddrString.substring(0, 30)}...`);
    
    // Use nostr-tools decoder for consistency with existing code
    const { type, data } = decodeNip19(naddrString);
    console.log('NDK: Decoded naddr data:', { type, data });
    
    if (type !== 'naddr' || !data) {
      console.error('NDK: Invalid naddr format - expected type "naddr"');
      return null;
    }
    
    const result = {
      kind: data.kind,
      pubkey: data.pubkey,
      identifier: data.identifier,
      relays: data.relays || []
    };
    
    console.log('NDK: Successfully parsed naddr to:', result);
    return result;
  } catch (error) {
    console.error('NDK: Error parsing naddr:', error);
    console.error('NDK: Problematic naddr string:', naddrString);
    return null;
  }
};

/**
 * Fetch group messages using NDK and NIP-29 h tag
 * @param {string} groupId - The group identifier (kind:pubkey:identifier)
 * @param {string[]} groupRelays - Optional additional relays to query
 * @returns {Promise<Array>} Array of group messages
 */
export const fetchGroupMessagesNDK = async (groupId, groupRelays = []) => {
  await ensureConnected();
  
  try {
    // Extract the actual group ID from the compound identifier
    const groupIdParts = groupId.split(':');
    const actualGroupId = groupIdParts.length === 3 ? groupIdParts[2] : groupId;
    
    console.log(`NDK: Extracted group identifier: ${actualGroupId}`);
    
    // Make sure we're using the groups relay, which is critical for NIP-29
    const primaryGroupsRelay = 'wss://groups.0xchat.com';
    let hasGroupsRelay = false;
    
    // Add specific group relays if provided
    if (groupRelays && groupRelays.length > 0) {
      for (const relay of groupRelays) {
        if (relay === primaryGroupsRelay) {
          hasGroupsRelay = true;
        }
        
        if (!ndk.pool.relayList.includes(relay)) {
          try {
            await ndk.pool.addRelay(relay);
            console.log(`NDK: Added relay: ${relay}`);
          } catch (relayError) {
            console.warn(`NDK: Failed to add relay ${relay}:`, relayError);
          }
        }
      }
    }
    
    // Make sure we always have the primary NIP-29 relay
    if (!hasGroupsRelay && !ndk.pool.relayList.includes(primaryGroupsRelay)) {
      console.log(`NDK: Adding primary groups relay: ${primaryGroupsRelay}`);
      try {
        await ndk.pool.addRelay(primaryGroupsRelay);
      } catch (relayError) {
        console.warn(`NDK: Failed to add primary groups relay:`, relayError);
      }
    }
    
    console.log(`NDK: Fetching messages for group ID: ${actualGroupId}`);
    
    // Create NDK filter with the actual group ID - IMPORTANT: use "#h" format for filters
    const filter = { 
      kinds: [1], // Regular note kind per NIP-29
      "#h": [actualGroupId], // NIP-29 uses #h tag with group_id
      limit: 100 // Increase limit to ensure we get enough messages
    };
    
    console.log("NDK: Fetching with filter:", JSON.stringify(filter));
    
    // Create a timeout promise
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('NDK: Fetch timeout after 10 seconds')), 10000);
    });
    
    // Fetch events with timeout
    const fetchPromise = ndk.fetchEvents(filter).then(events => {
      if (!events) return new Set();
      return events;
    });
    
    const events = await Promise.race([fetchPromise, timeout])
      .catch(error => {
        console.error('NDK: Fetch error or timeout:', error);
        return new Set(); // Return empty set on error
      });
    
    const messagesArray = Array.from(events);
    
    console.log(`NDK: Found ${messagesArray.length} group messages`);
    
    // Sort by created_at for consistent display
    return messagesArray.sort((a, b) => a.created_at - b.created_at);
  } catch (error) {
    console.error('NDK: Error fetching group messages:', error);
    return [];
  }
};

/**
 * Setup a subscription for real-time group messages using NDK
 * @param {string} groupId - The group identifier
 * @param {Function} onEvent - Callback for new events
 * @returns {Object} Subscription that can be closed
 */
export const subscribeToGroupNDK = async (groupId) => {
  await ensureConnected();
  
  try {
    // Extract the actual group ID from the compound identifier
    const groupIdParts = groupId.split(':');
    const actualGroupId = groupIdParts.length === 3 ? groupIdParts[2] : groupId;
    
    // Create NDK filter - IMPORTANT: use "#h" format for consistency
    const filter = { 
      kinds: [1], // Regular note kind per NIP-29
      "#h": [actualGroupId], // NIP-29 uses #h tag with group_id
      since: Math.floor(Date.now() / 1000) - 10 // Only new messages
    };
    
    console.log("NDK: Creating subscription with filter:", JSON.stringify(filter));
    
    // Create subscription
    const subscription = ndk.subscribe(filter);
    console.log("NDK: Subscription created");
    
    return subscription;
  } catch (error) {
    console.error('NDK: Error creating group subscription:', error);
    return null;
  }
};

/**
 * Check membership status using NDK
 * @param {string} naddr - Group naddr
 * @returns {Promise<boolean>} True if user is a member
 */
export const hasJoinedGroupNDK = async (naddr) => {
  await ensureConnected();
  
  try {
    // Get current user pubkey using app's authentication
    const pubkey = await getCurrentUserPubkey();
    if (!pubkey) {
      console.log("NDK: No user authenticated, can't check membership");
      return false;
    }
    
    // Parse the naddr
    const groupInfo = parseNaddrNDK(naddr);
    if (!groupInfo) return false;
    
    // 1. Check NIP-51 list membership
    try {
      const nip51Filter = {
        kinds: [30001], // NIP-51 lists
        authors: [pubkey],
        "#d": ["groups"]
      };
      
      const nip51Events = await ndk.fetchEvents(nip51Filter);
      
      if (nip51Events && nip51Events.size > 0) {
        const eventsArray = Array.from(nip51Events);
        // Sort to get the most recent
        const latestEvent = eventsArray.sort((a, b) => b.created_at - a.created_at)[0];
        
        const groupTag = `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;
        const isInList = latestEvent.tags.some(tag => 
          tag[0] === 'a' && tag[1] === groupTag
        );
        
        if (isInList) {
          console.log("NDK: User is a member (found in NIP-51 list)");
          return true;
        }
      }
    } catch (nip51Error) {
      console.warn("NDK: Error checking NIP-51 membership:", nip51Error);
    }
    
    // 2. Check kind 9000 put-user events
    try {
      const putUserFilter = {
        kinds: [9000], // put-user events
        "#p": [pubkey],
        h: [groupInfo.identifier]
      };
      
      const putUserEvents = await ndk.fetchEvents(putUserFilter);
      
      if (putUserEvents && putUserEvents.size > 0) {
        console.log("NDK: User is a member (found put-user event)");
        return true;
      }
    } catch (putUserError) {
      console.warn("NDK: Error checking put-user events:", putUserError);
    }
    
    // 3. Check if group is unmanaged (everyone is a member)
    try {
      const metadataFilter = {
        kinds: [39000], // Group metadata
        authors: [groupInfo.pubkey],
        "#d": [groupInfo.identifier]
      };
      
      const metadataEvents = await ndk.fetchEvents(metadataFilter);
      
      if (!metadataEvents || metadataEvents.size === 0) {
        console.log("NDK: Group appears to be unmanaged, considering user a member");
        return true; // Unmanaged groups consider everyone a member per NIP-29
      }
    } catch (metadataError) {
      console.warn("NDK: Error checking if group is unmanaged:", metadataError);
    }
    
    console.log("NDK: User is not a member of this group");
    return false;
  } catch (error) {
    console.error("NDK: Error checking group membership:", error);
    return false;
  }
};

/**
 * Join a group using NDK
 * @param {string} naddr - Group naddr
 * @returns {Promise<boolean>} Success status
 */
export const joinGroupNDK = async (naddr) => {
  await ensureConnected();
  
  try {
    // Get current user pubkey
    const pubkey = await getCurrentUserPubkey();
    if (!pubkey) {
      console.error("NDK: No authenticated user, can't join group");
      throw new Error("Authentication required to join groups");
    }
    
    // Parse the naddr
    const groupInfo = parseNaddrNDK(naddr);
    if (!groupInfo) {
      throw new Error("Invalid group identifier");
    }
    
    console.log("NDK: Joining group:", groupInfo);
    
    // Create a NIP-51 "groups" list or update existing one
    const listId = "groups";  // Per NIP-51 standard
    
    // Check if we already have a groups list
    const existingListFilter = {
      kinds: [30001],  // NIP-51 lists
      authors: [pubkey],
      "#d": [listId]
    };
    
    // Create a new NDK event
    let ndkEvent;
    const existingLists = await ndk.fetchEvents(existingListFilter);
    
    // The group identifier for the tag
    const groupTag = `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;
    
    if (existingLists && existingLists.size > 0) {
      // We have an existing list, so update it
      const listArray = Array.from(existingLists);
      // Sort to get the most recent list
      const latestList = listArray.sort((a, b) => b.created_at - a.created_at)[0];
      
      // Check if the group is already in the list
      const alreadyInList = latestList.tags.some(tag => 
        tag[0] === 'a' && tag[1] === groupTag
      );
      
      if (alreadyInList) {
        console.log("NDK: Group already in list, no need to update");
        return true;
      }
      
      // Copy existing tags and add the new group
      const tags = [...latestList.tags];
      
      // Add the group to the tags if not already there
      tags.push(['a', groupTag]);
      
      // Create a new NDK event with updated tags
      ndkEvent = {
        kind: 30001,
        tags,
        content: latestList.content || '',
        pubkey, // From authentication
        created_at: Math.floor(Date.now() / 1000)
      };
    } else {
      // Create a new list with this group
      ndkEvent = {
        kind: 30001,
        tags: [
          ['d', listId],
          ['a', groupTag]
        ],
        content: '',
        pubkey, // From authentication
        created_at: Math.floor(Date.now() / 1000)
      };
    }
    
    console.log('NDK: Joining group with event:', ndkEvent);
    
    // Use the existing signing mechanism from nostrClient
    const { createAndPublishEvent } = await import('./nostrClient');
    const publishedEvent = await createAndPublishEvent(ndkEvent);
    
    if (!publishedEvent) {
      throw new Error('Failed to publish group membership event');
    }
    
    console.log('NDK: Successfully joined group');
    return true;
  } catch (error) {
    console.error('NDK: Error joining group:', error);
    throw error;
  }
};

/**
 * Send a message to a group using NDK
 * @param {Object} groupInfo - Group information from parseNaddr
 * @param {string} content - Message content
 * @returns {Promise<Object|null>} The published event or null on failure
 */
export const sendGroupMessageNDK = async (groupInfo, content) => {
  await ensureConnected();
  
  try {
    // Get the user's pubkey
    const pubkey = await getCurrentUserPubkey();
    if (!pubkey) {
      throw new Error('User not authenticated with Nostr');
    }

    // Extract the identifier for the 'h' tag
    const groupIdentifier = groupInfo.identifier;
    
    console.log(`NDK: Sending message to group ${groupIdentifier}`);
    
    // Create a new NDK event
    const ndkEvent = ndk.getDefaultSigner().user;
    if (!ndkEvent) {
      console.error('NDK: No default signer available');
      throw new Error('No signer available for NDK');
    }
    
    // Create event data 
    const eventData = {
      kind: 1, // Regular note kind per NIP-29
      content,
      tags: [
        ['h', groupIdentifier] // NIP-29 uses h tag with group_id
      ],
      pubkey, // From authentication
      created_at: Math.floor(Date.now() / 1000)
    };
    
    // Add relay hints if available
    if (groupInfo.relays && groupInfo.relays.length > 0) {
      for (const relay of groupInfo.relays) {
        eventData.tags.push(['r', relay]);
      }
    }
    
    // Ensure the specific NIP-29 relay is included
    const nip29Relay = 'wss://groups.0xchat.com';
    if (!groupInfo.relays || !groupInfo.relays.includes(nip29Relay)) {
      eventData.tags.push(['r', nip29Relay]);
    }
    
    console.log('NDK: Message event data:', eventData);
    
    // We need to create the event using the existing signing mechanism
    // because we don't want to require the user to approve again if they're
    // already authenticated with the app
    const { createAndPublishEvent } = await import('./nostrClient');
    
    // Use the standard createAndPublishEvent function 
    const signedEvent = await createAndPublishEvent(eventData);
    
    if (!signedEvent) {
      throw new Error('Failed to sign and publish event');
    }
    
    console.log('NDK: Message sent successfully');
    return signedEvent;
  } catch (error) {
    console.error('NDK: Error sending group message:', error);
    return null;
  }
};

// Export NDK instance in case it's needed elsewhere
export { ndk }; 