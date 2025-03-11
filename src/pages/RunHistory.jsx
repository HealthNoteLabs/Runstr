import { useState, useEffect, useCallback } from 'react';
import { publishToNostr } from '../utils/nostr';

export const RunHistory = () => {
  const [runHistory, setRunHistory] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [additionalContent, setAdditionalContent] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [distanceUnit] = useState(
    () => localStorage.getItem('distanceUnit') || 'km'
  );
  const [userProfile, setUserProfile] = useState(() => {
    const storedProfile = localStorage.getItem('userProfile');
    return storedProfile
      ? JSON.parse(storedProfile)
      : {
          weight: 70, // default weight in kg
          heightFeet: 5, // default height in feet
          heightInches: 7, // default height in inches
          heightCm: 170, // store equivalent in cm for calculations
          gender: 'male', // default gender
          age: 30, // default age
          fitnessLevel: 'intermediate' // default fitness level
        };
  });
  const [stats, setStats] = useState({
    totalDistance: 0,
    totalRuns: 0,
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
      halfMarathon: Infinity,
      marathon: Infinity
    }
  });

  useEffect(() => {
    loadRunHistory();
  }, []);

  // Format date to a consistent readable format
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return new Date().toLocaleDateString();
      }
      
      // Check if date is in the future (use current date instead)
      const now = new Date();
      if (date > now) {
        return now.toLocaleDateString();
      }
      
      return date.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return new Date().toLocaleDateString();
    }
  };

  // Calculate calories burned based on user profile and run data
  const calculateCaloriesBurned = useCallback((distance, duration, userProfile) => {
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

    // Calculate pace in minutes per km
    const pace = duration / 60 / distance;
    
    // Get MET value based on pace
    const met = getPaceMET(pace);
    
    // Calculate base calories
    // Formula: MET * weight in kg * duration in hours
    const durationHours = duration / 3600;
    const baseCalories = met * userProfile.weight * durationHours;
    
    // Apply adjustments
    const adjustedCalories = 
      baseCalories * 
      fitnessAdjustment[userProfile.fitnessLevel] * 
      genderAdjustment[userProfile.gender] * 
      getAgeAdjustment(userProfile.age);
    
    return Math.round(adjustedCalories);
  }, []);

  const calculateStats = useCallback(() => {
    // Skip calculation if there are no runs
    if (runHistory.length === 0) {
      setStats({
        totalDistance: 0,
        totalRuns: 0,
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
          halfMarathon: Infinity,
          marathon: Infinity
        }
      });
      return;
    }
    
    const newStats = {
      totalDistance: 0,
      totalRuns: runHistory.length,
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
        halfMarathon: Infinity,
        marathon: Infinity
      }
    };

    let totalPace = 0;
    let totalCalories = 0;
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    // Create date objects for all runs (once)
    const runsWithDates = runHistory.map(run => ({
      ...run,
      dateObj: new Date(run.date)
    }));
    
    // Sort runs by date (newest first) for streak calculation
    const sortedRuns = [...runsWithDates].sort(
      (a, b) => b.dateObj - a.dateObj
    );

    // Calculate current streak - consecutive days of running from the most recent
    let streak = 0;
    let currentDate = sortedRuns.length > 0 ? sortedRuns[0].dateObj : null;
    
    // Map to track which days have runs
    const runDays = new Map();
    
    // First mark all days that have runs
    sortedRuns.forEach(run => {
      const dateStr = run.dateObj.toDateString();
      runDays.set(dateStr, true);
    });
    
    // Now calculate streak by checking consecutive days
    if (currentDate) {
      // Initialize with the first day
      streak = 1;
      
      // Start checking from yesterday
      let checkDate = new Date(currentDate);
      checkDate.setDate(checkDate.getDate() - 1);
      
      // Check consecutive days backwards
      while (runDays.has(checkDate.toDateString())) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }
    
    newStats.currentStreak = streak;

    // Process each run for other stats
    runHistory.forEach((run) => {
      // Skip runs with invalid data
      if (isNaN(run.distance) || run.distance <= 0 || 
          isNaN(run.duration) || run.duration <= 0) {
        return;
      }
      
      // Total distance
      newStats.totalDistance += run.distance;

      // Longest run
      if (run.distance > newStats.longestRun) {
        newStats.longestRun = run.distance;
      }

      // Pace calculations - apply reasonable limits
      // Most elite runners do 2-3 min/km, normal range 4-10 min/km
      // 1 min/km would be 60 km/h which is impossible running speed
      const pace = run.duration / 60 / run.distance;
      
      // Minimum valid pace is 2 min/km, maximum is 20 min/km
      const validPace = !isNaN(pace) && pace >= 2 && pace <= 20;
      
      if (validPace) {
        totalPace += pace;
        if (pace < newStats.fastestPace) {
          newStats.fastestPace = pace;
        }
        
        // Personal bests by distance
        if (run.distance >= 5 && pace < newStats.personalBests['5k']) {
          newStats.personalBests['5k'] = pace;
        }
        if (run.distance >= 10 && pace < newStats.personalBests['10k']) {
          newStats.personalBests['10k'] = pace;
        }
        if (run.distance >= 21.0975 && pace < newStats.personalBests['halfMarathon']) {
          newStats.personalBests['halfMarathon'] = pace;
        }
        if (run.distance >= 42.195 && pace < newStats.personalBests['marathon']) {
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
      const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration, userProfile);
      if (!isNaN(caloriesBurned)) {
        totalCalories += caloriesBurned;
      }
    });

    // Calculate average pace only if there's at least one valid run
    const validRunCount = runHistory.filter(run => 
      !isNaN(run.distance) && run.distance > 0 && 
      !isNaN(run.duration) && run.duration > 0 &&
      run.duration / 60 / run.distance >= 2 && run.duration / 60 / run.distance <= 20
    ).length;
    
    newStats.averagePace = validRunCount > 0 ? totalPace / validRunCount : 0;
    
    // If fastestPace is still Infinity, set it to 0
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
    
    // Calculate average calories per km
    newStats.averageCaloriesPerKm = newStats.totalDistance > 0 
      ? totalCalories / newStats.totalDistance 
      : 0;

    setStats(newStats);
  }, [runHistory, calculateCaloriesBurned, userProfile]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const loadRunHistory = () => {
    const storedRuns = localStorage.getItem('runHistory');
    if (storedRuns) {
      try {
        // Parse stored runs
        const parsedRuns = JSON.parse(storedRuns);
        
        // Create a map to store unique runs by their date and metrics
        // This will help identify and remove complete duplicates
        const uniqueRunsMap = new Map();
        const seenIds = new Set();
        const now = new Date();
        
        // First pass: identify unique runs and fix missing IDs, future dates, and unrealistic values
        const fixedRuns = parsedRuns.reduce((acc, run) => {
          // Fix future dates - replace with current date
          let runDate = new Date(run.date);
          if (isNaN(runDate.getTime()) || runDate > now) {
            run.date = now.toLocaleDateString();
          }
          
          // Fix unrealistic distance values (>100 km is extremely unlikely for normal runs)
          // World record for 24-hour run is ~300 km, so 100 km is already very generous
          const MAX_REALISTIC_DISTANCE = 100; // in km
          if (isNaN(run.distance) || run.distance <= 0) {
            run.distance = 5; // Default to 5 km for invalid distances
          } else if (run.distance > MAX_REALISTIC_DISTANCE) {
            run.distance = Math.min(run.distance, MAX_REALISTIC_DISTANCE);
          }
          
          // Fix unrealistic durations (>24 hours is extremely unlikely)
          const MAX_DURATION = 24 * 60 * 60; // 24 hours in seconds
          if (isNaN(run.duration) || run.duration <= 0) {
            run.duration = 30 * 60; // Default to 30 minutes for invalid durations
          } else if (run.duration > MAX_DURATION) {
            run.duration = Math.min(run.duration, MAX_DURATION);
          }
          
          // Create a signature for each run based on key properties
          const runSignature = `${run.date}-${run.distance}-${run.duration}`;
          
          // If this is a duplicate entry (same date, distance, duration)
          // and we've already seen it, skip it
          if (uniqueRunsMap.has(runSignature)) {
            return acc;
          }
          
          // Ensure run has a valid ID
          let runWithId = { ...run };
          if (!run.id || seenIds.has(run.id)) {
            runWithId.id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          }
          
          // Mark this ID as seen
          seenIds.add(runWithId.id);
          
          // Mark this run signature as seen
          uniqueRunsMap.set(runSignature, true);
          
          // Add to our accumulator
          acc.push(runWithId);
          return acc;
        }, []);
        
        // Save the fixed runs back to localStorage
        if (fixedRuns.length !== parsedRuns.length || 
            fixedRuns.some((run, i) => 
              run.id !== parsedRuns[i]?.id || 
              run.date !== parsedRuns[i]?.date ||
              run.distance !== parsedRuns[i]?.distance ||
              run.duration !== parsedRuns[i]?.duration
            )) {
          localStorage.setItem('runHistory', JSON.stringify(fixedRuns));
          console.log(`Fixed run history: Removed duplicates and fixed dates, distances, and durations`);
        }
        
        setRunHistory(fixedRuns);
      } catch (error) {
        console.error('Error loading run history:', error);
        // If there's an error, try to recover with an empty array
        setRunHistory([]);
      }
    }
  };

  const handleDeleteRun = (runId) => {
    if (window.confirm('Are you sure you want to delete this run?')) {
      const updatedRuns = runHistory.filter((run) => run.id !== runId);
      localStorage.setItem('runHistory', JSON.stringify(updatedRuns));
      setRunHistory(updatedRuns);
    }
  };

  const handlePostToNostr = (run) => {
    setSelectedRun(run);
    setAdditionalContent('');
    setShowModal(true);
  };

  const handlePostSubmit = async () => {
    if (!selectedRun) return;
    
    setIsPosting(true);
    
    try {
      const run = selectedRun;
      const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration, userProfile);
      
      const content = `
Just completed a run with Runstr! 🏃‍♂️💨

⏱️ Duration: ${formatTime(run.duration)}
📏 Distance: ${displayDistance(run.distance)}
⚡ Pace: ${(run.duration / 60 / run.distance).toFixed(2)} min/${distanceUnit}
🔥 Calories: ${caloriesBurned} kcal
${run.elevation ? `\n🏔️ Elevation Gain: ${formatElevation(run.elevation.gain)}\n📉 Elevation Loss: ${formatElevation(run.elevation.loss)}` : ''}
${additionalContent ? `\n${additionalContent}` : ''}
#Runstr #Running
`.trim();

      const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['t', 'Runstr'],
          ['t', 'Running']
        ],
        content: content
      };

      await publishToNostr(event);
      setShowModal(false);
      setAdditionalContent('');
      alert('Successfully posted to Nostr!');
    } catch (error) {
      console.error('Error posting to Nostr:', error);
      alert('Failed to post to Nostr: ' + error.message);
    } finally {
      setIsPosting(false);
      setShowModal(false);
    }
  };

  const formatTime = (seconds) => {
    // Round to 2 decimal places to avoid excessive precision
    seconds = Math.round(seconds * 100) / 100;
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const displayDistance = (value) => {
    // Ensure value is a number and not too small
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 0.01) {
      return `0.00 ${distanceUnit}`;
    }
    
    // Convert from kilometers to miles if needed
    const converted = distanceUnit === 'mi' ? numValue * 0.621371 : numValue;
    
    // Format to 2 decimal places
    return `${converted.toFixed(2)} ${distanceUnit}`;
  };

  const handleProfileSubmit = () => {
    // Convert feet and inches to cm for storage and calculations
    const heightCm = (userProfile.heightFeet * 30.48) + (userProfile.heightInches * 2.54);
    
    const updatedProfile = {
      ...userProfile,
      heightCm: Math.round(heightCm)
    };
    
    localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
    setUserProfile(updatedProfile);
    setShowProfileModal(false);
    // Recalculate stats with new profile data
    calculateStats();
  };

  const handleProfileChange = (field, value) => {
    console.log(`Updating ${field} to ${value}`); // Add logging for debugging
    
    setUserProfile((prev) => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      // If feet or inches are updated, also update the cm value
      if (field === 'heightFeet' || field === 'heightInches') {
        const feet = field === 'heightFeet' ? value : prev.heightFeet;
        const inches = field === 'heightInches' ? value : prev.heightInches;
        updated.heightCm = Math.round((feet * 30.48) + (inches * 2.54));
      }
      
      console.log('Updated profile:', updated); // Log the updated profile
      return updated;
    });
  };

  // Add a function to format elevation display
  const formatElevation = (meters) => {
    if (!meters || meters === null || isNaN(meters)) return '-- ';
    
    if (distanceUnit === 'mi') {
      // Convert to feet (1 meter = 3.28084 feet)
      return `${Math.round(meters * 3.28084)} ft`;
    } else {
      return `${Math.round(meters)} m`;
    }
  };

  // Add a reset function to clear all run history
  const handleResetAllData = () => {
    if (window.confirm('WARNING: This will permanently delete ALL your run history. Are you sure you want to continue? This cannot be undone.')) {
      if (window.confirm('FINAL WARNING: All runs will be permanently deleted. Confirm reset?')) {
        localStorage.removeItem('runHistory');
        setRunHistory([]);
        alert('All run history has been deleted.');
      }
    }
  };

  return (
    <div className="run-history">
      <div className="stats-overview">
        <h2>STATS</h2>
        <div className="profile-buttons">
          <button 
            className="profile-btn" 
            onClick={() => setShowProfileModal(true)}
            title="Update your profile for accurate calorie calculations"
          >
            Update Profile
          </button>
          <button 
            className="reset-btn" 
            onClick={handleResetAllData}
            title="Reset all run history data"
          >
            Reset Data
          </button>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Distance</h3>
            <p>{displayDistance(stats.totalDistance)}</p>
          </div>
          <div className="stat-card">
            <h3>Total Runs</h3>
            <p>{stats.totalRuns}</p>
          </div>
          <div className="stat-card">
            <h3>Current Streak</h3>
            <p>{stats.currentStreak} days</p>
          </div>
          <div className="stat-card">
            <h3>Average Pace</h3>
            <p>{stats.averagePace.toFixed(2)} min/{distanceUnit}</p>
          </div>
          <div className="stat-card">
            <h3>Fastest Pace</h3>
            <p>
              {stats.fastestPace === Infinity || stats.fastestPace === 0
                ? '-'
                : stats.fastestPace.toFixed(2)}{' '}
              min/{distanceUnit}
            </p>
          </div>
          <div className="stat-card">
            <h3>Longest Run</h3>
            <p>{displayDistance(stats.longestRun)}</p>
          </div>
        </div>

        <div className="calorie-stats">
          <h3>Calorie Tracking</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Total Calories Burned</h4>
              <p>{stats.totalCaloriesBurned.toLocaleString()} kcal</p>
            </div>
            <div className="stat-card">
              <h4>Avg. Calories per KM</h4>
              <p>{Math.round(stats.averageCaloriesPerKm)} kcal</p>
            </div>
          </div>
        </div>

        <div className="recent-stats">
          <h3>Recent Activity</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>This Week</h4>
              <p>{displayDistance(stats.thisWeekDistance)}</p>
            </div>
            <div className="stat-card">
              <h4>This Month</h4>
              <p>{displayDistance(stats.thisMonthDistance)}</p>
            </div>
          </div>
        </div>

        <div className="personal-bests">
          <h3>Personal Bests</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>5K</h4>
              <p>
                {stats.personalBests['5k'] === Infinity || stats.personalBests['5k'] === 0
                  ? '-'
                  : stats.personalBests['5k'].toFixed(2)}{' '}
                min/{distanceUnit}
              </p>
            </div>
            <div className="stat-card">
              <h4>10K</h4>
              <p>
                {stats.personalBests['10k'] === Infinity || stats.personalBests['10k'] === 0
                  ? '-'
                  : stats.personalBests['10k'].toFixed(2)}{' '}
                min/{distanceUnit}
              </p>
            </div>
            <div className="stat-card">
              <h4>Half Marathon</h4>
              <p>
                {stats.personalBests['halfMarathon'] === Infinity || stats.personalBests['halfMarathon'] === 0
                  ? '-'
                  : stats.personalBests['halfMarathon'].toFixed(2)}{' '}
                min/{distanceUnit}
              </p>
            </div>
            <div className="stat-card">
              <h4>Marathon</h4>
              <p>
                {stats.personalBests['marathon'] === Infinity || stats.personalBests['marathon'] === 0
                  ? '-'
                  : stats.personalBests['marathon'].toFixed(2)}{' '}
                min/{distanceUnit}
              </p>
            </div>
          </div>
        </div>

        {/* Add elevation stats to overview */}
        <div className="elevation-stats-overview">
          <h3>Elevation Data</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Total Elevation Gain</h4>
              <p>
                {formatElevation(
                  runHistory.reduce((sum, run) => sum + (run.elevation?.gain || 0), 0)
                )}
              </p>
            </div>
            <div className="stat-card">
              <h4>Total Elevation Loss</h4>
              <p>
                {formatElevation(
                  runHistory.reduce((sum, run) => sum + (run.elevation?.loss || 0), 0)
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <h2>Run History</h2>
      {runHistory.length === 0 ? (
        <p>No runs recorded yet</p>
      ) : (
        <ul className="history-list">
          {runHistory.map((run) => {
            const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration, userProfile);
            
            // Calculate pace with proper validation
            const pace = run.distance > 0.01 
              ? (run.duration / 60 / run.distance).toFixed(2) 
              : '0.00';
            
            return (
              <li key={run.id} className="history-item">
                <div className="run-date">{formatDate(run.date)}</div>
                <div className="run-details">
                  <span>Duration: {formatTime(run.duration)}</span>
                  <span>Distance: {displayDistance(run.distance)}</span>
                  <span>
                    Pace: {pace} min/{distanceUnit}
                  </span>
                  <span>Calories: {caloriesBurned} kcal</span>
                  {/* Add elevation data */}
                  {run.elevation && (
                    <>
                      <span>
                        Elevation Gain: {formatElevation(run.elevation.gain)}
                      </span>
                      <span>
                        Elevation Loss: {formatElevation(run.elevation.loss)}
                      </span>
                    </>
                  )}
                </div>
                <div className="run-actions">
                  <button
                    onClick={() => handlePostToNostr(run)}
                    className="share-btn"
                  >
                    Share to Nostr
                  </button>
                  <button
                    onClick={() => handleDeleteRun(run.id)}
                    className="delete-btn"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Post Run to Nostr</h3>
            <textarea
              value={additionalContent}
              onChange={(e) => setAdditionalContent(e.target.value)}
              placeholder="Add any additional comments or hashtags..."
              rows={4}
              disabled={isPosting}
            />
            <div className="modal-buttons">
              <button onClick={handlePostSubmit} disabled={isPosting}>
                {isPosting ? 'Posting...' : 'Post'}
              </button>
              <button onClick={() => setShowModal(false)} disabled={isPosting}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="modal-overlay">
          <div className="modal-content profile-modal">
            <h3>User Profile</h3>
            <div className="form-group">
              <label htmlFor="weight">Weight (kg)</label>
              <input
                id="weight"
                type="number"
                value={userProfile.weight}
                onChange={(e) => handleProfileChange('weight', Number(e.target.value))}
              />
            </div>
            <div className="form-group height-inputs">
              <label>Height</label>
              <div className="height-fields">
                <div className="height-field">
                  <input
                    id="heightFeet"
                    type="number"
                    min="0"
                    max="8"
                    value={userProfile.heightFeet}
                    onChange={(e) => handleProfileChange('heightFeet', Number(e.target.value))}
                  />
                  <label htmlFor="heightFeet">ft</label>
                </div>
                <div className="height-field">
                  <input
                    id="heightInches"
                    type="number"
                    min="0"
                    max="11"
                    value={userProfile.heightInches}
                    onChange={(e) => handleProfileChange('heightInches', Number(e.target.value))}
                  />
                  <label htmlFor="heightInches">in</label>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="gender">Gender</label>
              <select
                id="gender"
                value={userProfile.gender}
                onChange={(e) => handleProfileChange('gender', e.target.value)}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="age">Age</label>
              <input
                id="age"
                type="number"
                value={userProfile.age}
                onChange={(e) => handleProfileChange('age', Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="fitnessLevel">Fitness Level</label>
              <select
                id="fitnessLevel"
                value={userProfile.fitnessLevel}
                onChange={(e) => handleProfileChange('fitnessLevel', e.target.value)}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div className="modal-buttons">
              <button onClick={handleProfileSubmit}>Save</button>
              <button onClick={() => setShowProfileModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
