import { useState, useEffect, useCallback } from 'react';
import runDataService from '../services/RunDataService';
import { useSettings } from '../contexts/SettingsContext';

/**
 * Custom hook for calculating and managing run statistics
 * Optimized for Android
 */
export const useRunStats = (runHistory, userProfile) => {
  // Use the global settings context instead of local state
  const { distanceUnit } = useSettings();
  
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
      calculateStats(runHistory);
    }
  }, [runHistory, userProfile, distanceUnit]);

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
  const calculateStats = useCallback((runs) => {
    if (!runs || !runs.length) return;

    // Initialize stats
    const newStats = {
      totalDistance: 0,
      totalRuns: runs.length,
      averagePace: 0,
      fastestPace: 99999, // Start with high value to find minimum
      longestRun: 0,
      currentStreak: 0,
      bestStreak: 0,
      thisWeekDistance: 0,
      thisMonthDistance: 0,
      totalCaloriesBurned: 0,
      averageCaloriesPerKm: 0,
      personalBests: {
        '5k': 99999,
        '10k': 99999,
        'halfMarathon': 99999,
        'marathon': 99999
      }
    };

    // For average pace calculation
    let totalPace = 0;
    let validPaceCount = 0;

    // Group runs by date for streak calculations
    const runsByDate = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Get the start of this week (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Get the start of this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Process each run for other stats
    runs.forEach((run) => {
      // Skip runs with invalid data
      if (!run || isNaN(run.distance) || run.distance <= 0 || 
          isNaN(run.duration) || run.duration <= 0) {
        return;
      }
      
      // Total distance
      newStats.totalDistance += run.distance;

      // Longest run
      if (run.distance > newStats.longestRun) {
        newStats.longestRun = run.distance;
      }

      // Pace calculations using RunDataService
      // Calculate pace in minutes per unit (km or mi)
      const pace = runDataService.calculatePace(run.distance, run.duration, distanceUnit);
      
      // Apply reasonable limits (2-20 min/unit)
      const validPace = !isNaN(pace) && pace >= 2 && pace <= 20;
      
      if (validPace) {
        totalPace += pace;
        validPaceCount++;
        
        if (pace < newStats.fastestPace) {
          newStats.fastestPace = pace;
        }
        
        // Personal bests by distance
        const fiveKmInMeters = 5000;
        const tenKmInMeters = 10000;
        const halfMarathonInMeters = 21097.5;
        const marathonInMeters = 42195;
        
        if (run.distance >= fiveKmInMeters && pace < newStats.personalBests['5k']) {
          newStats.personalBests['5k'] = pace;
        }
        if (run.distance >= tenKmInMeters && pace < newStats.personalBests['10k']) {
          newStats.personalBests['10k'] = pace;
        }
        if (run.distance >= halfMarathonInMeters && pace < newStats.personalBests['halfMarathon']) {
          newStats.personalBests['halfMarathon'] = pace;
        }
        if (run.distance >= marathonInMeters && pace < newStats.personalBests['marathon']) {
          newStats.personalBests['marathon'] = pace;
        }
      }
      
      // This week and month distances
      const runDate = new Date(run.date);
      if (!isNaN(runDate.getTime())) {
        // Format the date as YYYY-MM-DD for consistent grouping
        const dateKey = runDate.toISOString().split('T')[0];
        runsByDate[dateKey] = true;
        
        // Check if run is from this week
        if (runDate >= startOfWeek) {
          newStats.thisWeekDistance += run.distance;
        }
        
        // Check if run is from this month
        if (runDate >= startOfMonth) {
          newStats.thisMonthDistance += run.distance;
        }
      }

      // Calculate calories burned
      const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration);
      newStats.totalCaloriesBurned += caloriesBurned;
    });

    // Calculate average pace if we have valid pace data
    if (validPaceCount > 0) {
      newStats.averagePace = totalPace / validPaceCount;
    }
    
    // Calculate average calories per km
    if (newStats.totalDistance > 0) {
      const distanceInKm = newStats.totalDistance / 1000;
      newStats.averageCaloriesPerKm = newStats.totalCaloriesBurned / distanceInKm;
    }
    
    // Reset PBs if they weren't set
    if (newStats.personalBests['5k'] === 99999) newStats.personalBests['5k'] = 0;
    if (newStats.personalBests['10k'] === 99999) newStats.personalBests['10k'] = 0;
    if (newStats.personalBests['halfMarathon'] === 99999) newStats.personalBests['halfMarathon'] = 0;
    if (newStats.personalBests['marathon'] === 99999) newStats.personalBests['marathon'] = 0;
    
    // Calculate streaks
    const dates = Object.keys(runsByDate).sort();
    if (dates.length > 0) {
      // Convert date strings to timestamps for easier comparison
      const timestamps = dates.map(d => new Date(d).getTime());
      
      // Current streak
      let currentStreak = 0;
      const yesterday = today - 86400000; // 24 hours in milliseconds
      
      // Check if there's a run today or yesterday to start the streak
      if (timestamps.includes(today) || timestamps.includes(yesterday)) {
        currentStreak = 1;
        
        // Go back in time day by day
        let checkDate = yesterday;
        while (true) {
          checkDate -= 86400000; // Go back one day
          
          // If we find a run on this day, increment streak
          if (timestamps.includes(checkDate)) {
            currentStreak++;
          } else {
            // Streak is broken
            break;
          }
        }
      }
      
      // Best streak
      let bestStreak = 0;
      let currentBestStreak = 1;
      
      for (let i = 1; i < timestamps.length; i++) {
        // Check if dates are consecutive
        if (timestamps[i] - timestamps[i-1] <= 86400000) {
          currentBestStreak++;
        } else {
          // Update best streak and reset current
          bestStreak = Math.max(bestStreak, currentBestStreak);
          currentBestStreak = 1;
        }
      }
      
      // Update best streak one more time after the loop
      bestStreak = Math.max(bestStreak, currentBestStreak);
      
      newStats.currentStreak = currentStreak;
      newStats.bestStreak = bestStreak;
    }
    
    setStats(newStats);
  }, [distanceUnit, calculateCaloriesBurned]);

  return {
    stats,
    calculateStats,
    calculateCaloriesBurned
  };
}; 