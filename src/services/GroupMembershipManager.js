import { SimplePool } from 'nostr-tools';
import { decode as decodeNip19 } from 'nostr-tools/nip19';

class GroupMembershipManager {
  constructor() {
    // Initialize SimplePool correctly - no parameters based on nostr-tools documentation
    this.pool = new SimplePool();
    this.membershipCache = new Map(); // groupId -> Set of member pubkeys
    this.pendingRequests = new Map(); // groupId -> Set of pending pubkeys
    
    // Try to load cache from localStorage
    this.loadCacheFromStorage();
  }
  
  loadCacheFromStorage() {
    try {
      const cachedData = localStorage.getItem('group_membership_cache');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        
        // Convert back to Map and Sets
        this.membershipCache = new Map();
        Object.entries(parsed.membershipCache).forEach(([groupId, members]) => {
          this.membershipCache.set(groupId, new Set(members));
        });
        
        this.pendingRequests = new Map();
        Object.entries(parsed.pendingRequests).forEach(([groupId, members]) => {
          this.pendingRequests.set(groupId, new Set(members));
        });
      }
    } catch (e) {
      console.error('Failed to load membership cache', e);
    }
  }
  
  saveToStorage() {
    try {
      // Convert Maps and Sets to serializable objects
      const cacheData = {
        membershipCache: Object.fromEntries(
          Array.from(this.membershipCache.entries()).map(
            ([groupId, members]) => [groupId, Array.from(members)]
          )
        ),
        pendingRequests: Object.fromEntries(
          Array.from(this.pendingRequests.entries()).map(
            ([groupId, members]) => [groupId, Array.from(members)]
          )
        )
      };
      
      localStorage.setItem('group_membership_cache', JSON.stringify(cacheData));
    } catch (e) {
      console.error('Failed to save membership cache', e);
    }
  }

  // Re-initialize pool if needed
  ensurePool() {
    if (!this.pool || typeof this.pool.list !== 'function') {
      console.log('Reinitializing SimplePool in GroupMembershipManager');
      this.pool = new SimplePool();
    }
    return this.pool;
  }

  // Parse naddr string into group components
  parseNaddr(naddrString) {
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
      console.error('Error parsing naddr:', error, naddrString);
      return null;
    }
  }

  // Get primary group identifier 
  getGroupId(groupInfo) {
    if (!groupInfo) return null;
    return `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;
  }

  // Fetch and update membership status
  async refreshMembershipStatus(naddrString, userPubkey) {
    const groupInfo = this.parseNaddr(naddrString);
    if (!groupInfo) {
      console.error('Could not parse group information from naddr');
      return false;
    }
    
    const groupId = this.getGroupId(groupInfo);
    
    // Get all relevant relays for this group
    const relays = this.getGroupRelays(groupInfo);
    
    // Check membership across all available relays
    const isMember = await this.checkMembershipAcrossRelays(groupInfo, userPubkey, relays);
    
    // Update cache based on membership status
    if (isMember) {
      this.addToMembershipCache(groupId, userPubkey);
      
      // If was pending, remove from pending
      if (this.pendingRequests.has(groupId)) {
        this.pendingRequests.get(groupId).delete(userPubkey);
      }
    }
    
    // Save updated cache
    this.saveToStorage();
    
    return isMember;
  }
  
  // Get relays from group info or fallback to default relays
  getGroupRelays(groupInfo) {
    const defaultRelays = [
      'wss://groups.0xchat.com', 
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band'
    ];
    
    // Add group-specific relays if available
    const relays = [...new Set([
      ...defaultRelays,
      ...(groupInfo.relays || [])
    ])];
    
    return relays;
  }
  
  // Check if user is a member of the group by checking multiple relays
  async checkMembershipAcrossRelays(groupInfo, userPubkey, relays) {
    const groupId = this.getGroupId(groupInfo);
    
    // Multiple ways to detect membership
    try {
      // First, try NIP-51 membership check which is most reliable
      const isMemberNip51 = await this.checkNip51Membership(groupInfo, userPubkey, relays);
      if (isMemberNip51) {
        console.log(`NIP-51 membership confirmed for ${userPubkey} in group ${groupId}`);
        return true;
      }
      
      // Then try alternative formats in a flexible way
      const isFlexibleMember = await this.checkFlexibleMembership(groupInfo, userPubkey, relays);
      if (isFlexibleMember) {
        console.log(`Flexible membership confirmed for ${userPubkey} in group ${groupId}`);
        return true;
      }
      
      // If both approaches fail, try direct WebSocket as a last resort
      try {
        const isWSMember = await this.checkMembershipWithWebSocket(groupInfo, userPubkey, relays[0]);
        if (isWSMember) {
          console.log(`WebSocket membership confirmed for ${userPubkey} in group ${groupId}`);
          return true;
        }
      } catch (wsError) {
        console.warn(`WebSocket membership check failed: ${wsError.message}`);
      }
    } catch (e) {
      console.warn(`Error during membership check: ${e.message}`);
    }
    
    return false;
  }
  
  // Check membership using NIP-51 lists (kind 30001 with d tag "groups")
  async checkNip51Membership(groupInfo, userPubkey, relays) {
    try {
      // Ensure pool is properly initialized
      this.ensurePool();
      
      // Look for NIP-51 lists (kind 30001) containing group references
      const filter = [{
        kinds: [30001],
        authors: [userPubkey],
        '#d': ['groups']
      }];
      
      // Query multiple relays, using the correct filter array format
      try {
        const events = await this.pool.list(relays, filter);
        if (!events || events.length === 0) {
          return false;
        }
        
        // Sort by created_at to get the latest list
        const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
        
        // Look for the group tag in various formats
        return this.checkGroupInTags(latestEvent.tags, groupInfo);
      } catch (error) {
        console.error('Error in pool.list:', error);
        return false;
      }
    } catch (e) {
      throw new Error(`NIP-51 membership check failed: ${e.message}`);
    }
  }
  
  // Check membership with direct WebSocket connection
  async checkMembershipWithWebSocket(groupInfo, userPubkey, relay) {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Checking membership with direct WebSocket to ${relay}`);
        const ws = new WebSocket(relay);
        let hasFoundMembership = false;
        
        const timeout = setTimeout(() => {
          ws.close();
          if (!hasFoundMembership) {
            resolve(false);
          }
        }, 5000);
        
        ws.onopen = () => {
          // Create filter for group lists
          const filter = {
            kinds: [30001],
            authors: [userPubkey],
            '#d': ['groups']
          };
          
          // Send subscription request
          ws.send(JSON.stringify(['REQ', 'membership', filter]));
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message[0] === 'EVENT' && message[2]) {
              const eventData = message[2];
              
              // Check membership in this event
              const isMember = this.checkGroupInTags(eventData.tags || [], groupInfo);
              
              if (isMember) {
                hasFoundMembership = true;
                clearTimeout(timeout);
                ws.close();
                resolve(true);
              }
            } else if (message[0] === 'EOSE') {
              // End of stored events, if we haven't found membership yet
              if (!hasFoundMembership) {
                clearTimeout(timeout);
                ws.close();
                resolve(false);
              }
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          clearTimeout(timeout);
          ws.close();
          reject(error);
        };
        
        ws.onclose = () => {
          clearTimeout(timeout);
          if (!hasFoundMembership) {
            resolve(false);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Check for group in tags with multiple format options
  checkGroupInTags(tags, groupInfo) {
    // The standard format is kind:pubkey:identifier
    const standardFormat = `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;
    
    // Alternative format with kind 30023
    const altKindFormat = `30023:${groupInfo.pubkey}:${groupInfo.identifier}`;
    
    // Check all tags
    return tags.some(tag => {
      if (tag[0] !== 'a') return false;
      
      const groupIdentifier = tag[1];
      return (
        // Direct match of group identifier
        groupIdentifier === standardFormat ||
        // Match alternative format
        groupIdentifier === altKindFormat ||
        // Match the identifier using just the pubkey and identifier
        groupIdentifier.includes(`${groupInfo.pubkey}:${groupInfo.identifier}`) ||
        // Match partial identifier 
        (groupInfo.identifier && groupIdentifier.includes(groupInfo.identifier)) ||
        // Match partial pubkey with kind
        groupIdentifier.includes(`30023:${groupInfo.pubkey}`) ||
        // Match any relay-specific format that might be used
        groupIdentifier.includes(`${groupInfo.kind}:${groupInfo.pubkey}`)
      );
    });
  }
  
  // Check membership using a flexible approach
  async checkFlexibleMembership(groupInfo, userPubkey, relays) {
    try {
      // Ensure pool is properly initialized
      this.ensurePool();
      
      // Try multiple formats at once to reduce network requests
      const identifier = groupInfo.identifier;
      
      // Construct filters that catch various ways a user might be in a group
      // CRITICAL: filters parameter must be an array of filter objects
      const filters = [
        // Direct 'a' tag with kind:pubkey:identifier format
        {
          kinds: [30001, 30000], // Kind for lists
          authors: [userPubkey],
          '#a': [`${groupInfo.kind}:${groupInfo.pubkey}:${identifier}`]
        },
        // Alternative format 1: 'd' tag with groups and 'a' tags in content
        {
          kinds: [30001],
          authors: [userPubkey],
          '#d': ['groups']
        },
        // Direct h tag format
        {
          kinds: [1, 9021], // Kind for group join request
          authors: [userPubkey],
          '#h': [identifier]
        }
      ];
      
      // Try each filter on all relays
      for (const filter of filters) {
        try {
          // Use the correct array format for filters
          const events = await this.pool.list(relays, [filter]);
          
          if (events && events.length > 0) {
            // Check each event for the group reference
            for (const event of events) {
              // If it's a group list, check the tags
              if (event.kind === 30001 && event.tags.some(t => t[0] === 'd' && t[1] === 'groups')) {
                if (this.checkGroupInTags(event.tags, groupInfo)) {
                  return true;
                }
              }
              
              // Check for '#h' tag matching the identifier
              if (event.tags.some(t => t[0] === 'h' && t[1] === identifier)) {
                return true;
              }
            }
          }
        } catch (error) {
          console.warn(`Error with filter ${JSON.stringify(filter)}:`, error);
          continue; // Try next filter even if this one failed
        }
      }
      
      return false;
    } catch (e) {
      throw new Error(`Flexible membership check failed: ${e.message}`);
    }
  }
  
  // Add member to the cache
  addToMembershipCache(groupId, pubkey) {
    if (!this.membershipCache.has(groupId)) {
      this.membershipCache.set(groupId, new Set());
    }
    this.membershipCache.get(groupId).add(pubkey);
    this.saveToStorage();
  }
  
  // Check membership from cache first, then network if needed
  async hasJoinedGroup(naddrString, userPubkey, forceRefresh = false) {
    try {
      const groupInfo = this.parseNaddr(naddrString);
      if (!groupInfo) return false;
      
      const groupId = this.getGroupId(groupInfo);
      
      // Check cache first
      if (!forceRefresh && this.membershipCache.has(groupId)) {
        if (this.membershipCache.get(groupId).has(userPubkey)) {
          console.log(`Cache hit: ${userPubkey} is a member of ${groupId}`);
          return true;
        }
      }
      
      // If not in cache or force refresh, check network
      return await this.refreshMembershipStatus(naddrString, userPubkey);
    } catch (error) {
      console.error('Error checking group membership:', error);
      return false;
    }
  }
}

// Export a singleton instance
const groupMembershipManager = new GroupMembershipManager();
export default groupMembershipManager; 