import { useState, useEffect, useContext, useCallback } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { fetchEvents } from '../utils/nostr';

/**
 * Hook: useLeaguePosition
 * Fetches user's Kind 1301 workout records and calculates total distance.
 * Used for RUNSTR Season 1 distance competition. ALL runs count toward total.
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

  // Constants
  const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes cache

  /**
   * Calculate total distance from 1301 workout events
   * ALL runs count - no minimum distance threshold
   */
  const calculateDistanceFromEvents = useCallback((events) => {
    if (!events || events.length === 0) {
      return { totalMiles: 0, runs: [] };
    }

    let totalMiles = 0;
    const runs = [];

    events.forEach(event => {
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
  }, []);



  /**
   * Fetch and process 1301 workout events
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
      // Fetch all 1301 workout events for the user
      const eventSet = await fetchEvents({ 
        kinds: [1301], 
        authors: [userPubkey], 
        limit: 1000 
      });
      
      // Convert Set to Array and extract raw events
      const events = Array.from(eventSet).map(e => e.rawEvent ? e.rawEvent() : e);
      
      // Calculate distance
      const { totalMiles, runs } = calculateDistanceFromEvents(events);
      
      // Update state
      setTotalDistance(totalMiles);
      setQualifyingRuns(runs);
      setLastFetchTime(now);
      
      console.log(`[useLeaguePosition] Total distance: ${totalMiles} miles`);
      
    } catch (err) {
      console.error('[useLeaguePosition] Error fetching position:', err);
      setError(err.message || 'Failed to fetch league position');
    } finally {
      setIsLoading(false);
    }
  }, [userPubkey, calculateDistanceFromEvents, lastFetchTime, totalDistance]);

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
    totalDistance,        // Total miles accumulated from ALL runs
    qualifyingRuns,      // Array of run data that contributed to total
    
    // Meta
    isLoading,
    error,
    lastFetchTime,
    
    // Actions
    refresh: refreshPosition,
    refetch: fetchLeaguePosition
  };
}; 