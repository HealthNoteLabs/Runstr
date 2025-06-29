import { useState, useEffect, useContext, useCallback } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { fetchEvents } from '../utils/nostr';
import { REWARDS } from '../config/rewardsConfig';

/**
 * Hook: useLeaguePosition
 * Fetches user's Kind 1301 workout records and calculates their Season 1 position
 * Only includes workouts within Season 1 date range (July 4 - Oct 4, 2025)
 * This is a time-based competition, not distance-based, so no completion percentage
 * 
 * @returns {Object} { totalDistance, qualifyingRuns, isLoading, error }
 */
export const useLeaguePosition = () => {
  const { publicKey: userPubkey } = useContext(NostrContext);
  const [totalDistance, setTotalDistance] = useState(0); // in miles
  const [qualifyingRuns, setQualifyingRuns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(0);

  // Season 1 Configuration
  const SEASON_1_START = new Date(REWARDS.SEASON_1.startDate).getTime() / 1000;
  const SEASON_1_END = new Date(REWARDS.SEASON_1.endDate).getTime() / 1000;
  const SEASON_1_IDENTIFIER = REWARDS.SEASON_1.identifier;

  // Constants
  const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes cache

  /**
   * Check if event is within Season 1 date range
   */
  const isWithinSeason1 = useCallback((event) => {
    const eventTime = event.created_at;
    return eventTime >= SEASON_1_START && eventTime <= SEASON_1_END;
  }, [SEASON_1_START, SEASON_1_END]);

  /**
   * Calculate total distance from Season 1 workout events
   * Only includes events within Season 1 date range with proper season tag
   */
  const calculateDistanceFromEvents = useCallback((events) => {
    if (!events || events.length === 0) {
      return { totalMiles: 0, runs: [] };
    }

    let totalMiles = 0;
    const runs = [];

    events.forEach(event => {
      // Filter 1: Only events within Season 1 date range
      if (!isWithinSeason1(event)) {
        console.log(`[useLeaguePosition] Filtering out event outside Season 1 dates: ${new Date(event.created_at * 1000).toISOString()}`);
        return;
      }

      // Filter 2: Check for Season 1 tag (events should be tagged with season identifier)
      const seasonTag = event.tags?.find(tag => tag[0] === 'season' && tag[1] === SEASON_1_IDENTIFIER);
      if (!seasonTag) {
        console.log(`[useLeaguePosition] Filtering out event without Season 1 tag: ${event.id}`);
        return;
      }

      // Extract distance tag: ["distance", "5.00", "km"] OR ["distance", "3.10", "mi"]
      const distanceTag = event.tags?.find(tag => tag[0] === 'distance');
      
      if (distanceTag && distanceTag[1]) {
        const distanceValue = parseFloat(distanceTag[1]);
        const unit = distanceTag[2] || 'km'; // default to km if no unit specified
        
        if (!isNaN(distanceValue) && distanceValue > 0) {
          // Convert to miles for consistent calculation
          const distanceInMiles = unit === 'km' ? (distanceValue * 0.621371) : distanceValue;
          totalMiles += distanceInMiles;
          
          // Store run data for reference
          runs.push({
            id: event.id,
            distance: distanceInMiles,
            originalDistance: distanceValue,
            unit: unit,
            timestamp: event.created_at,
            event: event
          });
        }
      }
    });

    return {
      totalMiles: Math.round(totalMiles * 100) / 100, // Round to 2 decimal places
      runs: runs.sort((a, b) => b.timestamp - a.timestamp) // Most recent first
    };
  }, [isWithinSeason1, SEASON_1_IDENTIFIER]);

  /**
   * Fetch and process Season 1 workout events
   */
  const fetchLeaguePosition = useCallback(async () => {
    if (!userPubkey) {
      setError('No user public key available');
      return;
    }

    // Check cache validity
    const now = Date.now();
    if (now - lastFetchTime < CACHE_DURATION_MS && totalDistance > 0) {
      return; // Use cached data
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch Season 1 workout events for the user within date range
      const eventSet = await fetchEvents({ 
        kinds: [1301], 
        authors: [userPubkey], 
        since: SEASON_1_START,
        until: SEASON_1_END,
        limit: 1000 
      });
      
      // Convert Set to Array and extract raw events
      const events = Array.from(eventSet).map(e => e.rawEvent ? e.rawEvent() : e);
      
      // Calculate distance from Season 1 events
      const { totalMiles, runs } = calculateDistanceFromEvents(events);
      
      // Update state
      setTotalDistance(totalMiles);
      setQualifyingRuns(runs);
      setLastFetchTime(now);
      
      console.log(`[useLeaguePosition] Season 1 total distance: ${totalMiles} miles from ${runs.length} qualifying runs`);
      
    } catch (err) {
      console.error('[useLeaguePosition] Error fetching Season 1 position:', err);
      setError(err.message || 'Failed to fetch Season 1 position');
    } finally {
      setIsLoading(false);
    }
  }, [userPubkey, calculateDistanceFromEvents, lastFetchTime, totalDistance, SEASON_1_START, SEASON_1_END]);

  /**
   * Force refresh position data (bypass cache)
   */
  const refreshPosition = useCallback(async () => {
    setLastFetchTime(0); // Clear cache
    await fetchLeaguePosition();
  }, [fetchLeaguePosition]);

  // Initial fetch when component mounts or pubkey changes
  useEffect(() => {
    fetchLeaguePosition();
  }, [fetchLeaguePosition]);

  return {
    // Core data
    totalDistance,        // Total miles accumulated from Season 1 runs only
    qualifyingRuns,      // Array of Season 1 run data that contributed to position
    
    // Meta
    isLoading,
    error,
    lastFetchTime,
    
    // Actions
    refresh: refreshPosition,
    refetch: fetchLeaguePosition
  };
}; 