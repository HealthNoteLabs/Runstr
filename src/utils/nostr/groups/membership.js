import { SimplePool } from 'nostr-tools';
import { pool, relays } from '../connection.js';
import { createAndPublishEvent } from '../events.js';
import { getUserPublicKey } from '../auth.js';
import { parseNaddr } from '../nip19.js';
import { fetchGroupMetadataByNaddr } from './metadata.js';

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
      // Sign and publish join request
      const publishedRequest = await createAndPublishEvent(joinRequest);
      if (!publishedRequest) {
        throw new Error('Failed to publish join request');
      }
      
      // Also publish specifically to group relays
      pool.sendEvent(groupRelays, publishedRequest);
      
      console.log('Join request sent successfully');
      
      // For compatibility, also update the NIP-51 list
      // This ensures our app can track membership even if relays don't implement NIP-29 fully
      await addGroupToNip51List(groupInfo);
      
      return true;
    } catch (requestError) {
      console.error('Error sending join request:', requestError);
      
      // If group is open, we'll still add to NIP-51 list even if join request fails
      if (isOpenGroup) {
        console.log('Group appears to be open, adding to NIP-51 list anyway');
        await addGroupToNip51List(groupInfo);
        return true;
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
    console.error('Error adding group to NIP-51 list:', error);
    throw error;
  }
};

/**
 * Check if user has joined a group
 * @param {string} naddr - The group naddr 
 * @returns {Promise<boolean>} Whether user has joined
 */
export const hasJoinedGroup = async (naddr) => {
  try {
    console.log(`Checking if user has joined group with naddr: ${naddr}`);
    
    if (!naddr) {
      console.error('No naddr provided to hasJoinedGroup');
      return false;
    }
    
    const userPubkey = await getUserPublicKey();
    if (!userPubkey) {
      console.error('No user public key available - user may not be authenticated');
      return false;
    }

    // Parse the naddr to get group components
    const groupInfo = parseNaddr(naddr);
    if (!groupInfo) {
      console.error('Failed to parse naddr:', naddr);
      return false;
    }

    console.log('Checking membership for group:', groupInfo);

    // Use specialized relays for NIP-29 groups
    const groupRelays = [...new Set([
      'wss://groups.0xchat.com',
      'wss://relay.0xchat.com',
      ...(groupInfo.relays || [])
    ])];

    // Create a temporary pool for this check to avoid issues with global pool
    const groupPool = new SimplePool();

    // First approach: Check NIP-51 list to see if user added the group
    try {
      // Look for the user's group list in NIP-51 (kind 30001 'groups')
      const nip51Filter = {
        kinds: [30001],
        authors: [userPubkey],
        '#d': ['groups']
      };

      const nip51Events = await groupPool.querySync(groupRelays, [nip51Filter]);
      
      if (nip51Events && nip51Events.length > 0) {
        // Sort by created_at to get the latest list
        const latestList = nip51Events.sort((a, b) => b.created_at - a.created_at)[0];
        
        // Check if this group is in the list
        const groupIdentifier = `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;
        const isInList = latestList.tags.some(tag => 
          tag[0] === 'a' && tag[1] === groupIdentifier
        );
        
        if (isInList) {
          await groupPool.close();
          return true; // Found in NIP-51 list, user is a member
        }
      }
    } catch (nip51Error) {
      console.warn('Error checking NIP-51 membership:', nip51Error);
      // Continue to next check
    }

    // Second approach: Check if user was added via NIP-29 put-user event (kind 9000)
    try {
      // Look for kind 9000 (put-user) events that mention this user
      const nip29Filter = {
        kinds: [9000], // put-user event
        '#p': [userPubkey], // User was added as a member
        '#h': [groupInfo.identifier] // For this specific group
      };

      const putUserEvents = await groupPool.querySync(groupRelays, [nip29Filter]);
      
      // If any put-user events exist for this user, they are a member
      if (putUserEvents && putUserEvents.length > 0) {
        await groupPool.close();
        return true; // Found a put-user event, user is a member
      }
    } catch (nip29Error) {
      console.warn('Error checking NIP-29 membership events:', nip29Error);
      // Continue to next check
    }

    // Third approach: Check if the group is "unmanaged" - in NIP-29, everybody is considered a member
    // of unmanaged groups
    try {
      // Check for group metadata to determine if it's managed or unmanaged
      const metadataFilter = {
        kinds: [39000], // Group metadata
        authors: [groupInfo.pubkey],
        '#d': [groupInfo.identifier]
      };

      const metadataEvents = await groupPool.querySync(groupRelays, [metadataFilter]);
      
      // If no metadata exists, the group is likely unmanaged
      if (!metadataEvents || metadataEvents.length === 0) {
        await groupPool.close();
        // According to NIP-29: "In `unmanaged` groups, everybody is considered to be a member."
        return true;
      }
      
      // Check for any messages from the user in this group - if they've sent messages, consider them a member
      const userMessagesFilter = {
        kinds: [1, 39001], // Regular note kind or group message kind
        authors: [userPubkey],
        '#h': [groupInfo.identifier]
      };
      
      const userMessages = await groupPool.querySync(groupRelays, [userMessagesFilter]);
      
      if (userMessages && userMessages.length > 0) {
        await groupPool.close();
        console.log('User has sent messages to this group, considering them a member');
        return true;
      }
    } catch (metadataError) {
      console.warn('Error checking if group is unmanaged:', metadataError);
    }

    await groupPool.close();
    return false; // Not a member according to any method
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
      pool.sendEvent(groupRelays, publishedRequest);
      
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

    // Import the fetchGroupMetadata function to avoid circular dependency
    const { fetchGroupMetadata } = await import('./metadata.js');

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

/**
 * Add a user to a group using NIP-29 standard (kind 42 event)
 * @param {string} naddrString - NIP-19 naddr string for the group
 * @param {string} userPubkey - Public key of the user to add
 * @returns {Promise<object>} The published event
 */
export const addUserToGroup = async (naddrString, userPubkey) => {
  try {
    console.log(`Adding user ${userPubkey} to group ${naddrString}`);
    
    if (!naddrString) {
      throw new Error('Missing group identifier');
    }
    
    if (!userPubkey) {
      throw new Error('Missing user public key');
    }
    
    // Parse the naddr to get group components
    const groupInfo = parseNaddr(naddrString);
    if (!groupInfo) {
      throw new Error('Invalid group data - could not parse naddr');
    }
    
    // Create a NIP-29 compliant member addition event (kind 42)
    const memberAdditionEvent = {
      kind: 42,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', groupInfo.identifier], // Group identifier
        ['p', userPubkey] // User being added
      ],
      content: JSON.stringify({
        members: [userPubkey]
      })
    };
    
    // Sign and publish the event
    const publishedEvent = await createAndPublishEvent(memberAdditionEvent);
    if (!publishedEvent) {
      throw new Error('Failed to publish member addition event');
    }
    
    // Publish to group-specific relays if available
    const groupRelays = [...new Set([
      ...relays,
      ...(groupInfo.relays || [])
    ])];
    
    await pool.sendEvent(groupRelays, publishedEvent);
    
    console.log('Successfully added user to group');
    return publishedEvent;
  } catch (error) {
    console.error('Error adding user to group:', error);
    throw error;
  }
};

/**
 * Remove a user from a group using NIP-29 standard (kind 43 event)
 * @param {string} naddrString - NIP-19 naddr string for the group
 * @param {string} userPubkey - Public key of the user to remove
 * @returns {Promise<object>} The published event
 */
export const removeUserFromGroup = async (naddrString, userPubkey) => {
  try {
    console.log(`Removing user ${userPubkey} from group ${naddrString}`);
    
    if (!naddrString) {
      throw new Error('Missing group identifier');
    }
    
    if (!userPubkey) {
      throw new Error('Missing user public key');
    }
    
    // Parse the naddr to get group components
    const groupInfo = parseNaddr(naddrString);
    if (!groupInfo) {
      throw new Error('Invalid group data - could not parse naddr');
    }
    
    // Create a NIP-29 compliant member removal event (kind 43)
    const memberRemovalEvent = {
      kind: 43,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', groupInfo.identifier], // Group identifier
        ['p', userPubkey] // User being removed
      ],
      content: '' // Usually empty
    };
    
    // Sign and publish the event
    const publishedEvent = await createAndPublishEvent(memberRemovalEvent);
    if (!publishedEvent) {
      throw new Error('Failed to publish member removal event');
    }
    
    // Publish to group-specific relays if available
    const groupRelays = [...new Set([
      ...relays,
      ...(groupInfo.relays || [])
    ])];
    
    await pool.sendEvent(groupRelays, publishedEvent);
    
    console.log('Successfully removed user from group');
    return publishedEvent;
  } catch (error) {
    console.error('Error removing user from group:', error);
    throw error;
  }
}; 