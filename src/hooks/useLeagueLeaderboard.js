import { useState, useEffect, useCallback, useContext } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { fetchEvents } from '../utils/nostr';
import { useActivityMode } from '../contexts/ActivityModeContext';

/**
 * Hook: useLeagueLeaderboard
 * Fetches ALL Kind 1301 workout records from ALL users and creates a comprehensive leaderboard
 * Filters by current activity mode (run/walk/cycle) for activity-specific leagues
 * Uses localStorage caching (30 min expiry) and lazy loading for better UX
 * 
 * @returns {Object} { leaderboard, isLoading, error, refresh, lastUpdated, activityMode }
 */
export const useLeagueLeaderboard = () => {
  const { ndk } = useContext(NostrContext);
  const { mode: activityMode } = useActivityMode();
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Constants  
  const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes cache
  const CACHE_KEY = `runstr_league_leaderboard_${activityMode}`; // Activity-specific cache
  const MAX_EVENTS = 5000; // Limit to prevent overwhelming queries

  /**
   * Load cached leaderboard data
   */
  const loadCachedData = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        if (now - timestamp < CACHE_DURATION_MS) {
          console.log('[useLeagueLeaderboard] Using cached data');
          setLeaderboard(data);
          setLastUpdated(new Date(timestamp));
          setIsLoading(false);
          return true; // Cache is valid
        }
      }
    } catch (err) {
      console.error('[useLeagueLeaderboard] Error loading cache:', err);
    }
    return false; // No valid cache
  }, [CACHE_KEY]);

  /**
   * Save leaderboard data to cache
   */
  const saveToCache = useCallback((data) => {
    try {
      const timestamp = Date.now();
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp
      }));
      setLastUpdated(new Date(timestamp));
    } catch (err) {
      console.error('[useLeagueLeaderboard] Error saving to cache:', err);
    }
  }, [CACHE_KEY]);

  /**
   * Calculate distance from event tags
   */
  const extractDistance = useCallback((event) => {
    const distanceTag = event.tags?.find(tag => tag[0] === 'distance');
    if (!distanceTag || !distanceTag[1]) return 0;

    const distanceValue = parseFloat(distanceTag[1]);
    const unit = distanceTag[2] || 'km';

    if (isNaN(distanceValue) || distanceValue <= 0) return 0;

    // Convert to miles for consistent calculation
    return unit === 'km' ? (distanceValue * 0.621371) : distanceValue;
  }, []);

  /**
   * Check for duplicate events with enhanced detection
   */
  const isDuplicateEvent = useCallback((event, existingEvents) => {
    const eventTime = event.created_at;
    const eventDistance = extractDistance(event);
    const eventAuthor = event.pubkey;
    const eventId = event.id;

    return existingEvents.some(existing => {
      // Skip if different user
      if (existing.pubkey !== eventAuthor) return false;

      // Check for exact same event ID (most reliable duplicate check)
      if (existing.id === eventId) return true;

      // Check for time-based duplicates with same distance
      const timeDiff = Math.abs(existing.created_at - eventTime);
      const distanceDiff = Math.abs(extractDistance(existing) - eventDistance);
      
      // Same user, same distance (within 0.05 miles), within 10 minutes = likely duplicate
      if (timeDiff < 600 && distanceDiff < 0.05) return true;

      // Check for identical workout data (distance, duration if available)
      const eventDuration = event.tags?.find(tag => tag[0] === 'duration')?.[1];
      const existingDuration = existing.tags?.find(tag => tag[0] === 'duration')?.[1];
      
      // If both have duration and they match exactly with same distance = duplicate
      if (eventDuration && existingDuration && 
          eventDuration === existingDuration && 
          distanceDiff < 0.01) return true;

      // Check for content-based duplicates (same workout description)
      if (event.content && existing.content && 
          event.content.trim() === existing.content.trim() && 
          distanceDiff < 0.1 && 
          timeDiff < 3600) return true; // Within 1 hour

      return false;
    });
  }, [extractDistance]);

  /**
   * Process events into user statistics
   */
  const processEvents = useCallback((events) => {
    const userStats = {};
    const processedEvents = [];

    // Filter duplicates and process events
    events.forEach(event => {
      if (!event.pubkey || isDuplicateEvent(event, processedEvents)) return;
      
      // Filter by current activity mode using exercise tag
      const exerciseTag = event.tags?.find(tag => tag[0] === 'exercise');
      const eventActivityType = exerciseTag?.[1]?.toLowerCase();
      
      // Map activity mode to possible exercise tag values (RUNSTR uses 'run', others might use 'running')
      const activityMatches = {
        'run': ['run', 'running', 'jog', 'jogging'],
        'cycle': ['cycle', 'cycling', 'bike', 'biking'],  
        'walk': ['walk', 'walking', 'hike', 'hiking']
      };
      
      const acceptedActivities = activityMatches[activityMode] || [activityMode];
      
      // Skip events that don't match current activity mode
      if (eventActivityType && !acceptedActivities.includes(eventActivityType)) return;
      
      // If no exercise tag but is valid event, allow it through (fallback)
      if (!eventActivityType) {
        console.log(`[useLeagueLeaderboard] Event with no exercise tag - allowing through`);
      }
      
      const distance = extractDistance(event);
      if (distance <= 0) return;

      processedEvents.push(event);

      // Initialize user if not exists
      if (!userStats[event.pubkey]) {
        userStats[event.pubkey] = {
          pubkey: event.pubkey,
          totalMiles: 0,
          runCount: 0, // Keep as runCount for backward compatibility but it represents activity count
          lastActivity: 0,
          runs: [] // Keep as runs for backward compatibility but it represents activities
        };
      }

      // Add activity data
      userStats[event.pubkey].totalMiles += distance;
      userStats[event.pubkey].runCount++; // Actually activity count
      userStats[event.pubkey].lastActivity = Math.max(
        userStats[event.pubkey].lastActivity, 
        event.created_at
      );
      userStats[event.pubkey].runs.push({ // Actually activities
        distance,
        timestamp: event.created_at,
        eventId: event.id,
        activityType: eventActivityType // Store the activity type for reference
      });
    });

    // Convert to leaderboard format and sort
    const leaderboardData = Object.values(userStats)
      .map(user => ({
        ...user,
        totalMiles: Math.round(user.totalMiles * 100) / 100, // Round to 2 decimals
      }))
      .sort((a, b) => b.totalMiles - a.totalMiles) // Sort by distance descending
      .slice(0, 10) // Top 10 only
      .map((user, index) => ({ ...user, rank: index + 1 }));

    return leaderboardData;
  }, [extractDistance, isDuplicateEvent, activityMode]);

  /**
   * Fetch comprehensive leaderboard data with lazy loading
   */
  const fetchLeaderboard = useCallback(async (useCache = true) => {
    console.log('[useLeagueLeaderboard] Starting fetch...');
    
    // Try cache first if requested
    if (useCache && loadCachedData()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (!ndk) {
        throw new Error('NDK not available');
      }

      console.log('[useLeagueLeaderboard] Fetching all 1301 events...');
      
      // Fetch ALL 1301 events from ALL users
      const filter = {
        kinds: [1301],
        limit: MAX_EVENTS,
        since: Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60) // Last year
      };

      const eventSet = await fetchEvents(filter);
      const events = Array.from(eventSet).map(e => e.rawEvent ? e.rawEvent() : e);
      
      console.log(`[useLeagueLeaderboard] Fetched ${events.length} events`);

      // Process events
      const processedLeaderboard = processEvents(events);
      
      console.log(`[useLeagueLeaderboard] Processed leaderboard with ${processedLeaderboard.length} users`);

      // Update state and cache
      setLeaderboard(processedLeaderboard);
      saveToCache(processedLeaderboard);

    } catch (err) {
      console.error('[useLeagueLeaderboard] Error fetching leaderboard:', err);
      setError(err.message || 'Failed to fetch leaderboard data');
      
      // Try to use stale cache on error
      if (useCache) {
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const { data } = JSON.parse(cached);
            setLeaderboard(data);
            console.log('[useLeagueLeaderboard] Using stale cache due to error');
          }
        } catch (cacheErr) {
          console.error('[useLeagueLeaderboard] Cache fallback failed:', cacheErr);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [ndk, loadCachedData, processEvents, saveToCache, CACHE_KEY]);

  /**
   * Force refresh leaderboard (bypass cache)
   */
  const refresh = useCallback(async () => {
    console.log('[useLeagueLeaderboard] Force refresh requested');
    await fetchLeaderboard(false);
  }, [fetchLeaderboard]);

  /**
   * Background refresh (use cache first, then update in background)
   */
  const backgroundRefresh = useCallback(async () => {
    // If we have cached data, use it first
    if (loadCachedData()) {
      // Then fetch fresh data in background
      setTimeout(() => {
        fetchLeaderboard(false);
      }, 1000);
    } else {
      // No cache, do normal fetch
      await fetchLeaderboard(false);
    }
  }, [loadCachedData, fetchLeaderboard]);

  // Initial load on mount and when activity mode changes
  useEffect(() => {
    backgroundRefresh();
  }, [backgroundRefresh, activityMode]);

  // Auto-refresh every 30 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[useLeagueLeaderboard] Auto-refreshing leaderboard');
      fetchLeaderboard(false); // Background refresh
    }, CACHE_DURATION_MS);

    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  return {
    leaderboard,           // Top 10 users with comprehensive stats
    isLoading,            // Loading state (false if using cache)
    error,                // Error message if fetch failed
    lastUpdated,          // Timestamp of last successful update
    refresh,              // Force refresh function
    activityMode,         // Current activity mode for UI display
  };
}; 