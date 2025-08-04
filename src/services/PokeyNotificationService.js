/**
 * PokeyNotificationService
 * 
 * Handles incoming Nostr events from Pokey push notifications.
 * Integrates with existing notification systems and provides real-time updates.
 */

import EventNotificationService from './EventNotificationService';

// Event kinds we care about for notifications
const NOTIFICATION_EVENT_KINDS = {
  JOIN_REQUEST: 31001,     // Custom join request notifications
  DIRECT_MESSAGE: 4,       // Standard DMs
  TEXT_NOTE: 1,            // Text notes (for mentions)
  RUN_EVENT: 31923,        // Running events
  TEAM_EVENT: 9802,        // Team events
  FITNESS_TEAM: 33404      // Team management events
};

// Event listeners for real-time updates
const eventListeners = new Map();

/**
 * Initialize Pokey notification service
 * Sets up event listeners and connects to existing systems
 */
export function initializePokeyService() {
  console.log('[PokeyNotificationService] Initializing Pokey notification service');
  
  // In a full implementation, this would set up the connection to the native broadcast receiver
  // For now, we set up the JavaScript-side handling infrastructure
  
  return {
    isConnected: false,
    supportedKinds: Object.values(NOTIFICATION_EVENT_KINDS),
    listenersCount: eventListeners.size
  };
}

/**
 * Process incoming Nostr event from Pokey broadcast
 * @param {Object} nostrEvent - Raw Nostr event from Pokey
 * @param {string} currentUserPubkey - Current user's pubkey for filtering
 */
export async function processIncomingEvent(nostrEvent, currentUserPubkey) {
  if (!nostrEvent || !nostrEvent.kind || !currentUserPubkey) {
    console.warn('[PokeyNotificationService] Invalid event or missing user pubkey');
    return null;
  }

  try {
    console.log(`[PokeyNotificationService] Processing incoming event kind ${nostrEvent.kind}`);
    
    // Validate event structure
    if (!isValidNostrEvent(nostrEvent)) {
      console.warn('[PokeyNotificationService] Invalid Nostr event structure');
      return null;
    }

    // Check if this event is relevant to current user
    if (!isEventRelevantToUser(nostrEvent, currentUserPubkey)) {
      console.log('[PokeyNotificationService] Event not relevant to current user, skipping');
      return null;
    }

    // Route to appropriate handler based on event kind
    const result = await routeEventToHandler(nostrEvent, currentUserPubkey);
    
    // Notify listeners
    if (result) {
      notifyEventListeners(nostrEvent.kind, result);
    }
    
    return result;
  } catch (error) {
    console.error('[PokeyNotificationService] Error processing incoming event:', error);
    return null;
  }
}

/**
 * Route event to appropriate handler based on kind
 */
async function routeEventToHandler(nostrEvent, currentUserPubkey) {
  const { kind } = nostrEvent;
  
  switch (kind) {
    case NOTIFICATION_EVENT_KINDS.JOIN_REQUEST:
      return await handleJoinRequestNotification(nostrEvent, currentUserPubkey);
      
    case NOTIFICATION_EVENT_KINDS.DIRECT_MESSAGE:
      return await handleDirectMessage(nostrEvent, currentUserPubkey);
      
    case NOTIFICATION_EVENT_KINDS.TEXT_NOTE:
      return await handleTextNote(nostrEvent, currentUserPubkey);
      
    case NOTIFICATION_EVENT_KINDS.TEAM_EVENT:
      return await handleTeamEvent(nostrEvent, currentUserPubkey);
      
    default:
      console.log(`[PokeyNotificationService] Unhandled event kind: ${kind}`);
      return null;
  }
}

/**
 * Handle join request notifications (integrate with existing system)
 */
async function handleJoinRequestNotification(event, currentUserPubkey) {
  try {
    console.log('[PokeyNotificationService] Processing join request notification');
    
    // Check if current user is the intended recipient (captain)
    const recipientTag = event.tags.find(tag => tag[0] === 'p' && tag[1] === currentUserPubkey);
    if (!recipientTag) {
      console.log('[PokeyNotificationService] Join request not for current user');
      return null;
    }
    
    // Parse notification content
    let content;
    try {
      content = JSON.parse(event.content);
    } catch (parseError) {
      console.warn('[PokeyNotificationService] Failed to parse join request content');
      return null;
    }
    
    // Extract relevant information
    const eventIdTag = event.tags.find(tag => tag[0] === 'e');
    const requesterTag = event.tags.find(tag => tag[0] === 'p' && tag[1] !== currentUserPubkey);
    const eventNameTag = event.tags.find(tag => tag[0] === 'event_name');
    
    if (!eventIdTag || !requesterTag) {
      console.warn('[PokeyNotificationService] Join request missing required tags');
      return null;
    }
    
    const notification = {
      id: event.id,
      type: 'join_request',
      eventId: eventIdTag[1],
      eventName: eventNameTag ? eventNameTag[1] : content.eventName || 'Team Event',
      requesterPubkey: requesterTag[1],
      requesterName: content.requesterName || 'Team Member',
      timestamp: content.timestamp || event.created_at * 1000,
      message: content.message,
      source: 'pokey'
    };
    
    console.log('[PokeyNotificationService] Processed join request notification:', notification.id);
    return notification;
    
  } catch (error) {
    console.error('[PokeyNotificationService] Error handling join request:', error);
    return null;
  }
}

/**
 * Handle direct messages
 */
async function handleDirectMessage(event, currentUserPubkey) {
  try {
    console.log('[PokeyNotificationService] Processing direct message');
    
    // Check if current user is the recipient
    const recipientTag = event.tags.find(tag => tag[0] === 'p' && tag[1] === currentUserPubkey);
    if (!recipientTag) {
      return null;
    }
    
    return {
      id: event.id,
      type: 'direct_message',
      from: event.pubkey,
      content: event.content, // Note: In production, this would need decryption
      timestamp: event.created_at * 1000,
      source: 'pokey'
    };
    
  } catch (error) {
    console.error('[PokeyNotificationService] Error handling direct message:', error);
    return null;
  }
}

/**
 * Handle text notes (mentions)
 */
async function handleTextNote(event, currentUserPubkey) {
  try {
    // Check if current user is mentioned
    const mentionTag = event.tags.find(tag => tag[0] === 'p' && tag[1] === currentUserPubkey);
    if (!mentionTag) {
      return null;
    }
    
    return {
      id: event.id,
      type: 'mention',
      from: event.pubkey,
      content: event.content,
      timestamp: event.created_at * 1000,
      source: 'pokey'
    };
    
  } catch (error) {
    console.error('[PokeyNotificationService] Error handling text note:', error);
    return null;
  }
}

/**
 * Handle team events
 */
async function handleTeamEvent(event, currentUserPubkey) {
  try {
    console.log('[PokeyNotificationService] Processing team event');
    
    // Check if current user is involved in this team event
    const relevantTag = event.tags.find(tag => 
      tag[0] === 'p' && tag[1] === currentUserPubkey
    );
    
    if (!relevantTag) {
      return null;
    }
    
    return {
      id: event.id,
      type: 'team_event',
      from: event.pubkey,
      eventName: extractEventName(event),
      timestamp: event.created_at * 1000,
      source: 'pokey'
    };
    
  } catch (error) {
    console.error('[PokeyNotificationService] Error handling team event:', error);
    return null;
  }
}

/**
 * Validate Nostr event structure
 */
function isValidNostrEvent(event) {
  return (
    event &&
    typeof event.id === 'string' &&
    typeof event.pubkey === 'string' &&
    typeof event.kind === 'number' &&
    typeof event.created_at === 'number' &&
    Array.isArray(event.tags) &&
    typeof event.content === 'string'
  );
}

/**
 * Check if event is relevant to current user
 */
function isEventRelevantToUser(event, currentUserPubkey) {
  // Check if user is mentioned in p-tags
  const mentionedInTags = event.tags.some(tag => 
    tag[0] === 'p' && tag[1] === currentUserPubkey
  );
  
  // Check if it's a direct message to user
  const isDirectMessage = event.kind === NOTIFICATION_EVENT_KINDS.DIRECT_MESSAGE &&
    event.tags.some(tag => tag[0] === 'p' && tag[1] === currentUserPubkey);
  
  // Check if it's authored by user (for some event types)
  const isFromUser = event.pubkey === currentUserPubkey;
  
  return mentionedInTags || isDirectMessage || isFromUser;
}

/**
 * Extract event name from event tags or content
 */
function extractEventName(event) {
  // Try to find event name in tags first
  const nameTag = event.tags.find(tag => 
    tag[0] === 'name' || tag[0] === 'title' || tag[0] === 'event_name'
  );
  
  if (nameTag && nameTag[1]) {
    return nameTag[1];
  }
  
  // Try to parse from content
  try {
    const content = JSON.parse(event.content);
    return content.name || content.title || content.eventName || 'Team Event';
  } catch {
    return 'Team Event';
  }
}

/**
 * Add event listener for real-time updates
 */
export function addEventListener(eventType, callback) {
  if (!eventListeners.has(eventType)) {
    eventListeners.set(eventType, new Set());
  }
  
  eventListeners.get(eventType).add(callback);
  
  console.log(`[PokeyNotificationService] Added listener for ${eventType}, total: ${eventListeners.get(eventType).size}`);
  
  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        eventListeners.delete(eventType);
      }
    }
  };
}

/**
 * Notify event listeners
 */
function notifyEventListeners(eventType, data) {
  const listeners = eventListeners.get(eventType);
  if (listeners && listeners.size > 0) {
    console.log(`[PokeyNotificationService] Notifying ${listeners.size} listeners for ${eventType}`);
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('[PokeyNotificationService] Error in event listener:', error);
      }
    });
  }
}

/**
 * Remove event listener
 */
export function removeEventListener(eventType, callback) {
  const listeners = eventListeners.get(eventType);
  if (listeners) {
    listeners.delete(callback);
    if (listeners.size === 0) {
      eventListeners.delete(eventType);
    }
  }
}

/**
 * Get service status
 */
export function getServiceStatus() {
  return {
    isInitialized: true,
    supportedKinds: Object.values(NOTIFICATION_EVENT_KINDS),
    activeListeners: Array.from(eventListeners.keys()),
    totalListeners: Array.from(eventListeners.values()).reduce((sum, set) => sum + set.size, 0)
  };
}

/**
 * Test function to simulate incoming Pokey event (for development)
 */
export function simulateIncomingEvent(eventKind, currentUserPubkey, overrides = {}) {
  const mockEvent = {
    id: `mock_${Date.now()}`,
    pubkey: 'mock_sender_pubkey',
    kind: eventKind,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', currentUserPubkey]],
    content: JSON.stringify({ message: 'Mock notification', timestamp: Date.now() }),
    ...overrides
  };
  
  console.log('[PokeyNotificationService] Simulating incoming event:', mockEvent);
  return processIncomingEvent(mockEvent, currentUserPubkey);
}

export default {
  initializePokeyService,
  processIncomingEvent,
  addEventListener,
  removeEventListener,
  getServiceStatus,
  simulateIncomingEvent,
  NOTIFICATION_EVENT_KINDS
};