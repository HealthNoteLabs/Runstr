import { useEffect, useState } from 'react';
import { useRunTracker } from '../contexts/RunTrackerContext';
import { useActivityType } from '../contexts/ActivityTypeContext';
import runDataService from '../services/RunDataService';
import { PermissionDialog } from './PermissionDialog';
import { formatPaceWithUnit, formatElevation, convertDistance, displayDistance } from '../utils/formatters';
import SplitsList from './SplitsList';
import { createAndPublishEvent } from '../utils/nostr';

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
    stopRun,
    splits
  } = useRunTracker();

  const { activityType, getActivityTypeLabel } = useActivityType();
  const activityLabel = getActivityTypeLabel();
  const activityLabelLower = activityLabel.toLowerCase();

  // Use a simpler approach to track distanceUnit since we're not updating it directly in this component
  const [distanceUnit, setDistanceUnit] = useState(localStorage.getItem('distanceUnit') || 'km');
  
  // Update distanceUnit when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setDistanceUnit(localStorage.getItem('distanceUnit') || 'km');
    };
    
    // Handle our custom event for unit changes within the same window
    const handleUnitChange = (event) => {
      setDistanceUnit(event.detail.unit);
    };
    
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('distanceUnitChanged', handleUnitChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('distanceUnitChanged', handleUnitChange);
    };
  }, []);

  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [countdown, setCountdown] = useState(0); // Countdown timer value
  const [isCountingDown, setIsCountingDown] = useState(false); // Flag to indicate countdown is in progress
  const [countdownType, setCountdownType] = useState(''); // 'start' or 'stop'
  
  // Add new state for recent runs and Nostr posting
  const [recentRun, setRecentRun] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [additionalContent, setAdditionalContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  // Add state for step count
  const [steps, setSteps] = useState(0);
  const [isWalkMode, setIsWalkMode] = useState(false);

  // Load the most recent run of the current activity type
  useEffect(() => {
    const loadRecentRun = () => {
      try {
        // Get the most recent activity of the current type
        const recentActivity = runDataService.getMostRecentRunByType(activityType);
        setRecentRun(recentActivity);
      } catch (error) {
        console.error(`Error loading recent ${activityLabelLower}:`, error);
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
  }, [activityType, activityLabelLower]);

  // Listen for step count changes
  useEffect(() => {
    if (!splits) return;
    
    const handleStepsChange = (steps) => {
      setSteps(steps);
    };
    
    splits.on('stepsChange', handleStepsChange);
    
    return () => {
      splits.off('stepsChange', handleStepsChange);
    };
  }, [splits]);

  // Set walk mode based on activity type
  useEffect(() => {
    setIsWalkMode(activityType === 'walk');
  }, [activityType]);

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
Just completed a ${activityLabelLower} with Runstr! 🏃‍♂️💨

⏱️ Duration: ${runDataService.formatTime(run.duration)}
📏 Distance: ${displayDistance(run.distance, distanceUnit)}
⚡ Pace: ${(run.duration / 60 / (distanceUnit === 'km' ? run.distance/1000 : run.distance/1609.344)).toFixed(2)} min/${distanceUnit}
🔥 Calories: ${caloriesBurned} kcal
${run.elevation ? `\n🏔️ Elevation Gain: ${formatElevation(run.elevation.gain, distanceUnit)}\n📉 Elevation Loss: ${formatElevation(run.elevation.loss, distanceUnit)}` : ''}
${additionalContent ? `\n${additionalContent}` : ''}
#Runstr #${activityLabel}
`.trim();

      // Create the event template for nostr-tools
      const eventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['t', 'Runstr'],
          ['t', activityLabel]
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
      alert('Location permission is required for tracking activities. Please restart the app to grant permissions.');
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

  // Format pace for display
  const formattedPace = formatPaceWithUnit(
    pace,
    distanceUnit
  );
  
  // Helper function to determine time of day based on timestamp
  const getTimeOfDay = (timestamp) => {
    if (!timestamp) {
      // For runs without timestamp, use a generic name
      return "Regular";
    }
    
    const hours = new Date(timestamp).getHours();
    
    if (hours >= 5 && hours < 12) return "Morning";
    if (hours >= 12 && hours < 17) return "Afternoon";
    if (hours >= 17 && hours < 21) return "Evening";
    return "Night";
  };

  // Helper function to format the run date in a user-friendly way
  const formatRunDate = (dateString) => {
    if (!dateString) return "Unknown date";
    
    const runDate = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if the run was today
    if (runDate.toDateString() === today.toDateString()) {
      return "Today";
    }
    
    // Check if the run was yesterday
    if (runDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    
    // Otherwise return the actual date
    return runDate.toLocaleDateString();
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
          <div className="text-3xl font-bold">{runDataService.formatTime(duration)}</div>
        </div>

        {/* Conditional Pace or Steps Card based on activity type */}
        {isWalkMode ? (
          // Steps Card (for Walk mode)
          <div className="bg-gradient-to-br from-[#111827] to-[#1a222e] p-4 rounded-xl shadow-lg flex flex-col">
            <div className="flex items-center mb-2">
              <div className="w-7 h-7 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-sm text-gray-400">Steps</span>
            </div>
            <div className="text-3xl font-bold">{steps.toLocaleString()}</div>
          </div>
        ) : (
          // Pace Card (for Run mode)
          <div className="bg-gradient-to-br from-[#111827] to-[#1a222e] p-4 rounded-xl shadow-lg flex flex-col">
            <div className="flex items-center mb-2">
              <div className="w-7 h-7 rounded-full bg-[#F59E0B]/20 flex items-center justify-center mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-sm text-gray-400">Pace</span>
            </div>
            <div className="text-3xl font-bold">{formattedPace.split(' ')[0]}</div>
            <div className="text-sm text-gray-400">{formattedPace.split(' ')[1]}</div>
          </div>
        )}

        {/* Elevation Card */}
        <div className="bg-gradient-to-br from-[#111827] to-[#1a222e] p-4 rounded-xl shadow-lg flex flex-col">
          <div className="flex items-center mb-2">
            <div className="w-7 h-7 rounded-full bg-[#EC4899]/20 flex items-center justify-center mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#EC4899]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <span className="text-sm text-gray-400">Elevation</span>
          </div>
          <div className="text-3xl font-bold">{formatElevation(elevation ? elevation.gain : 0, distanceUnit).split(' ')[0]}</div>
          <div className="text-sm text-gray-400">{formatElevation(elevation ? elevation.gain : 0, distanceUnit).split(' ')[1]}</div>
        </div>
      </div>
      
      {/* Start/Pause/Resume/Stop Button Group */}
      <div className="px-4 my-4">
        {!isTracking ? (
          // Start Button when not tracking
          <button 
            onClick={initiateRun} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl text-lg font-semibold shadow-lg flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start {activityLabel}
          </button>
        ) : (
          // Button Group when tracking
          <div className="flex space-x-4">
            {isPaused ? (
              // Resume Button
              <button 
                onClick={resumeRun} 
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl text-lg font-semibold shadow-lg flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Resume
              </button>
            ) : (
              // Pause Button
              <button 
                onClick={pauseRun} 
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-4 rounded-xl text-lg font-semibold shadow-lg flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pause
              </button>
            )}
            
            {/* Stop Button */}
            <button 
              onClick={() => startCountdown('stop')} 
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl text-lg font-semibold shadow-lg flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Stop
            </button>
          </div>
        )}
      </div>
      
      {/* Splits Section - Only show during active tracking */}
      {isTracking && (
        <div className="mx-4 mb-4">
          <SplitsList splits={splits} distanceUnit={distanceUnit} className="mt-2" />
        </div>
      )}
      
      {/* Join Club Button */}
      {!isTracking && (
        <button 
          className="mx-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-6 rounded-xl shadow-lg flex items-center justify-center text-lg font-semibold mb-4"
          onClick={() => window.location.href = '/club/'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Join Club
        </button>
      )}
      
      {/* Recent Runs Section */}
      {!isTracking && recentRun && (
        <div className="bg-[#1a222e] rounded-xl shadow-lg mt-6 mx-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="text-lg font-semibold">Recent {activityLabel}s</h3>
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
                <h4 className="font-semibold">{recentRun.title || `${getTimeOfDay(recentRun.timestamp)} ${activityLabel}`}</h4>
                <div className="flex items-center text-xs text-gray-400">
                  <span>{formatRunDate(recentRun.date)} • {displayDistance(recentRun.distance, distanceUnit)}</span>
                  <span className="ml-2 px-2 py-1 bg-gray-800 rounded-full">
                    {recentRun.distance > 0 
                      ? (recentRun.duration / 60 / (distanceUnit === 'km' ? recentRun.distance/1000 : recentRun.distance/1609.344)).toFixed(2) 
                      : '0.00'} min/{distanceUnit}
                  </span>
                </div>
              </div>
            </div>
              
            <div className="mt-4 flex space-x-2">
              <button 
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm"
                onClick={handlePostToNostr}
              >
                <div className="flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </div>
              </button>
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
              {countdownType === 'start' ? `Starting ${activityLabelLower}...` : `Stopping ${activityLabelLower}...`}
            </div>
          </div>
        </div>
      )}
      
      {/* Post to Nostr modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#1a222e] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Post {activityLabel} to Nostr</h3>
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
