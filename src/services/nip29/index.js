import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import { RELAYS } from '../../utils/nostr';
import { Platform } from '../../utils/react-native-shim';
import AmberAuth from '../../services/AmberAuth';

// Use a smaller set of relays specifically for groups to reduce connection overhead
// This helps avoid conflicts with the main feed's relay connections
const GROUP_RELAYS = [
  'wss://relay.0xchat.com',  // Primary for groups
  'wss://relay.damus.io',    // Good secondary
  'wss://nos.lol'            // Good tertiary
];

// Create a separate NDK instance specifically for group operations
// This avoids conflicts with the main feed's NDK instance
const groupNdk = new NDK({
  explicitRelayUrls: GROUP_RELAYS
});

// Track connection state
let isConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;
let lastConnectionTime = 0;
const CONNECTION_COOLDOWN = 30000; // 30 seconds between connection attempts

// Helper to generate proper NIP29 group ID
export function createGroupId(relayUrl, randomId) {
  const host = new URL(relayUrl).hostname;
  return `${host}'${randomId}`;
}

// Generate random string for group IDs
function generateRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Extract relay from group ID
export function getRelayFromGroupId(groupId) {
  const [host] = groupId.split("'");
  return `wss://${host}`;
}

// Ensure connection to group relays
export async function connectToGroupRelays() {
  // Check if we recently tried to connect to avoid hammering relays
  const now = Date.now();
  if (isConnected || (now - lastConnectionTime < CONNECTION_COOLDOWN && connectionAttempts > 0)) {
    return isConnected;
  }
  
  // Update connection tracking
  lastConnectionTime = now;
  connectionAttempts++;
  
  try {
    // Create a timeout promise that rejects after 5 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
    
    // Create the connection promise
    const connectionPromise = groupNdk.connect();
    
    // Race the connection against the timeout
    await Promise.race([connectionPromise, timeoutPromise]);
    console.log('Connected to group relays');
    isConnected = true;
    return true;
  } catch (error) {
    console.error('Error connecting to group relays:', error);
    isConnected = false;
    
    // If we've tried too many times, back off more aggressively
    if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
      console.warn(`Maximum connection attempts (${MAX_CONNECTION_ATTEMPTS}) reached, backing off`);
      // Reset attempts after backing off
      setTimeout(() => {
        connectionAttempts = 0;
      }, CONNECTION_COOLDOWN * 2);
    }
    
    return false;
  }
}

// Get pubkey using the appropriate method based on platform
async function getPubkey() {
  // First check if we have a cached pubkey to avoid unnecessary auth requests
  const storedPubkey = localStorage.getItem('nostrPublicKey');
  if (storedPubkey) {
    return storedPubkey;
  }
  
  // For Android, use Amber if available
  if (Platform.OS === 'android') {
    const isAmberAvailable = await AmberAuth.isAmberInstalled();
    if (isAmberAvailable) {
      // Request authentication via Amber
      // Note: The actual pubkey is returned via the deep link handler
      // So we need to check localStorage where NostrProvider saves it
      await AmberAuth.requestAuthentication();
      // Wait a moment for the deep link handler to process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if we have a pubkey in localStorage
      const permissionsGranted = localStorage.getItem('permissionsGranted') === 'true';
      if (permissionsGranted) {
        const storedPubkey = localStorage.getItem('nostrPublicKey');
        if (storedPubkey) return storedPubkey;
      }
      
      throw new Error('Could not get public key from Amber');
    }
  }
  
  // Fallback to window.nostr
  if (window.nostr) {
    return await window.nostr.getPublicKey();
  }
  
  throw new Error('No Nostr signer available');
}

// Sign an event using the appropriate method based on platform
async function signWithPlatformMethod(event) {
  // For Android, use Amber if available
  if (Platform.OS === 'android') {
    const isAmberAvailable = await AmberAuth.isAmberInstalled();
    if (isAmberAvailable) {
      return await AmberAuth.signEvent(event);
    }
  }
  
  // Fallback to window.nostr
  if (window.nostr) {
    return await window.nostr.signEvent(event);
  }
  
  throw new Error('No Nostr signer available');
}

// Create a new group
export async function createGroup(name, about) {
  try {
    await connectToGroupRelays();
    
    const relayUrl = 'wss://relay.0xchat.com'; // Primary relay for groups - updated to 0xchat
    const randomId = generateRandomString(8);
    const groupId = createGroupId(relayUrl, randomId);
    
    try {
      // Get the current user's public key
      const pubkey = await getPubkey();
      
      // Create the group metadata event
      const metadataEvent = {
        kind: 39000, // Group metadata event
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', randomId],
          ['name', name],
          ['about', about],
          ['h', groupId]
        ],
        content: '',
        pubkey: pubkey
      };
      
      // Sign the event using platform-specific method
      await signWithPlatformMethod(metadataEvent);
      
      // Publish the signed event
      const ndk = new NDK({ explicitRelayUrls: [relayUrl, ...GROUP_RELAYS] });
      await ndk.connect();
      
      const ndkEvent = new NDKEvent(ndk, metadataEvent);
      await ndkEvent.publish();
      
      // Create admin list event (make creator the admin)
      const adminEvent = {
        kind: 39001, // Group admin list
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['h', groupId],
          ['p', pubkey]
        ],
        content: '',
        pubkey: pubkey
      };
      
      // Sign and publish admin event
      await signWithPlatformMethod(adminEvent);
      const ndkAdminEvent = new NDKEvent(ndk, adminEvent);
      await ndkAdminEvent.publish();
      
      return { groupId, success: true };
    } catch (error) {
      console.error('Error in group creation process:', error);
      return { error: error.message, success: false };
    }
  } catch (error) {
    console.error('Error creating group:', error);
    return { error: error.message, success: false };
  }
}

// Get timeline references for request context
export async function getTimelineReferences(groupId) {
  try {
    // We don't actually need to use the relayUrl here
    // const relayUrl = getRelayFromGroupId(groupId);
    await connectToGroupRelays();
    
    // Fetch recent events in the group
    const filter = {
      '#h': [groupId],
      kinds: [1, 9000, 9001, 9021, 9022],
      limit: 50
    };
    
    const events = await groupNdk.fetchEvents(filter);
    const eventArray = Array.from(events);
    
    // Sort by creation time (newest first)
    eventArray.sort((a, b) => b.created_at - a.created_at);
    
    // Take 3 recent events for timeline references
    return eventArray.slice(0, 3).map(e => e.id);
  } catch (err) {
    console.error('Error getting timeline references:', err);
    return [];
  }
}

// Request to join a group
export async function requestToJoinGroup(groupId, inviteCode = null) {
  try {
    await connectToGroupRelays();
    
    // Get the current user's public key using platform-aware method
    const pubkey = await getPubkey();
    
    // Get timeline references
    const timelineRefs = await getTimelineReferences(groupId);
    
    // Create the join request event
    const requestEvent = {
      kind: 9021, // Join request event
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['h', groupId]
      ],
      content: 'Request to join the running group',
      pubkey: pubkey
    };
    
    // Add invite code if provided
    if (inviteCode) {
      requestEvent.tags.push(['code', inviteCode]);
    }
    
    // Add timeline references
    if (timelineRefs.length > 0) {
      timelineRefs.forEach(ref => {
        requestEvent.tags.push(['e', ref]);
      });
    }
    
    // Sign using platform-specific method
    await signWithPlatformMethod(requestEvent);
    
    // Publish the event
    const ndk = new NDK({ explicitRelayUrls: GROUP_RELAYS });
    await ndk.connect();
    
    const ndkEvent = new NDKEvent(ndk, requestEvent);
    await ndkEvent.publish();
    
    return { success: true };
  } catch (error) {
    console.error('Error requesting to join group:', error);
    return { error: error.message, success: false };
  }
}

// Leave a group
export async function leaveGroup(groupId) {
  try {
    await connectToGroupRelays();
    
    // Get the current user's public key using platform-aware method
    const pubkey = await getPubkey();
    
    // Get timeline references
    const timelineRefs = await getTimelineReferences(groupId);
    
    // Create the leave group event
    const leaveEvent = {
      kind: 9022, // Leave group event
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['h', groupId]
      ],
      content: 'Leaving running group',
      pubkey: pubkey
    };
    
    // Add timeline references
    if (timelineRefs.length > 0) {
      timelineRefs.forEach(ref => {
        leaveEvent.tags.push(['e', ref]);
      });
    }
    
    // Sign using platform-specific method
    await signWithPlatformMethod(leaveEvent);
    
    // Publish the event
    const ndk = new NDK({ explicitRelayUrls: GROUP_RELAYS });
    await ndk.connect();
    
    const ndkEvent = new NDKEvent(ndk, leaveEvent);
    await ndkEvent.publish();
    
    return { success: true };
  } catch (error) {
    console.error('Error leaving group:', error);
    return { error: error.message, success: false };
  }
}

// Cache for running groups to avoid repeated fetches
let runningGroupsCache = null;
let lastFetchTime = 0;
const CACHE_VALIDITY_PERIOD = 5 * 60 * 1000; // 5 minutes

// Fetch running groups (with #RUNSTR tag)
export async function fetchRunningGroups() {
  try {
    // Check cache first
    const now = Date.now();
    if (runningGroupsCache && (now - lastFetchTime < CACHE_VALIDITY_PERIOD)) {
      console.log('Using cached running groups data');
      return runningGroupsCache;
    }
    
    // Connect to relays with better timeout handling
    await connectToGroupRelays();
    if (!isConnected) {
      console.warn('Failed to connect to group relays, using default groups');
      return getDefaultGroups();
    }
    
    // Try to get clubs using a sequential approach to avoid overwhelming connections
    try {
      // First try the most specific relay that tends to have the most clubs
      console.log('Fetching clubs from primary relay...');
      const primaryRelay = 'wss://relay.0xchat.com';
      const ndk = new NDK({ explicitRelayUrls: [primaryRelay] });
      
      // Connect with timeout
      try {
        await Promise.race([
          ndk.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
        ]);
        
        // Fetch groups
        const filter = {
          kinds: [39000], // Group metadata
          limit: 50 // Reduced from 100 to improve performance
        };
        
        const events = await Promise.race([
          ndk.fetchEvents(filter),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), 8000))
        ]);
        
        if (events && events.size > 0) {
          console.log(`Found ${events.size} groups from primary relay`);
          const groups = processGroupEvents(Array.from(events));
          
          if (groups.length > 0 && groups[0].id !== 'default') {
            // We found actual groups, update cache and return
            runningGroupsCache = groups;
            lastFetchTime = now;
            
            // Continue loading in background for more complete results
            setTimeout(() => {
              fetchRemainingRelays(['wss://relay.damus.io', 'wss://nos.lol']);
            }, 0);
            
            return groups;
          }
        }
      } catch (error) {
        console.log('Primary relay fetch failed:', error.message);
        // Continue to fallback
      }
      
      // If primary relay failed, try others sequentially
      // This is more connection-efficient than parallel requests
      console.log('Primary relay failed, trying secondary relays sequentially...');
      const secondaryRelays = ['wss://relay.damus.io', 'wss://nos.lol'];
      
      for (const relay of secondaryRelays) {
        try {
          console.log(`Trying ${relay}...`);
          const ndkSecondary = new NDK({ explicitRelayUrls: [relay] });
          
          // Connect with timeout
          await Promise.race([
            ndkSecondary.connect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
          ]);
          
          // Fetch groups
          const filter = {
            kinds: [39000],
            limit: 40
          };
          
          const events = await Promise.race([
            ndkSecondary.fetchEvents(filter),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), 8000))
          ]);
          
          if (events && events.size > 0) {
            console.log(`Found ${events.size} groups from ${relay}`);
            const groups = processGroupEvents(Array.from(events));
            
            if (groups.length > 0 && groups[0].id !== 'default') {
              // We found actual groups, update cache and return
              runningGroupsCache = groups;
              lastFetchTime = now;
              return groups;
            }
          }
        } catch (error) {
          console.log(`Relay ${relay} fetch failed:`, error.message);
          // Continue to next relay
        }
      }
      
      // If we got here, all relay fetches failed or returned no results
      // Return default groups
      return getDefaultGroups();
    } catch (error) {
      console.error('Error fetching groups:', error);
      return getDefaultGroups();
    }
  } catch (error) {
    console.error('Error in fetchRunningGroups:', error);
    return getDefaultGroups();
  }
}

// Helper function to process group events into formatted groups
function processGroupEvents(events) {
  // Deduplicate events
  const uniqueEvents = new Map();
  
  // Process each event
  for (const event of events) {
    if (!event || !event.id) continue;
    uniqueEvents.set(event.id, event);
  }
  
  // Extract the unique events
  const uniqueEventsArray = Array.from(uniqueEvents.values());
  const groups = [];
  
  // Process groups and look for #RUNSTR in name, about, or tags
  for (const event of uniqueEventsArray) {
    try {
      // Extract group details from tags
      const name = event.tags.find(t => t[0] === 'name')?.[1] || 'Unnamed Group';
      const about = event.tags.find(t => t[0] === 'about')?.[1] || '';
      const idTag = event.tags.find(t => t[0] === 'h')?.[1] || event.tags.find(t => t[0] === 'd')?.[1];
      
      if (!idTag) continue; // Skip if no group ID found
      
      // Check for #RUNSTR in various places
      const hasRunstrTag = event.tags.some(t => 
        (t[0] === 't' && t[1].toUpperCase() === 'RUNSTR') ||
        (t[0] === 'hashtag' && t[1].toUpperCase() === 'RUNSTR')
      );
      
      // Check content for RUNSTR (some metadata might store it there)
      const contentHasRunstr = event.content && event.content.toUpperCase().includes('#RUNSTR');
      
      // Look for RUNSTR in name or about
      const nameHasRunstr = name.toUpperCase().includes('#RUNSTR');
      const aboutHasRunstr = about.toUpperCase().includes('#RUNSTR');
      
      // Include group if it has RUNSTR in any of these places
      if (nameHasRunstr || aboutHasRunstr || hasRunstrTag || contentHasRunstr) {
        // For groups that don't have a proper display name, use a generic one
        const displayName = name === 'Unnamed Group' ? 'Running Club #RUNSTR' : name;
        
        groups.push({
          id: idTag,
          name: displayName,
          about: about || 'A club for runners',
          createdAt: event.created_at || Math.floor(Date.now() / 1000),
          createdBy: event.pubkey
        });
      }
    } catch (error) {
      console.error('Error processing group event:', error);
      // Continue with next event
    }
  }
  
  return groups.length > 0 ? groups : getDefaultGroups();
}

// Background fetch for remaining relays
async function fetchRemainingRelays(relays) {
  try {
    const fetchPromises = relays.map((relay, index) => {
      return new Promise(async (resolve) => {
        try {
          const ndk = new NDK({ explicitRelayUrls: [relay] });
          await ndk.connect();
          
          const filter = {
            kinds: [39000],
            limit: 50
          };
          
          const events = await ndk.fetchEvents(filter);
          console.log(`Background fetch: Found ${events.size} groups from ${relay}`);
          resolve(Array.from(events));
        } catch (error) {
          console.error(`Background fetch error from ${relay}:`, error);
          resolve([]);
        }
      });
    });
    
    const results = await Promise.all(fetchPromises);
    const allEvents = [].concat(...results);
    
    if (allEvents.length > 0) {
      // Process the new events and update cache
      const updatedGroups = processGroupEvents(allEvents);
      
      // Only update cache if we have better results
      if (updatedGroups.length > 0 && updatedGroups[0].id !== 'default') {
        runningGroupsCache = updatedGroups;
        lastFetchTime = Date.now();
        console.log('Updated clubs cache with background fetch results');
        
        // Dispatch an event to notify components about the updated data
        document.dispatchEvent(new CustomEvent('clubsDataUpdated', { 
          detail: { clubs: updatedGroups } 
        }));
      }
    }
  } catch (error) {
    console.error('Error in background fetch:', error);
  }
}

// Get default groups for fallback
function getDefaultGroups() {
  return [{
    id: 'default',
    name: 'Alpha Test #RUNSTR',
    about: 'This is a placeholder running club until real ones are created. Create your own club to get started!',
    createdAt: Math.floor(Date.now() / 1000),
    createdBy: ''
  }];
}

// Get group members
export async function getGroupMembers(groupId) {
  try {
    await connectToGroupRelays();
    
    // No need to extract relay URL if we're not using it
    // const relayUrl = getRelayFromGroupId(groupId);
    
    // Fetch member addition events
    const addFilter = {
      kinds: [9000], // Add user events
      '#h': [groupId]
    };
    
    // Fetch member removal events
    const removeFilter = {
      kinds: [9001], // Remove user events
      '#h': [groupId]
    };
    
    const [addEvents, removeEvents] = await Promise.all([
      groupNdk.fetchEvents(addFilter),
      groupNdk.fetchEvents(removeFilter)
    ]);
    
    // Track current members (those added but not removed)
    const memberMap = new Map();
    
    // Process addition events
    for (const event of addEvents) {
      const targetPubkey = event.tags.find(t => t[0] === 'p')?.[1];
      if (targetPubkey) {
        memberMap.set(targetPubkey, {
          pubkey: targetPubkey,
          addedAt: event.created_at,
          addedBy: event.pubkey
        });
      }
    }
    
    // Process removal events
    for (const event of removeEvents) {
      const targetPubkey = event.tags.find(t => t[0] === 'p')?.[1];
      if (targetPubkey && memberMap.has(targetPubkey)) {
        memberMap.delete(targetPubkey);
      }
    }
    
    return Array.from(memberMap.values());
  } catch (error) {
    console.error('Error fetching group members:', error);
    return [];
  }
}

// Check if user is a member of the group
export async function checkGroupMembership(groupId) {
  try {
    // Get public key using platform-aware method
    let userPubkey;
    try {
      userPubkey = await getPubkey();
    } catch (error) {
      return { isMember: false, role: null };
    }
    
    await connectToGroupRelays();
    
    // Check if user is admin
    const adminFilter = {
      kinds: [39001], // Admin list events
      '#h': [groupId]
    };
    
    const adminEvents = await groupNdk.fetchEvents(adminFilter);
    
    for (const event of adminEvents) {
      const isAdmin = event.tags.some(t => t[0] === 'p' && t[1] === userPubkey);
      if (isAdmin) {
        return { isMember: true, role: 'admin' };
      }
    }
    
    // Check if user is a regular member
    const members = await getGroupMembers(groupId);
    const isMember = members.some(m => m.pubkey === userPubkey);
    
    return { 
      isMember, 
      role: isMember ? 'member' : null 
    };
  } catch (error) {
    console.error('Error checking group membership:', error);
    return { isMember: false, role: null };
  }
}

// Post a message to a group
export async function postToGroup(groupId, content) {
  try {
    await connectToGroupRelays();
    
    // Get the current user's public key using platform-aware method
    const pubkey = await getPubkey();
    
    // Get timeline references
    const timelineRefs = await getTimelineReferences(groupId);
    
    // Create the post event
    const postEvent = {
      kind: 1, // Regular note
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['h', groupId],
        ['t', 'RUNSTR'],
        ['t', 'running']
      ],
      content: content,
      pubkey: pubkey
    };
    
    // Add timeline references
    if (timelineRefs.length > 0) {
      timelineRefs.forEach(ref => {
        postEvent.tags.push(['e', ref]);
      });
    }
    
    // Sign using platform-specific method
    await signWithPlatformMethod(postEvent);
    
    // Publish the event
    const ndk = new NDK({ explicitRelayUrls: GROUP_RELAYS });
    await ndk.connect();
    
    const ndkEvent = new NDKEvent(ndk, postEvent);
    await ndkEvent.publish();
    
    return { success: true };
  } catch (error) {
    console.error('Error posting to group:', error);
    return { error: error.message, success: false };
  }
}

// Get group posts
export async function getGroupPosts(groupId) {
  try {
    // Special case for default club
    if (groupId === 'default') {
      // Create a default welcome post
      const userPubkey = localStorage.getItem('nostrPublicKey') || 'default-user';
      return [{
        id: `welcome-${Date.now()}`,
        content: 'Welcome to the Alpha Test running club! This is a special club for testing purposes. You can post messages here to try out the club functionality.',
        pubkey: userPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: []
      }];
    }
    
    await connectToGroupRelays();
    
    const filter = {
      kinds: [1], // Regular notes
      '#h': [groupId],
      limit: 100
    };
    
    const events = await groupNdk.fetchEvents(filter);
    const posts = Array.from(events);
    
    // Sort by creation time (newest first)
    return posts.sort((a, b) => b.created_at - a.created_at);
  } catch (error) {
    console.error('Error fetching group posts:', error);
    return [];
  }
} 