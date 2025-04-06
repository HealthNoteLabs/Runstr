import { useState, useEffect, useCallback } from 'react';
// Remove unused import
// import runDataService from '../services/RunDataService';

/**
 * Custom hook for calculating and managing run statistics
 * Optimized for Android
 */
export const useRunStats = (runHistory, userProfile) => {
  const [distanceUnit, setDistanceUnit] = useState(
    () => localStorage.getItem('distanceUnit') || 'km'
  );
  
  // Initialize stats with default values
  const [stats, setStats] = useState({
    totalDistance: 0,
    totalRuns: 0,
    averagePace: 0,
    fastestPace: 0,
    longestRun: 0,
    currentStreak: 0,
    bestStreak: 0,
    thisWeekDistance: 0,
    thisMonthDistance: 0,
    totalCaloriesBurned: 0,
    averageCaloriesPerKm: 0,
    averageSpeed: 0, // For cycling
    topSpeed: 0, // For cycling
    personalBests: {
      '5k': 0,
      '10k': 0,
      'halfMarathon': 0,
      'marathon': 0
    }
  });

  // Update stats when run history, user profile, or distance unit changes
  useEffect(() => {
    if (runHistory.length > 0) {
      calculateStats(runHistory, userProfile);
    }
  }, [runHistory, userProfile, distanceUnit, calculateStats]);

  // Listen for distance unit changes via custom event
  useEffect(() => {
    const handleUnitChange = (event) => {
      setDistanceUnit(event.detail.unit);
    };
    
    document.addEventListener('distanceUnitChanged', handleUnitChange);
    
    return () => {
      document.removeEventListener('distanceUnitChanged', handleUnitChange);
    };
  }, []);

  // Toggle between km and mi units
  const toggleDistanceUnit = () => {
    const newUnit = distanceUnit === 'km' ? 'mi' : 'km';
    setDistanceUnit(newUnit);
    localStorage.setItem('distanceUnit', newUnit);
  };

  // Calculate calories burned for a run
  const calculateCaloriesBurned = useCallback((distance, duration) => {
    // Default metabolic equivalent (MET) for running
    const MET = 8;
    
    // Use user profile weight if available, or default to 70kg
    const weight = userProfile?.weight || 70;
    
    // Calculate calories: MET * weight (kg) * duration (hours)
    const durationInHours = duration / 3600;
    return Math.round(MET * weight * durationInHours);
  }, [userProfile]);

  // Calculate all stats from run history
  const calculateStats = useCallback((runs, userProfile = null) => {
    try {
      if (!runs || runs.length === 0) {
        return;
      }

      // Filter out runs with zero distance to avoid NaN values
      const validRuns = runs.filter(run => run.distance > 0);
      
      if (validRuns.length === 0) {
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let totalDistance = 0;
      // We're using totalDuration for average speed calculation, so it's needed
      let totalDuration = 0;
      let totalPace = 0;
      let totalSpeed = 0; // For cycling
      let fastestPace = Infinity;
      let topSpeed = 0; // For cycling
      let longestRun = 0;
      let totalCaloriesBurned = 0;
      
      // Check if we are calculating for cycling activities
      const isCycling = runs[0]?.activityType === 'cycle';

      // Calculate the streak
      const runDates = validRuns.map(run => {
        const date = new Date(run.date);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      }).sort((a, b) => b - a); // Descending order (newest first)

      // Count runs per day
      const runsByDate = {};
      runDates.forEach(timestamp => {
        const dateStr = new Date(timestamp).toISOString().split('T')[0];
        runsByDate[dateStr] = (runsByDate[dateStr] || 0) + 1;
      });

      // Calculate current streak
      let currentStreak = 0;
      // Keeping dateKeys reference for future streak calculation implementation
      const dateKeys = Object.keys(runsByDate).sort((a, b) => b.localeCompare(a)); // Newest first
      
      // Simple streak calculation (to be improved later)
      if (dateKeys.length > 0) {
        // Check for yesterday or today
        const todayStr = new Date(today).toISOString().split('T')[0];
        const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().split('T')[0];
        
        if (dateKeys.includes(todayStr) || dateKeys.includes(yesterdayStr)) {
          currentStreak = 1;
        }
      }
      
      // Calculate stats for each run
      validRuns.forEach(run => {
        totalDistance += run.distance;
        totalDuration += run.duration;
        
        // Handle pace vs speed based on activity type
        if (isCycling && run.speed) {
          totalSpeed += run.speed;
          if (run.speed > topSpeed) {
            topSpeed = run.speed;
          }
        } else {
          if (run.pace && run.pace > 0) {
            totalPace += run.pace;
            if (run.pace < fastestPace) {
              fastestPace = run.pace;
            }
          }
        }
        
        if (run.distance > longestRun) {
          longestRun = run.distance;
        }

        // Calculate estimated calories burned
        const userWeight = userProfile?.weight || 70; // 70kg as default if no user profile
        let caloriesBurned = 0;
        
        if (run.activityType === 'run') {
          // For running: ~1 kcal per kg of body weight per km
          caloriesBurned = (userWeight * (run.distance / 1000));
        } else if (run.activityType === 'walk') {
          // For walking: ~0.5 kcal per kg of body weight per km
          caloriesBurned = (userWeight * (run.distance / 1000) * 0.5);
        } else if (run.activityType === 'cycle') {
          // For cycling: ~0.6 kcal per kg of body weight per km
          caloriesBurned = (userWeight * (run.distance / 1000) * 0.6);
        }
        
        totalCaloriesBurned += caloriesBurned;
      });

      // Calculate weekly and monthly distances
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const thisWeekDistance = validRuns
        .filter(run => new Date(run.date) >= thisWeekStart)
        .reduce((sum, run) => sum + run.distance, 0);
        
      const thisMonthDistance = validRuns
        .filter(run => new Date(run.date) >= thisMonthStart)
        .reduce((sum, run) => sum + run.distance, 0);

      // Calculate averages
      const averagePace = totalPace / validRuns.length;
      // Use totalSpeed for averageSpeed if we have it, otherwise calculate from distance and duration
      const averageSpeed = isCycling ? 
        (totalSpeed > 0 ? totalSpeed / validRuns.length : 
        (totalDistance / 1000) / (totalDuration / 3600)) : 0;
      const averageCaloriesPerKm = totalDistance > 0 
        ? (totalCaloriesBurned / (totalDistance / 1000))
        : 0;

      // Update state with calculated stats
      setStats({
        totalDistance,
        totalRuns: validRuns.length,
        averagePace: isNaN(averagePace) ? 0 : averagePace,
        fastestPace: fastestPace === Infinity ? 0 : fastestPace,
        averageSpeed: isNaN(averageSpeed) ? 0 : averageSpeed, // For cycling
        topSpeed, // For cycling
        longestRun,
        currentStreak,
        thisWeekDistance,
        thisMonthDistance,
        totalCaloriesBurned,
        averageCaloriesPerKm,
        personalBests: { // We can fill these in later when implemented
          '5k': 0,
          '10k': 0,
          'halfMarathon': 0,
          'marathon': 0
        }
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  }, [setStats, distanceUnit]);

  return {
    stats,
    distanceUnit,
    toggleDistanceUnit,
    calculateStats,
    calculateCaloriesBurned
  };
}; 