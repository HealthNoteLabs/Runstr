/**
 * @typedef {Object} CacheEntry
 * @property {any} data
 * @property {number} timestamp
 * @property {number} ttl
 */

class TeamEventsCache {
  constructor() {
    this.cache = new Map();
  }

  set(key, data, ttlMinutes = 5) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    });
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  clear() {
    this.cache.clear();
  }

  delete(key) {
    this.cache.delete(key);
  }
}

export const teamEventsCache = new TeamEventsCache();

export const CACHE_KEYS = {
  EVENT_DETAILS: (teamId, eventId) => `event:${teamId}:${eventId}`,
  EVENT_PARTICIPANTS: (teamId, eventId) => `participants:${teamId}:${eventId}`,
  EVENT_PARTICIPATION: (teamId, eventId) => `participation:${teamId}:${eventId}`,
  EVENT_ACTIVITIES: (teamId, eventId) => `activities:${teamId}:${eventId}`,
  TEAM_EVENTS: (teamId) => `team-events:${teamId}`
};

export const CACHE_TTL = {
  EVENT_DETAILS: 10, // 10 minutes - events rarely change
  PARTICIPANTS: 1,   // 1 minute - people join/leave should update quickly  
  PARTICIPATION: 1,  // 1 minute - completion data updates during events
  ACTIVITIES: 1,     // 1 minute - new activities posted frequently
  TEAM_EVENTS: 5     // 5 minutes - event list doesn't change often
};