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
      // If there are no runs, set default stats and return
      if (!runs || !Array.isArray(runs) || runs.length === 0) {
        setStats({
          totalDistance: 0,
          totalRuns: 0,
          averagePace: 0,
          fastestPace: 0,
          averageSpeed: 0,
          topSpeed: 0,
          longestRun: 0,
          currentStreak: 0,
          thisWeekDistance: 0,
          thisMonthDistance: 0,
          totalCaloriesBurned: 0,
          averageCaloriesPerKm: 0,
          personalBests: {
            '5k': 0,
            '10k': 0,
            'halfMarathon': 0,
            'marathon': 0
          }
        });
        return;
      }

      // Filter out runs with zero distance to avoid NaN values
      const validRuns = runs.filter(run => run && run.distance > 0);
      
      if (validRuns.length === 0) {
        // Also set default stats if there are no valid runs
        setStats({
          totalDistance: 0,
          totalRuns: 0,
          averagePace: 0,
          fastestPace: 0,
          averageSpeed: 0,
          topSpeed: 0,
          longestRun: 0,
          currentStreak: 0,
          thisWeekDistance: 0,
          thisMonthDistance: 0,
          totalCaloriesBurned: 0,
          averageCaloriesPerKm: 0,
          personalBests: {
            '5k': 0,
            '10k': 0,
            'halfMarathon': 0,
            'marathon': 0
          }
        });
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let totalDistance = 0;
      let totalDuration = 0;
      let totalPace = 0;
      let totalSpeed = 0;
      let fastestPace = Infinity;
      let topSpeed = 0;
      let longestRun = 0;
      let totalCaloriesBurned = 0;
      
      // Check if we are calculating for cycling activities
      const isCycling = validRuns[0]?.activityType === 'cycle';

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
        totalDistance += run.distance || 0;
        totalDuration += run.duration || 0;
        
        // Calculate pace values for all activity types as a fallback
        const runPace = run.pace || (run.duration && run.distance ? (run.duration / 60) / (run.distance / (distanceUnit === 'km' ? 1000 : 1609.344)) : 0);
        
        // Handle pace vs speed based on activity type
        if (isCycling) {
          // Use stored speed if available, otherwise calculate it
          const speed = run.speed || (run.duration && run.distance ? 
            (run.distance / (distanceUnit === 'km' ? 1000 : 1609.344)) / (run.duration / 3600) : 0);
          
          if (speed > 0) {
            totalSpeed += speed;
            if (speed > topSpeed) {
              topSpeed = speed;
            }
          }
        }
        
        // Always calculate pace for all activities as a fallback
        if (runPace > 0) {
          totalPace += runPace;
          if (runPace < fastestPace) {
            fastestPace = runPace;
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
        .reduce((sum, run) => sum + (run.distance || 0), 0);
        
      const thisMonthDistance = validRuns
        .filter(run => new Date(run.date) >= thisMonthStart)
        .reduce((sum, run) => sum + (run.distance || 0), 0);

      // Calculate averages
      const averagePace = validRuns.length > 0 ? totalPace / validRuns.length : 0;
      
      // Calculate average speed for cycling or default to 0
      let averageSpeed = 0;
      if (isCycling && validRuns.length > 0) {
        if (totalSpeed > 0) {
          averageSpeed = totalSpeed / validRuns.length;
        } else if (totalDistance > 0 && totalDuration > 0) {
          // Fallback calculation
          averageSpeed = (totalDistance / (distanceUnit === 'km' ? 1000 : 1609.344)) / (totalDuration / 3600);
        }
      }
      
      const averageCaloriesPerKm = totalDistance > 0 
        ? (totalCaloriesBurned / (totalDistance / 1000))
        : 0;

      // Update state with calculated stats (with safe fallbacks)
      setStats({
        totalDistance,
        totalRuns: validRuns.length,
        averagePace: isNaN(averagePace) ? 0 : averagePace,
        fastestPace: fastestPace === Infinity ? 0 : fastestPace,
        averageSpeed: isNaN(averageSpeed) ? 0 : averageSpeed,
        topSpeed: isNaN(topSpeed) ? 0 : topSpeed,
        longestRun,
        currentStreak,
        thisWeekDistance,
        thisMonthDistance,
        totalCaloriesBurned,
        averageCaloriesPerKm: isNaN(averageCaloriesPerKm) ? 0 : averageCaloriesPerKm,
        personalBests: {
          '5k': 0,
          '10k': 0,
          'halfMarathon': 0,
          'marathon': 0
        }
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
      // In case of error, set default stats to prevent blank screen
      setStats({
        totalDistance: 0,
        totalRuns: 0,
        averagePace: 0,
        fastestPace: 0,
        averageSpeed: 0,
        topSpeed: 0,
        longestRun: 0,
        currentStreak: 0,
        thisWeekDistance: 0,
        thisMonthDistance: 0,
        totalCaloriesBurned: 0,
        averageCaloriesPerKm: 0,
        personalBests: {
          '5k': 0,
          '10k': 0,
          'halfMarathon': 0,
          'marathon': 0
        }
      });
    }
  }, [distanceUnit]);

  // Update stats when run history, user profile, or distance unit changes
  useEffect(() => {
    try {
      // Always call calculateStats, even if runHistory is empty
      calculateStats(runHistory, userProfile);
    } catch (error) {
      console.error('Error in useRunStats effect:', error);
      // Set default stats if there's an error
      setStats({
        totalDistance: 0,
        totalRuns: 0,
        averagePace: 0,
        fastestPace: 0,
        averageSpeed: 0,
        topSpeed: 0,
        longestRun: 0,
        currentStreak: 0,
        thisWeekDistance: 0,
        thisMonthDistance: 0,
        totalCaloriesBurned: 0,
        averageCaloriesPerKm: 0,
        personalBests: {
          '5k': 0,
          '10k': 0,
          'halfMarathon': 0,
          'marathon': 0
        }
      });
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

  return {
    stats,
    distanceUnit,
    toggleDistanceUnit,
    calculateStats,
    calculateCaloriesBurned
  };
}; 