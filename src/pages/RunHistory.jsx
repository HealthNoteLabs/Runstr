import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDistanceUnit } from '../contexts/DistanceUnitContext';
import { displayDistance, formatTime, formatElevation, formatDate } from '../utils/formatters';
import { createAndPublishEvent } from '../utils/nostr';
import { useRunStats } from '../hooks/useRunStats';
import { useRunProfile } from '../hooks/useRunProfile';
import runDataService from '../services/RunDataService';
import DeleteConfirmationDialog from '../components/DeleteConfirmationDialog';
import '../styles/components/DeleteConfirmationDialog.css';
import '../styles/components/Toast.css';
import '../styles/components/RunHistory.css';

export const RunHistory = () => {
  const navigate = useNavigate();
  const { distanceUnit } = useDistanceUnit();
  const [runHistory, setRunHistory] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const [additionalContent, setAdditionalContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [runToDelete, setRunToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get user profile and distance unit from custom hooks
  const { profile } = useRunProfile();
  const { stats, calculateStats } = useRunStats(runHistory, profile);

  // Load run history on component mount and listen for updates
  useEffect(() => {
    const storedRuns = localStorage.getItem('runHistory');
    if (storedRuns) {
      try {
        const parsedRuns = JSON.parse(storedRuns);
        setRunHistory(parsedRuns);
        calculateStats(parsedRuns);
      } catch (error) {
        console.error('Error loading run history:', error);
      }
    }

    // Listen for run completed events
    const handleRunCompleted = () => {
      const updatedRuns = localStorage.getItem('runHistory');
      if (updatedRuns) {
        try {
          const parsedRuns = JSON.parse(updatedRuns);
          setRunHistory(parsedRuns);
          calculateStats(parsedRuns);
        } catch (error) {
          console.error('Error loading run history:', error);
        }
      }
    };

    // Listen for run deleted events
    const handleRunDeleted = (event) => {
      const { updatedRuns } = event.detail;
      setRunHistory(updatedRuns);
      calculateStats(updatedRuns);
    };

    document.addEventListener('runCompleted', handleRunCompleted);
    document.addEventListener('runDeleted', handleRunDeleted);

    return () => {
      document.removeEventListener('runCompleted', handleRunCompleted);
      document.removeEventListener('runDeleted', handleRunDeleted);
    };
  }, [calculateStats]);

  const handleDeleteRequest = (run) => {
    setRunToDelete(run);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!runToDelete) return;
    
    setIsDeleting(true);
    
    try {
      // Delete the run using RunDataService
      const success = runDataService.deleteRun(runToDelete.id);
      
      if (success) {
        // Update local state
        const updatedRuns = runHistory.filter(run => run.id !== runToDelete.id);
        setRunHistory(updatedRuns);
        
        // Recalculate stats
        calculateStats(updatedRuns);
        
        // Show success message
        showToast('Run successfully deleted');
      } else {
        showToast('Failed to delete run', 'error');
      }
    } catch (error) {
      console.error('Error deleting run:', error);
      showToast('Error deleting run', 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setRunToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false);
    setRunToDelete(null);
  };

  const showToast = (message, type = 'success') => {
    // Create and show a toast notification
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
      toast.remove();
    }, 3000);
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
      const caloriesBurned = calculateStats(run.distance, run.duration);
      
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
      {runHistory.length > 0 ? (
        <ul className="history-list">
          {runHistory.map((run) => {
            const caloriesBurned = calculateStats(run.distance, run.duration);
            const activityMode = run.activityMode || 'run';
            
            // Calculate pace with the consistent service method
            const pace = runDataService.calculatePace(run.distance, run.duration, distanceUnit);
            
            return (
              <li 
                key={run.id} 
                className={`history-item ${isDeleting && run.id === runToDelete?.id ? 'deleting' : ''}`}
              >
                <div className="run-date">{formatDate(run.date)}</div>
                <div className="run-details">
                  <span>Duration: {formatTime(run.duration)}</span>
                  <span>Distance: {displayDistance(run.distance, distanceUnit)}</span>
                  <span>
                    {activityMode === 'walk' ? 'Speed' : 'Pace'}: {runDataService.formatPace(pace, distanceUnit, activityMode)}
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
                    disabled={isDeleting}
                  >
                    Share to Nostr
                  </button>
                  <button
                    onClick={() => handleDeleteRequest(run)}
                    className="delete-btn"
                    disabled={isDeleting}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="no-runs">No runs recorded yet</p>
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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        run={runToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        distanceUnit={distanceUnit}
      />
    </div>
  );
};
