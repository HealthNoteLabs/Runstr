import { useState, useEffect, useCallback } from 'react';

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

  // Calculate calories burned based on user profile and run data
  const calculateCaloriesBurned = useCallback((distance, duration) => {
    // If user profile is missing or invalid, use default values
    if (!userProfile || !userProfile.weight) {
      return Math.round((distance / 1000) * 65); // Very simple estimation
    }
    
    // MET (Metabolic Equivalent of Task) values for running at different intensities
    // The higher the pace, the higher the MET value
    const getPaceMET = (paceMinPerKm) => {
      if (paceMinPerKm < 4) return 11.5; // Very fast
      if (paceMinPerKm < 5) return 10.0; // Fast
      if (paceMinPerKm < 6) return 9.0; // Moderate to fast
      if (paceMinPerKm < 7) return 8.0; // Moderate
      if (paceMinPerKm < 8) return 7.0; // Moderate to slow
      return 6.0; // Slow
    };

    // Adjustments based on fitness level
    const fitnessAdjustment = {
      beginner: 1.0,
      intermediate: 0.95,
      advanced: 0.9
    };

    // Adjustments based on gender (due to different body compositions)
    const genderAdjustment = {
      male: 1.0,
      female: 0.9
    };

    // Age adjustment (generally, calorie burn decreases with age)
    const getAgeAdjustment = (age) => {
      if (age < 20) return 1.10;
      if (age < 30) return 1.05;
      if (age < 40) return 1.0;
      if (age < 50) return 0.95;
      if (age < 60) return 0.90;
      return 0.85;
    };

    // Convert distance to km for calculation
    const distanceInKm = distance / 1000;
    
    // Calculate pace in minutes per km
    const pace = duration / 60 / distanceInKm;
    
    // Get MET value based on pace
    const met = getPaceMET(pace);
    
    // Calculate base calories
    // Formula: MET * weight in kg * duration in hours
    const durationHours = duration / 3600;
    const baseCalories = met * userProfile.weight * durationHours;
    
    // Apply adjustments
    const adjustedCalories = 
      baseCalories * 
      (fitnessAdjustment[userProfile.fitnessLevel] || 1.0) * 
      (genderAdjustment[userProfile.gender] || 1.0) * 
      getAgeAdjustment(userProfile.age || 30);
    
    return Math.round(adjustedCalories);
  }, [userProfile]);

  // Main function to calculate all stats
  const calculateStats = useCallback((runs) => {
    // Skip calculation if there are no runs
    if (!runs || runs.length === 0) {
      setStats({
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
      return;
    }
    
    const newStats = {
      totalDistance: 0,
      totalRuns: runs.length,
      averagePace: 0,
      fastestPace: Infinity,
      longestRun: 0,
      currentStreak: 0,
      bestStreak: 0,
      thisWeekDistance: 0,
      thisMonthDistance: 0,
      totalCaloriesBurned: 0,
      averageCaloriesPerKm: 0,
      personalBests: {
        '5k': Infinity,
        '10k': Infinity,
        'halfMarathon': Infinity,
        'marathon': Infinity
      }
    };

    let totalPace = 0;
    let validPaceCount = 0;
    let totalCalories = 0;
    
    // Set up date references for week and month calculations
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    // Create date objects for all runs (once)
    const runsWithDates = runs.map(run => ({
      ...run,
      dateObj: new Date(run.date)
    }));
    
    // Calculate streak
    // Sort runs by date (newest first) for streak calculation
    const sortedRuns = [...runsWithDates].sort(
      (a, b) => b.dateObj - a.dateObj
    );

    // Map to track which days have runs
    const runDays = new Map();
    
    // Mark all days that have runs
    sortedRuns.forEach(run => {
      const dateStr = run.dateObj.toDateString();
      runDays.set(dateStr, true);
    });
    
    // Calculate current streak
    let streak = 0;
    const todayStr = new Date().toDateString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toDateString();
    
    // Check if there's a run today or yesterday to start counting the streak
    if (runDays.has(todayStr) || runDays.has(yesterdayStr)) {
      // Initialize with the first day (today or yesterday)
      streak = runDays.has(todayStr) ? 1 : 1;
      
      // Start checking from yesterday or the day before
      let checkDate = runDays.has(todayStr) ? yesterdayDate : new Date(yesterdayDate);
      checkDate.setDate(checkDate.getDate() - (runDays.has(todayStr) ? 0 : 1));
      
      // Check consecutive days backwards with a limit to avoid excess processing
      let maxIterations = 365; // Limit to a year
      while (runDays.has(checkDate.toDateString()) && maxIterations-- > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }
    
    newStats.currentStreak = streak;

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

      // Pace calculations
      // Calculate pace in minutes per unit (km or mi)
      const distanceInSelectedUnit = distanceUnit === 'km' ? run.distance / 1000 : run.distance / 1609.344;
      const pace = run.duration / 60 / distanceInSelectedUnit;
      
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
      if (runDate >= weekStart) {
        newStats.thisWeekDistance += run.distance;
      }
      if (runDate >= monthStart) {
        newStats.thisMonthDistance += run.distance;
      }
      
      // Calories
      const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration);
      if (!isNaN(caloriesBurned)) {
        totalCalories += caloriesBurned;
      }
    });

    // Calculate average pace only if there's at least one valid run
    newStats.averagePace = validPaceCount > 0 ? totalPace / validPaceCount : 0;
    
    // Set fastestPace to 0 if it's still Infinity
    if (newStats.fastestPace === Infinity) {
      newStats.fastestPace = 0;
    }

    // Set personal bests to 0 if they remain at Infinity
    Object.keys(newStats.personalBests).forEach(key => {
      if (newStats.personalBests[key] === Infinity) {
        newStats.personalBests[key] = 0;
      }
    });

    // Set total calories burned
    newStats.totalCaloriesBurned = Math.round(totalCalories);
    
    // Calculate average calories per KM/MI
    const distanceInSelectedUnit = distanceUnit === 'km' ? 
      newStats.totalDistance / 1000 : 
      newStats.totalDistance / 1609.344;
      
    newStats.averageCaloriesPerKm = distanceInSelectedUnit > 0 
      ? totalCalories / distanceInSelectedUnit 
      : 0;

    setStats(newStats);
  }, [distanceUnit, calculateCaloriesBurned]);

  return {
    stats,
    distanceUnit,
    setDistanceUnit,
    calculateStats,
    calculateCaloriesBurned
  };
}; 