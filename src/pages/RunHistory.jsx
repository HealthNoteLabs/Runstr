import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAndPublishEvent } from '../utils/nostr';
import { useRunStats } from '../hooks/useRunStats';
import { useRunProfile } from '../hooks/useRunProfile';
import { formatTime, displayDistance, formatElevation, formatDate } from '../utils/formatters';
import runDataService from '../services/RunDataService';

export const RunHistory = () => {
  const navigate = useNavigate();
  // State for run history
  const [runHistory, setRunHistory] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [additionalContent, setAdditionalContent] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState(() => localStorage.getItem('distanceUnit') || 'km');
  const [npub, setNpub] = useState(() => localStorage.getItem('currentNpub'));
  const [publishEnabled, setPublishEnabled] = useState(false);

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
      const newStats = runDataService.calculateStats();
      calculateStats(sortedRuns, profile);
    } catch (error) {
      console.error('Error loading run history:', error);
      setRunHistory([]);
    }
  };

  const handleDeleteRun = async (runId) => {
    if (window.confirm('Are you sure you want to delete this run? This action cannot be undone.')) {
      try {
        const success = runDataService.deleteRun(runId);
        if (success) {
          // Show success message
          if (window.Android && window.Android.showToast) {
            window.Android.showToast('Run deleted successfully');
          } else {
            alert('Run deleted successfully');
          }
          
          // Reload history to update UI
          loadRunHistory();
        } else {
          throw new Error('Failed to delete run');
        }
      } catch (error) {
        console.error('Error deleting run:', error);
        
        if (window.Android && window.Android.showToast) {
          window.Android.showToast('Failed to delete run: ' + error.message);
        } else {
          alert('Failed to delete run: ' + error.message);
        }
      }
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
        <div className="flex justify-center my-4">
          <div className="flex rounded-full bg-[#1a222e] p-1">
            <button 
              className={`px-6 py-2 rounded-full text-sm ${distanceUnit === 'km' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
              onClick={() => distanceUnit !== 'km' && toggleDistanceUnit()}
            >
              Kilometers
            </button>
            <button 
              className={`px-6 py-2 rounded-full text-sm ${distanceUnit === 'mi' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
              onClick={() => distanceUnit !== 'mi' && toggleDistanceUnit()}
            >
              Miles
            </button>
          </div>
        </div>
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
