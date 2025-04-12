import { useState, useEffect } from 'react';
import { useRunTracker } from '../contexts/RunTrackerContext';
import { useActivityMode } from '../contexts/ActivityModeContext';
import { useSettings } from '../contexts/SettingsContext';
import runDataService from '../services/RunDataService';
import { PermissionDialog } from './PermissionDialog';
import { formatPaceWithUnit, displayDistance, convertDistance, formatElevation } from '../utils/formatters';
import { createAndPublishEvent, createWorkoutEvent } from '../utils/nostr';
import SplitsTable from './SplitsTable';
import DashboardRunCard from './DashboardRunCard';

export const RunTracker = () => {
  const { 
    isTracking,
    isPaused,
    distance,
    duration,
    pace,
    elevation,
    splits,
    startRun,
    pauseRun,
    resumeRun,
    stopRun
  } = useRunTracker();

  const { getActivityText } = useActivityMode();
  const { distanceUnit } = useSettings();

  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [countdownType, setCountdownType] = useState('start');
  const [recentRun, setRecentRun] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [additionalContent, setAdditionalContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [workoutSaved, setWorkoutSaved] = useState(false);
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

⏱️ Duration: ${runDataService.formatTime(run.duration)}
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
      alert('Location permission is required for tracking. Please restart the app to grant permissions.');
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

  // Add handler for saving workout record
  const handleSaveWorkoutRecord = async () => {
    if (!recentRun) return;
    
    setIsSavingWorkout(true);
    setWorkoutSaved(false);
    
    try {
      // Create a workout event with kind 1301 format
      const workoutEvent = createWorkoutEvent(recentRun, distanceUnit);
      
      // Use the existing createAndPublishEvent function
      await createAndPublishEvent(workoutEvent);
      
      // Update UI to show success
      setWorkoutSaved(true);
      
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
    }
  };

  // Add handler for deleting a run
  const handleDeleteRun = async () => {
    if (!recentRun) return;
    
    const confirmDelete = window.confirm("Are you sure you want to delete this run? This action cannot be undone.");
    if (!confirmDelete) return;
    
    setIsDeleting(true);
    
    try {
      // Get current run history
      const runHistory = JSON.parse(localStorage.getItem('runHistory') || '[]');
      
      // Filter out the run to delete
      const updatedRunHistory = runHistory.filter(run => run.id !== recentRun.id);
      
      // Save updated history back to localStorage
      localStorage.setItem('runHistory', JSON.stringify(updatedRunHistory));
      
      // Show success message
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Run deleted successfully');
      } else {
        alert('Run deleted successfully');
      }
      
      // If there are other runs, load the next most recent run
      if (updatedRunHistory.length > 0) {
        const sortedRuns = [...updatedRunHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecentRun(sortedRuns[0]);
      } else {
        // No more runs
        setRecentRun(null);
      }
    } catch (error) {
      console.error('Error deleting run:', error);
      
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to delete run: ' + error.message);
      } else {
        alert('Failed to delete run: ' + error.message);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#111827] text-white relative">
      {/* Title Banner */}
      <div className="bg-gradient-to-r from-indigo-800 to-purple-800 p-4 mb-6 text-center">
        <h2 className="text-2xl font-bold text-white">{getActivityText('header')}</h2>
      </div>

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
          <div className="text-3xl font-bold">{formattedPace.split(' ')[0]}</div>
          <div className="text-sm text-gray-400">{formattedPace.split(' ')[1]}</div>
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
          <div className="text-3xl font-bold">{elevation ? formatElevation(elevation.gain, distanceUnit) : '0'}</div>
          <div className="text-sm text-gray-400">{distanceUnit === 'mi' ? 'ft' : 'm'}</div>
        </div>
      </div>
      
      {/* Splits Table - Show only when tracking and splits exist */}
      {isTracking && splits && splits.length > 0 && (
        <div className="bg-[#1a222e] rounded-xl shadow-lg mt-2 mx-4 p-4 overflow-hidden">
          <div className="flex items-center mb-2">
            <div className="w-6 h-6 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-300">Split Times</span>
          </div>
          <div className="mt-2">
            <SplitsTable splits={splits} distanceUnit={distanceUnit} />
          </div>
          {splits.length > 5 && (
            <p className="text-xs text-gray-400 text-center mt-2">
              Swipe to see more splits if needed
            </p>
          )}
        </div>
      )}
      
      {/* Start Activity Button */}
      {!isTracking ? (
        <button 
          className="mx-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-6 rounded-xl shadow-lg flex items-center justify-center text-lg font-semibold my-4"
          onClick={initiateRun}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {getActivityText('start')}
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
      
      {/* Recent Activities Section with New DashboardRunCard */}
      {!isTracking && recentRun && (
        <div className="mt-6 mx-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">{getActivityText('recent')}</h3>
            <span className="text-xs text-gray-400">See All</span>
          </div>
          
          <DashboardRunCard
            run={{
              ...recentRun,
              title: recentRun.title || `${getTimeOfDay(recentRun.timestamp)} ${recentRun.activityType === 'walk' ? 'Walk' : recentRun.activityType === 'cycle' ? 'Cycle' : 'Run'}`,
              date: formatRunDate(recentRun.date)
            }}
            formatTime={runDataService.formatTime}
            displayDistance={displayDistance}
            distanceUnit={distanceUnit}
            onShare={handlePostToNostr}
            onSave={handleSaveWorkoutRecord}
            onDelete={handleDeleteRun}
            isSaving={isSavingWorkout}
            isWorkoutSaved={workoutSaved}
            isDeleting={isDeleting}
          />
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
