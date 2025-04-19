import { SimplePool } from 'nostr-tools';
import { pool } from '../connection.js';
import { createAndPublishEvent } from '../events.js';
import { getUserPublicKey } from '../auth.js';

// External dependency which we're maintaining for compatibility
import { ndk, ensureConnection } from '../../nostr.js';

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
    
    // Fix: Create a proper filter for fetching NIP-29 group messages
    // According to NIP-29, we need to use:
    // 1. Kind 39001 for dedicated group messages, but also kind 1 for standard notes
    // 2. 'h' tag for group reference (not '#e' or '#h')
    const filter = {
      kinds: [39001, 1], // Include both standard NIP-29 messages and regular notes with h tag
      '#h': [actualGroupId], // NIP-29 uses h tag with group_id
      limit: 50
    };
    
    console.log(`Fetching group messages with filter:`, filter);
    console.log(`Using relays:`, groupRelays);
    
    // Make sure we have the proper relays
    if (!groupRelays || groupRelays.length === 0) {
      groupRelays = ['wss://groups.0xchat.com', 'wss://relay.0xchat.com'];
    }
    
    // First try using NDK
    let events = [];
    let useNostrTools = false;
    
    // Try with NDK first if available
    if (ndk) {
      try {
        // Ensure NDK is connected
        await ensureConnection();
        
        // Use NDK to fetch events
        console.log('Fetching group messages with NDK');
        const ndkEvents = await ndk.fetchEvents(filter);
        events = Array.from(ndkEvents);
        
        if (events.length > 0) {
          console.log(`Found ${events.length} group messages with NDK`);
          // Convert to plain objects
          return events
            .map(event => event.rawEvent ? event.rawEvent() : event)
            .sort((a, b) => a.created_at - b.created_at);
        } else {
          // If no events found with NDK, try nostr-tools
          useNostrTools = true;
        }
      } catch (ndkError) {
        console.error('Error fetching with NDK:', ndkError);
        useNostrTools = true;
      }
    } else {
      useNostrTools = true;
    }
    
    // Fall back to nostr-tools if needed
    if (useNostrTools) {
      try {
        console.log('Falling back to nostr-tools for fetching group messages');
        const tempPool = new SimplePool();
        events = await tempPool.list(groupRelays, [filter]);
        
        if (!events || events.length === 0) {
          console.log(`No messages found for group ${actualGroupId}`);
          return [];
        }
        
        console.log(`Found ${events.length} group messages with nostr-tools`);
        // Sort by created_at
        return events.sort((a, b) => a.created_at - b.created_at);
      } catch (nostrToolsError) {
        console.error('Error fetching with nostr-tools:', nostrToolsError);
        throw new Error('Failed to fetch group messages: ' + nostrToolsError.message);
      }
    }
    
    // If we get here and have no events, return empty array
    return [];
  } catch (error) {
    console.error('Error fetching group messages:', error);
    return [];
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
 * Post a message to a group using the group ID directly
 * @param {string} groupId - The group identifier 
 * @param {string} content - Message content
 * @returns {Promise<Object|null>} The published event or null on failure
 */
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