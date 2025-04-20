import { SimplePool } from 'nostr-tools';
import { decode as decodeNip19 } from 'nostr-tools/nip19';
import groupMembershipManager from './GroupMembershipManager';

class GroupChatManager {
  constructor() {
    // Initialize SimplePool correctly - no parameters needed based on the nostr-tools documentation
    this.pool = new SimplePool();
    this.messageSubscriptions = new Map(); // groupId -> subscription
    this.groupMetadata = new Map(); // groupId -> group info
    this.groupMessages = new Map(); // groupId -> messages array
    this.userPubkey = null; // Set by setUserContext
    
    // Load cache from localStorage if available
    this.loadFromStorage();
  }
  
  // Re-initialize pool if needed - replaced with a method that follows the correct nostr-tools implementation
  ensurePool() {
    if (!this.pool || typeof this.pool.querySync !== 'function') {
      console.log('Reinitializing SimplePool');
      // Simply create a new instance without parameters
      this.pool = new SimplePool();
    }
    return this.pool;
  }
  
  loadFromStorage() {
    try {
      // Load message cache
      const cachedMessages = localStorage.getItem('group_messages_cache');
      if (cachedMessages) {
        const parsed = JSON.parse(cachedMessages);
        this.groupMessages = new Map(Object.entries(parsed));
      }
      
      // Load metadata cache
      const cachedMetadata = localStorage.getItem('group_metadata_cache');
      if (cachedMetadata) {
        const parsed = JSON.parse(cachedMetadata);
        this.groupMetadata = new Map(Object.entries(parsed));
      }
    } catch (e) {
      console.error('Failed to load GroupChatManager cache:', e);
    }
  }
  
  saveToStorage() {
    try {
      // Save message cache - limited to last 50 messages per group
      const processedMessages = {};
      this.groupMessages.forEach((messages, groupId) => {
        // Sort by timestamp and take the last 50
        const recentMessages = [...messages]
          .sort((a, b) => b.created_at - a.created_at)
          .slice(0, 50);
        processedMessages[groupId] = recentMessages;
      });
      
      localStorage.setItem('group_messages_cache', JSON.stringify(processedMessages));
      
      // Save metadata cache
      localStorage.setItem(
        'group_metadata_cache', 
        JSON.stringify(Object.fromEntries(this.groupMetadata))
      );
    } catch (e) {
      console.error('Failed to save GroupChatManager cache:', e);
    }
  }
  
  // Set user's public key for context
  setUserContext(pubkey) {
    this.userPubkey = pubkey;
    console.log(`GroupChatManager: Set user context to ${pubkey}`);
  }
  
  // Parse naddr into group info
  parseGroupInfo(naddrString) {
    try {
      if (!naddrString) return null;
      
      // Check if already parsed
      if (typeof naddrString === 'object' && naddrString.kind && naddrString.pubkey) {
        return naddrString;
      }
      
      // Parse naddr
      const decoded = decodeNip19(naddrString);
      if (!decoded || !decoded.data) {
        console.error('Invalid naddr format', naddrString);
        return null;
      }
      
      return decoded.data;
    } catch (error) {
      console.error('Error parsing naddr:', error);
      return null;
    }
  }
  
  // Get standardized group ID from group info
  getGroupId(groupInfo) {
    if (!groupInfo) return null;
    return `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;
  }
  
  // Get relays for a group
  getGroupRelays(groupInfo) {
    // Default relays for NIP-29 groups
    const defaultRelays = [
      'wss://groups.0xchat.com',
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band'
    ];
    
    // Add group-specific relays if available
    return [...new Set([
      ...defaultRelays,
      ...(groupInfo.relays || [])
    ])];
  }
  
  // Fetch group metadata
  async fetchGroupMetadata(naddrString) {
    const groupInfo = this.parseGroupInfo(naddrString);
    if (!groupInfo) return null;
    
    const groupId = this.getGroupId(groupInfo);
    
    // Check cache first
    if (this.groupMetadata.has(groupId)) {
      const cachedMetadata = this.groupMetadata.get(groupId);
      // Only use cache if it's recent (less than 10 minutes old)
      const isCacheRecent = cachedMetadata._fetchedAt && 
        (Date.now() - cachedMetadata._fetchedAt < 10 * 60 * 1000);
      
      if (isCacheRecent) {
        console.log(`Using cached metadata for group ${groupId}`);
        return cachedMetadata;
      }
    }
    
    // Get relays for this group
    const relays = this.getGroupRelays(groupInfo);
    
    try {
      // Important: Make sure pool is initialized
      this.ensurePool();
      
      // Create the correct filter format according to nostr-tools docs
      // CRITICAL: filters parameter must be an array of filter objects
      const filter = [{
        kinds: [groupInfo.kind], // Typically 39000 for NIP-29 groups
        authors: [groupInfo.pubkey],
        '#d': [groupInfo.identifier]
      }];
      
      console.log(`Fetching group metadata for ${groupId} with filter:`, filter);
      console.log(`Using relays:`, relays);
      
      // Correct usage: pool.querySync(relays, [filter])
      const events = await this.pool.querySync(relays, filter);
      
      if (!events || events.length === 0) {
        console.log(`No metadata found for group ${groupId}`);
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
      
      // Create metadata object
      const result = {
        id: latestEvent.id,
        pubkey: latestEvent.pubkey,
        created_at: latestEvent.created_at,
        kind: latestEvent.kind,
        tags: latestEvent.tags,
        metadata,
        _fetchedAt: Date.now() // Add timestamp for cache freshness checks
      };
      
      // Update cache
      this.groupMetadata.set(groupId, result);
      this.saveToStorage();
      
      return result;
    } catch (error) {
      console.error('Error fetching group metadata:', error);
      
      // Try fallback method - manually handle WebSocket connection
      try {
        console.log('Attempting direct WebSocket fallback for fetching metadata');
        return await this.fetchGroupMetadataWithWebSocket(groupInfo, relays[0]);
      } catch (wsError) {
        console.error('WebSocket fallback also failed:', wsError);
        return null;
      }
    }
  }
  
  // Fallback method using direct WebSocket connection
  async fetchGroupMetadataWithWebSocket(groupInfo, relay) {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(relay);
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, 10000);
        
        ws.onopen = () => {
          // Create filter for the group metadata
          const filter = {
            kinds: [groupInfo.kind],
            authors: [groupInfo.pubkey],
            '#d': [groupInfo.identifier]
          };
          
          // Send subscription request
          ws.send(JSON.stringify(['REQ', 'metadata', filter]));
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message[0] === 'EVENT' && message[2]) {
              const eventData = message[2];
              
              // Parse metadata from content or tags
              let metadata = {};
              try {
                if (eventData.content) {
                  metadata = JSON.parse(eventData.content);
                }
              } catch {
                console.log('Content is not JSON, using tag-based metadata');
              }
              
              // Extract metadata from tags
              if (eventData.tags) {
                for (const tag of eventData.tags) {
                  if (tag[0] === 'name' && tag[1]) metadata.name = tag[1];
                  else if (tag[0] === 'about' && tag[1]) metadata.about = tag[1];
                  else if ((tag[0] === 'picture' || tag[0] === 'image') && tag[1]) metadata.picture = tag[1];
                }
              }
              
              const result = {
                id: eventData.id,
                pubkey: eventData.pubkey,
                created_at: eventData.created_at,
                kind: eventData.kind,
                tags: eventData.tags,
                metadata,
                _fetchedAt: Date.now()
              };
              
              clearTimeout(timeout);
              ws.close();
              resolve(result);
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };
        
        ws.onerror = (error) => {
          clearTimeout(timeout);
          ws.close();
          reject(error);
        };
        
        ws.onclose = () => {
          clearTimeout(timeout);
          // If we haven't resolved by now, reject
          reject(new Error('WebSocket closed without receiving metadata'));
        };
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Subscribe to group chat messages
  subscribeToGroupMessages(naddrString, onNewMessage, onError) {
    const groupInfo = this.parseGroupInfo(naddrString);
    if (!groupInfo) {
      if (onError) onError(new Error('Invalid group identifier'));
      return null;
    }
    
    const groupId = this.getGroupId(groupInfo);
    
    // Unsubscribe if already subscribed
    if (this.messageSubscriptions.has(groupId)) {
      this.messageSubscriptions.get(groupId).unsub();
    }
    
    // Initialize message array if not exists
    if (!this.groupMessages.has(groupId)) {
      this.groupMessages.set(groupId, []);
    }
    
    // Get relays from group metadata or use defaults
    const relays = this.getGroupRelays(groupInfo);
    
    // Extract the actual group ID from the compound identifier
    // Format is kind:pubkey:identifier, we need just the identifier for NIP-29 'h' tag
    const groupIdParts = groupId.split(':');
    const actualGroupId = groupIdParts.length === 3 ? groupIdParts[2] : groupId;
    
    // Format the filter for subscription - NIP-29 uses 'h' tag
    // CRITICAL: filters parameter must be an array of filter objects
    const filter = [{
      '#h': [actualGroupId], // NIP-29 uses h tag with group_id
      since: Math.floor(Date.now() / 1000) - 3600 // Last hour
    }];
    
    console.log(`Setting up subscription for group ${groupId} with filter:`, filter);
    console.log(`Using relays:`, relays);
    
    try {
      // Re-initialize pool
      this.ensurePool();
      
      // Try to use the instance method
      try {
        // In nostr-tools v2.12.0, subscribe takes onEvent and onEose callbacks
        const sub = this.pool.subscribe(
          relays, 
          filter,
          {
            // Handle incoming events
            onEvent: (event) => {
              // Process incoming message
              this.processMessage(event, groupId, onNewMessage);
            },
            // Handle EOSE (End of Stored Events)
            onEose: () => {
              console.log(`Received EOSE for group ${groupId}`);
            }
          }
        );
        
        // Create a wrapper with unsub method to match our existing pattern
        const subscription = {
          relay: relays.join(','),
          sub,
          unsub: () => {
            try {
              // In v2.12.0, we call close() on the subscription
              if (sub && typeof sub.close === 'function') {
                sub.close();
              }
            } catch (e) {
              console.error('Error closing subscription:', e);
            }
          }
        };
        
        // Store subscription for cleanup
        this.messageSubscriptions.set(groupId, subscription);
        console.log(`Subscription established for group ${groupId}`);
        
        return subscription;
      } catch (subError) {
        // If the sub method fails, try direct WebSocket connection
        console.error('Error using SimplePool.subscribe:', subError);
        return this.setupDirectWebSocketSubscription(groupInfo, actualGroupId, groupId, onNewMessage, onError);
      }
    } catch (error) {
      console.error(`Error setting up subscription for group ${groupId}:`, error);
      if (onError) onError(error);
      
      // Try direct WebSocket as a last resort
      return this.setupDirectWebSocketSubscription(groupInfo, actualGroupId, groupId, onNewMessage, onError);
    }
  }
  
  // Setup a subscription using direct WebSocket connection
  setupDirectWebSocketSubscription(groupInfo, actualGroupId, groupId, onNewMessage, onError) {
    try {
      console.log('Setting up direct WebSocket subscription as fallback');
      const relay = 'wss://groups.0xchat.com';
      const ws = new WebSocket(relay);
      let isActive = true;
      
      const subscription = {
        relay,
        unsub: () => {
          if (isActive) {
            isActive = false;
            try {
              ws.send(JSON.stringify(['CLOSE', 'directsub']));
              ws.close();
            } catch (e) {
              console.error('Error closing WebSocket:', e);
            }
          }
        }
      };
      
      ws.onopen = () => {
        // Create filter for the group messages
        const filter = {
          '#h': [actualGroupId], // NIP-29 uses h tag with group_id
          since: Math.floor(Date.now() / 1000) - 3600 // Last hour
        };
        
        // Send subscription request
        ws.send(JSON.stringify(['REQ', 'directsub', filter]));
        console.log('Direct WebSocket subscription established');
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message[0] === 'EVENT' && message[2]) {
            const eventData = message[2];
            this.processMessage(eventData, groupId, onNewMessage);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (onError) onError(error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket connection closed');
        isActive = false;
      };
      
      // Store subscription for cleanup
      this.messageSubscriptions.set(groupId, subscription);
      
      return subscription;
    } catch (error) {
      console.error(`Error setting up direct WebSocket subscription:`, error);
      if (onError) onError(error);
      return null;
    }
  }
  
  // Process incoming message
  async processMessage(event, groupId, onNewMessage) {
    try {
      // Check if we have this group in our cache
      if (!this.groupMessages.has(groupId)) {
        this.groupMessages.set(groupId, []);
      }
      
      const messages = this.groupMessages.get(groupId);
      
      // Check if message already exists to avoid duplicates
      if (messages.some(msg => msg.id === event.id)) {
        return;
      }
      
      // If we have user context, verify sender is a member
      if (this.userPubkey) {
        // Get group info from group ID
        const groupParts = groupId.split(':');
        if (groupParts.length === 3) {
          const [kind, pubkey, identifier] = groupParts;
          const groupInfo = { kind: parseInt(kind), pubkey, identifier };
          
          try {
            // We won't block non-member messages from displaying, but we'll mark them
            let isMember = false;
            
            // First try to use hasJoinedGroup which is more reliable
            try {
              const { hasJoinedGroup } = await import('../utils/nostrClient');
              isMember = await hasJoinedGroup(groupInfo);
            } catch (importError) {
              console.error('Error importing hasJoinedGroup:', importError);
              
              // Fallback to direct check if available
              if (typeof groupMembershipManager.hasJoinedGroup === 'function') {
                isMember = await groupMembershipManager.hasJoinedGroup(
                  groupInfo,
                  event.pubkey,
                  false // Don't force refresh for performance
                );
              }
            }
            
            event._verified = isMember;
          } catch (e) {
            console.warn(`Could not verify message sender membership:`, e);
            event._verified = false;
          }
        }
      }
      
      // Add timestamp for sorting
      event._received = Date.now();
      
      // Add to messages array
      messages.push(event);
      
      // Sort messages by timestamp
      messages.sort((a, b) => a.created_at - b.created_at);
      
      // Limit cache size
      if (messages.length > 200) {
        // Keep the latest 200 messages
        this.groupMessages.set(
          groupId, 
          messages.slice(messages.length - 200)
        );
      }
      
      // Save to cache periodically (not on every message to avoid performance issues)
      if (event._received % 10 === 0) {
        this.saveToStorage();
      }
      
      // Trigger callback
      if (onNewMessage) {
        onNewMessage(event);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }
  
  // Fetch historical messages
  async fetchGroupMessages(naddrString, limit = 50) {
    const groupInfo = this.parseGroupInfo(naddrString);
    if (!groupInfo) return [];
    
    const groupId = this.getGroupId(groupInfo);
    
    // Get relays for this group
    const relays = this.getGroupRelays(groupInfo);
    
    try {
      // Re-initialize pool
      this.ensurePool();
      
      // Extract the actual group ID for the 'h' tag
      const groupIdParts = groupId.split(':');
      const actualGroupId = groupIdParts.length === 3 ? groupIdParts[2] : groupId;
      
      // Format the filter for fetching messages - NIP-29 uses 'h' tag
      // CRITICAL: filters parameter must be an array of filter objects
      const filter = [{
        '#h': [actualGroupId], // NIP-29 uses h tag with group_id
        limit: limit
      }];
      
      console.log(`Fetching group messages for ${groupId} with filter:`, filter);
      console.log(`Using relays:`, relays);
      
      // Correct usage: pool.querySync(relays, [filter])
      const events = await this.pool.querySync(relays, filter);
      
      if (!events || events.length === 0) {
        console.log(`No messages found for group ${groupId}`);
        return [];
      }
      
      // Process and sort events
      const processedEvents = events.map(event => ({
        ...event,
        _received: Date.now()
      }));
      
      // Sort by created_at
      processedEvents.sort((a, b) => a.created_at - b.created_at);
      
      // Update cache
      this.groupMessages.set(groupId, processedEvents);
      this.saveToStorage();
      
      return processedEvents;
    } catch (error) {
      console.error('Error fetching group messages:', error);
      
      // Try fallback with direct WebSocket connection
      try {
        console.log('Attempting direct WebSocket fallback for messages');
        const messages = await this.fetchMessagesWithWebSocket(groupInfo, relays[0]);
        return messages;
      } catch (wsError) {
        console.error('WebSocket fallback also failed:', wsError);
        return [];
      }
    }
  }
  
  // Fallback method using direct WebSocket connection for messages
  async fetchMessagesWithWebSocket(groupInfo, relay) {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(relay);
        const messages = [];
        const timeout = setTimeout(() => {
          ws.close();
          resolve(messages); // Resolve with whatever we got instead of rejecting
        }, 10000);
        
        ws.onopen = () => {
          // Extract the actual group ID
          const groupId = this.getGroupId(groupInfo);
          const groupIdParts = groupId.split(':');
          const actualGroupId = groupIdParts.length === 3 ? groupIdParts[2] : groupId;
          
          // Create filter for the group messages
          const filter = {
            '#h': [actualGroupId], // NIP-29 uses h tag with group_id
            limit: 50
          };
          
          // Send subscription request
          ws.send(JSON.stringify(['REQ', 'messages', filter]));
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message[0] === 'EVENT' && message[2]) {
              const eventData = message[2];
              messages.push({
                ...eventData,
                _received: Date.now()
              });
            } else if (message[0] === 'EOSE') {
              // End of stored events
              clearTimeout(timeout);
              ws.close();
              
              // Sort messages by timestamp
              messages.sort((a, b) => a.created_at - b.created_at);
              resolve(messages);
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          clearTimeout(timeout);
          ws.close();
          resolve(messages); // Resolve with whatever we got instead of rejecting
        };
        
        ws.onclose = () => {
          clearTimeout(timeout);
          // If we haven't resolved by now, resolve with what we have
          resolve(messages);
        };
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Get cached messages for a group
  getCachedMessages(naddrString) {
    const groupInfo = this.parseGroupInfo(naddrString);
    if (!groupInfo) return [];
    
    const groupId = this.getGroupId(groupInfo);
    
    return this.groupMessages.has(groupId) 
      ? [...this.groupMessages.get(groupId)] // Return a copy of the array
      : [];
  }
  
  // Clean up subscriptions
  unsubscribeAll() {
    this.messageSubscriptions.forEach(sub => {
      try {
        sub.unsub();
      } catch (e) {
        console.error('Error unsubscribing:', e);
      }
    });
    
    this.messageSubscriptions.clear();
    console.log('All group chat subscriptions unsubscribed');
  }
  
  // Clean up a single subscription
  unsubscribe(naddrString) {
    const groupInfo = this.parseGroupInfo(naddrString);
    if (!groupInfo) return;
    
    const groupId = this.getGroupId(groupInfo);
    
    if (this.messageSubscriptions.has(groupId)) {
      try {
        this.messageSubscriptions.get(groupId).unsub();
        this.messageSubscriptions.delete(groupId);
        console.log(`Unsubscribed from group ${groupId}`);
      } catch (e) {
        console.error(`Error unsubscribing from group ${groupId}:`, e);
      }
    }
  }
}

// Export singleton instance
const groupChatManager = new GroupChatManager();
export default groupChatManager; 