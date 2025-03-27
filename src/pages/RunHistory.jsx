import { useState, useEffect } from 'react';
import { createAndPublishEvent } from '../utils/nostr';
import { useRunStats } from '../hooks/useRunStats';
import { useRunProfile } from '../hooks/useRunProfile';
import { useRunData } from '../hooks/useRunData';
import { formatDate } from '../utils/formatters';

export const RunHistory = () => {
  // Use our new hook to access run data and functions
  const { 
    getAllRuns, 
    deleteRun, 
    formatDistance, 
    formatTime, 
    formatPace, 
    formatElevation,
    distanceUnit,
    toggleDistanceUnit
  } = useRunData();
  
  // State for run history
  const [runHistory, setRunHistory] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [additionalContent, setAdditionalContent] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // Get user profile from custom hook
  const { profile } = useRunProfile();

  const {
    stats,
    calculateStats,
    calculateCaloriesBurned
  } = useRunStats(runHistory, profile);

  // Load run history from our new data manager
  const loadRunHistory = () => {
    const runs = getAllRuns();
    setRunHistory(runs);
    // Update stats if needed
    if (runs && runs.length > 0) {
      calculateStats(runs);
    }
  };
  
  // Load run history on component mount and listen for updates
  useEffect(() => {
    loadRunHistory();
    
    // Add event listener for run history updates
    const handleRunHistoryUpdate = () => {
      console.log("Run history update event received");
      loadRunHistory();
    };
    
    document.addEventListener('runHistoryUpdated', handleRunHistoryUpdate);
    
    return () => {
      document.removeEventListener('runHistoryUpdated', handleRunHistoryUpdate);
    };
  }, []);

  // Function to handle clicking on a run to view details
  const handleRunClick = (run) => {
    setSelectedRun(run);
  };
  
  // Function to handle deleting a run
  const handleDeleteRun = (runId) => {
    // Ask for confirmation
    if (window.confirm('Are you sure you want to delete this run?')) {
      // Use our data manager to delete the run
      deleteRun(runId);
      
      // Clear the selected run if it was deleted
      if (selectedRun && selectedRun.id === runId) {
        setSelectedRun(null);
      }
    }
  };
  
  // Function to handle sharing a run to Nostr
  const handleShareRun = (run) => {
    setSelectedRun(run);
    setAdditionalContent('');
    setShowModal(true);
  };
  
  // Function to handle posting to Nostr
  const handlePostSubmit = async () => {
    if (!selectedRun) return;
    
    setIsPosting(true);
    
    try {
      const run = selectedRun;
      const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration);
      
      const content = `
Just completed a run with Runstr! 🏃‍♂️💨

⏱️ Duration: ${formatTime(run.duration)}
📏 Distance: ${formatDistance(run.distance)}
⚡ Pace: ${formatPace(run.pace)}
🔥 Calories: ${caloriesBurned} kcal
${run.elevation ? `\n🏔️ Elevation Gain: ${formatElevation(run.elevation.gain)}\n📉 Elevation Loss: ${formatElevation(run.elevation.loss)}` : ''}
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
        <div className="unit-toggle-container">
          <button 
            className={`unit-toggle ${distanceUnit === 'km' ? 'active' : ''}`}
            onClick={toggleDistanceUnit}
          >
            KM
          </button>
          <button 
            className={`unit-toggle ${distanceUnit === 'mi' ? 'active' : ''}`}
            onClick={toggleDistanceUnit}
          >
            MI
          </button>
        </div>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title">Total Distance</div>
            <div className="stat-value">{formatDistance(stats.totalDistance || 0)}</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-title">Total Runs</div>
            <div className="stat-value">{stats.totalRuns || 0}</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-title">Average Pace</div>
            <div className="stat-value">{formatPace(stats.averagePace || 0)}</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-title">Longest Run</div>
            <div className="stat-value">{formatDistance(stats.longestRun || 0)}</div>
          </div>
        </div>
      </div>
      
      <div className="run-list-container">
        <h2>RUN HISTORY</h2>
        {runHistory.length === 0 ? (
          <div className="empty-state">
            No runs recorded yet. Start tracking your runs!
          </div>
        ) : (
          <div className="run-list">
            {runHistory.map((run) => (
              <div 
                key={run.id}
                className={`run-item ${selectedRun && selectedRun.id === run.id ? 'selected' : ''}`}
                onClick={() => handleRunClick(run)}
              >
                <div className="run-date">{formatDate(run.date)}</div>
                <div className="run-info">
                  <div className="run-distance">{formatDistance(run.distance)}</div>
                  <div className="run-time">{formatTime(run.duration)}</div>
                </div>
                <div className="run-actions">
                  <button 
                    className="share-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareRun(run);
                    }}
                  >
                    Share
                  </button>
                  <button 
                    className="delete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRun(run.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Run detail view */}
      {selectedRun && (
        <div className="run-detail">
          <h2>RUN DETAILS</h2>
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">Date</div>
              <div className="detail-value">{formatDate(selectedRun.date)}</div>
            </div>
            
            <div className="detail-item">
              <div className="detail-label">Distance</div>
              <div className="detail-value">{formatDistance(selectedRun.distance)}</div>
            </div>
            
            <div className="detail-item">
              <div className="detail-label">Duration</div>
              <div className="detail-value">{formatTime(selectedRun.duration)}</div>
            </div>
            
            <div className="detail-item">
              <div className="detail-label">Pace</div>
              <div className="detail-value">{formatPace(selectedRun.pace)}</div>
            </div>
            
            {selectedRun.elevation && (
              <>
                <div className="detail-item">
                  <div className="detail-label">Elevation Gain</div>
                  <div className="detail-value">{formatElevation(selectedRun.elevation.gain)}</div>
                </div>
                
                <div className="detail-item">
                  <div className="detail-label">Elevation Loss</div>
                  <div className="detail-value">{formatElevation(selectedRun.elevation.loss)}</div>
                </div>
              </>
            )}
            
            <div className="detail-item">
              <div className="detail-label">Calories</div>
              <div className="detail-value">{calculateCaloriesBurned(selectedRun.distance, selectedRun.duration)} kcal</div>
            </div>
          </div>
          
          {selectedRun.splits && selectedRun.splits.length > 0 && (
            <div className="splits-section">
              <h3>Splits</h3>
              <div className="splits-table">
                <table>
                  <thead>
                    <tr>
                      <th>Split</th>
                      <th>Distance</th>
                      <th>Time</th>
                      <th>Pace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRun.splits.map((split, index) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>{split.km} {distanceUnit}</td>
                        <td>{formatTime(split.time)}</td>
                        <td>{formatPace(split.pace)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Nostr posting modal */}
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
