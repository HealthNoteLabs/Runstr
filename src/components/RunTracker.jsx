import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { useRunTracker } from '../contexts/RunTrackerContext';
import { useActivityMode } from '../contexts/ActivityModeContext';
import runDataService, { ACTIVITY_TYPES } from '../services/RunDataService';
import { PermissionDialog } from './PermissionDialog';
import { formatPaceWithUnit, displayDistance, convertDistance, formatElevation } from '../utils/formatters';
import { createAndPublishEvent, createWorkoutEvent } from '../utils/nostr';
import SplitsTable from './SplitsTable';
import DashboardRunCard from './DashboardRunCard';
import AchievementCard from './AchievementCard';
import GoalsDropdown from './GoalsDropdown';
import { validateEventRun, initializeEvents } from '../services/EventService';
import { PostRunWizardModal } from './PostRunWizardModal';
import { useContext } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { NostrContext } from '../contexts/NostrContext';
import { publishRun } from '../utils/runPublisher';
import appToast from '../utils/toast';
import { getWorkoutAssociations } from '../utils/teamChallengeHelper';
import { triggerRunStart, triggerRunStop, triggerRunPause, triggerSuccess, triggerError } from '../utils/haptics';
import { captureAndUploadPhoto, isCameraAvailable, getCameraErrorMessage } from '../utils/cameraUtils';

export const RunTracker = () => {
  const { 
    isTracking,
    isPaused,
    distance,
    duration,
    pace,
    elevation,
    splits,
    activityType,
    estimatedSteps,
    currentSpeed,
    startRun,
    pauseRun,
    resumeRun,
    stopRun
  } = useRunTracker();

  const { getActivityText, mode } = useActivityMode();
  const { distanceUnit, skipStartCountdown, skipEndCountdown, autoPostToNostr, autoPostKind1Note } = useSettings();
  const { publicKey, lightningAddress } = useContext(NostrContext);

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
  const [showPostRunWizard, setShowPostRunWizard] = useState(false);
  const [autoPublishing, setAutoPublishing] = useState(false);
  const [autoPublishingKind1, setAutoPublishingKind1] = useState(false);
  const [isAutoPost, setIsAutoPost] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);

  // Initialize events when the component mounts
  useEffect(() => {
    // Initialize events when the component mounts
    initializeEvents();
  }, []);

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
            
            // Check if the most recent run qualifies for any events
            const userPubkey = localStorage.getItem('nostrPublicKey');
            if (userPubkey && sortedRuns[0]) {
              const qualifyingEvents = validateEventRun(sortedRuns[0], userPubkey);
              
              // Notify user if their run qualified for an event
              if (qualifyingEvents && qualifyingEvents.length > 0) {
                const eventNames = qualifyingEvents.map(e => e.title).join(', ');
                const message = `Your run qualified for: ${eventNames}!`;
                
                if (window.Android && window.Android.showToast) {
                  window.Android.showToast(message);
                } else {
                  // Use a less intrusive way to notify
                  console.log(message);
                  // Could use a toast or notification component here
                }
              }
            }
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
    
    // Listen for run history updated events
    const handleRunHistoryUpdate = () => {
      console.log("Run history update event received");
      loadRecentRun();
    };
    
    // Listen for run deleted events
    const handleRunDeleted = (event) => {
      console.log("Run deleted event received", event.detail);
      // If we have the updated runs in the event detail, use them directly
      if (event.detail && event.detail.remainingRuns) {
        const sortedRuns = [...event.detail.remainingRuns].sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecentRun(sortedRuns.length > 0 ? sortedRuns[0] : null);
      } else {
        // Otherwise reload from storage
        loadRecentRun();
      }
    };
    
    document.addEventListener('runCompleted', handleRunCompleted);
    document.addEventListener('runHistoryUpdated', handleRunHistoryUpdate);
    document.addEventListener('runDeleted', handleRunDeleted);
    
    return () => {
      document.removeEventListener('runCompleted', handleRunCompleted);
      document.removeEventListener('runHistoryUpdated', handleRunHistoryUpdate);
      document.removeEventListener('runDeleted', handleRunDeleted);
    };
  }, []);

  // Handle posting to Nostr
  const handlePostToNostr = async () => {
    if (!recentRun) return;
    
    try {
      // Fetch team associations
      const associations = await getWorkoutAssociations();
      const teamInfo = associations.teamAssociation;
      
      // Generate workout summary content
      const run = recentRun;
      const activity = run.activityType || ACTIVITY_TYPES.RUN;
      const caloriesBurned = run.calories !== null && run.calories !== undefined 
        ? run.calories 
        : Math.round(run.distance * 0.06);

      let activitySpecificMetricLine = '';
      let introMessage = '';
      let primaryHashtag = '#Running';

      if (activity === ACTIVITY_TYPES.WALK) {
        const steps = run.estimatedTotalSteps !== undefined ? Math.round(run.estimatedTotalSteps).toLocaleString() : '0';
        activitySpecificMetricLine = `👟 Steps: ${steps} steps`;
        introMessage = `Just completed a walk with RUNSTR! 🚶‍♀️💨`;
        primaryHashtag = '#Walking';
      } else if (activity === ACTIVITY_TYPES.CYCLE) {
        const avgSpeed = run.averageSpeed && run.averageSpeed.value !== undefined ? parseFloat(run.averageSpeed.value).toFixed(1) : '0.0';
        const speedUnit = run.averageSpeed && run.averageSpeed.unit ? run.averageSpeed.unit : (distanceUnit === 'km' ? 'km/h' : 'mph');
        activitySpecificMetricLine = `🚴 Speed: ${avgSpeed} ${speedUnit}`;
        introMessage = `Just completed a cycle with RUNSTR! 🚴💨`;
        primaryHashtag = '#Cycling';
      } else {
        const paceValue = (run.duration / 60 / (distanceUnit === 'km' ? run.distance/1000 : run.distance/1609.344));
        const paceString = (paceValue && paceValue !== Infinity && paceValue !== 0) 
                          ? `${Math.floor(paceValue)}:${Math.round((paceValue - Math.floor(paceValue)) * 60).toString().padStart(2, '0')}`
                          : '-';
        activitySpecificMetricLine = `⚡ Pace: ${paceString} min/${distanceUnit}`;
        introMessage = `Just completed a run with RUNSTR! 🏃‍♂️💨`;
      }
      
      // Add team info if available
      const teamLine = teamInfo?.teamName ? `\n🏆 Team: ${teamInfo.teamName}` : '';
      
      const generatedContent = `${teamLine ? teamLine + '\n\n' : ''}${introMessage}

⏱️ Duration: ${runDataService.formatTime(run.duration)}
📏 Distance: ${displayDistance(run.distance, distanceUnit)}
${activitySpecificMetricLine}
🔥 Calories: ${caloriesBurned} kcal
${run.elevation && run.elevation.gain ? `\n🏔️ Elevation Gain: ${formatElevation(run.elevation.gain, distanceUnit)}` : ''}
${run.elevation && run.elevation.loss ? `\n📉 Elevation Loss: ${formatElevation(run.elevation.loss, distanceUnit)}` : ''}
#RUNSTR ${primaryHashtag}`.trim();

      setAdditionalContent(generatedContent);
      setIsAutoPost(true); // Mark as auto-generated to make it read-only
      setShowPostModal(true);
    } catch (error) {
      console.error('Error preparing post content:', error);
      // Fallback to empty content if there's an error
      setAdditionalContent('');
      setIsAutoPost(false);
      setShowPostModal(true);
    }
  };

  const handlePostSubmit = async () => {
    if (!recentRun) return;
    
    // Trigger haptic feedback for posting action
    triggerSuccess();
    setIsPosting(true);
    
    try {
      // Create the event template for nostr-tools
      const eventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['t', 'RUNSTR'], // Uppercase app name
          ['t', 'Running'] // Default tag, could be dynamic based on activity
        ],
        content: additionalContent
      };

      // Use the createAndPublishEvent function from nostr-tools
      const publishedEvent = await createAndPublishEvent(eventTemplate);
      
      // Save the event ID to track that this run has been posted
      if (publishedEvent?.id) {
        recentRun.nostrKind1EventId = publishedEvent.id;
        runDataService.updateRun(recentRun.id, { nostrKind1EventId: publishedEvent.id });
      }
      
      setShowPostModal(false);
      setAdditionalContent('');
      setIsAutoPost(false);
      setCapturedImage(null);
      
      // Show success message
      const successMsg = `Successfully posted to Nostr!`;
      if (window.Android && window.Android.showToast) {
        window.Android.showToast(successMsg);
      } else {
        appToast.success(successMsg);
      }
    } catch (error) {
      console.error('Error posting to Nostr:', error);
      
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to post to Nostr: ' + error.message);
      } else {
        appToast.error('Failed to post to Nostr: ' + error.message);
      }
    } finally {
      setIsPosting(false);
    }
  };

  // Handle taking a photo for the post
  const handleTakePhoto = async () => {
    if (!isCameraAvailable()) {
      appToast.error('Camera is not available on this device');
      return;
    }

    setIsTakingPhoto(true);
    
    try {
      const result = await captureAndUploadPhoto({
        quality: 80,
        width: 1024,
        height: 1024
      }, `workout-${Date.now()}.jpg`);
      
      setCapturedImage({
        url: result.imageUrl,
        dataUrl: result.dataUrl
      });
      
      // Add image URL to content if not already present
      if (additionalContent && !additionalContent.includes(result.imageUrl)) {
        setAdditionalContent(prev => prev + `\n\n${result.imageUrl}`);
      } else if (!additionalContent) {
        setAdditionalContent(result.imageUrl);
      }
      
      appToast.success('Photo captured and uploaded successfully!');
    } catch (error) {
      console.error('Error capturing photo:', error);
      const errorMessage = getCameraErrorMessage(error);
      appToast.error(errorMessage);
    } finally {
      setIsTakingPhoto(false);
    }
  };

  // Handle removing the captured photo
  const handleRemovePhoto = () => {
    if (capturedImage) {
      // Remove the image URL from content
      const imageUrl = capturedImage.url;
      setAdditionalContent(prev => prev.replace(imageUrl, '').replace(/\n\n\n+/g, '\n\n').trim());
      setCapturedImage(null);
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
    // Trigger haptic feedback for starting a run
    triggerRunStart();
    
    // Check if the user has already granted permissions
    const permissionsGranted = localStorage.getItem('permissionsGranted');
    
    if (permissionsGranted === 'true') {
      // If permissions already granted, start the countdown or run directly
      if (skipStartCountdown) {
        startRun();
      } else {
        startCountdown('start');
      }
    } else {
      // If permissions haven't been granted yet, show a message
      appToast.error('Location permission is required for tracking. Please restart the app to grant permissions.');
      // Set the flag to show permission dialog next time the app starts
      localStorage.removeItem('permissionsGranted');
    }
  };

  // Enhanced handlers with haptic feedback
  const handleResumeRun = () => {
    triggerRunStart();
    resumeRun();
  };

  const handlePauseRun = () => {
    triggerRunPause();
    pauseRun();
  };

  const handleStopRun = () => {
    triggerRunStop();
    if (skipEndCountdown) {
      stopRun();
    } else {
      startCountdown('stop');
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
  
  // Determine what to display in the 'Pace' card based on activityType from context
  let primaryMetricLabel = "Pace";
  let primaryMetricValue = formattedPace.split(' ')[0];
  let primaryMetricUnit = formattedPace.split(' ')[1] || "";

  // Use activityType from RunTrackerContext for live, or recentRun.activityType for completed run summary
  const displayActivityType = isTracking ? activityType : (recentRun ? recentRun.activityType : mode);

  if (displayActivityType === ACTIVITY_TYPES.WALK) {
    primaryMetricLabel = "Steps";
    if (!isTracking && recentRun && recentRun.estimatedTotalSteps !== undefined) {
      primaryMetricValue = String(Math.round(recentRun.estimatedTotalSteps));
    } else if (isTracking && estimatedSteps !== undefined) {
      primaryMetricValue = String(Math.round(estimatedSteps));
    } else {
      primaryMetricValue = "0";
    }
    primaryMetricUnit = "steps"; // Always "steps" for consistency if value is 0
  } else if (displayActivityType === ACTIVITY_TYPES.CYCLE) {
    primaryMetricLabel = "Speed";
    if (!isTracking && recentRun && recentRun.averageSpeed && recentRun.averageSpeed.value !== undefined) {
      primaryMetricValue = String(parseFloat(recentRun.averageSpeed.value).toFixed(1));
      primaryMetricUnit = recentRun.averageSpeed.unit;
    } else if (isTracking && currentSpeed && currentSpeed.value !== undefined && currentSpeed.unit) {
      primaryMetricValue = String(parseFloat(currentSpeed.value).toFixed(1));
      primaryMetricUnit = currentSpeed.unit;
    } else {
      primaryMetricValue = "0.0";
      primaryMetricUnit = (distanceUnit === 'km' ? 'km/h' : 'mph');
    }
  }
  // For RUN, it defaults to `formattedPace` which is already set

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
    
    // Trigger haptic feedback for save action
    triggerSuccess();
    setIsSavingWorkout(true);
    setWorkoutSaved(false);
    
    try {
      // Get team and challenge associations
      const { getWorkoutAssociations } = await import('../utils/teamChallengeHelper');
      const { teamAssociation, challengeUUIDs, challengeNames, userPubkey } = await getWorkoutAssociations();
      
      // Create a workout event with kind 1301 format including team/challenge tags
      const workoutEvent = createWorkoutEvent(recentRun, distanceUnit, { 
        teamAssociation, 
        challengeUUIDs, 
        challengeNames, 
        userPubkey 
      });
      
      // Use the existing createAndPublishEvent function
      const publishedEvent = await createAndPublishEvent(workoutEvent);
      
      const publishedEventId = publishedEvent?.id;
      if (publishedEventId) {
        setWorkoutSaved(true);
        recentRun.nostrWorkoutEventId = publishedEventId;
        runDataService.updateRun(recentRun.id, { nostrWorkoutEventId: publishedEventId });
        setShowPostRunWizard(true);
        // Streak & reward are now automatically handled when the run is saved.
      } else {
        throw new Error('Failed to get ID from published workout event.');
      }
    } catch (error) {
      console.error('Error saving workout record:', error);
      
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to save workout record: ' + error.message);
      } else {
        appToast.error('Failed to save workout record: ' + error.message);
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
    
    // Trigger haptic feedback for delete action (error pattern)
    triggerError();
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
        appToast.success('Run deleted successfully');
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
        appToast.error('Failed to delete run: ' + error.message);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const attemptAutoPostWorkout = async () => {
      if (!autoPostToNostr || !recentRun || recentRun.nostrWorkoutEventId || autoPublishing) return;
      
      try {
        setAutoPublishing(true);
        
        // Use the same proven pattern as handleSaveWorkoutRecord
        // Get team and challenge associations
        const { getWorkoutAssociations } = await import('../utils/teamChallengeHelper');
        const { teamAssociation, challengeUUIDs, challengeNames, userPubkey } = await getWorkoutAssociations();
        
        // Create a workout event with kind 1301 format including team/challenge tags
        const workoutEvent = createWorkoutEvent(recentRun, distanceUnit, { 
          teamAssociation, 
          challengeUUIDs, 
          challengeNames, 
          userPubkey 
        });
        
        // Use the existing createAndPublishEvent function
        const publishedEvent = await createAndPublishEvent(workoutEvent);
        
        const publishedEventId = publishedEvent?.id;
        if (publishedEventId) {
          // Update the run with the published event ID
          recentRun.nostrWorkoutEventId = publishedEventId;
          runDataService.updateRun(recentRun.id, { nostrWorkoutEventId: publishedEventId });
          
          // Show success feedback
          if (window.Android && window.Android.showToast) {
            window.Android.showToast('Run automatically published to Nostr!');
          } else {
            appToast.success('Run automatically published to Nostr!');
          }
        } else {
          throw new Error('Failed to get ID from published workout event.');
        }
      } catch (err) {
        console.error('Auto-post workout failed:', err);
        
        // Show error feedback
        const errorMessage = `Auto-post workout to Nostr failed: ${err.message}`;
        if (window.Android && window.Android.showToast) {
          window.Android.showToast(errorMessage);
        } else {
          appToast.error(errorMessage);
        }
      } finally {
        setAutoPublishing(false);
      }
    };

    const attemptAutoPostKind1 = async () => {
      if (!autoPostKind1Note || !recentRun || recentRun.nostrKind1EventId || recentRun.autoPostKind1Declined || autoPublishingKind1) return;
      
      try {
        setAutoPublishingKind1(true);
        
        // Generate the kind 1 content using the same format as manual posts
        const run = recentRun;
        const activity = run.activityType || ACTIVITY_TYPES.RUN;
        const caloriesBurned = run.calories !== null && run.calories !== undefined 
          ? run.calories 
          : Math.round(run.distance * 0.06);

        let activitySpecificMetricLine = '';
        let introMessage = '';
        let primaryHashtag = '#Running';

        if (activity === ACTIVITY_TYPES.WALK) {
          const steps = run.estimatedTotalSteps !== undefined ? Math.round(run.estimatedTotalSteps).toLocaleString() : '0';
          activitySpecificMetricLine = `👟 Steps: ${steps} steps`;
          introMessage = `Just completed a walk with RUNSTR! 🚶‍♀️💨`;
          primaryHashtag = '#Walking';
        } else if (activity === ACTIVITY_TYPES.CYCLE) {
          const avgSpeed = run.averageSpeed && run.averageSpeed.value !== undefined ? parseFloat(run.averageSpeed.value).toFixed(1) : '0.0';
          const speedUnit = run.averageSpeed && run.averageSpeed.unit ? run.averageSpeed.unit : (distanceUnit === 'km' ? 'km/h' : 'mph');
          activitySpecificMetricLine = `🚴 Speed: ${avgSpeed} ${speedUnit}`;
          introMessage = `Just completed a cycle with RUNSTR! 🚴💨`;
          primaryHashtag = '#Cycling';
        } else {
          const paceValue = (run.duration / 60 / (distanceUnit === 'km' ? run.distance/1000 : run.distance/1609.344));
          const paceString = (paceValue && paceValue !== Infinity && paceValue !== 0) 
                            ? `${Math.floor(paceValue)}:${Math.round((paceValue - Math.floor(paceValue)) * 60).toString().padStart(2, '0')}`
                            : '-';
          activitySpecificMetricLine = `⚡ Pace: ${paceString} min/${distanceUnit}`;
          introMessage = `Just completed a run with RUNSTR! 🏃‍♂️💨`;
        }
        
        const generatedContent = `
${introMessage}

⏱️ Duration: ${runDataService.formatTime(run.duration)}
📏 Distance: ${displayDistance(run.distance, distanceUnit)}
${activitySpecificMetricLine}
🔥 Calories: ${caloriesBurned} kcal
${run.elevation && run.elevation.gain ? `\n🏔️ Elevation Gain: ${formatElevation(run.elevation.gain, distanceUnit)}` : ''}
${run.elevation && run.elevation.loss ? `\n📉 Elevation Loss: ${formatElevation(run.elevation.loss, distanceUnit)}` : ''}
#RUNSTR ${primaryHashtag}
`.trim();

        // Pre-populate the modal with the generated content
        setAdditionalContent(generatedContent);
        setIsAutoPost(true);
        setShowPostModal(true);
        
      } catch (err) {
        console.error('Auto-post kind 1 preparation failed:', err);
        
        // Show error feedback
        const errorMessage = `Auto-post note preparation failed: ${err.message}`;
        if (window.Android && window.Android.showToast) {
          window.Android.showToast(errorMessage);
        } else {
          appToast.error(errorMessage);
        }
      } finally {
        setAutoPublishingKind1(false);
      }
    };

    // Sequential auto-posting: first workout (kind 1301), then kind 1 note
    const handleAutoPosting = async () => {
      if (!recentRun) return;
      
      // First attempt workout auto-post
      await attemptAutoPostWorkout();
      
      // Then attempt kind 1 auto-post (only if enabled and not already publishing)
      if (autoPostKind1Note && !autoPublishingKind1) {
        // Small delay to ensure workout post completes first
        setTimeout(() => {
          attemptAutoPostKind1();
        }, 1000);
      }
    };

    handleAutoPosting();
  }, [recentRun, autoPostToNostr, autoPostKind1Note, distanceUnit, autoPublishing, autoPublishingKind1]);

  return (
    <div className="w-full h-full flex flex-col bg-bg-primary text-text-primary relative">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {/* Distance Card */}
        <div className="bg-bg-secondary p-4 rounded-xl shadow-lg flex flex-col border border-border-secondary">
          <div className="flex items-center mb-2">
            <div className="w-7 h-7 rounded-full bg-success/20 flex items-center justify-center mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-sm text-text-secondary">Distance</span>
          </div>
          <div className="display-text">{convertDistance(distance, distanceUnit)}</div>
          <div className="text-sm text-text-muted">{distanceUnit}</div>
        </div>

        {/* Time Card */}
        <div className="bg-bg-secondary p-4 rounded-xl shadow-lg flex flex-col border border-border-secondary">
          <div className="flex items-center mb-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm text-text-secondary">Time</span>
          </div>
          <div className="display-text">{runDataService.formatTime(duration)}</div>
        </div>

        {/* Pace Card / Dynamic Metric Card */}
        <div className="bg-bg-secondary p-4 rounded-xl shadow-lg flex flex-col border border-border-secondary">
          <div className="flex items-center mb-2">
            <div className="w-7 h-7 rounded-full bg-warning/20 flex items-center justify-center mr-2">
              {/* Icon can also be dynamic based on metric type if desired */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-sm text-text-secondary">{primaryMetricLabel}</span>
          </div>
          <div className="display-text">{primaryMetricValue}</div>
          {primaryMetricUnit && <div className="text-sm text-text-muted">{primaryMetricUnit}</div>}
        </div>

        {/* Elevation Card */}
        <div className="bg-bg-secondary p-4 rounded-xl shadow-lg flex flex-col border border-border-secondary">
          <div className="flex items-center mb-2">
            <div className="w-7 h-7 rounded-full bg-info/20 flex items-center justify-center mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </div>
            <span className="text-sm text-text-secondary">Elevation</span>
          </div>
          <div className="display-text">{elevation ? formatElevation(elevation.gain, distanceUnit) : '0'}</div>
          <div className="text-sm text-text-muted">{distanceUnit === 'mi' ? 'ft' : 'm'}</div>
        </div>
      </div>
      
      {/* Start Activity Button / Control Buttons */}
      {!isTracking ? (
        <Button 
          onClick={initiateRun}
          variant="start-run"
          size="lg"
          className="mx-4 my-4 text-lg font-semibold"
        >
          {getActivityText('start')}
        </Button>
      ) : (
        <div className="flex justify-between px-4 my-4">
          {isPaused ? (
            <Button 
              onClick={handleResumeRun}
              variant="success"
              className="flex-1 mr-2 font-semibold bg-bg-secondary border border-border-secondary hover:bg-bg-tertiary"
            >
              Resume
            </Button>
          ) : (
            <Button 
              onClick={handlePauseRun}
              variant="warning"
              className="flex-1 mr-2 font-semibold bg-bg-secondary border border-border-secondary hover:bg-bg-tertiary"
            >
              Pause
            </Button>
          )}
          <Button 
            onClick={handleStopRun}
            variant="error"
            className="flex-1 ml-2 font-semibold bg-bg-secondary border border-border-secondary hover:bg-bg-tertiary"
          >
            Stop
          </Button>
        </div>
      )}
      
      {/* Splits Table - Show only when tracking and splits exist */}
      {isTracking && splits && splits.length > 0 && (
        <div className="bg-bg-secondary rounded-xl shadow-lg mt-2 mx-4 p-4 overflow-hidden border border-border-secondary">
          <div className="flex items-center mb-2">
            <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-sm font-medium text-text-secondary">Split Times</span>
          </div>
          <div className="mt-2">
            <SplitsTable splits={splits} distanceUnit={distanceUnit} />
          </div>
          {splits.length > 5 && (
            <p className="text-xs text-text-muted text-center mt-2">
              Swipe to see more splits if needed
            </p>
          )}
        </div>
      )}
      
      {/* Achievements & Rewards Card - Show only when not tracking */}
      {!isTracking && (
        <div className="mx-4">
          {/* Goals Dropdown - Show above Weekly Rewards Summary */}
          <GoalsDropdown />
          
          <AchievementCard 
            currentStreak={
              // Calculate streak based on recent runs - fallback to 0 if not available
              recentRun?.streak || localStorage.getItem('currentStreak') ? 
                parseInt(localStorage.getItem('currentStreak')) : 0
            } 
          />
        </div>
      )}
      
      {/* Recent Activities Section with New DashboardRunCard */}
      {!isTracking && recentRun && (
        <div className="mt-6 mx-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="subsection-heading">{getActivityText('recent')}</h3>
          </div>
          
          <DashboardRunCard
            run={{
              ...recentRun,
              title: recentRun.title || `${getTimeOfDay(recentRun.timestamp)} ${recentRun.activityType === 'walk' ? 'Walk' : recentRun.activityType === 'cycle' ? 'Cycle' : 'Run'}`,
              date: formatRunDate(recentRun.date),
              // Pass the determined main metric to DashboardRunCard
              mainMetricLabel: recentRun.activityType === ACTIVITY_TYPES.WALK 
                ? "Total Steps" 
                : recentRun.activityType === ACTIVITY_TYPES.CYCLE 
                  ? "Avg Speed" 
                  : "Avg Pace",
              mainMetricValue: recentRun.activityType === ACTIVITY_TYPES.WALK
                ? (recentRun.estimatedTotalSteps !== undefined ? Math.round(recentRun.estimatedTotalSteps).toLocaleString() : '0')
                : recentRun.activityType === ACTIVITY_TYPES.CYCLE
                  ? (recentRun.averageSpeed && recentRun.averageSpeed.value !== undefined ? parseFloat(recentRun.averageSpeed.value).toFixed(1) : '0.0')
                  : (runDataService.calculatePace(recentRun.distance, recentRun.duration, distanceUnit) ? `${Math.floor(runDataService.calculatePace(recentRun.distance, recentRun.duration, distanceUnit))}:${Math.round((runDataService.calculatePace(recentRun.distance, recentRun.duration, distanceUnit) - Math.floor(runDataService.calculatePace(recentRun.distance, recentRun.duration, distanceUnit))) * 60).toString().padStart(2, '0')}` : '-'),
              mainMetricUnit: recentRun.activityType === ACTIVITY_TYPES.WALK
                ? "steps"
                : recentRun.activityType === ACTIVITY_TYPES.CYCLE
                  ? (recentRun.averageSpeed && recentRun.averageSpeed.unit ? recentRun.averageSpeed.unit : (distanceUnit === 'km' ? 'km/h' : 'mph'))
                  : (runDataService.calculatePace(recentRun.distance, recentRun.duration, distanceUnit) ? `min/${distanceUnit}` : '' )
            }}
            formatTime={runDataService.formatTime}
            displayDistance={displayDistance}
            distanceUnit={distanceUnit}
            onShare={handlePostToNostr}
            onSave={handleSaveWorkoutRecord}
            onDelete={handleDeleteRun}
            isSaving={isSavingWorkout}
            isWorkoutSaved={!!recentRun.nostrWorkoutEventId}
            isDeleting={isDeleting}
            isKind1Posted={!!recentRun.nostrKind1EventId}
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
            <div className="text-6xl font-bold mb-4 text-text-primary">{countdown}</div>
            <div className="text-xl text-text-secondary">
              {countdownType === 'start' ? 'Starting run...' : 'Stopping run...'}
            </div>
          </div>
        </div>
      )}
      
      {/* Post to Nostr modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-bg-secondary rounded-xl p-6 w-full max-w-md border border-border-primary">
            <h3 className="text-xl font-semibold mb-4 text-text-primary">
              Post Run to Nostr
            </h3>
            {isAutoPost && (
              <p className="text-sm text-text-secondary mb-3">
                Your run summary has been prepared with your workout details.
              </p>
            )}
            
            {/* Camera Section */}
            {isCameraAvailable() && !isAutoPost && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text-secondary">Add Photo</span>
                  {!capturedImage && (
                    <Button
                      onClick={handleTakePhoto}
                      disabled={isTakingPhoto || isPosting}
                      variant="outline"
                      size="sm"
                      className="flex items-center space-x-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{isTakingPhoto ? 'Taking Photo...' : 'Take Photo'}</span>
                    </Button>
                  )}
                </div>
                
                {/* Image Preview */}
                {capturedImage && (
                  <div className="relative bg-bg-tertiary rounded-lg p-2 border border-border-secondary">
                    <img 
                      src={capturedImage.dataUrl} 
                      alt="Workout photo preview" 
                      className="w-full h-32 object-cover rounded"
                    />
                    <button
                      onClick={handleRemovePhoto}
                      disabled={isPosting}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                    >
                      ×
                    </button>
                    <p className="text-xs text-text-muted mt-1">Photo will be included in your post</p>
                  </div>
                )}
              </div>
            )}
            
            <textarea
              value={additionalContent}
              onChange={(e) => setAdditionalContent(e.target.value)}
              placeholder={isAutoPost ? "Edit your run summary..." : "Add any additional comments or hashtags..."}
              rows={isAutoPost ? 12 : 4}
              className="w-full bg-bg-tertiary border border-border-secondary rounded-lg p-3 mb-4 text-text-primary placeholder-text-muted focus:border-border-focus outline-none"
              disabled={isPosting}
              readOnly={isAutoPost}
            />
            <div className="flex justify-end space-x-3">
              <Button 
                onClick={() => {
                  // Track cancellation for auto-posts to prevent modal from reappearing
                  if (isAutoPost && recentRun) {
                    recentRun.autoPostKind1Declined = true;
                    runDataService.updateRun(recentRun.id, { autoPostKind1Declined: true });
                  }
                  setShowPostModal(false);
                  setAdditionalContent('');
                  setIsAutoPost(false);
                  setCapturedImage(null);
                }} 
                disabled={isPosting}
                variant="outline"
              >
                Cancel
              </Button>
              <Button 
                onClick={handlePostSubmit} 
                disabled={isPosting}
                variant="default"
              >
                {isPosting ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {showPostRunWizard && recentRun && (
        <PostRunWizardModal run={recentRun} onClose={() => setShowPostRunWizard(false)} />
      )}
    </div>
  );
};
