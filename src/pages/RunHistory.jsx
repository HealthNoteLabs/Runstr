import { useState, useEffect } from 'react';
import { createAndPublishEvent } from '../utils/nostr';
import { useRunStats } from '../hooks/useRunStats';
import { useRunProfile } from '../hooks/useRunProfile';
import { formatTime, displayDistance, formatElevation, formatDate } from '../utils/formatters';
import runDataService from '../services/RunDataService';

export const RunHistory = () => {
  // State for run history
  const [runHistory, setRunHistory] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [additionalContent, setAdditionalContent] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState(() => localStorage.getItem('distanceUnit') || 'km');

  // Get user profile and distance unit from custom hooks
  const { 
    profile
  } = useRunProfile();

  const {
    stats,
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

  // Load and process run history from localStorage
  const loadRunHistory = () => {
    try {
      // Use RunDataService to get runs instead of directly from localStorage
      const parsedRuns = runDataService.getAllRuns();
      
      // Create a map to store unique runs by their date and metrics
      const uniqueRunsMap = new Map();
      const seenIds = new Set();
      const now = new Date();
      
      // First pass: identify unique runs and fix missing IDs, future dates, and unrealistic values
      const fixedRuns = parsedRuns.reduce((acc, run) => {
        // Fix future dates - replace with current date
        let runDate = new Date(run.date);
        if (isNaN(runDate.getTime()) || runDate > now) {
          run.date = now.toLocaleDateString();
          // Update the run using the service
          runDataService.updateRun(run.id, { date: run.date });
        }
        
        // Fix unrealistic distance values (>100 km is extremely unlikely for normal runs)
        const MAX_REALISTIC_DISTANCE = 100 * 1000; // 100 km in meters
        if (isNaN(run.distance) || run.distance <= 0) {
          run.distance = 5000; // Default to 5 km for invalid distances
          // Update the run using the service
          runDataService.updateRun(run.id, { distance: run.distance });
        } else if (run.distance > MAX_REALISTIC_DISTANCE) {
          run.distance = Math.min(run.distance, MAX_REALISTIC_DISTANCE);
          // Update the run using the service
          runDataService.updateRun(run.id, { distance: run.distance });
        }
        
        // Fix unrealistic durations (>24 hours is extremely unlikely)
        const MAX_DURATION = 24 * 60 * 60; // 24 hours in seconds
        if (isNaN(run.duration) || run.duration <= 0) {
          run.duration = 30 * 60; // Default to 30 minutes for invalid durations
          // Update the run using the service
          runDataService.updateRun(run.id, { duration: run.duration });
        } else if (run.duration > MAX_DURATION) {
          run.duration = Math.min(run.duration, MAX_DURATION);
          // Update the run using the service
          runDataService.updateRun(run.id, { duration: run.duration });
        }
        
        // Skip the rest of the checks if this run doesn't have an ID
        if (!run.id) {
          run.id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          // Update the run using the service
          runDataService.updateRun(run.id, { id: run.id });
        }
        
        // Create a signature for each run based on key properties
        const runSignature = `${run.date}-${run.distance}-${run.duration}`;
        
        // If this is a duplicate entry (same date, distance, duration)
        // and we've already seen it, skip it
        if (uniqueRunsMap.has(runSignature)) {
          return acc;
        }

        // Otherwise, this is a unique run, add it to the map and output
        if (!seenIds.has(run.id)) {
          uniqueRunsMap.set(runSignature, run);
          seenIds.add(run.id);
          acc.push(run);
        }
        
        return acc;
      }, []);

      // Sort runs by date (newest first)
      fixedRuns.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });

      setRunHistory(fixedRuns);
    } catch (error) {
      console.error('Error loading run history:', error);
      setRunHistory([]);
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
      const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration);
      
      const content = `
Just completed a run with Runstr! 🏃‍♂️💨

⏱️ Duration: ${formatTime(run.duration)}
📏 Distance: ${displayDistance(run.distance, distanceUnit)}
⚡ Pace: ${(run.duration / 60 / (distanceUnit === 'km' ? run.distance/1000 : run.distance/1609.344)).toFixed(2)} min/${distanceUnit}
🔥 Calories: ${caloriesBurned} kcal
${run.elevation ? `\n🏔️ Elevation Gain: ${formatElevation(run.elevation.gain, distanceUnit)}\n📉 Elevation Loss: ${formatElevation(run.elevation.loss, distanceUnit)}` : ''}
${additionalContent ? `\n${additionalContent}` : ''}
#Runstr #Running
`.trim();

      // Create the event template for nostr-tools
      const eventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['t', 'Runstr'],
          ['t', 'Running']
        ],
        content: content
      };

      // Use the new createAndPublishEvent function from nostr-tools
      await createAndPublishEvent(eventTemplate);
      
      setShowModal(false);
      setAdditionalContent('');
      
      // Use a toast notification instead of alert for Android
      console.log('Successfully posted to Nostr!');
      // Show Android toast
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Successfully posted to Nostr!');
      } else {
        alert('Successfully posted to Nostr!');
      }
    } catch (error) {
      console.error('Error posting to Nostr:', error);
      
      // Use a toast notification instead of alert for Android
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to post to Nostr: ' + error.message);
      } else {
        alert('Failed to post to Nostr: ' + error.message);
      }
    } finally {
      setIsPosting(false);
      setShowModal(false);
    }
  };

  // Toggle distance unit function
  const toggleDistanceUnit = () => {
    const newUnit = distanceUnit === 'km' ? 'mi' : 'km';
    setDistanceUnit(newUnit);
    localStorage.setItem('distanceUnit', newUnit);
  };

  return (
    <div className="run-history">
      <div className="stats-overview">
        <h2>STATS</h2>
        <div className="unit-toggle-container">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={distanceUnit === 'mi'}
              onChange={toggleDistanceUnit}
            />
            <span className="toggle-slider"></span>
          </label>
          <span className="unit-label">{distanceUnit.toUpperCase()}</span>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Distance</h3>
            <p>{displayDistance(stats.totalDistance, distanceUnit)}</p>
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
            <h3>Longest Run</h3>
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

      <h2>Run History</h2>
      {runHistory.length === 0 ? (
        <p>No runs recorded yet</p>
      ) : (
        <ul className="history-list">
          {runHistory.map((run) => {
            const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration);
            
            // Calculate pace with the consistent service method
            const pace = runDataService.calculatePace(run.distance, run.duration, distanceUnit).toFixed(2);
            
            return (
              <li key={run.id} className="history-item">
                <div className="run-date">{formatDate(run.date)}</div>
                <div className="run-details">
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
    </div>
  );
};
