import { useState, useEffect } from 'react';
import { useRunTracker } from '../contexts/RunTrackerContext';
import { convertDistance, formatPaceWithUnit, formatTime } from '../utils/formatters';
import { PermissionDialog } from './PermissionDialog';
import { createAndPublishEvent } from '../utils/nostr';
import { displayDistance } from '../utils/formatters';

export const RunTracker = () => {
  const { 
    isTracking, 
    isPaused, 
    distance, 
    duration, 
    pace, 
    elevation,
    startRun,
    pauseRun,
    resumeRun,
    stopRun
  } = useRunTracker();

  const [distanceUnit, setDistanceUnit] = useState(
    () => localStorage.getItem('distanceUnit') || 'km'
  );
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [countdown, setCountdown] = useState(0); // Countdown timer value
  const [isCountingDown, setIsCountingDown] = useState(false); // Flag to indicate countdown is in progress
  const [countdownType, setCountdownType] = useState(''); // 'start' or 'stop'
  
  // Add new state for recent runs and Nostr posting
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
    
    document.addEventListener('runCompleted', handleRunCompleted);
    
    return () => {
      document.removeEventListener('runCompleted', handleRunCompleted);
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
      setShowPostModal(false);
    }
  };

  // Check if permissions have been granted on component mount
  useEffect(() => {
    const permissionsGranted = localStorage.getItem('permissionsGranted') === 'true';
    
    // If this is the first time the user opens the app, show the permission dialog
    if (!permissionsGranted) {
      setShowPermissionDialog(true);
    }
  }, []);

  const initiateRun = () => {
    // Check if the user has already granted permissions
    const permissionsGranted = localStorage.getItem('permissionsGranted');
    
    if (permissionsGranted === 'true') {
      // If permissions already granted, start the countdown
      startCountdown('start');
    } else {
      // If permissions haven't been granted yet, show a message
      alert('Location permission is required for tracking runs. Please restart the app to grant permissions.');
      // Set the flag to show permission dialog next time the app starts
      localStorage.removeItem('permissionsGranted');
    }
  };

  const handlePermissionContinue = () => {
    // User has acknowledged the permission requirements
    localStorage.setItem('permissionsGranted', 'true');
    setShowPermissionDialog(false);
  };

  const handlePermissionCancel = () => {
    // User declined to proceed
    setShowPermissionDialog(false);
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

  const toggleDistanceUnit = () => {
    const newUnit = distanceUnit === 'km' ? 'mi' : 'km';
    setDistanceUnit(newUnit);
    localStorage.setItem('distanceUnit', newUnit);
  };

  const formatElevation = (meters) => {
    if (meters === null || isNaN(meters)) return '-';
    
    // Convert from meters based on distance unit preference
    if (distanceUnit === 'mi') {
      // Convert to feet (1m ≈ 3.28084ft)
      return `${Math.round(meters * 3.28084)}ft`;
    }
    // Keep as meters
    return `${Math.round(meters)}m`;
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#111827] text-white relative">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {/* Distance Card */}
        <div className="bg-gradient-to-br from-[#111827] to-[#1a222e] p-4 rounded-xl shadow-lg flex flex-col">
          <div className="flex items-center mb-2">
            <div className="w-7 h-7 rounded-full bg-[#10B981]/20 flex items-center justify-center mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-sm text-gray-400">Distance</span>
          </div>
          <div className="text-3xl font-bold">{convertDistance(distance, distanceUnit)}</div>
          <div className="text-sm text-gray-400">{distanceUnit}</div>
        </div>

        {/* Time Card */}
        <div className="bg-gradient-to-br from-[#111827] to-[#1a222e] p-4 rounded-xl shadow-lg flex flex-col">
          <div className="flex items-center mb-2">
            <div className="w-7 h-7 rounded-full bg-[#3B82F6]/20 flex items-center justify-center mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm text-gray-400">Time</span>
          </div>
          <div className="text-3xl font-bold">{formatTime(duration)}</div>
        </div>

        {/* Pace Card */}
        <div className="bg-gradient-to-br from-[#111827] to-[#1a222e] p-4 rounded-xl shadow-lg flex flex-col">
          <div className="flex items-center mb-2">
            <div className="w-7 h-7 rounded-full bg-[#F59E0B]/20 flex items-center justify-center mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-sm text-gray-400">Pace</span>
          </div>
          <div className="text-3xl font-bold">{formatPaceWithUnit(pace, distanceUnit).split(' ')[0]}</div>
          <div className="text-sm text-gray-400">min/{distanceUnit}</div>
        </div>

        {/* Elevation Card */}
        <div className="bg-gradient-to-br from-[#111827] to-[#1a222e] p-4 rounded-xl shadow-lg flex flex-col">
          <div className="flex items-center mb-2">
            <div className="w-7 h-7 rounded-full bg-[#F97316]/20 flex items-center justify-center mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#F97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </div>
            <span className="text-sm text-gray-400">Elevation</span>
          </div>
          <div className="text-3xl font-bold">{elevation ? formatElevation(elevation.gain) : '0'}</div>
          <div className="text-sm text-gray-400">ft</div>
        </div>
      </div>
      
      {/* Unit Toggle */}
      <div className="flex justify-center my-4">
        <div className="flex rounded-full bg-[#1a222e] p-1">
          <button 
            className={`px-6 py-2 rounded-full text-sm ${distanceUnit === 'mi' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
            onClick={() => distanceUnit !== 'mi' && toggleDistanceUnit()}
          >
            Miles
          </button>
          <button 
            className={`px-6 py-2 rounded-full text-sm ${distanceUnit === 'km' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
            onClick={() => distanceUnit !== 'km' && toggleDistanceUnit()}
          >
            Kilometers
          </button>
        </div>
      </div>
      
      {/* Start Run Button */}
      {!isTracking ? (
        <button 
          className="mx-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-6 rounded-xl shadow-lg flex items-center justify-center text-lg font-semibold my-4"
          onClick={initiateRun}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Start Run
        </button>
      ) : (
        <div className="flex justify-between px-4 my-4">
          {isPaused ? (
            <button 
              className="bg-green-600 text-white py-3 px-6 rounded-xl shadow-lg flex-1 mr-2 font-semibold"
              onClick={resumeRun}
            >
              Resume
            </button>
          ) : (
            <button 
              className="bg-yellow-600 text-white py-3 px-6 rounded-xl shadow-lg flex-1 mr-2 font-semibold"
              onClick={pauseRun}
            >
              Pause
            </button>
          )}
          <button 
            className="bg-red-600 text-white py-3 px-6 rounded-xl shadow-lg flex-1 ml-2 font-semibold"
            onClick={() => startCountdown('stop')}
          >
            Stop
          </button>
        </div>
      )}
      
      {/* Recent Runs Section */}
      {recentRun && !isTracking && (
        <div className="mx-4 mt-4 bg-gradient-to-br from-[#111827] to-[#1a222e] rounded-xl shadow-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="text-lg font-semibold">Recent Runs</h3>
            <span className="text-xs text-gray-400">See All</span>
          </div>
          <div className="p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">Morning Run</h4>
                <div className="flex items-center text-xs text-gray-400">
                  <span>Yesterday • {displayDistance(recentRun.distance, distanceUnit)}</span>
                  <span className="ml-2 px-2 py-1 bg-gray-800 rounded-full">
                    {recentRun.distance > 0 
                      ? (recentRun.duration / 60 / (distanceUnit === 'km' ? recentRun.distance/1000 : recentRun.distance/1609.344)).toFixed(2) 
                      : '0.00'} min/{distanceUnit}
                  </span>
                </div>
              </div>
              <div className="text-right text-gray-400">
                <span className="block text-lg font-semibold">{formatTime(recentRun.duration).split(':').slice(0, 2).join(':')}</span>
                <button 
                  onClick={handlePostToNostr}
                  className="text-xs mt-1 text-indigo-400 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Display permission dialog if needed */}
      {showPermissionDialog && (
        <PermissionDialog
          onContinue={handlePermissionContinue}
          onCancel={handlePermissionCancel}
        />
      )}
      
      {/* Countdown overlay */}
      {isCountingDown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="flex flex-col items-center">
            <div className="text-6xl font-bold mb-4">{countdown}</div>
            <div className="text-xl">
              {countdownType === 'start' ? 'Starting run...' : 'Stopping run...'}
            </div>
          </div>
        </div>
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
