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

// NIP-29 event kinds
const NIP29_KINDS = {
  GROUP_CREATION: 80,      // To create a new group
  GROUP_METADATA: 81,      // To change group metadata
  GROUP_MEMBERSHIP: 82,    // To determine membership status of a user in a group
  GROUP_LIST: 83,          // To list groups
  GROUP_MESSAGES: 84,      // For messages sent to the group
  GROUP_HIDE_MESSAGE: 85,  // For hiding a message in a group
  GROUP_REMOVE_MESSAGE: 86 // For removing a message in a group
};

// Near the top of the file, add IndexedDB constants and helper
// Storage configuration
const DB_NAME = 'runstr_nostr_db';
const DB_VERSION = 1;
const MAPPINGS_STORE = 'club_group_mappings';

/**
 * NIP-29 validation requirements by event kind
 */
const NIP29_VALIDATION_RULES = {
  [NIP29_KINDS.GROUP_CREATION]: {
    requiredTags: [],
    optionalTags: ['d', 'name', 'description', 'image', 'rules'],
    validateContent: (content) => {
      try {
        const metadata = JSON.parse(content);
        return (
          typeof metadata === 'object' &&
          typeof metadata.name === 'string' &&
          metadata.name.length > 0
        );
      } catch (_) {
        return false;
      }
    }
  },
  [NIP29_KINDS.GROUP_METADATA]: {
    requiredTags: [['e', true]], // e tag with reference to group creation event
    optionalTags: ['d', 'name', 'description', 'image', 'rules'],
    validateContent: (content) => {
      try {
        const metadata = JSON.parse(content);
        return typeof metadata === 'object';
      } catch (_) {
        return false;
      }
    }
  },
  [NIP29_KINDS.GROUP_MEMBERSHIP]: {
    requiredTags: [
      ['e', true], // e tag with reference to group creation event
      ['p', true], // p tag with reference to member pubkey
      ['role', true] // role tag (admin, moderator, member)
    ],
    optionalTags: [],
    validateContent: () => true // Content can be anything or empty
  },
  [NIP29_KINDS.GROUP_MESSAGES]: {
    requiredTags: [['e', true]], // e tag with reference to group creation event
    optionalTags: ['subject', 'reply', 'root', 'client'],
    validateContent: (content) => content !== undefined // Just ensure content exists
  },
  [NIP29_KINDS.GROUP_HIDE_MESSAGE]: {
    requiredTags: [
      ['e', true, 'group'], // e tag with reference to group creation event
      ['e', true, 'message'] // e tag with reference to message to hide
    ],
    optionalTags: ['reason'],
    validateContent: () => true
  },
  [NIP29_KINDS.GROUP_REMOVE_MESSAGE]: {
    requiredTags: [
      ['e', true, 'group'], // e tag with reference to group creation event
      ['e', true, 'message'] // e tag with reference to message to remove
    ],
    optionalTags: ['reason'],
    validateContent: () => true
  }
};

// In-memory queue for outgoing messages
let outgoingMessageQueue = [];

// Background worker status
let isWorkerRunning = false;

/**
 * Initialize or open the IndexedDB database
 * @returns {Promise<IDBDatabase>} The database instance
 */
const openDatabase = () => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn('IndexedDB not supported, falling back to localStorage only');
      reject(new Error('IndexedDB not supported'));
      return;
    }
    
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('Error opening IndexedDB:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object store for club-to-group mappings
      if (!db.objectStoreNames.contains(MAPPINGS_STORE)) {
        db.createObjectStore(MAPPINGS_STORE, { keyPath: 'clubId' });
        console.log('Created IndexedDB object store for club-group mappings');
      }
    };
  });
};

class NIP29Bridge {
  constructor() {
    this.pool = new SimplePool();
    this.relays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band',
      'wss://relay.snort.social',
      'wss://relay.0xchat.com'  // Specialized relay with strong NIP-29 support
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
      
      // Create a standard-compliant NIP-29 group creation event
      const eventTemplate = this.createStandardNIP29Event(NIP29_KINDS.GROUP_CREATION, {
        name: clubData.name,
        about: clubData.description || '',
        picture: clubData.picture || '',
        additionalMetadata: {
          created_by: 'RUNSTR App',
          tags: ['running', 'fitness', 'runstr'],
          website: clubData.website || '',
          customFields: clubData.customFields || {}
        },
        tags: [
          ['t', 'running'],
          ['t', 'runstr']
        ]
      });
      
      // Add pubkey to the event template
      eventTemplate.pubkey = pubkey;
      
      // Create and publish the event
      const event = await createAndPublishEvent(eventTemplate);
      
      if (!event) {
        throw new Error('Failed to create Nostr group');
      }
      
      // Store the mapping
      this.clubToGroupMap.set(clubData.id, event.id);
      this.saveMappings();
      
      // Subscribe to events for this group
      this.subscribeToGroupEvents(event.id);
      
      // Verify the group visibility on relays
      setTimeout(() => {
        this.verifyGroupVisibility(event.id).then(visibility => {
          console.log(`Group ${clubData.name} visibility status:`, visibility);
        });
      }, 5000); // Give relays some time to process the event
      
      return {
        clubId: clubData.id,
        groupId: event.id,
        metadata: {
          name: clubData.name,
          about: clubData.description || '',
          picture: clubData.picture || ''
        },
        event: event
      };
    } catch (error) {
      console.error('Error creating group for club:', error);
      throw error;
    }
  }

  /**
   * Verify if a group is visible on connected relays
   * @param {string} groupId - The Nostr event ID of the group
   * @returns {Promise<Object>} Visibility status across relays
   */
  async verifyGroupVisibility(groupId) {
    try {
      console.log(`Verifying visibility of group ${groupId}...`);
      
      const results = {
        groupId,
        timestamp: Date.now(),
        overallStatus: false,
        relayResults: {},
        visibleOn: 0,
        totalRelays: this.relays.length
      };
      
      // Check each relay individually
      for (const relay of this.relays) {
        try {
          // Create a temporary pool for just this relay
          const tempPool = new SimplePool();
          
          // Construct filter to find this specific group
          const filter = {
            kinds: [NIP29_KINDS.GROUP_CREATION],
            ids: [groupId]
          };
          
          // Try to fetch the group from this specific relay
          const events = await tempPool.list([relay], [filter], { timeout: 5000 });
          
          // Check if we found the group
          const found = events && events.length > 0;
          
          results.relayResults[relay] = {
            found,
            timestamp: Date.now()
          };
          
          if (found) {
            results.visibleOn++;
          }
        } catch (relayError) {
          results.relayResults[relay] = {
            found: false,
            error: relayError.message,
            timestamp: Date.now()
          };
        }
      }
      
      // Group is considered visible if it's on at least one relay
      results.overallStatus = results.visibleOn > 0;
      
      return results;
    } catch (error) {
      console.error('Error verifying group visibility:', error);
      return {
        groupId,
        overallStatus: false,
        error: error.message,
        timestamp: Date.now()
      };
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
    
    // Fetch historical messages
    this.getGroupHistory(groupId).then(history => {
      if (history && history.length > 0) {
        const clubId = this.getClubIdForGroup(groupId);
        if (!clubId) return;
        
        // Notify about historical messages
        this.notifyListeners('group_history', {
          clubId,
          groupId,
          events: history
        });
        
        console.log(`Loaded ${history.length} historical messages for group ${groupId}`);
      }
    }).catch(error => {
      console.error(`Error fetching history for group ${groupId}:`, error);
    });
    
    // Also subscribe to metadata updates
    this.listenForGroupMetadataUpdates(groupId);
    
    return sub;
  }

  /**
   * Get historical messages for a group
   * @param {string} groupId - Nostr group ID
   * @param {number} limit - Maximum number of messages to fetch
   * @param {number} since - Timestamp to fetch messages since (in seconds)
   * @returns {Promise<Array>} Array of historical messages
   */
  async getGroupHistory(groupId, limit = 50, since = undefined) {
    try {
      // Default to last 30 days if no since time provided
      const sinceTime = since || Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
      
      console.log(`Fetching history for group ${groupId} since ${new Date(sinceTime * 1000).toLocaleString()}`);
      
      // Create filter for historical messages
      const filter = {
        kinds: [NIP29_KINDS.GROUP_MESSAGES],
        '#e': [groupId],
        since: sinceTime,
        limit: limit
      };
      
      // Fetch events from all relays
      const events = await this.pool.list(this.relays, [filter]);
      
      console.log(`Found ${events.length} historical messages for group ${groupId}`);
      
      // Sort by created_at timestamp, oldest first
      return events.sort((a, b) => a.created_at - b.created_at);
    } catch (error) {
      console.error(`Error fetching group history for ${groupId}:`, error);
      return [];
    }
  }

  /**
   * Listen for metadata updates on a group
   * @param {string} groupId - Nostr group ID
   */
  listenForGroupMetadataUpdates(groupId) {
    // Create filter for metadata updates
    const filter = {
      kinds: [NIP29_KINDS.GROUP_METADATA],
      '#e': [groupId],
      limit: 10
    };
    
    // Subscribe to metadata events
    const metaSub = this.pool.sub(this.relays, [filter]);
    
    // Handle incoming metadata updates
    metaSub.on('event', event => {
      try {
        // Parse metadata from content
        const metadata = JSON.parse(event.content);
        
        // Find club ID from group ID
        const clubId = this.getClubIdForGroup(groupId);
        if (!clubId) return;
        
        // Notify listeners about the metadata update
        this.notifyListeners('metadata_update', {
          clubId,
          groupId,
          metadata,
          event
        });
        
        console.log(`Received metadata update for group ${groupId}`);
      } catch (error) {
        console.error(`Error processing metadata update for group ${groupId}:`, error);
      }
    });
    
    // Store subscription with a special key
    this.subscriptions.set(`${groupId}_metadata`, metaSub);
    
    // Also track membership changes
    this.listenForMembershipChanges(groupId);
  }

  /**
   * Listen for membership changes in a group
   * @param {string} groupId - Nostr group ID
   */
  listenForMembershipChanges(groupId) {
    // Create filter for membership events
    const filter = {
      kinds: [NIP29_KINDS.GROUP_MEMBERSHIP],
      '#e': [groupId],
      limit: 50
    };
    
    // Subscribe to membership events
    const memberSub = this.pool.sub(this.relays, [filter]);
    
    // Handle incoming membership events
    memberSub.on('event', event => {
      // Find club ID from group ID
      const clubId = this.getClubIdForGroup(groupId);
      if (!clubId) return;
      
      // Extract member public key and role
      const pubkeyTag = event.tags.find(tag => tag[0] === 'p');
      const roleTag = event.tags.find(tag => tag[0] === 'role');
      
      if (!pubkeyTag) return;
      
      const memberPubkey = pubkeyTag[1];
      const role = roleTag ? roleTag[1] : 'member';
      
      // Notify listeners about the membership change
      this.notifyListeners('membership_change', {
        clubId,
        groupId,
        memberPubkey,
        role,
        event
      });
    });
    
    // Store subscription with a special key
    this.subscriptions.set(`${groupId}_members`, memberSub);
    
    // Fetch current members
    this.getGroupMembers(groupId).then(members => {
      // Find club ID from group ID
      const clubId = this.getClubIdForGroup(groupId);
      if (!clubId) return;
      
      // Notify about members
      this.notifyListeners('members_loaded', {
        clubId,
        groupId,
        members
      });
      
      console.log(`Loaded ${members.length} members for group ${groupId}`);
    }).catch(error => {
      console.error(`Error fetching members for group ${groupId}:`, error);
    });
  }

  /**
   * Get current members of a group
   * @param {string} groupId - Nostr group ID
   * @returns {Promise<Array>} Array of group members with roles
   */
  async getGroupMembers(groupId) {
    try {
      // Create filter for membership events
      const filter = {
        kinds: [NIP29_KINDS.GROUP_MEMBERSHIP],
        '#e': [groupId]
      };
      
      // Fetch membership events
      const events = await this.pool.list(this.relays, [filter]);
      
      console.log(`Found ${events.length} membership events for group ${groupId}`);
      
      // Process membership events
      const membersMap = new Map();
      
      events.forEach(event => {
        // Extract member public key and role
        const pubkeyTag = event.tags.find(tag => tag[0] === 'p');
        const roleTag = event.tags.find(tag => tag[0] === 'role');
        
        if (!pubkeyTag) return;
        
        const pubkey = pubkeyTag[1];
        const role = roleTag ? roleTag[1] : 'member';
        
        // Store the most recent role for each member
        if (!membersMap.has(pubkey) || 
            membersMap.get(pubkey).event.created_at < event.created_at) {
          membersMap.set(pubkey, {
            pubkey,
            role,
            joinedAt: event.created_at,
            event
          });
        }
      });
      
      return Array.from(membersMap.values());
    } catch (error) {
      console.error(`Error fetching group members for ${groupId}:`, error);
      return [];
    }
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
   * Save club-to-group mappings to persistent storage
   * Uses both IndexedDB and localStorage for redundancy
   */
  saveMappings() {
    try {
      // First save to localStorage as a fallback
      const mappings = Object.fromEntries(this.clubToGroupMap);
      localStorage.setItem('nip29_mappings', JSON.stringify(mappings));
      
      // Then save to IndexedDB for more robust storage
      this.saveToIndexedDB().catch(error => {
        console.warn('Failed to save to IndexedDB, using localStorage fallback:', error);
      });
    } catch (error) {
      console.error('Error saving NIP29 mappings:', error);
    }
  }

  /**
   * Save the mappings to IndexedDB
   * @returns {Promise<void>}
   */
  async saveToIndexedDB() {
    try {
      const db = await openDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([MAPPINGS_STORE], 'readwrite');
        const store = transaction.objectStore(MAPPINGS_STORE);
        
        // First clear existing mappings
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => {
          // Then add all current mappings
          let completed = 0;
          const totalMappings = this.clubToGroupMap.size;
          
          this.clubToGroupMap.forEach((groupId, clubId) => {
            const request = store.put({
              clubId,
              groupId,
              timestamp: Date.now()
            });
            
            request.onsuccess = () => {
              completed++;
              if (completed >= totalMappings) {
                console.log(`Saved ${completed} club-group mappings to IndexedDB`);
                resolve();
              }
            };
            
            request.onerror = (event) => {
              console.error('Error saving mapping to IndexedDB:', event.target.error);
              reject(event.target.error);
            };
          });
          
          // If no mappings to save, resolve immediately
          if (totalMappings === 0) {
            resolve();
          }
        };
        
        clearRequest.onerror = (event) => {
          console.error('Error clearing IndexedDB store:', event.target.error);
          reject(event.target.error);
        };
        
        transaction.oncomplete = () => {
          db.close();
        };
      });
    } catch (error) {
      console.error('Error saving to IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Load club-to-group mappings from persistent storage
   * Tries IndexedDB first, then falls back to localStorage
   */
  loadMappings() {
    try {
      // First try loading from IndexedDB (more robust)
      this.loadFromIndexedDB().catch(error => {
        console.warn('Failed to load from IndexedDB, trying localStorage fallback:', error);
        
        // Fall back to localStorage if IndexedDB fails
        this.loadFromLocalStorage();
      });
    } catch (error) {
      console.error('Error loading NIP29 mappings:', error);
      
      // Try localStorage as last resort
      this.loadFromLocalStorage();
    }
  }

  /**
   * Load mappings from localStorage
   */
  loadFromLocalStorage() {
    try {
      const mappings = localStorage.getItem('nip29_mappings');
      if (mappings) {
        this.clubToGroupMap = new Map(Object.entries(JSON.parse(mappings)));
        console.log(`Loaded ${this.clubToGroupMap.size} club-group mappings from localStorage`);
        
        // Subscribe to all mapped groups
        for (const groupId of this.clubToGroupMap.values()) {
          this.subscribeToGroupEvents(groupId);
        }
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  }

  /**
   * Load mappings from IndexedDB
   * @returns {Promise<void>}
   */
  async loadFromIndexedDB() {
    try {
      const db = await openDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([MAPPINGS_STORE], 'readonly');
        const store = transaction.objectStore(MAPPINGS_STORE);
        const request = store.getAll();
        
        request.onsuccess = (event) => {
          const mappings = event.target.result;
          
          // Clear existing map and load all mappings
          this.clubToGroupMap.clear();
          
          mappings.forEach(mapping => {
            this.clubToGroupMap.set(mapping.clubId, mapping.groupId);
          });
          
          console.log(`Loaded ${this.clubToGroupMap.size} club-group mappings from IndexedDB`);
          
          // Subscribe to all mapped groups
          for (const groupId of this.clubToGroupMap.values()) {
            this.subscribeToGroupEvents(groupId);
          }
          
          resolve();
        };
        
        request.onerror = (event) => {
          console.error('Error loading mappings from IndexedDB:', event.target.error);
          reject(event.target.error);
        };
        
        transaction.oncomplete = () => {
          db.close();
        };
      });
    } catch (error) {
      console.error('Error loading from IndexedDB:', error);
      throw error;
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

  /**
   * Discover existing NIP-29 groups from relays
   * @param {number} limit - Maximum number of groups to fetch
   * @param {number} since - Fetch groups created since this timestamp (seconds)
   * @returns {Promise<Array>} Array of discovered groups
   */
  async discoverGroups(limit = 50, since = undefined) {
    try {
      // Default to fetching groups from last 30 days if not specified
      const sinceTime = since || Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
      
      console.log(`Discovering NIP-29 groups created since ${new Date(sinceTime * 1000).toLocaleString()}`);
      
      // Fetch group creation events (kind 80)
      const filter = {
        kinds: [NIP29_KINDS.GROUP_CREATION], // Use the constant for compatibility
        since: sinceTime,
        limit: limit
      };
      
      // Query all configured relays
      const events = await this.pool.list(this.relays, [filter]);
      console.log(`Found ${events.length} NIP-29 groups`);
      
      if (!events || events.length === 0) {
        return [];
      }
      
      // Process and convert events to a more usable format
      const discoveredGroups = events.map(event => {
        let metadata = {};
        
        // Parse group metadata from content
        try {
          metadata = JSON.parse(event.content);
        } catch (error) {
          console.warn(`Failed to parse group metadata for ${event.id}:`, error);
        }
        
        return {
          id: event.id,
          pubkey: event.pubkey, // Group creator
          created_at: event.created_at,
          metadata: {
            name: metadata.name || 'Unnamed Group',
            about: metadata.about || '',
            picture: metadata.picture || ''
          },
          rawEvent: event // Keep the raw event for reference
        };
      });
      
      // Sort by creation time, newest first
      return discoveredGroups.sort((a, b) => b.created_at - a.created_at);
    } catch (error) {
      console.error('Error discovering groups:', error);
      return [];
    }
  }
  
  /**
   * Search for groups by name, with special focus on running-related groups
   * @param {string} query - Search query
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Matching groups
   */
  async searchGroupsByName(query, limit = 20) {
    try {
      // First discover recent groups
      const allGroups = await this.discoverGroups(100);
      
      if (!allGroups || allGroups.length === 0) {
        return [];
      }
      
      // Filter groups by name containing the query (case insensitive)
      const normalizedQuery = query.toLowerCase();
      const matchingGroups = allGroups.filter(group => {
        const name = (group.metadata.name || '').toLowerCase();
        const about = (group.metadata.about || '').toLowerCase();
        
        return name.includes(normalizedQuery) || about.includes(normalizedQuery);
      }).slice(0, limit);
      
      console.log(`Found ${matchingGroups.length} groups matching "${query}"`);
      return matchingGroups;
    } catch (error) {
      console.error(`Error searching for groups with query "${query}":`, error);
      return [];
    }
  }
  
  /**
   * Find a specific group by exact name
   * @param {string} exactName - The exact name to search for
   * @returns {Promise<Object|null>} The group or null if not found
   */
  async findGroupByExactName(exactName) {
    try {
      // Search with a higher limit to increase chances of finding the exact match
      const groups = await this.searchGroupsByName(exactName, 100);
      
      // Find exact match (case insensitive)
      const normalizedName = exactName.toLowerCase();
      const exactMatch = groups.find(group => 
        (group.metadata.name || '').toLowerCase() === normalizedName
      );
      
      if (exactMatch) {
        console.log(`Found exact match for group "${exactName}": ${exactMatch.id}`);
        return exactMatch;
      }
      
      console.log(`No exact match found for group "${exactName}"`);
      return null;
    } catch (error) {
      console.error(`Error finding group "${exactName}":`, error);
      return null;
    }
  }
  
  /**
   * Join an existing NIP-29 group by its ID
   * @param {string} groupId - The Nostr event ID of the group
   * @param {Object} clubData - Optional local club data to associate with this group
   * @returns {Promise<Object>} Result with success status and club/group info
   */
  async joinExistingGroup(groupId, clubData = null) {
    try {
      // Verify this is a valid group by fetching its details
      const filter = {
        kinds: [NIP29_KINDS.GROUP_CREATION], // Use the constant for compatibility
        ids: [groupId]
      };
      
      const events = await this.pool.list(this.relays, [filter]);
      
      if (!events || events.length === 0) {
        throw new Error('Group not found or invalid');
      }
      
      const groupEvent = events[0];
      let metadata = {};
      
      // Parse group metadata
      try {
        metadata = JSON.parse(groupEvent.content);
      } catch (error) {
        console.warn('Error parsing group metadata:', error);
      }
      
      // Create a membership event to join the group
      const pubkey = await getUserPublicKey();
      if (!pubkey) {
        throw new Error('User not authenticated with Nostr');
      }
      
      // Create membership event
      const membershipEvent = await createAndPublishEvent({
        kind: NIP29_KINDS.GROUP_MEMBERSHIP, // Use the constant for compatibility
        content: '',
        tags: [
          ['e', groupId],
          ['p', pubkey],
          ['role', 'member']
        ]
      });
      
      // Generate a club ID if not provided with club data
      const localClubId = clubData?.id || `external_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Save the mapping
      this.clubToGroupMap.set(localClubId, groupId);
      this.saveMappings();
      
      // Subscribe to events for this group
      this.subscribeToGroupEvents(groupId);
      
      // Return combined data
      return {
        success: true,
        clubId: localClubId,
        groupId: groupId,
        metadata: metadata,
        membershipEvent: membershipEvent
      };
    } catch (error) {
      console.error('Error joining existing group:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find and join the "Messi Run Club" running group
   * This is a specific helper method for joining a known popular running group
   * @returns {Promise<Object>} Result with success status and club/group info
   */
  async findAndJoinMessiRunClub() {
    try {
      console.log('Searching for Messi Run Club group...');
      
      // First try to find by exact name
      let messiGroup = await this.findGroupByExactName('Messi Run Club');
      
      // If not found by exact name, try a broader search
      if (!messiGroup) {
        console.log('Exact match not found, trying broader search...');
        const searchResults = await this.searchGroupsByName('Messi Run', 50);
        
        // Look for anything with Messi and Run in the name
        messiGroup = searchResults.find(group => {
          const name = (group.metadata.name || '').toLowerCase();
          return name.includes('messi') && name.includes('run');
        });
      }
      
      // If still not found, try an even broader search
      if (!messiGroup) {
        console.log('Still not found, trying even broader search...');
        const runGroups = await this.searchGroupsByName('run club', 100);
        
        // Just pick any running club if we can't find Messi's specifically
        if (runGroups.length > 0) {
          console.log(`Found ${runGroups.length} running clubs instead`);
          messiGroup = runGroups[0];
        }
      }
      
      if (!messiGroup) {
        return {
          success: false,
          error: 'Could not find Messi Run Club or any running clubs'
        };
      }
      
      console.log(`Found group: ${messiGroup.metadata.name} (${messiGroup.id})`);
      
      // Create club data from the group metadata
      const clubData = {
        id: `messirunclub_${Date.now()}`,
        name: messiGroup.metadata.name,
        description: messiGroup.metadata.about,
        picture: messiGroup.metadata.picture,
        isExternal: true,
        source: 'nostr'
      };
      
      // Join the group
      const joinResult = await this.joinExistingGroup(messiGroup.id, clubData);
      
      // Add additional information to the result
      return {
        ...joinResult,
        group: messiGroup,
        clubData
      };
    } catch (error) {
      console.error('Error finding and joining Messi Run Club:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Discover running-related NIP-29 groups
   * Searches for groups that appear to be related to running and fitness
   * @param {number} limit - Maximum number of groups to return
   * @returns {Promise<Array>} Array of running-related groups
   */
  async discoverRunningGroups(limit = 20) {
    try {
      // Get a larger set of recent groups to filter from
      const allGroups = await this.discoverGroups(100);
      
      if (!allGroups || allGroups.length === 0) {
        console.log('No groups found to filter for running content');
        return [];
      }
      
      console.log(`Filtering ${allGroups.length} groups for running content...`);
      
      // Keywords related to running and fitness
      const runningKeywords = [
        'run', 'running', 'runner', 'jog', 'jogging', 'marathon', 
        'fitness', 'exercise', '5k', '10k', 'track', 'trail', 
        'sprint', 'pace', 'race', 'runstr'
      ];
      
      // Filter for groups that mention running in name or description
      const runningGroups = allGroups.filter(group => {
        const name = (group.metadata.name || '').toLowerCase();
        const about = (group.metadata.about || '').toLowerCase();
        const combinedText = `${name} ${about}`;
        
        // Check if any running keyword is present
        return runningKeywords.some(keyword => combinedText.includes(keyword));
      });
      
      console.log(`Found ${runningGroups.length} running-related groups`);
      
      // Prioritize groups that have "run" or "running" directly in the name
      const prioritizedGroups = [...runningGroups].sort((a, b) => {
        const nameA = (a.metadata.name || '').toLowerCase();
        const nameB = (b.metadata.name || '').toLowerCase();
        
        // Direct mentions of run/running in the name get priority
        const directRunA = nameA.includes('run') || nameA.includes('running');
        const directRunB = nameB.includes('run') || nameB.includes('running');
        
        if (directRunA && !directRunB) return -1;
        if (!directRunA && directRunB) return 1;
        
        // Otherwise sort by creation date, newest first
        return b.created_at - a.created_at;
      });
      
      return prioritizedGroups.slice(0, limit);
    } catch (error) {
      console.error('Error discovering running groups:', error);
      return [];
    }
  }

  /**
   * Validate a group event against the NIP-29 specification
   * @param {Object} event - The event to validate
   * @returns {Object} Result with validation status and errors
   */
  validateGroupEvent(event) {
    try {
      // Check if we have a kind that should be validated
      if (!event || !event.kind || !NIP29_VALIDATION_RULES[event.kind]) {
        return {
          valid: false,
          errors: [`Unknown or unsupported event kind: ${event.kind}`]
        };
      }
      
      const rules = NIP29_VALIDATION_RULES[event.kind];
      const errors = [];
      
      // Check required tags
      for (const [tagName, required, marker] of rules.requiredTags) {
        if (!required) continue;
        
        // Find matching tags
        const matchingTags = event.tags.filter(tag => tag[0] === tagName);
        
        if (matchingTags.length === 0) {
          errors.push(`Missing required tag: ${tagName}`);
          continue;
        }
        
        // If a marker is specified, check for tag with that marker
        if (marker) {
          const tagWithMarker = matchingTags.find(tag => tag[2] === marker);
          if (!tagWithMarker) {
            errors.push(`Missing ${tagName} tag with marker: ${marker}`);
          }
        }
      }
      
      // Validate content if a validator is provided
      if (rules.validateContent && !rules.validateContent(event.content)) {
        errors.push('Invalid content format');
      }
      
      return {
        valid: errors.length === 0,
        errors: errors
      };
    } catch (error) {
      console.error('Error validating event:', error);
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`]
      };
    }
  }

  /**
   * Create a properly formatted NIP-29 event for the specified kind
   * @param {number} kind - The NIP-29 kind to create
   * @param {Object} params - Parameters specific to the event kind
   * @returns {Object} The formatted event ready to be signed and published
   */
  createStandardNIP29Event(kind, params) {
    try {
      // Base event structure
      const event = {
        kind,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: ''
      };
      
      switch (kind) {
        case NIP29_KINDS.GROUP_CREATION:
          // Group creation requires metadata in content
          event.content = JSON.stringify({
            name: params.name || 'Unnamed Group',
            about: params.about || '',
            picture: params.picture || '',
            ...params.additionalMetadata
          });
          
          // Add any optional tags
          if (params.tags) {
            event.tags = [...params.tags];
          }
          break;
          
        case NIP29_KINDS.GROUP_METADATA:
          // Must reference group creation event
          if (!params.groupId) {
            throw new Error('Group ID is required for GROUP_METADATA events');
          }
          
          event.tags.push(['e', params.groupId]);
          event.content = JSON.stringify({
            name: params.name,
            about: params.about,
            picture: params.picture,
            ...params.additionalMetadata
          });
          break;
          
        case NIP29_KINDS.GROUP_MEMBERSHIP:
          // Must reference group and member
          if (!params.groupId) {
            throw new Error('Group ID is required for GROUP_MEMBERSHIP events');
          }
          if (!params.pubkey) {
            throw new Error('Member pubkey is required for GROUP_MEMBERSHIP events');
          }
          
          event.tags.push(['e', params.groupId]);
          event.tags.push(['p', params.pubkey]);
          event.tags.push(['role', params.role || 'member']);
          break;
          
        case NIP29_KINDS.GROUP_MESSAGES:
          // Must reference group
          if (!params.groupId) {
            throw new Error('Group ID is required for GROUP_MESSAGES events');
          }
          
          event.tags.push(['e', params.groupId, '', 'root']);
          event.content = params.content || '';
          
          // Add optional client tag
          event.tags.push(['client', 'RUNSTR App']);
          
          // Add reply tags if this is a reply
          if (params.replyTo) {
            event.tags.push(['e', params.replyTo, '', 'reply']);
          }
          break;
          
        case NIP29_KINDS.GROUP_HIDE_MESSAGE:
        case NIP29_KINDS.GROUP_REMOVE_MESSAGE:
          // Must reference group and message
          if (!params.groupId) {
            throw new Error('Group ID is required for message moderation events');
          }
          if (!params.messageId) {
            throw new Error('Message ID is required for message moderation events');
          }
          
          event.tags.push(['e', params.groupId, '', 'group']);
          event.tags.push(['e', params.messageId, '', 'message']);
          
          // Add reason if provided
          if (params.reason) {
            event.tags.push(['reason', params.reason]);
          }
          break;
          
        default:
          throw new Error(`Unsupported NIP-29 event kind: ${kind}`);
      }
      
      // Validate the created event against our rules
      const validation = this.validateGroupEvent(event);
      if (!validation.valid) {
        console.error('Created invalid NIP-29 event:', validation.errors);
        throw new Error(`Invalid NIP-29 event: ${validation.errors.join(', ')}`);
      }
      
      return event;
    } catch (error) {
      console.error('Error creating NIP-29 event:', error);
      throw error;
    }
  }

  /**
   * Leave a NIP-29 group
   * @param {string} clubId - Club ID
   * @returns {Promise<Object>} Result with success status
   */
  async leaveGroup(clubId) {
    try {
      const groupId = this.getGroupIdForClub(clubId);
      if (!groupId) {
        throw new Error('No Nostr group found for this club');
      }
      
      const pubkey = await getUserPublicKey();
      if (!pubkey) {
        throw new Error('User not authenticated with Nostr');
      }
      
      // Create a standard-compliant NIP-29 group membership event
      // Setting empty role indicates leaving the group
      const eventTemplate = this.createStandardNIP29Event(NIP29_KINDS.GROUP_MEMBERSHIP, {
        groupId: groupId,
        pubkey: pubkey,
        role: '' // Empty role indicates leaving
      });
      
      // Add pubkey to the event template
      eventTemplate.pubkey = pubkey;
      
      // Create and publish the event
      const event = await createAndPublishEvent(eventTemplate);
      
      if (!event) {
        throw new Error('Failed to leave Nostr group');
      }
      
      // Close and remove subscriptions
      this.cleanupGroupSubscriptions(groupId);
      
      // Remove from the mapping
      this.clubToGroupMap.delete(clubId);
      this.saveMappings();
      
      console.log(`Left group ${groupId} (club ${clubId})`);
      
      return {
        success: true,
        clubId,
        groupId,
        event
      };
    } catch (error) {
      console.error('Error leaving group:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clean up subscriptions for a group
   * @param {string} groupId - Nostr group ID
   */
  cleanupGroupSubscriptions(groupId) {
    // Clean up main message subscription
    if (this.subscriptions.has(groupId)) {
      const sub = this.subscriptions.get(groupId);
      if (sub && typeof sub.close === 'function') {
        sub.close();
      }
      this.subscriptions.delete(groupId);
    }
    
    // Clean up metadata subscription
    const metaSubKey = `${groupId}_metadata`;
    if (this.subscriptions.has(metaSubKey)) {
      const metaSub = this.subscriptions.get(metaSubKey);
      if (metaSub && typeof metaSub.close === 'function') {
        metaSub.close();
      }
      this.subscriptions.delete(metaSubKey);
    }
    
    // Clean up members subscription
    const membersSubKey = `${groupId}_members`;
    if (this.subscriptions.has(membersSubKey)) {
      const membersSub = this.subscriptions.get(membersSubKey);
      if (membersSub && typeof membersSub.close === 'function') {
        membersSub.close();
      }
      this.subscriptions.delete(membersSubKey);
    }
    
    console.log(`Cleaned up subscriptions for group ${groupId}`);
  }
}

// Create and export singleton instance
const nip29Bridge = new NIP29Bridge();
export default nip29Bridge; 