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
 * Generate cache keys with versioning like League
 */
export const CACHE_KEYS = {
  EVENT_DETAILS: (teamId, eventId) => `runstr_team_event_details_${teamId}_${eventId}_${CACHE_VERSION}`,
  EVENT_PARTICIPANTS: (teamId, eventId) => `runstr_team_event_participants_${teamId}_${eventId}_${CACHE_VERSION}`,
  EVENT_PARTICIPATION: (teamId, eventId) => `runstr_team_event_participation_${teamId}_${eventId}_${CACHE_VERSION}`,
  EVENT_ACTIVITIES: (teamId, eventId) => `runstr_team_event_activities_${teamId}_${eventId}_${CACHE_VERSION}`,
  TEAM_EVENTS: (teamId) => `runstr_team_events_${teamId}_${CACHE_VERSION}`
};

/**
 * TTL configuration - using longer durations like League for better UX
 */
export const CACHE_TTL = {
  EVENT_DETAILS: TEAM_EVENTS_CACHE_DURATION_MS, // 15 minutes - events rarely change
  PARTICIPANTS: 5 * 60 * 1000,   // 5 minutes - people join/leave but not frequently
  PARTICIPATION: 3 * 60 * 1000,  // 3 minutes - completion data updates during events
  ACTIVITIES: 5 * 60 * 1000,     // 5 minutes - new activities but cache for UX
  TEAM_EVENTS: TEAM_EVENTS_CACHE_DURATION_MS  // 15 minutes - event list changes infrequently
};

/**
 * Load cached data from localStorage with timestamp validation
 * Copied from League's successful loadCachedData pattern
 */
export const loadCachedData = (cacheKey, cacheDurationMs = TEAM_EVENTS_CACHE_DURATION_MS) => {
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
  try {
    localStorage.removeItem(cacheKey);
  } catch (err) {
    console.error('Error clearing team events cache:', err);
  }
};

/**
 * Clear all team events cache entries (for logout, etc.)
 */
export const clearAllTeamEventsCache = () => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('runstr_team_') && key.includes(CACHE_VERSION)) {
        localStorage.removeItem(key);
      }
    });
  } catch (err) {
    console.error('Error clearing all team events cache:', err);
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