import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import { RELAYS } from '../../utils/nostr';
import { Platform } from '../../utils/react-native-shim';
import AmberAuth from '../../services/AmberAuth';

// Add some relays known to support NIP29
const GROUP_RELAYS = [
  'wss://relay.0xchat.com', // Added as recommended
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://nostr.wine',
  'wss://eden.nostr.land',
  'wss://groups.nostr.com'
];

// Initialize NDK instance for group operations
const groupNdk = new NDK({
  explicitRelayUrls: [...RELAYS, ...GROUP_RELAYS]
});

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
    return true;
  } catch (error) {
    console.error('Error connecting to group relays:', error);
    return false;
  }
}

// Get pubkey using the appropriate method based on platform
async function getPubkey() {
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

// Fetch running groups (with #RUNSTR tag)
export async function fetchRunningGroups() {
  try {
    await connectToGroupRelays();
    
    // Create a timeout promise that rejects after 10 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Fetch timeout')), 10000); // 10 second timeout
    });
    
    // Try specific relays that are known to work well with NIP29
    const specificRelays = [
      'wss://relay.0xchat.com',
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band'
    ];
    
    // Create a function to fetch from a specific relay
    const fetchFromRelay = async (relay) => {
      console.log(`Trying to fetch groups from ${relay}...`);
      
      try {
        const ndk = new NDK({ explicitRelayUrls: [relay] });
        await ndk.connect();
        
        // Fetch groups with broader filter
        const filter = {
          kinds: [39000], // Group metadata
          limit: 100 // Increased limit to find more groups
        };
        
        const events = await ndk.fetchEvents(filter);
        console.log(`Found ${events.size} groups from ${relay}`);
        return Array.from(events);
      } catch (error) {
        console.error(`Error fetching from ${relay}:`, error);
        return [];
      }
    };
    
    // Try fetching from each relay in parallel
    const allPromises = specificRelays.map(relay => fetchFromRelay(relay));
    
    // Wait for all fetches, with timeout
    const fetchPromise = Promise.all(allPromises);
    const results = await Promise.race([fetchPromise, timeoutPromise])
      .catch(error => {
        console.error('Error or timeout in fetchRunningGroups:', error);
        return [];
      });
    
    // Flatten and deduplicate events
    const allEvents = [].concat(...results);
    const uniqueEvents = new Map();
    
    // Process each event
    for (const event of allEvents) {
      if (!event || !event.id) continue;
      
      uniqueEvents.set(event.id, event);
    }
    
    // Extract the unique events
    const events = Array.from(uniqueEvents.values());
    const groups = [];
    
    // Process groups and look for #RUNSTR in name, about, or tags
    for (const event of events) {
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
    
    // If we couldn't find any groups with explicit RUNSTR, create a default entry
    if (groups.length === 0) {
      groups.push({
        id: 'default',
        name: 'Alpha Test #RUNSTR',
        about: 'This is a placeholder running club until real ones are created. Create your own club to get started!',
        createdAt: Math.floor(Date.now() / 1000),
        createdBy: ''
      });
    }
    
    console.log(`Found ${groups.length} running clubs with #RUNSTR`);
    return groups;
  } catch (error) {
    console.error('Error fetching running groups:', error);
    // Return a default group in case of error
    return [{
      id: 'default',
      name: 'Alpha Test #RUNSTR',
      about: 'This is a placeholder running club until real ones are created. Create your own club to get started!',
      createdAt: Math.floor(Date.now() / 1000),
      createdBy: ''
    }];
  }
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