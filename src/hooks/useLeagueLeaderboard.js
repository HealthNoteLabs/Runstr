import { useState, useEffect, useCallback, useContext } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { fetchEvents } from '../utils/nostr';

/**
 * Hook: useLeagueLeaderboard
 * Fetches ALL Kind 1301 workout records from ALL users and creates a comprehensive leaderboard
 * Uses localStorage caching (30 min expiry) and lazy loading for better UX
 * 
 * @returns {Object} { leaderboard, isLoading, error, refresh, lastUpdated }
 */
export const useLeagueLeaderboard = () => {
  const { ndk, canReadData } = useContext(NostrContext);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Constants
  const COURSE_TOTAL_MILES = 500; // Updated to 500 miles
  const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes cache
  const CACHE_KEY = 'runstr_league_leaderboard';
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
  }, []);

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
  }, []);

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
   * Check for duplicate events (same user, same distance, within 5 minutes)
   */
  const isDuplicateEvent = useCallback((event, existingEvents) => {
    const eventTime = event.created_at;
    const eventDistance = extractDistance(event);
    const eventAuthor = event.pubkey;

    return existingEvents.some(existing => 
      existing.pubkey === eventAuthor &&
      Math.abs(existing.created_at - eventTime) < 300 && // 5 minutes
      Math.abs(extractDistance(existing) - eventDistance) < 0.1 // 0.1 mile tolerance
    );
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
      
      const distance = extractDistance(event);
      if (distance <= 0) return;

      processedEvents.push(event);

      // Initialize user if not exists
      if (!userStats[event.pubkey]) {
        userStats[event.pubkey] = {
          pubkey: event.pubkey,
          totalMiles: 0,
          runCount: 0,
          lastActivity: 0,
          runs: []
        };
      }

      // Add run data
      userStats[event.pubkey].totalMiles += distance;
      userStats[event.pubkey].runCount++;
      userStats[event.pubkey].lastActivity = Math.max(
        userStats[event.pubkey].lastActivity, 
        event.created_at
      );
      userStats[event.pubkey].runs.push({
        distance,
        timestamp: event.created_at,
        eventId: event.id
      });
    });

    // Convert to leaderboard format and sort
    const leaderboardData = Object.values(userStats)
      .map(user => ({
        ...user,
        totalMiles: Math.round(user.totalMiles * 100) / 100, // Round to 2 decimals
        progressPercentage: Math.min(100, (user.totalMiles / COURSE_TOTAL_MILES) * 100),
        isComplete: user.totalMiles >= COURSE_TOTAL_MILES
      }))
      .sort((a, b) => b.totalMiles - a.totalMiles) // Sort by distance descending
      .slice(0, 10) // Top 10 only
      .map((user, index) => ({ ...user, rank: index + 1 }));

    return leaderboardData;
  }, [extractDistance, isDuplicateEvent, COURSE_TOTAL_MILES]);

  /**
   * Fetch comprehensive leaderboard data with lazy loading
   */
  const fetchLeaderboard = useCallback(async (useCache = true) => {
    console.log('[useLeagueLeaderboard] Starting fetch...');
    
    // Try cache first if requested
    if (useCache && loadCachedData()) {
      return;
    }

    // Check if NDK is ready for reading data (don't need user pubkey for this)
    if (!canReadData || !ndk) {
      console.log('[useLeagueLeaderboard] NDK not ready for data reading, waiting...');
      setIsLoading(true);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
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
  }, [canReadData, ndk, loadCachedData, processEvents, saveToCache]);

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

  // Initial load on mount
  useEffect(() => {
    backgroundRefresh();
  }, [backgroundRefresh]);

  // Retry fetch when NDK becomes ready for reading data
  useEffect(() => {
    if (canReadData && leaderboard.length === 0 && !isLoading) {
      console.log('[useLeagueLeaderboard] NDK ready for reading, fetching leaderboard...');
      backgroundRefresh();
    }
  }, [canReadData, leaderboard.length, isLoading, backgroundRefresh]);

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
    courseTotal: COURSE_TOTAL_MILES, // Total course distance for calculations
  };
}; 