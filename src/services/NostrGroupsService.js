/**
 * NostrGroupsService.js
 * Service for NIP-29 group functionality with fully Nostr-native approach (no local storage)
 */

import {
  joinGroup,
  leaveGroup,
  hasJoinedGroup,
  parseNaddr,
  fetchGroupMetadataByNaddr,
  fetchGroupMessages,
  sendGroupMessage,
  fetchUserGroupList,
  createNostrEvent,
  publishEvent,
  fetchEventsWithNDK
} from '../utils/nostrClient';

class NostrGroupsService {
  constructor() {
    this.listeners = [];
  }

  /**
   * Join a Nostr group
   * @param {string} naddr - Group address
   * @returns {Promise<boolean>} Success status
   */
  async joinGroup(naddr) {
    try {
      const result = await joinGroup(naddr);
      this._notifyListeners('join', naddr, result);
      return result;
    } catch (error) {
      console.error('NostrGroupsService: Error joining group:', error);
      this._notifyListeners('join', naddr, false, error.message);
      throw error;
    }
  }

  /**
   * Leave a Nostr group
   * @param {string} naddr - Group address
   * @returns {Promise<boolean>} Success status
   */
  async leaveGroup(naddr) {
    try {
      const result = await leaveGroup(naddr);
      this._notifyListeners('leave', naddr, result);
      return result;
    } catch (error) {
      console.error('NostrGroupsService: Error leaving group:', error);
      this._notifyListeners('leave', naddr, false, error.message);
      throw error;
    }
  }

  /**
   * Check if user is a member of a group
   * @param {string} naddr - Group address
   * @returns {Promise<boolean>} Membership status
   */
  async isGroupMember(naddr) {
    try {
      return await hasJoinedGroup(naddr);
    } catch (error) {
      console.error('NostrGroupsService: Error checking group membership:', error);
      return false;
    }
  }

  /**
   * Fetch group metadata
   * @param {string} naddr - Group address
   * @returns {Promise<Object>} Group metadata
   */
  async getGroupMetadata(naddr) {
    try {
      if (!naddr) {
        console.error('NostrGroupsService: Cannot fetch group metadata - no naddr provided');
        return null;
      }
      
      console.log('NostrGroupsService: Fetching metadata for group:', naddr);
      const metadata = await fetchGroupMetadataByNaddr(naddr);
      console.log('NostrGroupsService: Metadata fetch result:', !!metadata);
      return metadata;
    } catch (error) {
      console.error('NostrGroupsService: Error fetching group metadata:', error);
      throw error;
    }
  }

  /**
   * Fetch messages for a group
   * @param {Object} groupData - Group data with kind, pubkey, identifier
   * @param {number} limit - Maximum number of messages to fetch
   * @returns {Promise<Array>} Array of messages
   */
  async fetchGroupMessages(groupData, limit = 50) {
    try {
      const groupId = `${groupData.kind}:${groupData.pubkey}:${groupData.identifier}`;
      const relays = groupData.relays?.length > 0 ? 
        groupData.relays : ['wss://groups.0xchat.com'];
      
      return await fetchGroupMessages(groupId, relays, limit);
    } catch (error) {
      console.error('NostrGroupsService: Error fetching group messages:', error);
      return [];
    }
  }

  /**
   * Send a message to a group
   * @param {Object} groupInfo - Group information from parseNaddr
   * @param {string} content - Message content
   * @returns {Promise<Object|null>} The published event or null on failure
   */
  async sendMessage(groupInfo, content) {
    try {
      return await sendGroupMessage(groupInfo, content);
    } catch (error) {
      console.error('NostrGroupsService: Error sending message:', error);
      throw error;
    }
  }

  /**
   * Fetch user's joined groups via NIP-51 list
   * @param {string} pubkey - User's public key
   * @returns {Promise<Array>} User's groups
   */
  async fetchUserGroups(pubkey) {
    try {
      if (!pubkey) {
        console.error('NostrGroupsService: Cannot fetch user groups - no pubkey provided');
        return [];
      }
      
      console.log('NostrGroupsService: Fetching groups for pubkey:', pubkey);
      const groups = await fetchUserGroupList(pubkey);
      console.log('NostrGroupsService: Fetched groups count:', groups?.length || 0);
      return groups || [];
    } catch (error) {
      console.error('NostrGroupsService: Error fetching user groups:', error);
      return [];
    }
  }

  /**
   * Create or get a pinned messages list for a group
   * @param {string} groupNaddr - Group naddr
   * @param {string} userPubkey - User's public key
   * @returns {Promise<Object|null>} Pinned messages list event or null
   * @private
   */
  async _getPinnedMessagesList(groupNaddr, userPubkey) {
    try {
      // Create a d tag value that uniquely identifies this pinned messages list
      const listId = `pinned_messages:${groupNaddr}`;
      
      // Find existing list
      const filter = {
        kinds: [30001], // NIP-51 lists
        authors: [userPubkey],
        '#d': [listId]
      };
      
      const lists = await fetchEventsWithNDK(filter);
      
      // Return most recent list if exists
      if (lists && lists.length > 0) {
        return lists.sort((a, b) => b.created_at - a.created_at)[0];
      }
      
      return null;
    } catch (error) {
      console.error('NostrGroupsService: Error getting pinned messages list:', error);
      return null;
    }
  }

  /**
   * Get pinned messages for a group using Nostr NIP-51 lists
   * @param {string} groupNaddr - Group naddr
   * @param {string} userPubkey - User public key
   * @returns {Promise<Array>} Pinned messages
   */
  async getPinnedMessages(groupNaddr, userPubkey) {
    try {
      // Get properly decoded naddr if needed
      const decodedNaddr = groupNaddr.startsWith('naddr') ? 
        groupNaddr : decodeURIComponent(groupNaddr);
      
      // Get the pinned messages list
      const listEvent = await this._getPinnedMessagesList(decodedNaddr, userPubkey);
      if (!listEvent) {
        return [];
      }
      
      // Extract message IDs from list
      const messageIds = listEvent.tags
        .filter(tag => tag[0] === 'e')
        .map(tag => tag[1]);
      
      if (messageIds.length === 0) {
        return [];
      }
      
      // Fetch the actual message events
      const filter = {
        ids: messageIds
      };
      
      const messages = await fetchEventsWithNDK(filter);
      return messages || [];
    } catch (error) {
      console.error('NostrGroupsService: Error getting pinned messages:', error);
      return [];
    }
  }

  /**
   * Pin a message in a group using Nostr NIP-51 lists
   * @param {Object} message - Message to pin 
   * @param {string} groupNaddr - Group naddr
   * @param {string} userPubkey - User public key
   * @returns {Promise<boolean>} Success status
   */
  async pinMessage(message, groupNaddr, userPubkey) {
    try {
      // Get properly decoded naddr if needed
      const decodedNaddr = groupNaddr.startsWith('naddr') ? 
        groupNaddr : decodeURIComponent(groupNaddr);
      
      // Create a d tag value that uniquely identifies this pinned messages list
      const listId = `pinned_messages:${decodedNaddr}`;
      
      // Get existing list or create a new one
      let listEvent = await this._getPinnedMessagesList(decodedNaddr, userPubkey);
      
      // If no list exists, create a new one
      if (!listEvent) {
        // Create a new list event
        const event = {
          kind: 30001, // NIP-51 lists
          tags: [
            ['d', listId],
            ['name', 'Pinned Messages'],
            ['description', `Pinned messages for group ${decodedNaddr}`],
            ['e', message.id, '', 'root'] // First pinned message
          ],
          content: '',
          created_at: Math.floor(Date.now() / 1000)
        };
        
        const publishedEvent = await publishEvent(event);
        return !!publishedEvent;
      }
      
      // Check if message is already pinned
      const alreadyPinned = listEvent.tags.some(tag => 
        tag[0] === 'e' && tag[1] === message.id
      );
      
      if (alreadyPinned) {
        return true; // Already pinned, no need to do anything
      }
      
      // Add message to existing list
      const updatedTags = [...listEvent.tags, ['e', message.id, '', 'root']];
      
      // Create updated list event
      const updatedEvent = {
        kind: 30001,
        tags: updatedTags,
        content: '',
        created_at: Math.floor(Date.now() / 1000)
      };
      
      const publishedEvent = await publishEvent(updatedEvent);
      return !!publishedEvent;
    } catch (error) {
      console.error('NostrGroupsService: Error pinning message:', error);
      return false;
    }
  }

  /**
   * Unpin a message in a group using Nostr NIP-51 lists
   * @param {string} messageId - ID of message to unpin
   * @param {string} groupNaddr - Group naddr
   * @param {string} userPubkey - User public key
   * @returns {Promise<boolean>} Success status
   */
  async unpinMessage(messageId, groupNaddr, userPubkey) {
    try {
      // Get properly decoded naddr if needed
      const decodedNaddr = groupNaddr.startsWith('naddr') ? 
        groupNaddr : decodeURIComponent(groupNaddr);
      
      // Get the pinned messages list
      const listEvent = await this._getPinnedMessagesList(decodedNaddr, userPubkey);
      if (!listEvent) {
        return false; // No list exists, nothing to unpin
      }
      
      // Check if message is pinned
      const isPinned = listEvent.tags.some(tag => 
        tag[0] === 'e' && tag[1] === messageId
      );
      
      if (!isPinned) {
        return true; // Already not pinned, no need to do anything
      }
      
      // Filter out the message to unpin
      const updatedTags = listEvent.tags.filter(tag => 
        !(tag[0] === 'e' && tag[1] === messageId)
      );
      
      // Create updated list event
      const updatedEvent = {
        kind: 30001,
        tags: updatedTags,
        content: '',
        created_at: Math.floor(Date.now() / 1000)
      };
      
      const publishedEvent = await publishEvent(updatedEvent);
      return !!publishedEvent;
    } catch (error) {
      console.error('NostrGroupsService: Error unpinning message:', error);
      return false;
    }
  }

  /**
   * Add a listener for group operations
   * @param {Function} listener - Callback function
   * @returns {Function} Function to remove the listener
   */
  addListener(listener) {
    this.listeners.push(listener);
    
    // Return function to remove listener
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of group operations
   * @param {string} action - The action being performed
   * @param {string} naddr - Group naddr
   * @param {boolean} success - Whether the operation succeeded
   * @param {string} error - Optional error message
   * @private
   */
  _notifyListeners(action, naddr, success, error = null) {
    const eventData = { action, naddr, success, error };
    this.listeners.forEach(listener => {
      try {
        listener(eventData);
      } catch (err) {
        console.error('Error in group listener:', err);
      }
    });
  }
}

export default new NostrGroupsService(); 