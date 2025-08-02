import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNostr } from './useNostr';
import EventParticipationService from '../services/EventParticipationService';

/**
 * Hook: useEventLeaderboard
 * 
 * Creates a leaderboard for a specific team event by querying workout activities
 * from event participants during the event timeframe.
 * 
 * Follows the successful league leaderboard pattern:
 * - Queries Kind 1301 workout events from participants
 * - Calculates totals and rankings during event period
 * - Provides real-time updates as new workouts are posted
 * 
 * @param {Array} participants - Array of event participants with pubkeys
 * @param {number} eventStartTime - Event start timestamp (ms)
 * @param {number} eventEndTime - Event end timestamp (ms), undefined if ongoing
 * @param {string} activityMode - Activity type filter ('run', 'walk', 'cycle', 'all')
 * @returns {Object} Hook state with leaderboard data and methods
 */
export const useEventLeaderboard = (participants = [], eventStartTime, eventEndTime, activityMode = 'all') => {
  const { ndk, ndkReady } = useNostr();
  
  // State
  const [leaderboard, setLeaderboard] = useState([]);
  const [workoutActivities, setWorkoutActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Extract participant pubkeys
  const participantPubkeys = useMemo(() => {
    return participants.map(p => p.pubkey).filter(Boolean);
  }, [participants]);

  // Activity type filter
  const activityTypeFilter = useMemo(() => {
    if (activityMode === 'all') return null;
    return activityMode;
  }, [activityMode]);

  /**
   * Parse workout data from Kind 1301 event with robust tag validation
   */
  const parseWorkoutData = useCallback((event) => {
    if (!event || typeof event !== 'object') {
      console.warn('[useEventLeaderboard] Invalid event object provided to parseWorkoutData');
      return null;
    }
    
    const tags = Array.isArray(event.tags) ? event.tags : [];
    
    // Helper function to safely extract tag values with validation
    const getTagValue = (tagName, defaultValue = '0', validator = null) => {
      try {
        const tag = tags.find(tag => Array.isArray(tag) && tag.length >= 2 && tag[0] === tagName);
        if (!tag || !tag[1]) return defaultValue;
        
        const value = tag[1];
        if (validator && !validator(value)) {
          console.warn(`[useEventLeaderboard] Invalid ${tagName} value: ${value}, using default`);
          return defaultValue;
        }
        
        return value;
      } catch (err) {
        console.warn(`[useEventLeaderboard] Error extracting ${tagName} tag:`, err);
        return defaultValue;
      }
    };
    
    // Validators for different data types
    const isValidNumber = (val) => !isNaN(parseFloat(val)) && isFinite(parseFloat(val)) && parseFloat(val) >= 0;
    const isValidInteger = (val) => !isNaN(parseInt(val)) && parseInt(val) >= 0;
    const isValidString = (val) => typeof val === 'string' && val.trim().length > 0;
    
    // Extract data from tags with validation
    const distanceStr = getTagValue('distance', '0', isValidNumber);
    const durationStr = getTagValue('duration', '0', isValidInteger);
    const activityType = getTagValue('activity_type', 'run', isValidString);
    const caloriesStr = getTagValue('calories', '0', isValidInteger);
    const elevationStr = getTagValue('elevation_gain', '0', isValidNumber);
    
    // Parse with additional bounds checking
    const distance = Math.max(0, Math.min(1000, parseFloat(distanceStr))); // Max 1000km
    const duration = Math.max(0, Math.min(86400, parseInt(durationStr))); // Max 24 hours
    const calories = Math.max(0, Math.min(10000, parseInt(caloriesStr))); // Max 10000 calories
    const elevation = Math.max(0, Math.min(10000, parseFloat(elevationStr))); // Max 10000m elevation
    
    // Calculate pace/speed based on activity type
    let pace = 0;
    let speed = 0;
    if (distance > 0 && duration > 0) {
      const durationHours = duration / 3600; // Convert seconds to hours
      speed = distance / durationHours; // Distance per hour
      
      if (activityType === 'run' || activityType === 'walk') {
        // Pace in minutes per mile
        pace = (duration / 60) / distance;
      }
    }

    return {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      distance,
      duration,
      activityType,
      calories,
      elevation,
      pace,
      speed,
      // Raw event data
      rawEvent: event
    };
  }, []);

  /**
   * Calculate leaderboard from workout activities
   */
  const calculateLeaderboard = useCallback((activities) => {
    console.log(`[useEventLeaderboard] Calculating leaderboard from ${activities.length} activities`);
    
    // Group activities by participant
    const participantStats = new Map();
    
    activities.forEach(activity => {
      const { pubkey } = activity;
      
      // Apply activity type filter
      if (activityTypeFilter && activity.activityType !== activityTypeFilter) {
        return;
      }
      
      if (!participantStats.has(pubkey)) {
        participantStats.set(pubkey, {
          pubkey,
          totalDistance: 0,
          totalDuration: 0,
          totalCalories: 0,
          totalElevation: 0,
          workoutCount: 0,
          activities: [],
          lastActivity: 0
        });
      }
      
      const stats = participantStats.get(pubkey);
      stats.totalDistance += activity.distance;
      stats.totalDuration += activity.duration;
      stats.totalCalories += activity.calories;
      stats.totalElevation += activity.elevation;
      stats.workoutCount += 1;
      stats.activities.push(activity);
      stats.lastActivity = Math.max(stats.lastActivity, activity.created_at);
    });
    
    // Convert to array and calculate additional metrics
    const leaderboardData = Array.from(participantStats.values()).map(stats => {
      // Calculate average pace/speed
      let averagePace = 0;
      let averageSpeed = 0;
      
      if (stats.totalDistance > 0 && stats.totalDuration > 0) {
        const totalDurationHours = stats.totalDuration / 3600;
        averageSpeed = stats.totalDistance / totalDurationHours;
        
        if (activityTypeFilter === 'run' || activityTypeFilter === 'walk' || !activityTypeFilter) {
          averagePace = (stats.totalDuration / 60) / stats.totalDistance;
        }
      }
      
      return {
        ...stats,
        averagePace,
        averageSpeed,
        // Format total distance to 2 decimal places
        totalDistance: Math.round(stats.totalDistance * 100) / 100
      };
    });
    
    // Sort by total distance (primary), then workout count (secondary), then last activity (tertiary)
    leaderboardData.sort((a, b) => {
      if (b.totalDistance !== a.totalDistance) return b.totalDistance - a.totalDistance;
      if (b.workoutCount !== a.workoutCount) return b.workoutCount - a.workoutCount;
      return b.lastActivity - a.lastActivity;
    });
    
    // Add rankings
    const rankedLeaderboard = leaderboardData.map((participant, index) => ({
      ...participant,
      rank: index + 1
    }));
    
    console.log(`[useEventLeaderboard] Calculated leaderboard with ${rankedLeaderboard.length} participants`);
    rankedLeaderboard.forEach(p => {
      console.log(`  ${p.pubkey.slice(0, 8)}: ${p.totalDistance} mi, ${p.workoutCount} workouts, rank ${p.rank}`);
    });
    
    return rankedLeaderboard;
  }, [activityTypeFilter]);

  /**
   * Fetch workout activities for event participants during event timeframe
   */
  const fetchEventActivities = useCallback(async () => {
    if (!ndk || !ndkReady || participantPubkeys.length === 0 || !eventStartTime) {
      console.log('[useEventLeaderboard] Missing required data for fetching activities');
      setIsLoading(false);
      return;
    }

    try {
      console.log(`[useEventLeaderboard] Fetching activities for ${participantPubkeys.length} participants`);
      setError(null);
      
      const activities = await EventParticipationService.fetchEventWorkoutActivities(
        ndk,
        participantPubkeys,
        eventStartTime,
        eventEndTime || Date.now()
      );
      
      // Parse workout data and filter out invalid entries
      const parsedActivities = activities.map(parseWorkoutData).filter(Boolean);
      const invalidCount = activities.length - parsedActivities.length;
      
      if (invalidCount > 0) {
        console.warn(`[useEventLeaderboard] Filtered out ${invalidCount} invalid workout activities`);
      }
      
      setWorkoutActivities(parsedActivities);
      
      // Calculate leaderboard
      const leaderboardData = calculateLeaderboard(parsedActivities);
      setLeaderboard(leaderboardData);
      
      setLastUpdated(new Date());
      console.log(`[useEventLeaderboard] Successfully loaded ${parsedActivities.length} activities`);
      
    } catch (err) {
      console.error('[useEventLeaderboard] Error fetching event activities:', err);
      setError(err.message || 'Failed to load event activities');
    } finally {
      setIsLoading(false);
    }
  }, [ndk, ndkReady, participantPubkeys, eventStartTime, eventEndTime, parseWorkoutData, calculateLeaderboard]);

  /**
   * Refresh leaderboard data
   */
  const refresh = useCallback(() => {
    console.log('[useEventLeaderboard] Refreshing leaderboard...');
    setIsLoading(true);
    fetchEventActivities();
  }, [fetchEventActivities]);

  // Initial load
  useEffect(() => {
    fetchEventActivities();
  }, [fetchEventActivities]);

  // Auto-refresh when participants change
  useEffect(() => {
    if (participantPubkeys.length > 0 && !isLoading) {
      console.log('[useEventLeaderboard] Participants changed, refreshing activities');
      fetchEventActivities();
    }
  }, [participantPubkeys, fetchEventActivities, isLoading]);

  // Memoized stats
  const stats = useMemo(() => {
    const totalParticipants = participants.length;
    const activeParticipants = leaderboard.length;
    const totalWorkouts = leaderboard.reduce((sum, p) => sum + p.workoutCount, 0);
    const totalDistance = leaderboard.reduce((sum, p) => sum + p.totalDistance, 0);
    const totalDuration = leaderboard.reduce((sum, p) => sum + p.totalDuration, 0);
    
    return {
      totalParticipants,
      activeParticipants,
      totalWorkouts,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalDuration,
      averageDistance: activeParticipants > 0 ? Math.round((totalDistance / activeParticipants) * 100) / 100 : 0
    };
  }, [participants.length, leaderboard]);

  return {
    // Leaderboard data
    leaderboard,
    workoutActivities,
    stats,
    
    // Loading states
    isLoading,
    error,
    lastUpdated,
    
    // Actions
    refresh,
    
    // Debug info
    debugInfo: {
      participantCount: participantPubkeys.length,
      activityMode,
      eventStartTime: eventStartTime ? new Date(eventStartTime).toISOString() : null,
      eventEndTime: eventEndTime ? new Date(eventEndTime).toISOString() : null,
      totalActivities: workoutActivities.length,
      ndkReady
    }
  };
};