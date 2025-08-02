/**
 * Team Event Leaderboard Utilities
 * 
 * Following League's pattern of deriving leaderboard data from activity feed events
 * instead of separate queries for better performance and consistency.
 */

/**
 * Calculate leaderboard from team event activity feed data
 * @param {Array} feedEvents - Activity feed events from useTeamEventActivityFeed
 * @param {Array} participants - All event participants
 * @param {Object} event - Event details (distance, activity type, etc.)
 * @param {string} publicKey - Current user's public key
 * @returns {Array} Sorted leaderboard with participant stats
 */
export const calculateLeaderboardFromFeed = (feedEvents = [], participants = [], event = null, publicKey = null) => {
  console.log('[teamEventLeaderboard] Calculating leaderboard from feed:', {
    feedEventsCount: feedEvents.length,
    participantsCount: participants.length,
    eventDistance: event?.distance,
    eventActivity: event?.activity
  });

  // Create participant stats map
  const participantStats = new Map();
  
  // Initialize all participants (even those without activities)
  participants.forEach(participant => {
    const pubkey = participant.pubkey || participant;
    participantStats.set(pubkey, {
      pubkey,
      totalDistance: 0,
      totalDuration: 0,
      totalCalories: 0,
      totalElevation: 0,
      workoutCount: 0,
      activities: [],
      lastActivity: 0,
      isCurrentUser: pubkey === publicKey,
      completed: false
    });
  });

  // Process feed events to build stats
  feedEvents.forEach(feedEvent => {
    const { pubkey } = feedEvent;
    
    if (!participantStats.has(pubkey)) {
      // Add participant if not in original list (shouldn't happen but be safe)
      participantStats.set(pubkey, {
        pubkey,
        totalDistance: 0,
        totalDuration: 0,
        totalCalories: 0,
        totalElevation: 0,
        workoutCount: 0,
        activities: [],
        lastActivity: 0,
        isCurrentUser: pubkey === publicKey,
        completed: false
      });
    }
    
    const stats = participantStats.get(pubkey);
    
    // Extract metrics from feed event
    const distance = feedEvent.distance || 0;
    const duration = extractDurationFromTags(feedEvent.tags) || 0;
    const calories = extractCaloriesFromTags(feedEvent.tags) || 0;
    const elevation = extractElevationFromTags(feedEvent.tags) || 0;
    
    // Update totals
    stats.totalDistance += distance;
    stats.totalDuration += duration;
    stats.totalCalories += calories;
    stats.totalElevation += elevation;
    stats.workoutCount += 1;
    stats.activities.push(feedEvent);
    stats.lastActivity = Math.max(stats.lastActivity, feedEvent.created_at || 0);
  });

  // Calculate completion status and additional metrics
  const eventDistance = event?.distance || 0;
  const leaderboardData = Array.from(participantStats.values()).map(stats => {
    // Calculate average pace/speed
    let averagePace = 0;
    let averageSpeed = 0;
    
    if (stats.totalDistance > 0 && stats.totalDuration > 0) {
      const totalDurationHours = stats.totalDuration / 3600;
      averageSpeed = stats.totalDistance / totalDurationHours;
      
      // Pace in minutes per km for running/walking activities
      if (event?.activity === 'run' || event?.activity === 'walk') {
        averagePace = (stats.totalDuration / 60) / stats.totalDistance;
      }
    }
    
    // Determine completion status (80% of event distance threshold)
    const completed = eventDistance > 0 ? stats.totalDistance >= eventDistance * 0.8 : false;
    
    return {
      ...stats,
      averagePace,
      averageSpeed,
      completed,
      // Format total distance to 2 decimal places
      totalDistance: Math.round(stats.totalDistance * 100) / 100,
      // Add display fields for UI compatibility
      distance: Math.round(stats.totalDistance * 100) / 100,
      duration: stats.totalDuration,
      pace: averagePace
    };
  });

  // Sort by completion status, then distance, then workout count, then last activity
  leaderboardData.sort((a, b) => {
    // Completed participants first
    if (a.completed && !b.completed) return -1;
    if (!a.completed && b.completed) return 1;
    
    // Among completed participants, sort by time (fastest first)
    if (a.completed && b.completed && a.totalDuration > 0 && b.totalDuration > 0) {
      return a.totalDuration - b.totalDuration;
    }
    
    // Primary sort: total distance (highest first)
    if (b.totalDistance !== a.totalDistance) return b.totalDistance - a.totalDistance;
    
    // Secondary sort: workout count (more workouts first)
    if (b.workoutCount !== a.workoutCount) return b.workoutCount - a.workoutCount;
    
    // Tertiary sort: last activity (most recent first)
    return b.lastActivity - a.lastActivity;
  });

  // Add rankings
  const rankedLeaderboard = leaderboardData.map((participant, index) => ({
    ...participant,
    rank: index + 1
  }));

  console.log('[teamEventLeaderboard] Calculated leaderboard:', {
    totalParticipants: rankedLeaderboard.length,
    activeParticipants: rankedLeaderboard.filter(p => p.workoutCount > 0).length,
    completedParticipants: rankedLeaderboard.filter(p => p.completed).length
  });

  return rankedLeaderboard;
};

/**
 * Extract duration from event tags (in seconds)
 */
const extractDurationFromTags = (tags = []) => {
  try {
    const durationTag = tags.find(tag => tag[0] === 'duration');
    if (!durationTag || !durationTag[1]) return 0;
    
    const value = parseInt(durationTag[1]);
    return isNaN(value) || value < 0 ? 0 : value;
  } catch (err) {
    console.error('Error extracting duration:', err);
    return 0;
  }
};

/**
 * Extract calories from event tags
 */
const extractCaloriesFromTags = (tags = []) => {
  try {
    const caloriesTag = tags.find(tag => tag[0] === 'calories');
    if (!caloriesTag || !caloriesTag[1]) return 0;
    
    const value = parseInt(caloriesTag[1]);
    return isNaN(value) || value < 0 ? 0 : value;
  } catch (err) {
    console.error('Error extracting calories:', err);
    return 0;
  }
};

/**
 * Extract elevation gain from event tags
 */
const extractElevationFromTags = (tags = []) => {
  try {
    const elevationTag = tags.find(tag => tag[0] === 'elevation_gain' || tag[0] === 'elevation');
    if (!elevationTag || !elevationTag[1]) return 0;
    
    const value = parseFloat(elevationTag[1]);
    return isNaN(value) || value < 0 ? 0 : value;
  } catch (err) {
    console.error('Error extracting elevation:', err);
    return 0;
  }
};

/**
 * Calculate summary stats from leaderboard data (similar to League)
 */
export const calculateEventStats = (leaderboard = []) => {
  const totalParticipants = leaderboard.length;
  const activeParticipants = leaderboard.filter(p => p.workoutCount > 0).length;
  const completedParticipants = leaderboard.filter(p => p.completed).length;
  const totalWorkouts = leaderboard.reduce((sum, p) => sum + p.workoutCount, 0);
  const totalDistance = leaderboard.reduce((sum, p) => sum + p.totalDistance, 0);
  const totalDuration = leaderboard.reduce((sum, p) => sum + p.totalDuration, 0);
  
  return {
    totalParticipants,
    activeParticipants,
    completedParticipants,
    totalWorkouts,
    totalDistance: Math.round(totalDistance * 100) / 100,
    totalDuration,
    averageDistance: activeParticipants > 0 ? Math.round((totalDistance / activeParticipants) * 100) / 100 : 0,
    completionRate: totalParticipants > 0 ? Math.round((completedParticipants / totalParticipants) * 100) : 0
  };
};