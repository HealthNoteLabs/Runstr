import { useState, useEffect } from 'react';
import { useRunData } from '../hooks/useRunData';
import { createAndPublishEvent } from '../utils/nostr';
import { PermissionDialog } from './PermissionDialog';
import SplitsTable from './SplitsTable';
import { formatDate } from '../utils/formatters';

export const RunTracker = () => {
  // Use our new hook instead of the old context
  const {
    isTracking,
    isPaused,
    splits,
    distanceUnit,
    formattedDistance,
    formattedPace,
    formattedTime,
    formattedElevationGain,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    toggleDistanceUnit,
    formatDistance,
    formatTime,
    formatPace
  } = useRunData();

  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownType, setCountdownType] = useState('');
  
  // Add state for recent runs and Nostr posting
  const [recentRun, setRecentRun] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [additionalContent, setAdditionalContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  // Load the most recent run
  useEffect(() => {
    const loadRecentRun = () => {
      const storedRuns = localStorage.getItem('runHistory');
      if (storedRuns) {
        try {
          const parsedRuns = JSON.parse(storedRuns);
          if (parsedRuns.length > 0) {
            // Sort runs by date (most recent first)
            const sortedRuns = [...parsedRuns].sort((a, b) => new Date(b.date) - new Date(a.date));
            setRecentRun(sortedRuns[0]);
          }
        } catch (error) {
          console.error('Error loading recent run:', error);
        }
      }
    };
    
    loadRecentRun();
    
    // Listen for run completed events
    const handleRunCompleted = () => {
      console.log("Run completed event received");
      loadRecentRun();
    };
    
    document.addEventListener('runHistoryUpdated', handleRunCompleted);
    
    return () => {
      document.removeEventListener('runHistoryUpdated', handleRunCompleted);
    };
  }, []);

  // Handle posting to Nostr
  const handlePostToNostr = () => {
    if (!recentRun) return;
    setAdditionalContent('');
    setShowPostModal(true);
  };

  const handlePostSubmit = async () => {
    if (!recentRun) return;
    
    setIsPosting(true);
    
    try {
      const run = recentRun;
      // Calculate calories (simplified version)
      const caloriesBurned = Math.round(run.distance * 0.06);
      
      const content = `
Just completed a run with Runstr! 🏃‍♂️💨

⏱️ Duration: ${formattedTime(run.duration)}
📏 Distance: ${formattedDistance(run.distance)}
⚡ Pace: ${formattedPace(run.pace)}
🔥 Calories: ${caloriesBurned} kcal
${run.elevation ? `\n🏔️ Elevation Gain: ${formattedElevationGain(run.elevation.gain)}\n📉 Elevation Loss: ${formattedElevationGain(run.elevation.loss)}` : ''}
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

      // Use the createAndPublishEvent function from nostr-tools
      await createAndPublishEvent(eventTemplate);
      
      setShowPostModal(false);
      setAdditionalContent('');
      
      // Show success message
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Successfully posted to Nostr!');
      } else {
        alert('Successfully posted to Nostr!');
      }
    } catch (error) {
      console.error('Error posting to Nostr:', error);
      
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to post to Nostr: ' + error.message);
      } else {
        alert('Failed to post to Nostr: ' + error.message);
      }
    } finally {
      setIsPosting(false);
    }
  };

  const startCountdown = (type) => {
    setCountdownType(type);
    setIsCountingDown(true);
    setCountdown(5);
    
    const countdownInterval = setInterval(() => {
      setCountdown((prevCount) => {
        if (prevCount <= 1) {
          clearInterval(countdownInterval);
          
          // Add small delay before hiding overlay for better UX
          setTimeout(() => {
            setIsCountingDown(false);
            
            // Execute the appropriate action after countdown finishes
            if (type === 'start') {
              startRun();
            } else if (type === 'stop') {
              stopRun();
            }
          }, 200);
          
          return 0;
        }
        return prevCount - 1;
      });
    }, 1000);
  };

  return (
    <div className="run-tracker-container">
      {/* Run stats display */}
      <div className="run-stats">
        <div className="run-stat">
          <div className="stat-label">Distance</div>
          <div className="stat-value">{formattedDistance}</div>
        </div>
        
        <div className="run-stat">
          <div className="stat-label">Time</div>
          <div className="stat-value">{formattedTime}</div>
        </div>
        
        <div className="run-stat">
          <div className="stat-label">Pace</div>
          <div className="stat-value">{formattedPace}</div>
        </div>
        
        <div className="run-stat">
          <div className="stat-label">Elevation</div>
          <div className="stat-value">{formattedElevationGain}</div>
        </div>
      </div>
      
      {/* Unit toggle */}
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
      
      {/* Control buttons */}
      <div className="run-controls">
        {!isTracking ? (
          <button 
            className="start-button"
            onClick={() => startCountdown('start')}
          >
            Start Run
          </button>
        ) : isPaused ? (
          <>
            <button 
              className="resume-button"
              onClick={resumeRun}
            >
              Resume
            </button>
            <button 
              className="stop-button"
              onClick={() => startCountdown('stop')}
            >
              Stop
            </button>
          </>
        ) : (
          <>
            <button 
              className="pause-button"
              onClick={pauseRun}
            >
              Pause
            </button>
            <button 
              className="stop-button"
              onClick={() => startCountdown('stop')}
            >
              Stop
            </button>
          </>
        )}
      </div>
      
      {/* Display splits if available */}
      {splits && splits.length > 0 && (
        <div className="splits-container">
          <h3>Splits</h3>
          <SplitsTable 
            splits={splits} 
            unit={distanceUnit} 
          />
        </div>
      )}
      
      {/* Recent runs section */}
      {recentRun && !isTracking && (
        <div className="recent-run-section">
          <h3>Recent Runs</h3>
          <div className="recent-run-card">
            <div className="run-date">{formatDate(recentRun.date)}</div>
            <div className="run-details">
              <div>Distance: {formatDistance(recentRun.distance)}</div>
              <div>Duration: {formatTime(recentRun.duration)}</div>
              <div>Pace: {formatPace(recentRun.pace)}</div>
            </div>
            <div className="run-actions">
              <button 
                className="share-btn"
                onClick={handlePostToNostr}
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Countdown overlay */}
      {isCountingDown && (
        <div className="countdown-overlay">
          <div className="countdown-container">
            <div className="countdown-number">{countdown}</div>
            <div className="countdown-text">
              {countdownType === 'start' ? 'Starting run...' : 'Stopping run...'}
            </div>
          </div>
        </div>
      )}
      
      {/* Permission dialog */}
      {showPermissionDialog && (
        <PermissionDialog 
          onClose={() => setShowPermissionDialog(false)}
        />
      )}
      
      {/* Post to Nostr modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#1a222e] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Post Run to Nostr</h3>
            <textarea
              value={additionalContent}
              onChange={(e) => setAdditionalContent(e.target.value)}
              placeholder="Add any additional comments or hashtags..."
              rows={4}
              className="w-full bg-[#111827] border border-gray-700 rounded-lg p-3 mb-4 text-white"
              disabled={isPosting}
            />
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowPostModal(false)} 
                disabled={isPosting}
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300"
              >
                Cancel
              </button>
              <button 
                onClick={handlePostSubmit} 
                disabled={isPosting}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white"
              >
                {isPosting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
