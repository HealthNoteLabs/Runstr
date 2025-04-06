import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import { RELAYS } from '../../utils/nostr';

// Add some relays known to support NIP29
const GROUP_RELAYS = [
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
    await groupNdk.connect();
    console.log('Connected to group relays');
    return true;
  } catch (error) {
    console.error('Error connecting to group relays:', error);
    return false;
  }
}

// Create a new group
export async function createGroup(name, about) {
  try {
    await connectToGroupRelays();
    
    const relayUrl = 'wss://groups.nostr.com'; // Primary relay for groups
    const randomId = generateRandomString(8);
    const groupId = createGroupId(relayUrl, randomId);
    
    // Get the current user's public key
    let pubkey;
    if (window.nostr) {
      pubkey = await window.nostr.getPublicKey();
    } else {
      throw new Error('Nostr extension required');
    }
    
    // Create the group metadata event
    const event = new NDKEvent(groupNdk);
    event.kind = 39000; // Group metadata event
    event.created_at = Math.floor(Date.now() / 1000);
    event.tags = [
      ['d', randomId],
      ['name', name],
      ['about', about],
      ['h', groupId]
    ];
    event.content = '';
    event.pubkey = pubkey;
    
    // Sign and publish
    await event.sign();
    await event.publish();
    
    // Create admin list event (make creator the admin)
    const adminEvent = new NDKEvent(groupNdk);
    adminEvent.kind = 39001; // Group admin list
    adminEvent.created_at = Math.floor(Date.now() / 1000);
    adminEvent.tags = [
      ['h', groupId],
      ['p', pubkey]
    ];
    adminEvent.content = '';
    adminEvent.pubkey = pubkey;
    
    // Sign and publish admin event
    await adminEvent.sign();
    await adminEvent.publish();
    
    return { groupId, success: true };
  } catch (error) {
    console.error('Error creating group:', error);
    return { error: error.message, success: false };
  }
}

// Get timeline references for request context
export async function getTimelineReferences(groupId) {
  try {
    const relayUrl = getRelayFromGroupId(groupId);
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
    
    // Get the current user's public key
    let pubkey;
    if (window.nostr) {
      pubkey = await window.nostr.getPublicKey();
    } else {
      throw new Error('Nostr extension required');
    }
    
    // Get timeline references
    const timelineRefs = await getTimelineReferences(groupId);
    
    // Create the join request event
    const event = new NDKEvent(groupNdk);
    event.kind = 9021; // Join request event
    event.created_at = Math.floor(Date.now() / 1000);
    event.tags = [
      ['h', groupId]
    ];
    
    // Add invite code if provided
    if (inviteCode) {
      event.tags.push(['code', inviteCode]);
    }
    
    // Add timeline references
    if (timelineRefs.length > 0) {
      timelineRefs.forEach(ref => {
        event.tags.push(['e', ref]);
      });
    }
    
    event.content = 'Request to join the running group';
    event.pubkey = pubkey;
    
    // Sign and publish
    await event.sign();
    await event.publish();
    
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
    
    // Get the current user's public key
    let pubkey;
    if (window.nostr) {
      pubkey = await window.nostr.getPublicKey();
    } else {
      throw new Error('Nostr extension required');
    }
    
    // Get timeline references
    const timelineRefs = await getTimelineReferences(groupId);
    
    // Create the leave group event
    const event = new NDKEvent(groupNdk);
    event.kind = 9022; // Leave group event
    event.created_at = Math.floor(Date.now() / 1000);
    event.tags = [
      ['h', groupId]
    ];
    
    // Add timeline references
    if (timelineRefs.length > 0) {
      timelineRefs.forEach(ref => {
        event.tags.push(['e', ref]);
      });
    }
    
    event.content = 'Leaving running group';
    event.pubkey = pubkey;
    
    // Sign and publish
    await event.sign();
    await event.publish();
    
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
    
    // Fetch groups with RUNSTR in name or about field
    const filter = {
      kinds: [39000], // Group metadata
      limit: 50
    };
    
    const events = await groupNdk.fetchEvents(filter);
    const groups = [];
    
    // Process each group metadata event
    for (const event of events) {
      // Extract group details from tags
      const name = event.tags.find(t => t[0] === 'name')?.[1] || 'Unnamed Group';
      const about = event.tags.find(t => t[0] === 'about')?.[1] || '';
      const idTag = event.tags.find(t => t[0] === 'h')?.[1];
      
      // Only include groups with "RUNSTR" in name or about
      if (idTag && (name.includes('#RUNSTR') || about.includes('#RUNSTR'))) {
        groups.push({
          id: idTag,
          name,
          about,
          createdAt: event.created_at,
          createdBy: event.pubkey
        });
      }
    }
    
    return groups;
  } catch (error) {
    console.error('Error fetching running groups:', error);
    return [];
  }
}

// Get group members
export async function getGroupMembers(groupId) {
  try {
    await connectToGroupRelays();
    
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
    if (!window.nostr) {
      return { isMember: false, role: null };
    }
    
    const userPubkey = await window.nostr.getPublicKey();
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
    
    // Get timeline references
    const timelineRefs = await getTimelineReferences(groupId);
    
    // Create the post event
    const event = new NDKEvent(groupNdk);
    event.kind = 1; // Regular note
    event.created_at = Math.floor(Date.now() / 1000);
    event.tags = [
      ['h', groupId],
      ['t', 'RUNSTR'],
      ['t', 'running']
    ];
    
    // Add timeline references
    if (timelineRefs.length > 0) {
      timelineRefs.forEach(ref => {
        event.tags.push(['e', ref]);
      });
    }
    
    event.content = content;
    
    // Sign and publish
    await event.sign();
    await event.publish();
    
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