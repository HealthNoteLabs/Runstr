import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAndPublishEvent, createWorkoutEvent } from '../utils/nostr';
import { useRunStats } from '../hooks/useRunStats';
import { useRunProfile } from '../hooks/useRunProfile';
import { formatTime, displayDistance, formatElevation, formatDate } from '../utils/formatters';
import runDataService from '../services/RunDataService';
import SplitsTable from '../components/SplitsTable';
import { useActivityMode } from '../contexts/ActivityModeContext';
import { useSettings } from '../contexts/SettingsContext';
import { RunHistoryCard } from '../components/RunHistoryCard';

export const RunHistory = () => {
  const navigate = useNavigate();
  const { mode, getActivityText } = useActivityMode();
  const { distanceUnit } = useSettings();
  
  // State for run history
  const [runHistory, setRunHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [additionalContent, setAdditionalContent] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [runToDelete, setRunToDelete] = useState(null);
  // Add state for workout record saving
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);
  const [savingWorkoutRunId, setSavingWorkoutRunId] = useState(null);
  const [workoutSavedRuns, setWorkoutSavedRuns] = useState(new Set());
  // Add state for expanded runs to show splits
  const [expandedRuns, setExpandedRuns] = useState(new Set());

  // Get user profile and distance unit from custom hooks
  const { userProfile: profile } = useRunProfile();

  const {
    stats,
    calculateStats,
    calculateCaloriesBurned
  } = useRunStats(filteredHistory, profile);

  // Filter runs when activity mode or run history changes
  useEffect(() => {
    if (runHistory.length > 0) {
      const filtered = runDataService.getRunsByActivityType(mode);
      setFilteredHistory(filtered);
    }
  }, [runHistory, mode]);

  // Load run history on component mount and listen for updates
  useEffect(() => {
    loadRunHistory();
    
    // Add event listener for run history updates
    const handleRunHistoryUpdate = () => {
      console.log("Run history update event received");
      loadRunHistory();
    };
    
    const handleRunDeleted = (event) => {
      console.log("Run deleted event received", event.detail);
      // If we have the updated runs in the event detail, use them directly
      if (event.detail && event.detail.remainingRuns) {
        setRunHistory(event.detail.remainingRuns);
      } else {
        // Otherwise reload from storage
        loadRunHistory();
      }
    };
    
    document.addEventListener('runHistoryUpdated', handleRunHistoryUpdate);
    document.addEventListener('runCompleted', handleRunHistoryUpdate);
    document.addEventListener('runDeleted', handleRunDeleted);
    
    return () => {
      document.removeEventListener('runHistoryUpdated', handleRunHistoryUpdate);
      document.removeEventListener('runCompleted', handleRunHistoryUpdate);
      document.removeEventListener('runDeleted', handleRunDeleted);
    };
  }, []);

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
        if (isNaN(run.distance)) {
          // Only set default if the distance is invalid (NaN), not if it's legitimately zero
          run.distance = 0; // Default to 0 meters for invalid distances instead of 5km
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

  const handleDeleteClick = (run) => {
    setRunToDelete(run);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!runToDelete) return;
    
    const success = runDataService.deleteRun(runToDelete.id);
    if (success) {
      // Run was successfully deleted, update the local state
      setRunHistory(prevRuns => {
        const updatedRuns = prevRuns.filter(run => run.id !== runToDelete.id);
        // Explicitly recalculate stats with the updated runs
        calculateStats(updatedRuns);
        return updatedRuns;
      });
      
      // Show success message
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Run deleted successfully');
      }
    } else {
      // Error occurred during deletion
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to delete run');
      } else {
        alert('Failed to delete run');
      }
    }
    
    // Close the modal
    setShowDeleteModal(false);
    setRunToDelete(null);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setRunToDelete(null);
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

  const handleSaveWorkoutRecord = async (run) => {
    if (!run) return;
    
    setIsSavingWorkout(true);
    setSavingWorkoutRunId(run.id);
    
    try {
      // Create a workout event with kind 1301 format
      const workoutEvent = createWorkoutEvent(run, distanceUnit);
      
      // Use the existing createAndPublishEvent function
      await createAndPublishEvent(workoutEvent);
      
      // Update UI to show success
      setWorkoutSavedRuns(prev => new Set([...prev, run.id]));
      
      // Show success message
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Workout record saved to Nostr!');
      } else {
        alert('Workout record saved to Nostr!');
      }
    } catch (error) {
      console.error('Error saving workout record:', error);
      
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to save workout record: ' + error.message);
      } else {
        alert('Failed to save workout record: ' + error.message);
      }
    } finally {
      setIsSavingWorkout(false);
      setSavingWorkoutRunId(null);
    }
  };

  // Add toggle function for splits view
  const toggleSplitsView = (e, runId) => {
    e.stopPropagation(); // Prevent triggering parent click events
    const newExpandedRuns = new Set(expandedRuns);
    if (newExpandedRuns.has(runId)) {
      newExpandedRuns.delete(runId);
    } else {
      newExpandedRuns.add(runId);
    }
    setExpandedRuns(newExpandedRuns);
  };

  return (
    <div className="run-history">
      <div className="stats-overview">
        <h2>{getActivityText('history')}</h2>
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
      {filteredHistory.length === 0 ? (
        <p>No runs recorded yet</p>
      ) : (
        <ul className="history-list">
          {filteredHistory.map((run) => {
            const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration);
            
            // Calculate pace with the consistent service method
            const pace = runDataService.calculatePace(run.distance, run.duration, distanceUnit).toFixed(2);
            
            // Check if workout has been saved for this run
            const isWorkoutSaved = workoutSavedRuns.has(run.id);
            
            return (
              <li key={run.id} className="history-item">
                <RunHistoryCard
                  run={run}
                  distanceUnit={distanceUnit}
                  formatDate={formatDate}
                  formatTime={formatTime}
                  displayDistance={displayDistance}
                  formatElevation={formatElevation}
                  pace={pace}
                  caloriesBurned={caloriesBurned}
                  isWorkoutSaved={isWorkoutSaved}
                  isSavingWorkout={isSavingWorkout}
                  savingWorkoutRunId={savingWorkoutRunId}
                  expandedRuns={expandedRuns}
                  onPostToNostr={handlePostToNostr}
                  onSaveWorkout={handleSaveWorkoutRecord}
                  onDeleteClick={handleDeleteClick}
                  onToggleSplits={toggleSplitsView}
                  SplitsTable={SplitsTable}
                />
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

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Deletion</h3>
            <p>Are you sure you want to delete this run?</p>
            {runToDelete && (
              <div className="run-summary">
                <p>Date: {formatDate(runToDelete.date)}</p>
                <p>Distance: {displayDistance(runToDelete.distance, distanceUnit)}</p>
                <p>Duration: {formatTime(runToDelete.duration)}</p>
              </div>
            )}
            <div className="modal-buttons">
              <button 
                onClick={confirmDelete}
                className="delete-btn"
              >
                Delete
              </button>
              <button 
                onClick={cancelDelete}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
