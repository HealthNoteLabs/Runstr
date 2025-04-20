import { SimplePool } from 'nostr-tools';
import { decode as decodeNip19 } from 'nostr-tools/nip19';

class GroupMembershipManager {
  constructor() {
    // Initialize SimplePool for standard Nostr relay operations
    this.pool = new SimplePool();
    
    // Cache for membership status to reduce network requests
    this.membershipCache = new Map(); // groupId -> Map of pubkey -> boolean
    
    // Default relays for group operations
    this.defaultRelays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band'
    ];
    
    // Try to load cache from localStorage
    this.loadCacheFromStorage();
  }
  
  loadCacheFromStorage() {
    try {
      const cachedData = localStorage.getItem('group_membership_cache');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        
        // Convert back to Map of Maps
        this.membershipCache = new Map();
        Object.entries(parsed.membershipCache).forEach(([groupId, members]) => {
          this.membershipCache.set(groupId, new Map(Object.entries(members)));
        });
      }
    } catch (e) {
      console.error('Failed to load membership cache', e);
      // Reset cache if loading fails
      this.membershipCache = new Map();
    }
  }
  
  saveToStorage() {
    try {
      // Convert Maps to serializable objects
      const cacheData = {
        membershipCache: Object.fromEntries(
          Array.from(this.membershipCache.entries()).map(
            ([groupId, members]) => [groupId, Object.fromEntries(members)]
          )
        )
      };
      
      localStorage.setItem('group_membership_cache', JSON.stringify(cacheData));
    } catch (e) {
      console.error('Failed to save membership cache', e);
    }
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

  // Get relays from group info or fallback to default relays
  getGroupRelays(groupInfo) {
    // Add group-specific relays if available
    return [...new Set([
      ...this.defaultRelays,
      ...(groupInfo.relays || [])
    ])];
  }

  // Clear membership cache for a specific group or user
  clearCache(groupId = null, pubkey = null) {
    if (groupId && pubkey) {
      // Clear for specific group and user
      if (this.membershipCache.has(groupId)) {
        this.membershipCache.get(groupId).delete(pubkey);
      }
    } else if (groupId) {
      // Clear for specific group
      this.membershipCache.delete(groupId);
    } else {
      // Clear all
      this.membershipCache.clear();
    }
    this.saveToStorage();
  }

  // Check if user is a member of the group using proper NIP-29 events
  async checkMembershipStatus(groupInfo, userPubkey) {
    const groupId = this.getGroupId(groupInfo);
    const relays = this.getGroupRelays(groupInfo);
    
    try {
      console.log(`Checking membership status for ${userPubkey} in group ${groupId}`);
      
      // 1. Check for member addition events (kind 42)
      const memberEvents = await this.pool.querySync(relays, [{
        kinds: [42],
        '#d': [groupInfo.identifier],
        limit: 100
      }]);
      
      // Check if user is in any member addition events
      for (const event of memberEvents) {
        try {
          // Check 'p' tags for user pubkey
          if (event.tags.some(tag => tag[0] === 'p' && tag[1] === userPubkey)) {
            console.log(`Found user ${userPubkey} in member addition event`, event);
            return true;
          }
          
          // Also check if content contains members array
          const content = JSON.parse(event.content);
          if (content.members && Array.isArray(content.members) && 
              content.members.includes(userPubkey)) {
            console.log(`Found user ${userPubkey} in members list`, event);
            return true;
          }
        } catch {
          // Continue checking other events if one fails to parse
          continue;
        }
      }
      
      // 2. Check if user has posted to the group (implicit membership)
      const userMessages = await this.pool.querySync(relays, [{
        kinds: [42, 43, 44], // Group-related message types
        authors: [userPubkey],
        '#d': [groupInfo.identifier],
        limit: 10
      }]);
      
      if (userMessages.length > 0) {
        console.log(`User ${userPubkey} has posted to group ${groupId}`, userMessages[0]);
        return true;
      }
      
      // 3. Check if the group is "public" - in some cases everyone is a member
      const metadataEvents = await this.pool.querySync(relays, [{
        kinds: [41], // Group metadata
        '#d': [groupInfo.identifier],
        limit: 1
      }]);
      
      if (metadataEvents.length > 0) {
        const metadata = metadataEvents[0];
        // Check if group has a "public" tag or similar
        const isPublic = metadata.tags.some(tag => 
          (tag[0] === 'public' && tag[1] !== 'false') ||
          (tag[0] === 'private' && tag[1] === 'false')
        );
        
        if (isPublic) {
          console.log(`Group ${groupId} is public, considering ${userPubkey} a member`);
          return true;
        }
      }
      
      // 4. Check if there are any member removal events (kind 43) after additions
      const removalEvents = await this.pool.querySync(relays, [{
        kinds: [43],
        '#d': [groupInfo.identifier],
        '#p': [userPubkey],
        limit: 10
      }]);
      
      if (removalEvents.length > 0) {
        // Sort by created_at to get the latest
        const latestRemoval = removalEvents.sort((a, b) => b.created_at - a.created_at)[0];
        
        // If the most recent event is a removal, user is not a member
        console.log(`Found removal event for ${userPubkey} in group ${groupId}`, latestRemoval);
        return false;
      }
      
      // No evidence of membership
      return false;
    } catch (error) {
      console.error(`Error checking NIP-29 membership: ${error.message}`);
      return false;
    }
  }
  
  // Main method to check membership status
  async hasJoinedGroup(naddrString, userPubkey, forceRefresh = false) {
    try {
      // Parse the group naddr
      const groupInfo = this.parseNaddr(naddrString);
      if (!groupInfo) return false;
      
      const groupId = this.getGroupId(groupInfo);
      
      // Check cache first unless forced refresh
      if (!forceRefresh) {
        // Get group's cache
        const groupCache = this.membershipCache.get(groupId);
        if (groupCache && groupCache.has(userPubkey)) {
          console.log(`Cache hit: ${userPubkey} is ${groupCache.get(userPubkey) ? '' : 'not '}a member of ${groupId}`);
          return groupCache.get(userPubkey);
        }
      }
      
      // If not in cache or forced refresh, check membership status
      const isMember = await this.checkMembershipStatus(groupInfo, userPubkey);
      
      // Update cache with result
      if (!this.membershipCache.has(groupId)) {
        this.membershipCache.set(groupId, new Map());
      }
      this.membershipCache.get(groupId).set(userPubkey, isMember);
      
      // Save to persistent storage
      this.saveToStorage();
      
      return isMember;
    } catch (error) {
      console.error('Error checking group membership:', error);
      return false;
    }
  }
  
  // Refresh membership status from network and update cache
  async refreshMembershipStatus(naddrString, userPubkey) {
    // This just forces a cache refresh
    return await this.hasJoinedGroup(naddrString, userPubkey, true);
  }
  
  // Close the pool to release resources
  close() {
    if (this.pool) {
      this.pool.close();
    }
  }
}

// Export a singleton instance
const groupMembershipManager = new GroupMembershipManager();
export default groupMembershipManager; 