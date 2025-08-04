/**
 * Team Events Cache - Persistent localStorage implementation
 * Based on successful League caching patterns for resilience and user experience
 * 
 * Key improvements over previous Map() implementation:
 * - Persistent localStorage cache survives page refreshes
 * - Longer TTL (15 minutes) for better resilience like League
 * - Versioned cache keys to handle schema changes
 * - Better error handling and recovery
 */

// Cache configuration following League success patterns
const TEAM_EVENTS_CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes like League
const CACHE_VERSION = 'v1'; // Versioning for cache invalidation

/**
 * Sanitize cache key components to prevent injection and ensure valid keys
 */
const sanitizeCacheKeyComponent = (component) => {
  if (!component || typeof component !== 'string') {
    return null;
  }
  
  // Remove potentially problematic characters and limit length
  const sanitized = component
    .replace(/[^a-zA-Z0-9\-_:]/g, '_') // Replace non-alphanumeric chars with underscore
    .substring(0, 100) // Limit length to prevent extremely long keys
    .trim();
    
  return sanitized.length > 0 ? sanitized : null;
};

/**
 * Generate cache keys with proper separators and input sanitization
 * Uses double underscores as separators since they're unlikely to appear in IDs
 */
export const CACHE_KEYS = {
  EVENT_DETAILS: (teamId, eventId) => {
    const cleanTeamId = sanitizeCacheKeyComponent(teamId);
    const cleanEventId = sanitizeCacheKeyComponent(eventId);
    
    if (!cleanTeamId || !cleanEventId) {
      console.warn('[CACHE_KEYS] Invalid teamId or eventId for EVENT_DETAILS', { teamId, eventId });
      return null;
    }
    return `runstr_team_event_details__${cleanTeamId}__${cleanEventId}__${CACHE_VERSION}`;
  },
  EVENT_PARTICIPANTS: (teamId, eventId) => {
    const cleanTeamId = sanitizeCacheKeyComponent(teamId);
    const cleanEventId = sanitizeCacheKeyComponent(eventId);
    
    if (!cleanTeamId || !cleanEventId) {
      console.warn('[CACHE_KEYS] Invalid teamId or eventId for EVENT_PARTICIPANTS', { teamId, eventId });
      return null;
    }
    return `runstr_team_event_participants__${cleanTeamId}__${cleanEventId}__${CACHE_VERSION}`;
  },
  EVENT_PARTICIPATION: (teamId, eventId) => {
    const cleanTeamId = sanitizeCacheKeyComponent(teamId);
    const cleanEventId = sanitizeCacheKeyComponent(eventId);
    
    if (!cleanTeamId || !cleanEventId) {
      console.warn('[CACHE_KEYS] Invalid teamId or eventId for EVENT_PARTICIPATION', { teamId, eventId });
      return null;
    }
    return `runstr_team_event_participation__${cleanTeamId}__${cleanEventId}__${CACHE_VERSION}`;
  },
  EVENT_ACTIVITIES: (teamId, eventId) => {
    const cleanTeamId = sanitizeCacheKeyComponent(teamId);
    const cleanEventId = sanitizeCacheKeyComponent(eventId);
    
    if (!cleanTeamId || !cleanEventId) {
      console.warn('[CACHE_KEYS] Invalid teamId or eventId for EVENT_ACTIVITIES', { teamId, eventId });
      return null;
    }
    return `runstr_team_event_activities__${cleanTeamId}__${cleanEventId}__${CACHE_VERSION}`;
  },
  TEAM_EVENTS: (teamId) => {
    const cleanTeamId = sanitizeCacheKeyComponent(teamId);
    
    if (!cleanTeamId) {
      console.warn('[CACHE_KEYS] Invalid teamId for TEAM_EVENTS', { teamId });
      return null;
    }
    return `runstr_team_events__${cleanTeamId}__${CACHE_VERSION}`;
  },
  WORKOUT_PLANS: (captainPubkey, teamUUID) => {
    const cleanCaptainPubkey = sanitizeCacheKeyComponent(captainPubkey);
    const cleanTeamUUID = sanitizeCacheKeyComponent(teamUUID);
    
    if (!cleanCaptainPubkey || !cleanTeamUUID) {
      console.warn('[CACHE_KEYS] Invalid captainPubkey or teamUUID for WORKOUT_PLANS', { captainPubkey, teamUUID });
      return null;
    }
    return `runstr_workout_plans__${cleanCaptainPubkey}__${cleanTeamUUID}__${CACHE_VERSION}`;
  },
  WORKOUT_PLAN_DETAILS: (captainPubkey, planId) => {
    const cleanCaptainPubkey = sanitizeCacheKeyComponent(captainPubkey);
    const cleanPlanId = sanitizeCacheKeyComponent(planId);
    
    if (!cleanCaptainPubkey || !cleanPlanId) {
      console.warn('[CACHE_KEYS] Invalid captainPubkey or planId for WORKOUT_PLAN_DETAILS', { captainPubkey, planId });
      return null;
    }
    return `runstr_workout_plan_details__${cleanCaptainPubkey}__${cleanPlanId}__${CACHE_VERSION}`;
  }
};

/**
 * TTL configuration - using longer durations like League for better UX
 */
export const CACHE_TTL = {
  EVENT_DETAILS: TEAM_EVENTS_CACHE_DURATION_MS, // 15 minutes - events rarely change
  PARTICIPANTS: 5 * 60 * 1000,   // 5 minutes - people join/leave but not frequently
  PARTICIPATION: 3 * 60 * 1000,  // 3 minutes - completion data updates during events
  ACTIVITIES: 5 * 60 * 1000,     // 5 minutes - new activities but cache for UX
  TEAM_EVENTS: TEAM_EVENTS_CACHE_DURATION_MS,  // 15 minutes - event list changes infrequently
  WORKOUT_PLANS: TEAM_EVENTS_CACHE_DURATION_MS, // 15 minutes - workout plans rarely change
  WORKOUT_PLAN_DETAILS: TEAM_EVENTS_CACHE_DURATION_MS // 15 minutes - individual plan details rarely change
};

/**
 * Load cached data from localStorage with timestamp validation
 * Copied from League's successful loadCachedData pattern
 */
export const loadCachedData = (cacheKey, cacheDurationMs = TEAM_EVENTS_CACHE_DURATION_MS) => {
  if (!cacheKey) {
    console.warn('[loadCachedData] Invalid cache key provided');
    return null;
  }
  
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      
      if (now - timestamp < cacheDurationMs) {
        return {
          data,
          timestamp: new Date(timestamp),
          fromCache: true
        };
      }
    }
  } catch (err) {
    console.error('Error loading team events cache:', err);
  }
  return null;
};

/**
 * Save data to localStorage cache with timestamp
 * Copied from League's successful saveCachedData pattern
 */
export const saveCachedData = (cacheKey, data) => {
  if (!cacheKey) {
    console.warn('[saveCachedData] Invalid cache key provided');
    return;
  }
  
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (err) {
    console.error('Error saving team events cache:', err);
  }
};

/**
 * Check if cache has valid data without loading it
 */
export const hasCachedData = (cacheKey, cacheDurationMs = TEAM_EVENTS_CACHE_DURATION_MS) => {
  if (!cacheKey) {
    console.warn('[hasCachedData] Invalid cache key provided');
    return false;
  }
  
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { timestamp } = JSON.parse(cached);
      const now = Date.now();
      return now - timestamp < cacheDurationMs;
    }
  } catch (err) {
    console.error('Error checking team events cache:', err);
  }
  return false;
};

/**
 * Clear specific cache entry
 */
export const clearCachedData = (cacheKey) => {
  if (!cacheKey) {
    console.warn('[clearCachedData] Invalid cache key provided');
    return;
  }
  
  try {
    localStorage.removeItem(cacheKey);
  } catch (err) {
    console.error('Error clearing team events cache:', err);
  }
};

/**
 * Clear all team events and workout plans cache entries (for logout, etc.)
 */
export const clearAllTeamEventsCache = () => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if ((key.startsWith('runstr_team_') || key.startsWith('runstr_workout_')) && key.includes(CACHE_VERSION)) {
        localStorage.removeItem(key);
      }
    });
  } catch (err) {
    console.error('Error clearing all team events and workout plans cache:', err);
  }
};

/**
 * Legacy Map-based cache interface for backward compatibility
 * @deprecated - Use new localStorage methods instead
 */
class TeamEventsCache {
  constructor() {
    console.warn('TeamEventsCache Map-based implementation is deprecated. Use new localStorage methods.');
  }

  set(key, data) {
    // Convert to new localStorage method (TTL handled by new system)
    saveCachedData(key, data);
  }

  get(key) {
    // Convert to new localStorage method  
    const cached = loadCachedData(key);
    return cached ? cached.data : null;
  }

  has(key) {
    return hasCachedData(key);
  }

  clear() {
    clearAllTeamEventsCache();
  }

  delete(key) {
    clearCachedData(key);
  }
}

export const teamEventsCache = new TeamEventsCache();