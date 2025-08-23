import { useState, useEffect, useContext, useCallback } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { fetchEvents } from '../utils/nostr';
import AmberAuth from '../services/AmberAuth';

/**
 * Hook: useNostrRunStats
 * Fetches all Kind 1301 workout records for the logged-in user and returns
 * aggregated statistics plus the raw events for further UI needs.
 */
export const useNostrRunStats = () => {
  const { publicKey: userPubkey } = useContext(NostrContext);
  const [workoutEvents, setWorkoutEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Level system utility functions
  const calculateWorkoutXP = useCallback((distanceInMiles) => {
    // Removed minimum distance threshold - all movements count for competitions
    // if (distanceInMiles < 1) return 0; // Below qualifying threshold
    const baseXP = 10;
    const distanceBonus = Math.floor(distanceInMiles - 1) * 5;
    return baseXP + distanceBonus;
  }, []);

  const getXPRequiredForLevel = useCallback((level) => {
    if (level <= 10) {
      return level * 100;
    }
    const baseXP = 1000; // XP for level 10
    const levelsAbove10 = level - 10;
    return baseXP + (levelsAbove10 * 150) + (levelsAbove10 * (levelsAbove10 - 1) * 25);
  }, []);

  const calculateLevelFromXP = useCallback((totalXP) => {
    let level = 1;
    while (getXPRequiredForLevel(level + 1) <= totalXP) {
      level++;
    }
    return level;
  }, [getXPRequiredForLevel]);

  const calculateLevelData = useCallback((totalXP, qualifyingWorkouts) => {
    const currentLevel = calculateLevelFromXP(totalXP);
    const xpForCurrentLevel = currentLevel > 1 ? getXPRequiredForLevel(currentLevel) : 0;
    const xpForNextLevel = getXPRequiredForLevel(currentLevel + 1);
    const progressXP = totalXP - xpForCurrentLevel;
    const xpNeededForNext = xpForNextLevel - xpForCurrentLevel;
    const progressPercentage = xpNeededForNext > 0 ? (progressXP / xpNeededForNext) * 100 : 0;

    return {
      currentLevel,
      totalXP,
      xpForCurrentLevel,
      xpForNextLevel,
      progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
      qualifyingWorkouts,
      // selectedActivityClass will be handled by UI component with localStorage
    };
  }, [calculateLevelFromXP, getXPRequiredForLevel]);

  const aggregateStats = useCallback((events) => {
    if (!events || events.length === 0) return null;
    let totalDistance = 0; // metres or converted unit value based on unit tag
    let totalDuration = 0; // seconds
    let elevationGain = 0;
    let firstTimestamp = null;
    let latestTimestamp = null;

    // Level system tracking
    let totalXP = 0;
    let qualifyingWorkouts = 0;

    // Personal bests tracking
    const personalBests = {
      '1k': null,    // fastest 1k time
      '5k': null,    // fastest 5k time  
      '10k': null    // fastest 10k time
    };

    // For streak calculation
    const workoutDates = new Set();

    events.forEach(ev => {
      // distance tag: ["distance", "5.00", "km"] OR ["distance", "3.10", "mi"]
      const distTag = ev.tags?.find(t => t[0] === 'distance');
      const durTag = ev.tags?.find(t => t[0] === 'duration');
      
      if (distTag) {
        const val = parseFloat(distTag[1]);
        const unit = distTag[2] || 'km';
        if (!isNaN(val)) {
          totalDistance += unit === 'km' ? val : (val * 1.609344);

          // Calculate XP for level system
          const distanceInMiles = unit === 'km' ? (val * 0.621371) : val;
          const workoutXP = calculateWorkoutXP(distanceInMiles);
          if (workoutXP > 0) {
            totalXP += workoutXP;
            qualifyingWorkouts++;
          }
        }

        // Calculate personal bests based on pace (more accurate than distance-specific runs)
        if (durTag && !isNaN(val)) {
          const parts = durTag[1].split(':').map(Number);
          if (parts.length === 3) {
            const durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            const distanceKm = unit === 'km' ? val : (val * 1.609344);
            
            // Only consider runs that are at least 1km and have reasonable pace (2-20 min/km)
            if (distanceKm >= 1 && durationSeconds > 0) {
              const pacePerKm = durationSeconds / distanceKm; // seconds per km
              
              // Validate reasonable running pace (2-20 minutes per km)
              if (pacePerKm >= 120 && pacePerKm <= 1200) {
                // Update personal bests if this is the fastest pace we've seen
                const distances = [1, 5, 10];
                distances.forEach(targetDistance => {
                  // Only update if the run is long enough to include this distance
                  if (distanceKm >= targetDistance) {
                    const projectedTime = pacePerKm * targetDistance;
                    const currentPB = personalBests[`${targetDistance}k`];
                    
                    if (!currentPB || projectedTime < currentPB.time) {
                      personalBests[`${targetDistance}k`] = {
                        time: projectedTime,
                        pacePerKm: pacePerKm,
                        date: ev.created_at,
                        sourceDistance: distanceKm // Track which run this came from
                      };
                    }
                  }
                });
              }
            }
          }
        }
      }

      if (durTag) {
        // duration formatted HH:MM:SS
        const parts = durTag[1].split(':').map(Number);
        if (parts.length === 3) {
          const secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
          totalDuration += secs;
        }
      }

      const elevTag = ev.tags?.find(t => t[0] === 'elevation_gain');
      if (elevTag) {
        const val = parseFloat(elevTag[1]);
        if (!isNaN(val)) {
          elevationGain += val; // unit agnostic, UI can decide
        }
      }

      const ts = ev.created_at || 0;
      if (firstTimestamp === null || ts < firstTimestamp) firstTimestamp = ts;
      if (latestTimestamp === null || ts > latestTimestamp) latestTimestamp = ts;

      // Add workout date for streak calculation (using date string to avoid timezone issues)
      const workoutDate = new Date(ts * 1000).toDateString();
      workoutDates.add(workoutDate);
    });

    // Calculate longest streak
    const calculateLongestStreak = () => {
      if (workoutDates.size === 0) return 0;
      
      const dates = Array.from(workoutDates)
        .map(dateStr => new Date(dateStr))
        .sort((a, b) => a - b);
      
      let longestStreak = 1;
      let currentStreak = 1;
      
      for (let i = 1; i < dates.length; i++) {
        const prevDate = dates[i - 1];
        const currDate = dates[i];
        const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          // Consecutive day
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else if (diffDays > 1) {
          // Gap in streak
          currentStreak = 1;
        }
        // If diffDays === 0, it's the same day, so don't change streak
      }
      
      return longestStreak;
    };

    const totalRuns = events.length;
    const avgDistance = totalRuns > 0 ? totalDistance / totalRuns : 0;
    const avgDuration = totalRuns > 0 ? totalDuration / totalRuns : 0;

    // Calculate level data
    const levelData = calculateLevelData(totalXP, qualifyingWorkouts);

    return {
      totalRuns,
      totalDistanceKm: totalDistance, // always km for consistency
      totalDurationSeconds: totalDuration,
      elevationGain,
      avgDistanceKm: avgDistance,
      avgDurationSeconds: avgDuration,
      firstWorkout: firstTimestamp,
      lastWorkout: latestTimestamp,
      personalBests,
      longestStreak: calculateLongestStreak(),
      levelData, // Add level system data
    };
  }, [calculateWorkoutXP, calculateLevelData]);

  const loadEvents = useCallback(async () => {
    // Try multiple sources for pubkey (context first, then localStorage)
    let effectivePubkey = userPubkey;
    
    if (!effectivePubkey && typeof window !== 'undefined') {
      // Fallback to localStorage 'userPublicKey' (where Amber stores it)
      effectivePubkey = window.localStorage.getItem('userPublicKey');
    }
    
    if (!effectivePubkey) {
      setError('No user pubkey');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const evSet = await fetchEvents({ kinds: [1301], authors: [effectivePubkey], limit: 1000 });
      const evArr = Array.from(evSet).map(e => e.rawEvent ? e.rawEvent() : e);
      setWorkoutEvents(evArr);
      setStats(aggregateStats(evArr));
    } catch (err) {
      console.error('useNostrRunStats fetch error', err);
      setError(err.message || 'Fetch error');
    } finally {
      setIsLoading(false);
    }
  }, [userPubkey, aggregateStats]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return { workoutEvents, stats, isLoading, error, reload: loadEvents };
}; 