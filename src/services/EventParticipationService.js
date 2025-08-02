/**
 * EventParticipationService
 * 
 * Simplified event participation system following the successful league pattern.
 * Uses localStorage for immediate joins and Nostr lists (Kind 30001) for official captain-managed participants.
 * 
 * Key features:
 * - User clicks join → immediately stored in localStorage 
 * - Captain maintains official participant list as Kind 30001 Nostr list
 * - Hybrid query system checks both localStorage + official list
 * - Simple leaderboard queries 1301 workout events from participants during event timeframe
 */

import { NDKEvent } from '@nostr-dev-kit/ndk';

// Storage keys for localStorage
const STORAGE_KEYS = {
  EVENT_PARTICIPANTS: 'eventParticipants',
  USER_JOINED_EVENTS: 'userJoinedEvents'
};

// Nostr kinds
const KIND_PARTICIPANT_LIST = 30001; // Nostr list for official participants
const KIND_WORKOUT_RECORD = 1301; // Workout events

// In-memory fallback for when localStorage fails
let memoryStorage = {};

/**
 * Enhanced storage wrapper with fallbacks for localStorage failures
 */
const safeStorage = {
  getItem: (key) => {
    try {
      if (typeof localStorage === 'undefined') {
        console.warn('[safeStorage] localStorage not available, using memory fallback');
        return memoryStorage[key] || null;
      }
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('[safeStorage] localStorage.getItem failed, using memory fallback:', error.message);
      return memoryStorage[key] || null;
    }
  },
  
  setItem: (key, value) => {
    try {
      if (typeof localStorage === 'undefined') {
        console.warn('[safeStorage] localStorage not available, using memory fallback');
        memoryStorage[key] = value;
        return true;
      }
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn('[safeStorage] localStorage.setItem failed, using memory fallback:', error.message);
      memoryStorage[key] = value;
      return false; // Indicate localStorage failed but memory fallback succeeded
    }
  },
  
  removeItem: (key) => {
    try {
      if (typeof localStorage === 'undefined') {
        delete memoryStorage[key];
        return;
      }
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('[safeStorage] localStorage.removeItem failed, removing from memory fallback:', error.message);
      delete memoryStorage[key];
    }
  },
  
  isUsingFallback: () => {
    return typeof localStorage === 'undefined' || Object.keys(memoryStorage).length > 0;
  }
};

/**
 * Get stored event participants with enhanced fallback support
 * Format: { eventId: { [pubkey]: { joinedAt, status } } }
 */
function getStoredEventParticipants() {
  try {
    const stored = safeStorage.getItem(STORAGE_KEYS.EVENT_PARTICIPANTS);
    const data = stored ? JSON.parse(stored) : {};
    
    if (safeStorage.isUsingFallback()) {
      console.info('[EventParticipationService] Using fallback storage for participants data');
    }
    
    return data;
  } catch (error) {
    console.error('[EventParticipationService] Error reading stored participants:', error);
    return {};
  }
}

/**
 * Save event participants with enhanced fallback support
 */
function saveStoredEventParticipants(participants) {
  try {
    const success = safeStorage.setItem(STORAGE_KEYS.EVENT_PARTICIPANTS, JSON.stringify(participants));
    
    if (!success) {
      console.warn('[EventParticipationService] Using memory fallback for participant storage');
    }
  } catch (error) {
    console.error('[EventParticipationService] Error saving participants:', error);
  }
}

/**
 * Get user's joined events with enhanced fallback support
 * Format: { [eventId]: { joinedAt, teamAIdentifier, eventName } }
 */
function getUserJoinedEvents() {
  try {
    const stored = safeStorage.getItem(STORAGE_KEYS.USER_JOINED_EVENTS);
    const data = stored ? JSON.parse(stored) : {};
    
    if (safeStorage.isUsingFallback()) {
      console.info('[EventParticipationService] Using fallback storage for user events data');
    }
    
    return data;
  } catch (error) {
    console.error('[EventParticipationService] Error reading user joined events:', error);
    return {};
  }
}

/**
 * Save user's joined events with enhanced fallback support
 */
function saveUserJoinedEvents(joinedEvents) {
  try {
    const success = safeStorage.setItem(STORAGE_KEYS.USER_JOINED_EVENTS, JSON.stringify(joinedEvents));
    
    if (!success) {
      console.warn('[EventParticipationService] Using memory fallback for user events storage');
    }
  } catch (error) {
    console.error('[EventParticipationService] Error saving user joined events:', error);
  }
}

/**
 * Join an event - immediately stored in localStorage
 */
export function joinEventLocally(eventId, teamAIdentifier, eventName, userPubkey) {
  if (!eventId || !userPubkey) {
    throw new Error('EventId and userPubkey are required');
  }

  console.log(`[EventParticipationService] Joining event ${eventId} for user ${userPubkey}`);

  const now = Date.now();

  try {
    // Update event participants
    const participants = getStoredEventParticipants();
    
    if (!participants[eventId]) {
      participants[eventId] = {};
    }
    
    participants[eventId][userPubkey] = {
      joinedAt: now,
      status: 'active',
      source: 'localStorage'
    };
    
    saveStoredEventParticipants(participants);

    // Update user's joined events
    const userJoined = getUserJoinedEvents();
    
    userJoined[eventId] = {
      joinedAt: now,
      teamAIdentifier,
      eventName: eventName || 'Team Event'
    };
    
    saveUserJoinedEvents(userJoined);

    console.log(`[EventParticipationService] Successfully joined event ${eventId}`);
    return true;
  } catch (error) {
    console.error('[EventParticipationService] Error in joinEventLocally:', error);
    throw error;
  }
}

/**
 * Leave an event - remove from localStorage
 */
export function leaveEventLocally(eventId, userPubkey) {
  if (!eventId || !userPubkey) {
    throw new Error('EventId and userPubkey are required');
  }

  console.log(`[EventParticipationService] Leaving event ${eventId} for user ${userPubkey}`);

  // Update event participants
  const participants = getStoredEventParticipants();
  if (participants[eventId] && participants[eventId][userPubkey]) {
    delete participants[eventId][userPubkey];
    if (Object.keys(participants[eventId]).length === 0) {
      delete participants[eventId];
    }
    saveStoredEventParticipants(participants);
  }

  // Update user's joined events
  const userJoined = getUserJoinedEvents();
  if (userJoined[eventId]) {
    delete userJoined[eventId];
    saveUserJoinedEvents(userJoined);
  }

  console.log(`[EventParticipationService] Successfully left event ${eventId}`);
  return true;
}

/**
 * Check if user is participating in an event (localStorage only)
 */
export function isUserParticipatingLocally(eventId, userPubkey) {
  if (!eventId || !userPubkey) return false;

  const participants = getStoredEventParticipants();
  return !!(participants[eventId] && participants[eventId][userPubkey]);
}

/**
 * Get local participants for an event
 */
export function getLocalEventParticipants(eventId) {
  const participants = getStoredEventParticipants();
  const eventParticipants = participants[eventId] || {};
  
  return Object.keys(eventParticipants).map(pubkey => ({
    pubkey,
    ...eventParticipants[pubkey]
  }));
}

/**
 * Get all events the user has joined locally
 */
export function getUserJoinedEventsLocal() {
  return getUserJoinedEvents();
}

/**
 * Fetch official participants from captain's Nostr list (Kind 30001)
 * Captain maintains official participant list for the event
 */
export async function fetchOfficialEventParticipants(ndk, eventId, captainPubkey) {
  if (!ndk || !eventId || !captainPubkey) {
    console.warn('[EventParticipationService] Missing required parameters for fetching official participants');
    return [];
  }

  try {
    console.log(`[EventParticipationService] Fetching official participants for event ${eventId} from captain ${captainPubkey}`);

    const filter = {
      kinds: [KIND_PARTICIPANT_LIST],
      authors: [captainPubkey],
      '#d': [eventId] // d-tag identifies the specific event
    };

    const events = await ndk.fetchEvents(filter);
    console.log(`[EventParticipationService] Found ${events.size} participant list events`);

    if (events.size === 0) {
      return [];
    }

    // Get the most recent participant list
    const sortedEvents = Array.from(events).sort((a, b) => b.created_at - a.created_at);
    const latestList = sortedEvents[0];

    // Extract participants from p-tags
    const participants = [];
    for (const tag of latestList.tags) {
      if (tag[0] === 'p' && tag[1]) {
        participants.push({
          pubkey: tag[1],
          joinedAt: latestList.created_at * 1000, // Convert to milliseconds
          status: 'active',
          source: 'official'
        });
      }
    }

    console.log(`[EventParticipationService] Found ${participants.length} official participants`);
    return participants;
  } catch (error) {
    console.error('[EventParticipationService] Error fetching official participants:', error);
    return [];
  }
}

/**
 * Captain publishes official participant list to Nostr (Kind 30001)
 */
export async function publishOfficialParticipantList(ndk, eventId, participantPubkeys, eventName) {
  if (!ndk || !eventId || !Array.isArray(participantPubkeys)) {
    throw new Error('NDK, eventId, and participantPubkeys array are required');
  }

  try {
    console.log(`[EventParticipationService] Publishing official participant list for event ${eventId} with ${participantPubkeys.length} participants`);

    const tags = [
      ['d', eventId], // d-tag identifies the event
      ['name', `${eventName || 'Event'} Participants`],
      ['description', `Official participant list for ${eventName || 'event'}`]
    ];

    // Add each participant as a p-tag
    participantPubkeys.forEach(pubkey => {
      tags.push(['p', pubkey]);
    });

    const event = new NDKEvent(ndk);
    event.kind = KIND_PARTICIPANT_LIST;
    event.tags = tags;
    event.content = `Official participant list for ${eventName || 'event'} - ${participantPubkeys.length} participants`;
    event.created_at = Math.floor(Date.now() / 1000);

    await event.publish();
    console.log(`[EventParticipationService] Successfully published participant list for event ${eventId}`);
    return true;
  } catch (error) {
    console.error('[EventParticipationService] Error publishing participant list:', error);
    throw error;
  }
}

/**
 * Fetch hybrid participant list (localStorage + official Nostr list)
 * Combines local joins with captain's official list, deduplicating by pubkey
 */
export async function fetchHybridEventParticipants(ndk, eventId, captainPubkey) {
  console.log(`[EventParticipationService] Fetching hybrid participants for event ${eventId}`);

  // Get local participants
  const localParticipants = getLocalEventParticipants(eventId);
  console.log(`[EventParticipationService] Found ${localParticipants.length} local participants`);

  // Get official participants
  let officialParticipants = [];
  try {
    officialParticipants = await fetchOfficialEventParticipants(ndk, eventId, captainPubkey);
    console.log(`[EventParticipationService] Found ${officialParticipants.length} official participants`);
  } catch (err) {
    console.warn('[EventParticipationService] Failed to fetch official participants, using local only:', err.message);
  }

  // Combine and deduplicate
  const participantMap = new Map();

  // Add local participants first
  localParticipants.forEach(participant => {
    participantMap.set(participant.pubkey, participant);
  });

  // Add official participants, giving them priority
  officialParticipants.forEach(participant => {
    participantMap.set(participant.pubkey, {
      ...participantMap.get(participant.pubkey), // Keep local data if exists
      ...participant, // Official data takes priority
      source: participantMap.has(participant.pubkey) ? 'hybrid' : 'official'
    });
  });

  const combinedParticipants = Array.from(participantMap.values());
  console.log(`[EventParticipationService] Combined ${combinedParticipants.length} unique participants`);

  return combinedParticipants;
}

/**
 * Fetch workout activities for event participants during event timeframe
 * Queries Kind 1301 workout events from all participants
 */
export async function fetchEventWorkoutActivities(ndk, participantPubkeys, eventStartTime, eventEndTime) {
  if (!ndk || !Array.isArray(participantPubkeys) || participantPubkeys.length === 0) {
    console.warn('[EventParticipationService] Missing required parameters for fetching activities');
    return [];
  }
  
  // Validate date range parameters
  if (!eventStartTime || typeof eventStartTime !== 'number' || eventStartTime <= 0) {
    console.error('[EventParticipationService] Invalid eventStartTime:', eventStartTime);
    throw new Error('Invalid event start time provided');
  }
  
  if (eventEndTime && (typeof eventEndTime !== 'number' || eventEndTime <= 0)) {
    console.error('[EventParticipationService] Invalid eventEndTime:', eventEndTime);
    throw new Error('Invalid event end time provided');
  }
  
  if (eventEndTime && eventEndTime <= eventStartTime) {
    console.error('[EventParticipationService] End time must be after start time', {
      eventStartTime: new Date(eventStartTime),
      eventEndTime: new Date(eventEndTime)
    });
    throw new Error('Event end time must be after start time');
  }
  
  // Reasonable bounds checking (within last 5 years and next 1 year)
  const fiveYearsAgo = Date.now() - (5 * 365 * 24 * 60 * 60 * 1000);
  const oneYearFromNow = Date.now() + (365 * 24 * 60 * 60 * 1000);
  
  if (eventStartTime < fiveYearsAgo || eventStartTime > oneYearFromNow) {
    console.warn('[EventParticipationService] Event start time outside reasonable bounds', {
      eventStartTime: new Date(eventStartTime),
      bounds: { min: new Date(fiveYearsAgo), max: new Date(oneYearFromNow) }
    });
  }
  
  // Validate participant pubkeys
  const validPubkeys = participantPubkeys.filter(pubkey => {
    if (!pubkey || typeof pubkey !== 'string' || pubkey.length < 32) {
      console.warn('[EventParticipationService] Invalid pubkey filtered out:', pubkey);
      return false;
    }
    return true;
  });
  
  if (validPubkeys.length === 0) {
    console.warn('[EventParticipationService] No valid participant pubkeys after filtering');
    return [];
  }
  
  if (validPubkeys.length !== participantPubkeys.length) {
    console.warn(`[EventParticipationService] Filtered ${participantPubkeys.length - validPubkeys.length} invalid pubkeys`);
  }

  try {
    console.log(`[EventParticipationService] Fetching workout activities for ${validPubkeys.length} participants from ${new Date(eventStartTime)} to ${new Date(eventEndTime || Date.now())}`);

    const filter = {
      kinds: [KIND_WORKOUT_RECORD],
      authors: validPubkeys,
      since: Math.floor(eventStartTime / 1000),
      until: eventEndTime ? Math.floor(eventEndTime / 1000) : undefined
    };

    const events = await ndk.fetchEvents(filter);
    console.log(`[EventParticipationService] Found ${events.size} workout activities`);

    // Convert to array and sort by created_at
    const activities = Array.from(events).sort((a, b) => b.created_at - a.created_at);
    
    return activities.map(event => ({
      id: event.id,
      pubkey: event.pubkey,
      kind: event.kind,
      content: event.content,
      created_at: event.created_at,
      tags: event.tags,
      // Parse workout data from tags if needed
      distance: parseFloat(event.tags.find(tag => tag[0] === 'distance')?.[1] || '0'),
      duration: parseInt(event.tags.find(tag => tag[0] === 'duration')?.[1] || '0'),
      activity_type: event.tags.find(tag => tag[0] === 'activity_type')?.[1] || 'run'
    }));
  } catch (error) {
    console.error('[EventParticipationService] Error fetching workout activities:', error);
    return [];
  }
}

/**
 * Clear all stored event participation data (for testing/debugging)
 */
export function clearStoredParticipationData() {
  try {
    // Graceful fallback for environments without localStorage
    if (typeof localStorage === 'undefined') {
      console.warn('[EventParticipationService] localStorage not available, nothing to clear');
      return;
    }
    localStorage.removeItem(STORAGE_KEYS.EVENT_PARTICIPANTS);
    localStorage.removeItem(STORAGE_KEYS.USER_JOINED_EVENTS);
    console.log('[EventParticipationService] Cleared all stored participation data');
  } catch (error) {
    console.error('[EventParticipationService] Error clearing stored data:', error);
  }
}

export default {
  joinEventLocally,
  leaveEventLocally,
  isUserParticipatingLocally,
  getLocalEventParticipants,
  getUserJoinedEventsLocal,
  fetchOfficialEventParticipants,
  publishOfficialParticipantList,
  fetchHybridEventParticipants,
  fetchEventWorkoutActivities,
  clearStoredParticipationData
};