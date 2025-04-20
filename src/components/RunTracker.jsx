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
import ImagePicker from './ImagePicker';
import { useMobileStorage } from '../contexts/MobileStorageContext';
import { vibrate, showToast, showDialog } from '../utils/platform';
import './RunTracker.css';

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
  const storage = useMobileStorage();

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
  const [selectedImages, setSelectedImages] = useState([]);

  // Load the most recent run
  useEffect(() => {
    const loadRecentRun = async () => {
      try {
        const storedRuns = await storage.getJSON('runHistory', []);
        if (storedRuns.length > 0) {
          // Sort runs by date (most recent first)
          const sortedRuns = [...storedRuns].sort((a, b) => new Date(b.date) - new Date(a.date));
          setRecentRun(sortedRuns[0]);
        }
      } catch (error) {
        console.error('Error loading recent run:', error);
      }
    };
    
    if (storage.isReady) {
      loadRecentRun();
    }
    
    // Listen for run completed events
    const handleRunCompleted = () => {
      console.log("Run completed event received");
      loadRecentRun();
    };
    
    document.addEventListener('runCompleted', handleRunCompleted);
    
    return () => {
      document.removeEventListener('runCompleted', handleRunCompleted);
    };
  }, [storage.isReady, storage]);

  // Handle posting to Nostr
  const handlePostToNostr = () => {
    if (!recentRun) return;
    
    // Provide haptic feedback when opening post dialog
    vibrate('light');
    
    setAdditionalContent('');
    setSelectedImages([]);
    setShowPostModal(true);
  };

  /**
   * Handle when an image is selected from camera or gallery
   * @param {File} file - The selected image file
   * @param {string} url - Object URL for the image
   */
  const handleImageSelected = (file, url) => {
    // Add new image to the selectedImages array
    setSelectedImages(prev => [...prev, { file, url }]);
    vibrate('light'); // Haptic feedback for image selection
  };

  /**
   * Handle when an image is removed
   * @param {number} index - Index of the image to remove
   */
  const handleImageRemoved = (index) => {
    setSelectedImages(prev => {
      const newImages = [...prev];
      // Release the object URL to prevent memory leaks
      URL.revokeObjectURL(newImages[index].url);
      newImages.splice(index, 1);
      return newImages;
    });
    vibrate('light'); // Haptic feedback for image removal
  };

  /**
   * Convert image file to base64 string for posting
   * @param {File} file - Image file to convert
   * @returns {Promise<string>} Base64 encoded image
   */
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
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

      // Process any attached images
      const imageUrls = [];
      const imageTags = [];
      
      if (selectedImages.length > 0) {
        // Process each selected image
        for (let i = 0; i < selectedImages.length; i++) {
          try {
            // Convert image to base64
            const base64Image = await fileToBase64(selectedImages[i].file);
            
            // In a real implementation, you would upload the image to a service
            // Here we'd typically do something like:
            // const uploadResponse = await uploadImageToService(base64Image);
            // const imageUrl = uploadResponse.url;
            
            // For now, we'll just use the base64 image directly in the post
            // Note: In a production app, you should upload images to a service
            imageUrls.push(base64Image);
            
            // Add image url to the content
            imageTags.push(['image', base64Image]);
          } catch (error) {
            console.error('Error processing image:', error);
          }
        }
      }

      // Create the event template for nostr-tools with image tags
      const eventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['t', 'Runstr'],
          ['t', 'Running'],
          ...imageTags
        ],
        content: content
      };

      // Use the createAndPublishEvent function from nostr-tools
      await createAndPublishEvent(eventTemplate);
      
      // Clean up image URLs to prevent memory leaks
      selectedImages.forEach(image => {
        URL.revokeObjectURL(image.url);
      });
      
      setShowPostModal(false);
      setAdditionalContent('');
      setSelectedImages([]);
      
      // Provide success haptic feedback
      vibrate('success');
      
      // Show success toast
      showToast('Successfully posted to Nostr!');
    } catch (error) {
      console.error('Error posting to Nostr:', error);
      
      // Provide error haptic feedback
      vibrate('error');
      
      // Show error toast
      showToast('Failed to post to Nostr: ' + error.message, 'long');
    } finally {
      setIsPosting(false);
      setShowPostModal(false);
    }
  };

  // Check if permissions have been granted on component mount
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const permissionsGranted = await storage.getItem('permissionsGranted') === 'true';
        
        // If this is the first time the user opens the app, show the permission dialog
        if (!permissionsGranted) {
          setShowPermissionDialog(true);
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
        // Default to showing the permission dialog on error
        setShowPermissionDialog(true);
      }
    };
    
    if (storage.isReady) {
      checkPermissions();
    }
  }, [storage.isReady, storage]);

  const initiateRun = async () => {
    // Check if the user has already granted permissions
    try {
      const permissionsGranted = await storage.getItem('permissionsGranted');
      
      if (permissionsGranted === 'true') {
        // If permissions already granted, start the countdown
        // Provide haptic feedback when initiating run
        vibrate('medium');
        startCountdown('start');
      } else {
        // If permissions haven't been granted yet, show a message
        await showDialog({
          title: 'Permission Required',
          message: 'Location permission is required for tracking. Please restart the app to grant permissions.',
          buttonLabels: ['OK']
        });
        
        // Reset permission flag
        await storage.removeItem('permissionsGranted');
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      showToast('Error checking permissions', 'short');
    }
  };

  const handlePermissionContinue = async () => {
    // User has acknowledged the permission requirements
    try {
      await storage.setItem('permissionsGranted', 'true');
      setShowPermissionDialog(false);
      // Provide acknowledgment haptic feedback
      vibrate('success');
    } catch (error) {
      console.error('Error saving permissions:', error);
      showToast('Error saving permissions', 'short');
    }
  };

  const handlePermissionCancel = () => {
    // User declined to proceed
    setShowPermissionDialog(false);
    // Provide cancellation haptic feedback
    vibrate('error');
  };

  const startCountdown = (type) => {
    setCountdownType(type);
    setIsCountingDown(true);
    setCountdown(5);
    
    // Initial countdown haptic feedback
    vibrate('medium');
    
    const countdownInterval = setInterval(() => {
      setCountdown((prevCount) => {
        // Haptic feedback for each second
        if (prevCount > 0) {
          vibrate('light');
        }
        
        if (prevCount <= 1) {
          clearInterval(countdownInterval);
          
          // Add small delay before hiding overlay for better UX
          setTimeout(() => {
            setIsCountingDown(false);
            
            // Execute the appropriate action after countdown finishes
            if (type === 'start') {
              startRun();
              vibrate('success'); // Stronger feedback when run starts
            } else if (type === 'stop') {
              stopRun();
              vibrate('heavy'); // Strong feedback when run stops
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
      
      // Provide success haptic feedback
      vibrate('success');
      
      // Show success toast
      showToast('Workout record saved to Nostr!');
    } catch (error) {
      console.error('Error saving workout record:', error);
      
      // Provide error haptic feedback
      vibrate('error');
      
      // Show error toast
      showToast('Failed to save workout record: ' + error.message, 'long');
    } finally {
      setIsSavingWorkout(false);
    }
  };

  // Add handler for deleting a run
  const handleDeleteRun = async () => {
    if (!recentRun) return;
    
    try {
      const confirmDeleteResult = await showDialog({
        title: 'Confirm Delete',
        message: 'Are you sure you want to delete this run? This action cannot be undone.',
        buttonLabels: ['Delete', 'Cancel']
      });
      
      if (confirmDeleteResult !== 0) {
        // User cancelled the delete operation
        return;
      }
      
      setIsDeleting(true);
      
      // Get current run history
      const runHistory = await storage.getJSON('runHistory', []);
      
      // Filter out the run to delete
      const updatedRunHistory = runHistory.filter(run => run.id !== recentRun.id);
      
      // Save updated history back to storage
      await storage.setJSON('runHistory', updatedRunHistory);
      
      // Provide haptic feedback for successful deletion
      vibrate('warning');
      
      // Show success message
      showToast('Run deleted successfully');
      
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
      vibrate('error');
      showToast('Failed to delete run: ' + error.message, 'long');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="run-tracker-container">
      {/* Title Banner */}
      <div className="title-banner">
        <h2 className="title-text">{getActivityText('header')}</h2>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {/* Distance Card */}
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon-container distance-icon-container">
              <svg xmlns="http://www.w3.org/2000/svg" className="distance-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="stat-label">Distance</span>
          </div>
          <div className="stat-value">{convertDistance(distance, distanceUnit)}</div>
          <div className="stat-unit">{distanceUnit}</div>
        </div>

        {/* Time Card */}
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon-container time-icon-container">
              <svg xmlns="http://www.w3.org/2000/svg" className="time-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="stat-label">Time</span>
          </div>
          <div className="stat-value">{runDataService.formatTime(duration)}</div>
        </div>

        {/* Pace Card */}
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon-container pace-icon-container">
              <svg xmlns="http://www.w3.org/2000/svg" className="pace-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="stat-label">Pace</span>
          </div>
          <div className="stat-value">{formattedPace.split(' ')[0]}</div>
          <div className="stat-unit">{formattedPace.split(' ')[1]}</div>
        </div>

        {/* Elevation Card */}
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon-container elevation-icon-container">
              <svg xmlns="http://www.w3.org/2000/svg" className="elevation-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </div>
            <span className="stat-label">Elevation</span>
          </div>
          <div className="stat-value">{elevation ? formatElevation(elevation.gain, distanceUnit) : '0'}</div>
          <div className="stat-unit">{distanceUnit === 'mi' ? 'ft' : 'm'}</div>
        </div>
      </div>
      
      {/* Splits Table - Show only when tracking and splits exist */}
      {isTracking && splits && splits.length > 0 && (
        <div className="splits-container">
          <div className="splits-header">
            <div className="splits-icon-container">
              <svg xmlns="http://www.w3.org/2000/svg" className="splits-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="splits-label">Split Times</span>
          </div>
          <div>
            <SplitsTable splits={splits} distanceUnit={distanceUnit} />
          </div>
          {splits.length > 5 && (
            <p className="splits-help-text">
              Swipe to see more splits if needed
            </p>
          )}
        </div>
      )}
      
      {/* Start Activity Button */}
      {!isTracking ? (
        <button 
          className="control-button"
          onClick={initiateRun}
        >
          Start {getActivityText()}
        </button>
      ) : (
        <div>
          {isPaused ? (
            <button 
              className="control-button"
              onClick={() => {
                resumeRun();
                vibrate('medium');
              }}
            >
              Resume
            </button>
          ) : (
            <button 
              className="control-button"
              onClick={() => {
                pauseRun();
                vibrate('medium');
              }}
            >
              Pause
            </button>
          )}
          <button 
            className="control-button"
            onClick={() => startCountdown('stop')}
          >
            Stop
          </button>
        </div>
      )}
      
      {/* Recent Run Card */}
      {recentRun && !isTracking && (
        <DashboardRunCard 
          run={recentRun} 
          distanceUnit={distanceUnit} 
          onDelete={handleDeleteRun}
          onShare={handlePostToNostr}
          isDeleting={isDeleting}
          onSaveWorkout={handleSaveWorkoutRecord}
          isSavingWorkout={isSavingWorkout}
          workoutSaved={workoutSaved}
        />
      )}

      {/* Permission Dialog */}
      {showPermissionDialog && (
        <PermissionDialog 
          onContinue={handlePermissionContinue}
          onCancel={handlePermissionCancel}
        />
      )}
      
      {/* Post to Nostr Modal */}
      {showPostModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Share Your Run</h3>
            
            <div>
              <p>
                <strong>Date:</strong> {formatRunDate(recentRun.date)}<br />
                <strong>Duration:</strong> {runDataService.formatTime(recentRun.duration)}<br />
                <strong>Distance:</strong> {displayDistance(recentRun.distance, distanceUnit)}<br />
                <strong>Pace:</strong> {formatPaceWithUnit(recentRun.pace, distanceUnit)}
              </p>
            </div>
            
            <textarea
              value={additionalContent}
              onChange={(e) => setAdditionalContent(e.target.value)}
              placeholder="Add a comment about your run..."
              rows={4}
              disabled={isPosting}
            />
            
            {/* Image Selection */}
            <ImagePicker
              images={selectedImages}
              onImageSelected={handleImageSelected}
              onImageRemoved={handleImageRemoved}
              disabled={isPosting}
              maxImages={4}
            />
            
            <div className="modal-buttons">
              <button onClick={() => {
                setShowPostModal(false);
                vibrate('light');
              }} disabled={isPosting}>
                Cancel
              </button>
              <button 
                onClick={handlePostSubmit} 
                disabled={isPosting}
                className="post-nostr-btn"
              >
                {isPosting ? 'Posting...' : 'Post to Nostr'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Countdown Overlay */}
      {isCountingDown && (
        <div className="countdown-overlay">
          <div className="countdown-container">
            <div className="countdown-number">{countdown}</div>
            <div className="countdown-text">
              {countdownType === 'start' ? 'Starting Soon' : 'Finishing Soon'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
