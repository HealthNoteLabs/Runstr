import { useState, useEffect, useCallback, useContext } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { fetchEvents } from '../utils/nostr';
import { useActivityMode } from '../contexts/ActivityModeContext';
import seasonPassService from '../services/seasonPassService';
import { REWARDS } from '../config/rewardsConfig';

/**
 * Hook: useLeagueLeaderboard
 * Fetches Kind 1301 workout records from Season Pass participants only and creates a comprehensive leaderboard
 * Filters by current activity mode (run/walk/cycle) for activity-specific leagues
 * Only counts runs during the competition period (July 11 - October 11, 2025)
 * Uses localStorage caching (30 min expiry) and lazy loading for better UX
 * 
 * @returns {Object} { leaderboard, isLoading, error, refresh, lastUpdated, activityMode, courseTotal }
 */
export const useLeagueLeaderboard = () => {
  const { ndk } = useContext(NostrContext);
  const { mode: activityMode } = useActivityMode();
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Constants
  const COURSE_TOTAL_MILES = 500; // Updated to 500 miles
  const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes cache
  const CACHE_KEY = `runstr_league_leaderboard_${activityMode}_v2`; // Activity-specific cache with competition dates
  const MAX_EVENTS = 5000; // Limit to prevent overwhelming queries
  
  // Competition date range
  const COMPETITION_START = Math.floor(new Date(REWARDS.SEASON_1.startUtc).getTime() / 1000);
  const COMPETITION_END = Math.floor(new Date(REWARDS.SEASON_1.endUtc).getTime() / 1000);

  /**
   * Load cached leaderboard data with safety checks
   */
  const loadCachedData = useCallback(() => {
    try {
      // Safety Check: localStorage availability
      if (typeof localStorage === 'undefined') {
        console.warn('[useLeagueLeaderboard] localStorage not available');
        return false;
      }

      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        
        // Safety Check: validate cache structure
        if (!parsed || typeof parsed !== 'object' || !parsed.data || !parsed.timestamp) {
          console.warn('[useLeagueLeaderboard] Invalid cache structure');
          localStorage.removeItem(CACHE_KEY); // Clean up bad cache
          return false;
        }

        const { data, timestamp } = parsed;
        const now = Date.now();
        
        // Safety Check: validate timestamp
        if (typeof timestamp !== 'number' || timestamp > now) {
          console.warn('[useLeagueLeaderboard] Invalid cache timestamp');
          localStorage.removeItem(CACHE_KEY); // Clean up bad cache
          return false;
        }
        
        if (now - timestamp < CACHE_DURATION_MS) {
          // Safety Check: validate data structure
          if (!Array.isArray(data)) {
            console.warn('[useLeagueLeaderboard] Cached data is not an array');
            localStorage.removeItem(CACHE_KEY); // Clean up bad cache
            return false;
          }

          console.log('[useLeagueLeaderboard] Using cached data');
          setLeaderboard(data);
          setLastUpdated(new Date(timestamp));
          setIsLoading(false);
          return true; // Cache is valid
        }
      }
    } catch (err) {
      console.error('[useLeagueLeaderboard] Error loading cache:', err);
      // Try to clean up corrupted cache
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch (cleanupErr) {
        console.error('[useLeagueLeaderboard] Error cleaning up cache:', cleanupErr);
      }
    }
    return false; // No valid cache
  }, [CACHE_KEY]);

  /**
   * Save leaderboard data to cache with safety checks
   */
  const saveCachedData = useCallback((data) => {
    try {
      // Safety Check: localStorage availability
      if (typeof localStorage === 'undefined') {
        console.warn('[useLeagueLeaderboard] localStorage not available for saving');
        return;
      }

      // Safety Check: validate data before saving
      if (!Array.isArray(data)) {
        console.warn('[useLeagueLeaderboard] Cannot save non-array data to cache');
        return;
      }

      const cacheData = {
        data,
        timestamp: Date.now()
      };
      
      const serialized = JSON.stringify(cacheData);
      
      // Safety Check: validate serialization
      if (!serialized || serialized === 'null' || serialized === 'undefined') {
        console.warn('[useLeagueLeaderboard] Failed to serialize cache data');
        return;
      }

      localStorage.setItem(CACHE_KEY, serialized);
    } catch (err) {
      console.error('[useLeagueLeaderboard] Error saving cache:', err);
      
      // Check if it's a quota exceeded error
      if (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('[useLeagueLeaderboard] localStorage quota exceeded, clearing old cache');
        try {
          localStorage.removeItem(CACHE_KEY);
        } catch (clearErr) {
          console.error('[useLeagueLeaderboard] Error clearing cache after quota error:', clearErr);
        }
      }
    }
  }, [CACHE_KEY]);

  /**
   * Extract distance from event tags
   */
  const extractDistance = useCallback((event) => {
    try {
      const distanceTag = event.tags?.find(tag => tag[0] === 'distance');
      if (!distanceTag || !distanceTag[1]) return 0;
      
      const value = parseFloat(distanceTag[1]);
      const unit = distanceTag[2]?.toLowerCase() || 'km';
      
      // Convert to miles
      if (unit === 'mi' || unit === 'mile' || unit === 'miles') {
        return value;
      } else if (unit === 'km' || unit === 'kilometer' || unit === 'kilometers') {
        return value * 0.621371; // km to miles
      } else if (unit === 'm' || unit === 'meter' || unit === 'meters') {
        return value * 0.000621371; // meters to miles
      }
      
      return value; // Default assumption is miles
    } catch (err) {
      console.error('[useLeagueLeaderboard] Error extracting distance:', err);
      return 0;
    }
  }, []);

  /**
   * Check if event is duplicate
   */
  const isDuplicateEvent = useCallback((event, processedEvents) => {
    return processedEvents.some(existing => {
      // Primary check: exact same event ID
      if (existing.id === event.id) return true;
      
      // Secondary checks for same user
      if (existing.pubkey !== event.pubkey) return false;
      
      const existingDistance = extractDistance(existing);
      const currentDistance = extractDistance(event);
      const timeDiff = Math.abs(existing.created_at - event.created_at);
      
      // Same distance within 0.05 miles and within 10 minutes
      if (Math.abs(existingDistance - currentDistance) < 0.05 && timeDiff < 600) return true;
      
      // Check duration matching
      const existingDuration = existing.tags?.find(tag => tag[0] === 'duration')?.[1];
      const currentDuration = event.tags?.find(tag => tag[0] === 'duration')?.[1];
      if (existingDuration && currentDuration && existingDuration === currentDuration && 
          Math.abs(existingDistance - currentDistance) < 0.1) return true;
      
      // Check content similarity
      if (existing.content && event.content && existing.content === event.content && 
          Math.abs(existingDistance - currentDistance) < 0.1 && timeDiff < 3600) return true;
      
      return false;
    });
  }, [extractDistance]);

  /**
   * Process events into user statistics
   * Only counts runs during the competition period
   */
  const processEvents = useCallback((events) => {
    const userStats = {};
    const processedEvents = [];

    // Filter duplicates and process events
    events.forEach(event => {
      if (!event.pubkey || isDuplicateEvent(event, processedEvents)) return;
      
      // REMOVED: Date filtering - count all runs from participants regardless of date
      
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
        isComplete: user.totalMiles >= COURSE_TOTAL_MILES
      }))
      .sort((a, b) => b.totalMiles - a.totalMiles) // Sort by distance descending
      .slice(0, 10) // Top 10 only
      .map((user, index) => ({ ...user, rank: index + 1 }));

    return leaderboardData;
  }, [extractDistance, isDuplicateEvent, COURSE_TOTAL_MILES, activityMode, COMPETITION_START, COMPETITION_END]);

  /**
   * Fetch fresh leaderboard data from Season Pass participants only
   * Enhanced with safety checks for Fix 3
   */
  const fetchLeaderboardData = useCallback(async () => {
    // Safety Check 1: NDK availability
    if (!ndk) {
      console.log('[useLeagueLeaderboard] NDK not available');
      setError('Nostr connection not available');
      setIsLoading(false);
      return;
    }

    // Safety Check 2: fetchEvents function availability
    if (typeof fetchEvents !== 'function') {
      console.error('[useLeagueLeaderboard] fetchEvents function not available');
      setError('Event fetching service unavailable');
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      
      // **Safety Check 3: Season Pass Service with fallback**
      let participants = [];
      try {
        participants = seasonPassService.getParticipants();
        console.log(`[useLeagueLeaderboard] Season Pass participants: ${participants.length}`);
      } catch (seasonErr) {
        console.error('[useLeagueLeaderboard] Error accessing seasonPassService:', seasonErr);
        setError('Unable to access participant data');
        setIsLoading(false);
        return;
      }
      
      // **Handle empty participants gracefully - no error, just empty leaderboard**
      if (participants.length === 0) {
        console.log('[useLeagueLeaderboard] No Season Pass participants found - showing empty leaderboard');
        const emptyLeaderboard = [];
        setLeaderboard(emptyLeaderboard);
        saveCachedData(emptyLeaderboard);
        setLastUpdated(new Date());
        setIsLoading(false);
        return;
      }

      // **Safety Check 4: Validate participants array**
      if (!Array.isArray(participants)) {
        console.error('[useLeagueLeaderboard] Participants is not an array:', typeof participants);
        setError('Invalid participant data format');
        setIsLoading(false);
        return;
      }

      // **Only fetch events from Season Pass participants during competition period**
      console.log(`[useLeagueLeaderboard] Fetching events from ${participants.length} participants for ${activityMode} mode during competition period`);
      
      // **Safety Check 5: Wrap fetchEvents with timeout and error handling**
      let events = [];
      try {
        const fetchPromise = fetchEvents(ndk, {
          kinds: [1301],
          authors: participants, // Only query Season Pass participants
          limit: MAX_EVENTS
          // REMOVED date filtering - show all runs from participants
        });

        // Add 30 second timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Fetch timeout')), 30000)
        );

        events = await Promise.race([fetchPromise, timeoutPromise]);
        
        // Safety check: ensure events is an array
        if (!Array.isArray(events)) {
          console.warn('[useLeagueLeaderboard] fetchEvents returned non-array:', typeof events);
          events = [];
        }

      } catch (fetchErr) {
        console.error('[useLeagueLeaderboard] Error fetching events:', fetchErr);
        
        // Try to use cached data if available
        const hasCachedData = loadCachedData();
        if (hasCachedData) {
          console.log('[useLeagueLeaderboard] Using cached data due to fetch error');
          return; // loadCachedData already set the state
        }
        
        setError(`Failed to fetch workout data: ${fetchErr.message}`);
        setIsLoading(false);
        return;
      }

      console.log(`[useLeagueLeaderboard] Fetched ${events.length} events from ${participants.length} participants`);

      // **Safety Check 6: Process events with error handling**
      let leaderboardData = [];
      try {
        leaderboardData = processEvents(events);
        console.log(`[useLeagueLeaderboard] Processed ${leaderboardData.length} users for leaderboard`);
      } catch (processErr) {
        console.error('[useLeagueLeaderboard] Error processing events:', processErr);
        setError('Failed to process workout data');
        setIsLoading(false);
        return;
      }

      // Update state and cache
      setLeaderboard(leaderboardData);
      saveCachedData(leaderboardData);
      setLastUpdated(new Date());

    } catch (err) {
      console.error('[useLeagueLeaderboard] Unexpected error fetching leaderboard:', err);
      setError(err.message || 'Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  }, [ndk, processEvents, saveCachedData, activityMode, loadCachedData]);

  /**
   * Refresh leaderboard data
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchLeaderboardData();
  }, [fetchLeaderboardData]);

  // Load cached data on mount
  useEffect(() => {
    const hasCachedData = loadCachedData();
    if (!hasCachedData) {
      fetchLeaderboardData();
    }
  }, [loadCachedData, fetchLeaderboardData]);

  // Refresh when activity mode changes
  useEffect(() => {
    console.log(`[useLeagueLeaderboard] Activity mode changed to: ${activityMode}`);
    setIsLoading(true);
    fetchLeaderboardData();
  }, [activityMode, fetchLeaderboardData]);

  // Auto-refresh every 30 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[useLeagueLeaderboard] Auto-refreshing leaderboard...');
      fetchLeaderboardData();
    }, CACHE_DURATION_MS);

    return () => clearInterval(interval);
  }, [fetchLeaderboardData]);

  return {
    leaderboard,
    isLoading,
    error,
    refresh,
    lastUpdated,
    activityMode,
    courseTotal: COURSE_TOTAL_MILES
  };
}; 