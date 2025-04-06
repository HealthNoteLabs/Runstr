import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  createAndPublishEvent, 
  formatRunEvent, 
  formatEnhancedRunEvent, 
  formatHealthProfileEvent, 
  formatHealthRecordEvent 
} from '../utils/nostr';
import { useRunStats } from '../hooks/useRunStats';
import { useRunProfile } from '../hooks/useRunProfile';
import { useActivityType } from '../contexts/ActivityTypeContext';
import { formatTime, displayDistance, formatElevation, formatDate } from '../utils/formatters';
import runDataService from '../services/RunDataService';

export const RunHistory = () => {
  const navigate = useNavigate();
  const { activityType, getActivityTypeLabel } = useActivityType();
  const activityLabel = getActivityTypeLabel();
  const activityLabelLower = activityLabel.toLowerCase();
  
  // State for run history
  const [runHistory, setRunHistory] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState(() => localStorage.getItem('distanceUnit') || 'km');

  // Get user profile and distance unit from custom hooks
  const { userProfile: profile } = useRunProfile();

  const {
    stats,
    calculateStats,
    calculateCaloriesBurned
  } = useRunStats(runHistory, profile);

  // Load run history on component mount and listen for updates
  useEffect(() => {
    loadRunHistory();
    
    // Add event listener for run history updates
    const handleRunHistoryUpdate = () => {
      console.log("Run history update event received");
      loadRunHistory();
    };
    
    document.addEventListener('runHistoryUpdated', handleRunHistoryUpdate);
    document.addEventListener('runCompleted', handleRunHistoryUpdate);
    
    return () => {
      document.removeEventListener('runHistoryUpdated', handleRunHistoryUpdate);
      document.removeEventListener('runCompleted', handleRunHistoryUpdate);
    };
  }, []);

  // Listen for changes to the distance unit in localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const newUnit = localStorage.getItem('distanceUnit') || 'km';
      if (newUnit !== distanceUnit) {
        setDistanceUnit(newUnit);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Using a shorter interval for Android optimization
    const checkInterval = setInterval(() => {
      // Check for unit changes
      const currentUnit = localStorage.getItem('distanceUnit') || 'km';
      if (currentUnit !== distanceUnit) {
        setDistanceUnit(currentUnit);
      }
      
      // Check for run history changes
      const storedRuns = localStorage.getItem('runHistory');
      if (storedRuns) {
        const parsedRuns = JSON.parse(storedRuns);
        if (parsedRuns.length !== runHistory.length) {
          loadRunHistory();
        }
      }
    }, 1500); // Increased from 1000ms to 1500ms to reduce battery usage

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, [distanceUnit, runHistory.length, setDistanceUnit]);

  // Setup local storage event listener
  useEffect(() => {
    // Listen for storage changes
    const handleStorageChange = () => {
      // Update distance unit if it changed in another component
      setDistanceUnit(localStorage.getItem('distanceUnit') || 'km');
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Load and process run history from localStorage
  const loadRunHistory = () => {
    try {
      // Use RunDataService to get active runs
      const activeRuns = runDataService.getActiveRuns();
      
      // Sort runs by date (newest first)
      const sortedRuns = [...activeRuns].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });

      setRunHistory(sortedRuns);
      
      // Recalculate stats
      calculateStats(sortedRuns, profile);
    } catch (error) {
      console.error('Error loading run history:', error);
      setRunHistory([]);
    }
  };

  const handleDeleteRun = async (runId) => {
    if (window.confirm(`Are you sure you want to delete this ${activityLabelLower}? This action cannot be undone.`)) {
      try {
        const success = runDataService.deleteRun(runId);
        if (success) {
          // Show success message
          if (window.Android && window.Android.showToast) {
            window.Android.showToast(`${activityLabel} deleted successfully`);
          } else {
            alert(`${activityLabel} deleted successfully`);
          }
          
          // Reload history to update UI
          loadRunHistory();
        } else {
          throw new Error(`Failed to delete ${activityLabelLower}`);
        }
      } catch (error) {
        console.error(`Error deleting ${activityLabelLower}:`, error);
        
        if (window.Android && window.Android.showToast) {
          window.Android.showToast(`Failed to delete ${activityLabelLower}: ` + error.message);
        } else {
          alert(`Failed to delete ${activityLabelLower}: ` + error.message);
        }
      }
    }
  };

  const handlePostToNostr = async (run) => {
    try {
      const content = `
Just completed a ${activityLabelLower} with Runstr! 🏃‍♂️💨

⏱️ Duration: ${formatTime(run.duration)}
📏 Distance: ${displayDistance(run.distance, distanceUnit)}
⚡ Pace: ${(run.duration / 60 / (distanceUnit === 'km' ? run.distance/1000 : run.distance/1609.344)).toFixed(2)} min/${distanceUnit}
🔥 Calories: ${calculateCaloriesBurned(run.distance, run.duration)} kcal
${run.elevation ? `\n🏔️ Elevation Gain: ${formatElevation(run.elevation.gain, distanceUnit)}\n📉 Elevation Loss: ${formatElevation(run.elevation.loss, distanceUnit)}` : ''}
#Runstr #${activityLabel}
`.trim();

      const eventTemplate = {
        kind: 1,
        content: content,
        tags: [
          ['t', 'Runstr'],
          ['t', activityLabel]
        ]
      };

      await createAndPublishEvent(eventTemplate);
      
      // Show success message
      if (window.Android && window.Android.showToast) {
        window.Android.showToast(`Successfully shared ${activityLabelLower} to Nostr!`);
      } else {
        alert(`Successfully shared ${activityLabelLower} to Nostr!`);
      }
      
      setShowModal(false);
    } catch (error) {
      console.error(`Error sharing ${activityLabelLower} to Nostr:`, error);
      
      if (window.Android && window.Android.showToast) {
        window.Android.showToast(`Failed to share ${activityLabelLower} to Nostr: ` + error.message);
      } else {
        alert(`Failed to share ${activityLabelLower} to Nostr: ` + error.message);
      }
    }
  };

  const handleSaveToNostr = async (run) => {
    try {
      console.log(`Running handleSaveToNostr with ${activityLabelLower}:`, run);
      
      // Check if the run has all required fields
      if (!run || !run.distance || !run.duration) {
        console.error(`${activityLabel} is missing required fields:`, run);
        throw new Error(`${activityLabel} is missing required data`);
      }
      
      // Ensure run has elevation data
      if (!run.elevation) {
        run.elevation = { gain: 0, loss: 0 };
      }
      
      console.log('formatRunEvent function available:', typeof formatRunEvent === 'function');
      
      const runEvent = formatRunEvent(run, distanceUnit);
      console.log('Generated runEvent:', runEvent);
      
      await createAndPublishEvent(runEvent);
      
      // Show success message
      if (window.Android && window.Android.showToast) {
        window.Android.showToast(`Successfully saved ${activityLabelLower} to Nostr!`);
      } else {
        alert(`Successfully saved ${activityLabelLower} to Nostr!`);
      }
    } catch (error) {
      console.error(`Detailed error in handleSaveToNostr for ${activityLabelLower}:`, error);
      
      if (window.Android && window.Android.showToast) {
        window.Android.showToast(`Failed to save ${activityLabelLower} to Nostr: ` + error.message);
      } else {
        alert(`Failed to save ${activityLabelLower} to Nostr: ` + error.message);
      }
    }
  };

  const handleSaveHealthData = async (run) => {
    try {
      console.log(`Running handleSaveHealthData with ${activityLabelLower}:`, run);
      
      // Check if the run has all required fields
      if (!run || !run.distance || !run.duration) {
        console.error(`${activityLabel} is missing required fields:`, run);
        throw new Error(`${activityLabel} is missing required data`);
      }
      
      // Ensure run has elevation data
      if (!run.elevation) {
        run.elevation = { gain: 0, loss: 0 };
      }
      
      console.log('formatEnhancedRunEvent function available:', typeof formatEnhancedRunEvent === 'function');
      
      // Calculate calories burned
      const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration);
      
      // Create enhanced workout record with calories
      const workoutEvent = formatEnhancedRunEvent(run, caloriesBurned, distanceUnit);
      console.log('Generated workoutEvent:', workoutEvent);
      
      const workoutResult = await createAndPublishEvent(workoutEvent);
      
      // Get user profile data
      const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      if (userProfile.weight && userProfile.height && userProfile.gender) {
        const healthProfileEvent = formatHealthProfileEvent(userProfile);
        await createAndPublishEvent(healthProfileEvent);
      }
      
      // Create health record
      const healthData = {
        weight: userProfile.weight || 0,
        restingCalories: Math.round(caloriesBurned * 0.2) // Simplified calculation
      };
      
      const healthRecordEvent = formatHealthRecordEvent(healthData, workoutResult.id);
      await createAndPublishEvent(healthRecordEvent);
      
      // Show success message
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Successfully saved health data to Nostr!');
      } else {
        alert('Successfully saved health data to Nostr!');
      }
    } catch (error) {
      console.error('Detailed error in handleSaveHealthData:', error);
      
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to save health data to Nostr: ' + error.message);
      } else {
        alert('Failed to save health data to Nostr: ' + error.message);
      }
    }
  };

  return (
    <div className="run-history">
      <div className="stats-overview">
        <h2>STATS</h2>
        <button 
          className="profile-btn" 
          onClick={() => navigate('/profile')}
          title="Update your profile for accurate calorie calculations"
        >
          Update Profile
        </button>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Distance</h3>
            <p>{displayDistance(stats.totalDistance, distanceUnit)}</p>
          </div>
          <div className="stat-card">
            <h3>Total {activityLabel}s</h3>
            <p>{stats.totalRuns}</p>
          </div>
          <div className="stat-card">
            <h3>Current Streak</h3>
            <p>{stats.currentStreak} days</p>
          </div>
          <div className="stat-card">
            <h3>Average Pace</h3>
            <p>
              {stats.averagePace === 0 
                ? '-' 
                : `${Math.floor(stats.averagePace)}:${Math.round(stats.averagePace % 1 * 60).toString().padStart(2, '0')}`}{' '}
              min/{distanceUnit}
            </p>
          </div>
          <div className="stat-card">
            <h3>Fastest Pace</h3>
            <p>
              {stats.fastestPace === 0
                ? '-'
                : `${Math.floor(stats.fastestPace)}:${Math.round(stats.fastestPace % 1 * 60).toString().padStart(2, '0')}`}{' '}
              min/{distanceUnit}
            </p>
          </div>
          <div className="stat-card">
            <h3>Longest {activityLabel}</h3>
            <p>{displayDistance(stats.longestRun, distanceUnit)}</p>
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
              <h4>Avg. Calories per {distanceUnit.toUpperCase()}</h4>
              <p>{Math.round(stats.averageCaloriesPerKm)} kcal</p>
            </div>
          </div>
        </div>

        <div className="recent-stats">
          <h3>Recent Activity</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>This Week</h4>
              <p>{displayDistance(stats.thisWeekDistance, distanceUnit)}</p>
            </div>
            <div className="stat-card">
              <h4>This Month</h4>
              <p>{displayDistance(stats.thisMonthDistance, distanceUnit)}</p>
            </div>
          </div>
        </div>

        <div className="personal-bests">
          <h3>Personal Bests</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>5K</h4>
              <p>
                {stats.personalBests['5k'] === 0
                  ? '-'
                  : `${Math.floor(stats.personalBests['5k'])}:${Math.round(stats.personalBests['5k'] % 1 * 60).toString().padStart(2, '0')}`}{' '}
                min/{distanceUnit}
              </p>
            </div>
            <div className="stat-card">
              <h4>10K</h4>
              <p>
                {stats.personalBests['10k'] === 0
                  ? '-'
                  : `${Math.floor(stats.personalBests['10k'])}:${Math.round(stats.personalBests['10k'] % 1 * 60).toString().padStart(2, '0')}`}{' '}
                min/{distanceUnit}
              </p>
            </div>
            <div className="stat-card">
              <h4>Half Marathon</h4>
              <p>
                {stats.personalBests['halfMarathon'] === 0
                  ? '-'
                  : `${Math.floor(stats.personalBests['halfMarathon'])}:${Math.round(stats.personalBests['halfMarathon'] % 1 * 60).toString().padStart(2, '0')}`}{' '}
                min/{distanceUnit}
              </p>
            </div>
            <div className="stat-card">
              <h4>Marathon</h4>
              <p>
                {stats.personalBests['marathon'] === 0
                  ? '-'
                  : `${Math.floor(stats.personalBests['marathon'])}:${Math.round(stats.personalBests['marathon'] % 1 * 60).toString().padStart(2, '0')}`}{' '}
                min/{distanceUnit}
              </p>
            </div>
          </div>
        </div>

        <div className="elevation-stats-overview">
          <h3>Elevation Data</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Total Elevation Gain</h4>
              <p>
                {formatElevation(
                  runHistory.reduce((sum, run) => sum + (run.elevation?.gain || 0), 0),
                  distanceUnit
                )}
              </p>
            </div>
            <div className="stat-card">
              <h4>Total Elevation Loss</h4>
              <p>
                {formatElevation(
                  runHistory.reduce((sum, run) => sum + (run.elevation?.loss || 0), 0),
                  distanceUnit
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <h2>{activityLabel} History</h2>
      {runHistory.length === 0 ? (
        <p>No {activityLabelLower}s recorded yet</p>
      ) : (
        <ul className="history-list space-y-4 px-4">
          {runHistory.map((run) => {
            const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration);
            
            // Calculate pace with the consistent service method
            const pace = runDataService.calculatePace(run.distance, run.duration, distanceUnit).toFixed(2);
            
            return (
              <li key={run.id} className="history-item bg-[#1a222e] rounded-lg p-4">
                <div className="run-date text-lg font-semibold text-indigo-400 mb-2">{formatDate(run.date)}</div>
                <div className="run-details grid grid-cols-2 gap-2 mb-4 text-sm text-gray-300">
                  <span>Duration: {formatTime(run.duration)}</span>
                  <span>Distance: {displayDistance(run.distance, distanceUnit)}</span>
                  <span>
                    Pace: {pace} min/{distanceUnit}
                  </span>
                  <span>Calories: {caloriesBurned} kcal</span>
                  {run.elevation && (
                    <>
                      <span>
                        Elevation Gain: {formatElevation(run.elevation.gain, distanceUnit)}
                      </span>
                      <span>
                        Elevation Loss: {formatElevation(run.elevation.loss, distanceUnit)}
                      </span>
                    </>
                  )}
                </div>
                <div className="run-actions flex flex-wrap gap-2 justify-end">
                  <button
                    onClick={() => handlePostToNostr(run)}
                    className="text-xs text-indigo-400 flex items-center hover:text-indigo-300 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share
                  </button>
                  <button
                    onClick={() => handleSaveToNostr(run)}
                    className="text-xs text-indigo-400 flex items-center hover:text-indigo-300 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save to Nostr
                  </button>
                  <button
                    onClick={() => handleSaveHealthData(run)}
                    className="text-xs text-indigo-400 flex items-center hover:text-indigo-300 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    Save Health Data
                  </button>
                  <button
                    onClick={() => handleDeleteRun(run.id)}
                    className="text-xs text-red-400 flex items-center hover:text-red-300 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
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
            <h3>Post {activityLabel} to Nostr</h3>
            <textarea
              placeholder="Add any additional comments or hashtags..."
              rows={4}
            />
            <div className="modal-buttons">
              <button>
                Post
              </button>
              <button onClick={() => setShowModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
