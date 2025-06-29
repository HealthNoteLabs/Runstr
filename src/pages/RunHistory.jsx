import { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createAndPublishEvent, createWorkoutEvent } from '../utils/nostr';
import { useRunStats } from '../hooks/useRunStats';
import { useRunProfile } from '../hooks/useRunProfile';
import { formatTime, displayDistance, formatElevation, formatDate } from '../utils/formatters';
import runDataService, { ACTIVITY_TYPES } from '../services/RunDataService';
import SplitsTable from '../components/SplitsTable';
import { useActivityMode } from '../contexts/ActivityModeContext';
import { useSettings } from '../contexts/SettingsContext';
import { RunHistoryCard } from '../components/RunHistoryCard';
import { SaveRunExtrasModal } from '../components/SaveRunExtrasModal';
import { rewardUserActivity } from '../services/rewardService';
import { NostrContext } from '../contexts/NostrContext';
import { useSeasonSubscription } from '../hooks/useSeasonSubscription';
import { REWARDS } from '../config/rewardsConfig';
import appToast from '../utils/toast';

const AVERAGE_STRIDE_LENGTH_METERS = 0.73; // average stride length (adjusted from 0.762)

// Helper function to estimate stride length based on height
// This function will now effectively always return AVERAGE_STRIDE_LENGTH_METERS
// since userHeight and customStrideLength localStorage items are no longer set by UI.
const estimateStrideLength = (heightCm) => {
  if (!heightCm || heightCm < 100 || heightCm > 250) {
    return AVERAGE_STRIDE_LENGTH_METERS;
  }
  const heightInches = heightCm / 2.54;
  const strideLengthInches = heightInches * 0.414;
  const strideLengthMeters = strideLengthInches * 0.0254;
  // Even if height was somehow set, we might want to ensure it doesn't override
  // the new default approach if we are strictly moving away from height-based estimation.
  // For now, leaving this part of the function as is, but its inputs from localStorage are gone.
  return strideLengthMeters; 
};

// Get custom stride length from settings or calculate from height
// This function will also now effectively always return AVERAGE_STRIDE_LENGTH_METERS
const getCustomStrideLength = () => {
  const customStrideLength = parseFloat(localStorage.getItem('customStrideLength'));
  if (customStrideLength && customStrideLength > 0) {
    // UI for setting this is removed, but if old value exists, it might be used.
    // To strictly enforce the new default, we could ignore this.
    // For now, if an old value is there, it might still take precedence if not cleared.
    // However, the intent is to move to the single default.
    // To ensure the new default is used, we should make this function simply return AVERAGE_STRIDE_LENGTH_METERS
    // return customStrideLength;
  }
  const userHeight = parseFloat(localStorage.getItem('userHeight'));
  if (userHeight && userHeight > 0) {
    // Similar to above, UI is removed. To enforce default:
    // return estimateStrideLength(userHeight);
  }
  return AVERAGE_STRIDE_LENGTH_METERS;
};

// Add Stat component for consistent styling
const Stat = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-xs text-text-muted">{label}</span>
    <span className="text-sm font-semibold text-text-primary">{value}</span>
  </div>
);

export const RunHistory = () => {
  const navigate = useNavigate();
  const { mode, getActivityText } = useActivityMode();
  const { distanceUnit, publishMode } = useSettings();
  const { publicKey } = useContext(NostrContext);
  const subscription = useSeasonSubscription(publicKey);
  
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

  // State for the new modal
  const [showSaveExtrasModal, setShowSaveExtrasModal] = useState(false);
  const [currentRunForExtras, setCurrentRunForExtras] = useState(null);
  const [currentWorkoutEventId, setCurrentWorkoutEventId] = useState(null);

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
      const now = Date.now(); // Use UTC timestamp for comparison
      
      // First pass: identify unique runs and fix missing IDs, future timestamps, and unrealistic values
      const fixedRuns = parsedRuns.reduce((acc, run) => {
        let runTimestamp = run.timestamp;

        // Check if timestamp is valid or in the future
        if (typeof runTimestamp !== 'number' || isNaN(runTimestamp) || runTimestamp > now) {
          // If timestamp is invalid or future, attempt to use run.date (YYYY-MM-DD)
          // If run.date is also problematic, default to current time.
          const dateFromRunDateString = new Date(run.date).getTime();
          if (run.date && !isNaN(dateFromRunDateString) && dateFromRunDateString <= now) {
            run.timestamp = dateFromRunDateString;
          } else {
            run.timestamp = now; // Default to current time as a last resort
          }
          // Update the run.date field to be consistent with the (potentially new) timestamp
          run.date = new Date(run.timestamp).toISOString().split('T')[0];
          runDataService.updateRun(run.id, { timestamp: run.timestamp, date: run.date });
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

      // Sort runs by timestamp (newest first)
      fixedRuns.sort((a, b) => b.timestamp - a.timestamp);

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
        appToast.error('Failed to delete run');
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
        appToast.success('Successfully posted to Nostr!');
      }
    } catch (error) {
      console.error('Error posting to Nostr:', error);
      
      // Use a toast notification instead of alert for Android
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to post to Nostr: ' + error.message);
      } else {
        appToast.error('Failed to post to Nostr: ' + error.message);
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
    let publishedWorkoutEventId = null;
    
    try {
      // Get team and challenge associations
      const { getWorkoutAssociations } = await import('../utils/teamChallengeHelper');
      const { teamAssociation, challengeUUIDs, challengeNames, userPubkey } = await getWorkoutAssociations();
      
      // Prepare season subscription information if user is subscribed
      let seasonSubscription = undefined;
      if (subscription.phase === 'current' && subscription.tier) {
        seasonSubscription = {
          tier: subscription.tier,
          identifier: REWARDS.SEASON_1.identifier
        };
      }
      
      // Create workout event with team/challenge tags
      const workoutEvent = createWorkoutEvent(run, distanceUnit, { 
        teamAssociation, 
        challengeUUIDs, 
        challengeNames, 
        userPubkey,
        seasonSubscription
      });
      const publishedEvent = await createAndPublishEvent(workoutEvent);
      publishedWorkoutEventId = publishedEvent?.id;

      if (publishedWorkoutEventId) {
        setWorkoutSavedRuns(prev => new Set([...prev, run.id]));
        const rewardSats = publishMode === 'private' ? 10 : 5;
        if (publicKey) {
          rewardUserActivity(publicKey, 'workout_record', publishMode === 'private');
        }
        const msg = `Main workout record saved! Now choose extras. (+${rewardSats} sats)`;
        if (window.Android && window.Android.showToast) {
          window.Android.showToast(msg);
        } else {
          appToast.info(msg);
        }
        // Open the extras modal
        setCurrentRunForExtras(run);
        setCurrentWorkoutEventId(publishedWorkoutEventId);
        setShowSaveExtrasModal(true);
      } else {
        throw new Error('Failed to get ID from published workout event.');
      }

    } catch (error) {
      console.error('Error saving main workout record:', error);
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to save main workout record: ' + error.message);
      } else {
        appToast.error('Failed to save main workout record: ' + error.message);
      }
    } finally {
      // We don't set isSavingWorkout to false here if modal is opening
      // The modal itself will handle further user interaction an UI state.
      // If extras modal isn't shown due to an error, then reset.
      if (!publishedWorkoutEventId) {
          setIsSavingWorkout(false);
          setSavingWorkoutRunId(null);
      }
    }
  };

  const handleCloseSaveExtrasModal = () => {
    setShowSaveExtrasModal(false);
    setCurrentRunForExtras(null);
    setCurrentWorkoutEventId(null);
    // Reset saving state after extras modal is closed
    setIsSavingWorkout(false);
    setSavingWorkoutRunId(null);
  };

  const handlePublishExtrasSuccess = ({ intensityEventId, caloricEventId, errors }) => {
    if (errors && errors.length > 0) {
      const errorMsg = 'Extras publishing failed: ' + errors.join(', ');
      if (window.Android && window.Android.showToast) {
        window.Android.showToast(errorMsg);
      } else {
        appToast.error(errorMsg);
      }
    } else {
      let successMsg = 'Workout extras published successfully!';
      if(intensityEventId && caloricEventId) successMsg = 'Intensity and Calories published!';
      else if(intensityEventId) successMsg = 'Intensity published!';
      else if(caloricEventId) successMsg = 'Calories published!';
      else successMsg = 'No extras selected to publish.'; // Or handle as 'skipped' in modal

      if (window.Android && window.Android.showToast) {
        window.Android.showToast(successMsg);
      } else {
        appToast.success(successMsg);
      }
    }
    // The modal itself calls onClose which triggers handleCloseSaveExtrasModal to reset states.
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
      <div className="p-4 space-y-6 bg-bg-primary min-h-screen">
        <h2 className="page-title">{getActivityText('history')}</h2>
        <div className="my-4">
          <Link 
            to="/nostr-stats" 
            className="w-full text-center px-4 py-3 bg-bg-secondary hover:bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary font-semibold transition-colors duration-150 block md:w-auto md:inline-block"
          >
            Nostr Workout Record
          </Link>
        </div>
        
        {/* Overall Stats */}
        <div className="grid grid-cols-2 gap-4 bg-bg-secondary p-4 rounded-lg text-sm border border-border-secondary">
          <Stat label="Total Distance" value={displayDistance(stats.totalDistance, distanceUnit)} />
          <Stat label="Total Runs" value={stats.totalRuns} />
          <Stat 
            label="Current Streak" 
            value={`${stats.currentStreak} days`} 
          />
          <Stat 
            label="Average Pace" 
            value={stats.averagePace === 0 
              ? '-' 
              : `${Math.floor(stats.averagePace)}:${Math.round(stats.averagePace % 1 * 60).toString().padStart(2, '0')} min/${distanceUnit}`
            } 
          />
          <Stat 
            label="Fastest Pace" 
            value={stats.fastestPace === 0
              ? '-'
              : `${Math.floor(stats.fastestPace)}:${Math.round(stats.fastestPace % 1 * 60).toString().padStart(2, '0')} min/${distanceUnit}`
            } 
          />
          <Stat label="Longest Run" value={displayDistance(stats.longestRun, distanceUnit)} />
        </div>

        {/* Calorie Tracking */}
        <div className="bg-bg-secondary p-4 rounded-lg border border-border-secondary">
          <h3 className="subsection-heading mb-3">Calorie Tracking</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Stat label="Total Calories Burned" value={`${stats.totalCaloriesBurned.toLocaleString()} kcal`} />
            <Stat label={`Avg. Calories per ${distanceUnit.toUpperCase()}`} value={`${Math.round(stats.averageCaloriesPerKm)} kcal`} />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-bg-secondary p-4 rounded-lg border border-border-secondary">
          <h3 className="subsection-heading mb-3">Recent Activity</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Stat label="This Week" value={displayDistance(stats.thisWeekDistance, distanceUnit)} />
            <Stat label="This Month" value={displayDistance(stats.thisMonthDistance, distanceUnit)} />
          </div>
        </div>

        {/* Personal Bests */}
        <div className="bg-bg-secondary p-4 rounded-lg border border-border-secondary">
          <h3 className="subsection-heading mb-3">Personal Bests</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Stat 
              label="5K" 
              value={stats.personalBests['5k'] === 0
                ? '-'
                : `${Math.floor(stats.personalBests['5k'])}:${Math.round(stats.personalBests['5k'] % 1 * 60).toString().padStart(2, '0')} min/${distanceUnit}`
              }
            />
            <Stat 
              label="10K" 
              value={stats.personalBests['10k'] === 0
                ? '-'
                : `${Math.floor(stats.personalBests['10k'])}:${Math.round(stats.personalBests['10k'] % 1 * 60).toString().padStart(2, '0')} min/${distanceUnit}`
              }
            />
            <Stat 
              label="Half Marathon" 
              value={stats.personalBests['halfMarathon'] === 0
                ? '-'
                : `${Math.floor(stats.personalBests['halfMarathon'])}:${Math.round(stats.personalBests['halfMarathon'] % 1 * 60).toString().padStart(2, '0')} min/${distanceUnit}`
              }
            />
            <Stat 
              label="Marathon" 
              value={stats.personalBests['marathon'] === 0
                ? '-'
                : `${Math.floor(stats.personalBests['marathon'])}:${Math.round(stats.personalBests['marathon'] % 1 * 60).toString().padStart(2, '0')} min/${distanceUnit}`
              }
            />
          </div>
        </div>

        {/* Elevation Data */}
        <div className="bg-bg-secondary p-4 rounded-lg border border-border-secondary">
          <h3 className="subsection-heading mb-3">Elevation Data</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Stat 
              label="Total Elevation Gain" 
              value={formatElevation(
                runHistory.reduce((sum, run) => sum + (run.elevation?.gain || 0), 0),
                distanceUnit
              )}
            />
            <Stat 
              label="Total Elevation Loss" 
              value={formatElevation(
                runHistory.reduce((sum, run) => sum + (run.elevation?.loss || 0), 0),
                distanceUnit
              )}
            />
          </div>
        </div>
      </div>

      <div className="p-4">
        <h2 className="section-heading">Run History</h2>
        {filteredHistory.length === 0 ? (
          <p>No runs recorded yet</p>
        ) : (
          <ul className="history-list">
            {filteredHistory.map((run) => {
              const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration);
              
              // Calculate pace with the consistent service method
              const existingPace = runDataService.calculatePace(run.distance, run.duration, distanceUnit).toFixed(2);
              
              // Check if workout has been saved for this run
              const isWorkoutSaved = workoutSavedRuns.has(run.id);

              // Prepare props for RunHistoryCard based on activity type
              let displayMetricValue;
              let displayMetricLabel;
              let displayMetricUnit;

              const currentActivityType = run.activityType || ACTIVITY_TYPES.RUN; // Default to RUN if not present

              if (currentActivityType === ACTIVITY_TYPES.WALK) {
                // Ensure distance is in meters for step calculation
                // Assuming run.distance is already in meters as per typical GPS data
                const distanceInMeters = run.distance; 
                displayMetricValue = distanceInMeters > 0 ? Math.round(distanceInMeters / getCustomStrideLength()) : 0;
                displayMetricLabel = 'Steps';
                displayMetricUnit = ''; // No unit for steps, or could be "steps"
              } else if (currentActivityType === ACTIVITY_TYPES.CYCLE) {
                // Ensure distance is in meters and duration in seconds
                const distanceInMeters = run.distance;
                const durationInSeconds = run.duration;
                if (durationInSeconds > 0 && distanceInMeters > 0) {
                  const speedMps = distanceInMeters / durationInSeconds; // m/s
                  if (distanceUnit === 'km') {
                    let speedKmh = speedMps * 3.6; // km/h
                    // Apply minimum speed threshold - don't show speeds below 0.1 km/h
                    if (speedKmh < 0.1) {
                      speedKmh = 0.0;
                    }
                    displayMetricValue = speedKmh.toFixed(1);
                    displayMetricUnit = 'km/h';
                  } else {
                    let speedMph = speedMps * 2.23694; // mph
                    // Apply minimum speed threshold - don't show speeds below 0.1 mph
                    if (speedMph < 0.1) {
                      speedMph = 0.0;
                    }
                    displayMetricValue = speedMph.toFixed(1);
                    displayMetricUnit = 'mph';
                  }
                  displayMetricLabel = 'Speed';
                } else {
                  displayMetricValue = '0.0';
                  displayMetricLabel = 'Speed';
                  displayMetricUnit = distanceUnit === 'km' ? 'km/h' : 'mph';
                }
              } else { // Default to RUN
                displayMetricValue = existingPace;
                displayMetricLabel = 'Pace';
                displayMetricUnit = `min/${distanceUnit}`;
              }
              
              return (
                <li key={run.id} className="history-item">
                  <RunHistoryCard
                    run={run}
                    activityType={currentActivityType}
                    distanceUnit={distanceUnit}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    displayDistance={displayDistance}
                    formatElevation={formatElevation}
                    pace={existingPace}
                    caloriesBurned={caloriesBurned}
                    displayMetricValue={displayMetricValue}
                    displayMetricLabel={displayMetricLabel}
                    displayMetricUnit={displayMetricUnit}
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
              <h3 className="subsection-heading">Post Run to Nostr</h3>
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
              <h3 className="subsection-heading">Confirm Deletion</h3>
              <p>Are you sure you want to delete this run?</p>
              {runToDelete && (
                <div className="run-summary">
                  <p>Date: {formatDate(runToDelete.timestamp)}</p>
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

        {showSaveExtrasModal && currentRunForExtras && currentWorkoutEventId && (
          <SaveRunExtrasModal 
            run={currentRunForExtras}
            workoutEventId={currentWorkoutEventId}
            onClose={handleCloseSaveExtrasModal}
            onPublishSuccess={handlePublishExtrasSuccess}
          />
        )}
      </div>
    </div>
  );
};
