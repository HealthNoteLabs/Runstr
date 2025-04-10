/**
 * NIP29Bridge.js
 * Service responsible for synchronizing centralized clubs with Nostr NIP29 groups
 * 
 * This service handles:
 * 1. Creating NIP29 groups when clubs are created
 * 2. Synchronizing messages between club chat and Nostr group
 * 3. Managing group membership
 * 4. Handling background processing to maintain performance
 */

import { SimplePool } from 'nostr-tools';
import { getUserPublicKey, createAndPublishEvent } from '../utils/nostrClient';

// NIP29 event kinds
const NIP29_KINDS = {
  GROUP_CREATION: 80,      // To create a new group
  GROUP_METADATA: 81,      // To change group metadata
  GROUP_MEMBERSHIP: 82,    // To determine membership status of a user in a group
  GROUP_LIST: 83,          // To list groups
  GROUP_MESSAGES: 84,      // For messages sent to the group
  GROUP_HIDE_MESSAGE: 85,  // For hiding a message in a group
  GROUP_REMOVE_MESSAGE: 86 // For removing a message in a group
};

// In-memory queue for outgoing messages
let outgoingMessageQueue = [];

// Background worker status
let isWorkerRunning = false;

class NIP29Bridge {
  constructor() {
    this.pool = new SimplePool();
    this.relays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band',
      'wss://relay.snort.social'
    ];
    this.subscriptions = new Map();
    this.listeners = [];
    this.processInterval = null;
    this.syncInterval = null;
    this.isInitialized = false;
    
    // Mapping between club IDs and Nostr group IDs
    this.clubToGroupMap = new Map();
  }

  /**
   * Initialize the bridge
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      // Load club-to-group mappings from storage
      this.loadMappings();
      
      // Start background processing
      this.startBackgroundProcessing();
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize NIP29Bridge:', error);
      return false;
    }
  }

  /**
   * Create a NIP29 group for a club
   * @param {Object} clubData - Club data from the centralized system
   * @returns {Promise<Object>} Created group data including eventId
   */
  async createGroupForClub(clubData) {
    try {
      const pubkey = await getUserPublicKey();
      if (!pubkey) {
        throw new Error('User not authenticated with Nostr');
      }
      
      // Create group metadata
      const metadata = {
        name: clubData.name,
        about: clubData.description || '',
        picture: clubData.picture || '',
        created_at: Math.floor(Date.now() / 1000)
      };
      
      // Create the group creation event
      const event = await createAndPublishEvent({
        kind: NIP29_KINDS.GROUP_CREATION,
        content: JSON.stringify(metadata),
        tags: []
      });
      
      if (!event) {
        throw new Error('Failed to create Nostr group');
      }
      
      // Store the mapping
      this.clubToGroupMap.set(clubData.id, event.id);
      this.saveMappings();
      
      // Subscribe to events for this group
      this.subscribeToGroupEvents(event.id);
      
      return {
        clubId: clubData.id,
        groupId: event.id,
        metadata
      };
    } catch (error) {
      console.error('Error creating group for club:', error);
      throw error;
    }
  }

  /**
   * Add a user to a Nostr group
   * @param {string} clubId - Club ID
   * @param {string} userPubkey - User's Nostr public key
   * @returns {Promise<boolean>} Success status
   */
  async addUserToGroup(clubId, userPubkey) {
    try {
      const groupId = this.getGroupIdForClub(clubId);
      if (!groupId) {
        throw new Error('No Nostr group found for this club');
      }
      
      // Create membership event
      const event = await createAndPublishEvent({
        kind: NIP29_KINDS.GROUP_MEMBERSHIP,
        content: '',
        tags: [
          ['e', groupId],
          ['p', userPubkey],
          ['role', 'member']
        ]
      });
      
      return !!event;
    } catch (error) {
      console.error('Error adding user to group:', error);
      return false;
    }
  }

  /**
   * Send a message to a Nostr group
   * @param {string} clubId - Club ID
   * @param {string} content - Message content
   * @param {string} userPubkey - User's Nostr public key
   * @returns {Promise<Object>} The created message event
   */
  async sendMessageToGroup(clubId, content, userPubkey) {
    try {
      const groupId = this.getGroupIdForClub(clubId);
      if (!groupId) {
        throw new Error('No Nostr group found for this club');
      }
      
      // Add to queue for background processing
      const queueItem = {
        type: 'outgoing_message',
        clubId,
        groupId,
        content,
        userPubkey,
        timestamp: Date.now()
      };
      
      outgoingMessageQueue.push(queueItem);
      
      // Process immediately if possible, otherwise let background worker handle it
      if (!isWorkerRunning) {
        await this.processQueue();
      }
      
      return { queued: true, item: queueItem };
    } catch (error) {
      console.error('Error sending message to group:', error);
      throw error;
    }
  }

  /**
   * Process the outgoing message queue
   * @returns {Promise<void>}
   */
  async processQueue() {
    if (isWorkerRunning) return;
    
    isWorkerRunning = true;
    
    try {
      while (outgoingMessageQueue.length > 0) {
        const item = outgoingMessageQueue.shift();
        
        if (item.type === 'outgoing_message') {
          // Create and publish the message event
          await createAndPublishEvent({
            kind: NIP29_KINDS.GROUP_MESSAGES,
            content: item.content,
            tags: [
              ['e', item.groupId, '', 'root'],
              ['client', 'RUNSTR App']
            ]
          });
        }
        
        // Small delay to prevent overwhelming relays
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error('Error processing message queue:', error);
      
      // If processing fails, put items back in queue
      // but only retain the last 50 to prevent queue explosion
      if (outgoingMessageQueue.length > 50) {
        outgoingMessageQueue = outgoingMessageQueue.slice(-50);
      }
    } finally {
      isWorkerRunning = false;
    }
  }

  /**
   * Subscribe to events for a specific group
   * @param {string} groupId - Nostr group ID
   * @returns {Object} Subscription
   */
  subscribeToGroupEvents(groupId) {
    // Check if we already have a subscription
    if (this.subscriptions.has(groupId)) {
      return this.subscriptions.get(groupId);
    }
    
    // Create filter for group messages
    const filter = {
      kinds: [NIP29_KINDS.GROUP_MESSAGES],
      '#e': [groupId],
      limit: 50
    };
    
    // Subscribe to events
    const sub = this.pool.sub(this.relays, [filter]);
    
    // Handle incoming events
    sub.on('event', event => {
      // Find club ID from group ID
      const clubId = this.getClubIdForGroup(groupId);
      if (!clubId) return;
      
      // Notify listeners about the new message
      this.notifyListeners('incoming_message', {
        clubId,
        groupId,
        event
      });
    });
    
    // Store subscription
    this.subscriptions.set(groupId, sub);
    
    return sub;
  }

  /**
   * Add listener for bridge events
   * @param {function} callback - Callback function
   */
  addListener(callback) {
    if (typeof callback === 'function' && !this.listeners.includes(callback)) {
      this.listeners.push(callback);
    }
  }

  /**
   * Remove listener
   * @param {function} callback - Callback function to remove
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  /**
   * Notify all listeners about an event
   * @param {string} eventType - Type of event
   * @param {Object} data - Event data
   */
  notifyListeners(eventType, data) {
    this.listeners.forEach(listener => {
      try {
        listener(eventType, data);
      } catch (error) {
        console.error('Error in NIP29Bridge listener:', error);
      }
    });
  }

  /**
   * Get group ID for a club
   * @param {string} clubId - Club ID
   * @returns {string|null} Nostr group ID or null
   */
  getGroupIdForClub(clubId) {
    return this.clubToGroupMap.get(clubId) || null;
  }

  /**
   * Get club ID for a group
   * @param {string} groupId - Nostr group ID
   * @returns {string|null} Club ID or null
   */
  getClubIdForGroup(groupId) {
    for (const [clubId, gid] of this.clubToGroupMap.entries()) {
      if (gid === groupId) {
        return clubId;
      }
    }
    return null;
  }

  /**
   * Save club-to-group mappings to localStorage
   */
  saveMappings() {
    try {
      const mappings = Object.fromEntries(this.clubToGroupMap);
      localStorage.setItem('nip29_mappings', JSON.stringify(mappings));
    } catch (error) {
      console.error('Error saving NIP29 mappings:', error);
    }
  }

  /**
   * Load club-to-group mappings from localStorage
   */
  loadMappings() {
    try {
      const mappings = localStorage.getItem('nip29_mappings');
      if (mappings) {
        this.clubToGroupMap = new Map(Object.entries(JSON.parse(mappings)));
        
        // Subscribe to all mapped groups
        for (const groupId of this.clubToGroupMap.values()) {
          this.subscribeToGroupEvents(groupId);
        }
      }
    } catch (error) {
      console.error('Error loading NIP29 mappings:', error);
    }
  }

  /**
   * Start background processing for queues and synchronization
   */
  startBackgroundProcessing() {
    // Process queue every 3 seconds
    this.processInterval = setInterval(() => {
      if (!isWorkerRunning && outgoingMessageQueue.length > 0) {
        this.processQueue().catch(error => {
          console.error('Error in background queue processing:', error);
        });
      }
    }, 3000);
    
    // Sync with Nostr every 2 minutes
    this.syncInterval = setInterval(() => {
      this.syncGroups().catch(error => {
        console.error('Error in background group sync:', error);
      });
    }, 120000);
  }

  /**
   * Stop background processing
   */
  stopBackgroundProcessing() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Sync all mapped groups with Nostr
   * @returns {Promise<void>}
   */
  async syncGroups() {
    try {
      // For each mapped group, check for new messages
      for (const [clubId, groupId] of this.clubToGroupMap.entries()) {
        // Get last 20 messages from Nostr
        const events = await this.pool.list(this.relays, [{
          kinds: [NIP29_KINDS.GROUP_MESSAGES],
          '#e': [groupId],
          limit: 20
        }]);
        
        // Process events if any
        if (events && events.length > 0) {
          // Sort by created_at
          events.sort((a, b) => a.created_at - b.created_at);
          
          // Notify about each event
          for (const event of events) {
            this.notifyListeners('sync_message', {
              clubId,
              groupId,
              event
            });
          }
        }
      }
    } catch (error) {
      console.error('Error syncing groups:', error);
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopBackgroundProcessing();
    
    // Close all subscriptions
    for (const sub of this.subscriptions.values()) {
      sub.unsub();
    }
    
    this.subscriptions.clear();
    this.listeners = [];
  }
}

// Create and export singleton instance
const nip29Bridge = new NIP29Bridge();
export default nip29Bridge; 