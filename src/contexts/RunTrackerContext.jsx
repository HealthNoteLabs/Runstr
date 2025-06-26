import { createContext, useContext, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { runTracker } from '../services/RunTracker';
import { useActivityMode } from './ActivityModeContext';
import { ACTIVITY_TYPES } from '../services/RunDataService';
import { NostrContext } from './NostrContext';
import { Pedometer } from '../services/PedometerService';
import { useDailySteps } from '../hooks/useDailySteps';

// Create the context
const RunTrackerContext = createContext(null);

// Custom hook to use the run tracker context
export const useRunTracker = () => {
  const context = useContext(RunTrackerContext);
  if (!context) {
    console.error('useRunTracker must be used within a RunTrackerProvider');
    // Return a fallback object with no-op functions to prevent crashes
    return {
      isTracking: false,
      isPaused: false,
      distance: 0,
      duration: 0,
      pace: 0,
      estimatedSteps: 0,
      currentSpeed: { value: 0, unit: 'km/h' },
      splits: [],
      elevation: { current: null, gain: 0, loss: 0 },
      activityType: ACTIVITY_TYPES.RUN,
      pedometerStatus: 'idle',
      dailySteps: 0,
      dailyStepGoal: 10000,
      dailyStepProgress: 0,
      startRun: () => console.warn('RunTracker not initialized'),
      pauseRun: () => console.warn('RunTracker not initialized'),
      resumeRun: () => console.warn('RunTracker not initialized'),
      stopRun: () => console.warn('RunTracker not initialized'),
      runTracker
    };
  }
  return context;
};

// Add helper to check setting
const isPedometerEnabled = () => localStorage.getItem('usePedometer') === 'true';

// Provider component
export const RunTrackerProvider = ({ children }) => {
  const { mode: activityType } = useActivityMode();
  const { publicKey, lightningAddress } = useContext(NostrContext);
  
  // Use daily steps hook for integration
  const { steps: dailySteps, goal: dailyStepGoal, progress: dailyStepProgress, updateSpeed } = useDailySteps();

  // Initialize state with try/catch to prevent fatal errors on startup
  const [trackingState, setTrackingState] = useState(() => {
    try {
      return {
        isTracking: runTracker.isTracking,
        isPaused: runTracker.isPaused,
        distance: runTracker.distance,
        duration: runTracker.duration,
        pace: runTracker.pace,
        estimatedSteps: runTracker.estimatedSteps || 0,
        currentSpeed: runTracker.currentSpeed || { value: 0, unit: 'km/h' },
        splits: runTracker.splits,
        elevation: runTracker.elevation,
        activityType: runTracker.activityType || activityType,
        pedometerStatus: isPedometerEnabled() ? 'idle' : 'disabled',
        dailySteps,
        dailyStepGoal,
        dailyStepProgress
      };
    } catch (error) {
      console.error('Error initializing run tracker state:', error);
      return {
        isTracking: false,
        isPaused: false,
        distance: 0,
        duration: 0,
        pace: 0,
        estimatedSteps: 0,
        currentSpeed: { value: 0, unit: activityType === ACTIVITY_TYPES.CYCLE ? (localStorage.getItem('distanceUnit') || 'km') === 'km' ? 'km/h' : 'mph' : 'km/h' },
        splits: [],
        elevation: { current: null, gain: 0, loss: 0, lastAltitude: null },
        activityType: activityType,
        pedometerStatus: isPedometerEnabled() ? 'idle' : 'disabled',
        dailySteps,
        dailyStepGoal,
        dailyStepProgress
      };
    }
  });

  // Add a ref for pedometer unsubscribe
  const pedometerUnsubRef = useRef(null);

  // Update tracking state when daily steps change
  useEffect(() => {
    setTrackingState(prev => ({
      ...prev,
      dailySteps,
      dailyStepGoal,
      dailyStepProgress
    }));
  }, [dailySteps, dailyStepGoal, dailyStepProgress]);

  // Listen for changes in the run tracker state
  useEffect(() => {
    try {
      const handleDistanceChange = (distance) => {
        setTrackingState(prev => ({ ...prev, distance }));
      };

      const handleDurationChange = (duration) => {
        setTrackingState(prev => ({ ...prev, duration }));
      };

      const handlePaceChange = (pace) => {
        setTrackingState(prev => ({ ...prev, pace }));
      };

      const handleSplitRecorded = (splits) => {
        setTrackingState(prev => ({ ...prev, splits }));
      };

      const handleElevationChange = (elevation) => {
        setTrackingState(prev => ({ ...prev, elevation }));
      };

      const handleStepsChange = (steps) => {
        setTrackingState(prev => ({ ...prev, estimatedSteps: steps }));
      };

      const handleSpeedChange = (speed) => {
        setTrackingState(prev => ({ ...prev, currentSpeed: speed }));
        
        // Update daily step counter with current speed for filtering
        if (speed && speed.value !== undefined) {
          updateSpeed(speed.value);
        }
      };

      const handleStatusChange = () => {
        setTrackingState(prev => ({
          ...prev,
          isTracking: runTracker.isTracking,
          isPaused: runTracker.isPaused
        }));

        if (runTracker.isTracking && !runTracker.isPaused && isPedometerEnabled()) {
          // Start pedometer if enabled by user, supported and not already listening
          if (!Pedometer.listening && Pedometer.supported) {
            Pedometer.start()
              .then(() => {
                setTrackingState(prev => ({ ...prev, pedometerStatus: 'tracking' }));
                // Subscribe to step events
                if (pedometerUnsubRef.current) pedometerUnsubRef.current();
                pedometerUnsubRef.current = Pedometer.addListener((data) => {
                  const steps = data.count ?? 0;
                  // Update runTracker's estimatedSteps and emit event
                  runTracker.estimatedSteps = steps;
                  runTracker.emit('stepsChange', steps);
                  setTrackingState(prev => ({ ...prev, estimatedSteps: steps }));
                });
              })
              .catch(err => {
                console.error('Could not start pedometer:', err);
                setTrackingState(prev => ({ ...prev, pedometerStatus: 'error' }));
              });
          }
        } else {
          // Stop pedometer when run is stopped or pedometer disabled
          if (Pedometer.listening) {
            Pedometer.stop().catch(err => console.warn('Error stopping pedometer:', err));
          }
          if (pedometerUnsubRef.current) {
            pedometerUnsubRef.current();
            pedometerUnsubRef.current = null;
          }
          setTrackingState(prev => ({ ...prev, pedometerStatus: isPedometerEnabled() ? 'idle' : 'disabled', estimatedSteps: runTracker.estimatedSteps }));
        }
      };

      // Handler for saving completed runs to localStorage
      const handleRunStopped = (finalResults) => {
        console.log('Run completed:', finalResults);
        // The actual saving is now handled by the RunTracker service using RunDataService
        
        // Reset speed tracking for daily step counter when run stops
        updateSpeed(0);
      };

      // Subscribe to events from the run tracker
      runTracker.on('distanceChange', handleDistanceChange);
      runTracker.on('durationChange', handleDurationChange);
      runTracker.on('paceChange', handlePaceChange);
      runTracker.on('splitRecorded', handleSplitRecorded);
      runTracker.on('elevationChange', handleElevationChange);
      runTracker.on('statusChange', handleStatusChange);
      runTracker.on('stopped', handleRunStopped);
      runTracker.on('stepsChange', handleStepsChange);
      runTracker.on('speedChange', handleSpeedChange);

      // Check for active run state in localStorage on mount
      const savedRunState = localStorage.getItem('activeRunState');
      if (savedRunState) {
        try {
          const runData = JSON.parse(savedRunState);
          
          // Update state
          setTrackingState(prev => ({
            ...prev,
            isTracking: runData.isRunning,
            isPaused: runData.isPaused,
            distance: runData.distance,
            duration: runData.duration,
            pace: runData.pace,
            estimatedSteps: runData.estimatedTotalSteps || 0,
            currentSpeed: runData.averageSpeed || { value: 0, unit: (runData.unit || localStorage.getItem('distanceUnit') || 'km') === 'km' ? 'km/h' : 'mph' },
            splits: runData.splits,
            elevation: runData.elevation,
            activityType: runData.activityType || activityType,
            pedometerStatus: isPedometerEnabled() ? 'idle' : 'disabled'
          }));
          
          // Restore tracking if active and not paused
          if (runData.isRunning && !runData.isPaused) {
            runTracker.restoreTracking(runData);
          } else if (runData.isRunning && runData.isPaused) {
            // We need to ensure the runTracker internal state matches our paused state
            runTracker.isTracking = true;
            runTracker.isPaused = true;
            runTracker.distance = runData.distance;
            runTracker.duration = runData.duration;
            runTracker.pace = runData.pace;
            runTracker.splits = [...runData.splits];
            runTracker.elevation = {...runData.elevation};
            runTracker.activityType = runData.activityType || activityType;
          }
        } catch (error) {
          console.error('Error restoring run state:', error);
          // If restoration fails, remove potentially corrupted state
          localStorage.removeItem('activeRunState');
        }
      }

      // Cleanup event listeners on unmount
      return () => {
        runTracker.off('distanceChange', handleDistanceChange);
        runTracker.off('durationChange', handleDurationChange);
        runTracker.off('paceChange', handlePaceChange);
        runTracker.off('splitRecorded', handleSplitRecorded);
        runTracker.off('elevationChange', handleElevationChange); 
        runTracker.off('statusChange', handleStatusChange);
        runTracker.off('stopped', handleRunStopped);
        runTracker.off('stepsChange', handleStepsChange);
        runTracker.off('speedChange', handleSpeedChange);
      };
    } catch (error) {
      console.error('Error setting up run tracker event listeners:', error);
      // Return empty cleanup function
      return () => {};
    }
  }, [activityType, updateSpeed]); // Include updateSpeed in dependencies

  // Save run state to localStorage when it changes
  useEffect(() => {
    try {
      if (trackingState.isTracking) {
        const runData = {
          isRunning: trackingState.isTracking,
          isPaused: trackingState.isPaused,
          distance: trackingState.distance,
          duration: trackingState.duration,
          pace: trackingState.pace,
          estimatedSteps: trackingState.estimatedSteps,
          currentSpeed: trackingState.currentSpeed,
          splits: trackingState.splits,
          elevation: trackingState.elevation,
          activityType: trackingState.activityType,
          pedometerStatus: trackingState.pedometerStatus,
          timestamp: new Date().getTime()
        };
        
        localStorage.setItem('activeRunState', JSON.stringify(runData));
      } else {
        // Clear active run state when run is stopped
        localStorage.removeItem('activeRunState');
      }
    } catch (error) {
      console.error('Error saving run state:', error);
    }
  }, [trackingState]);

  // Update activity type in tracking state when it changes in context
  useEffect(() => {
    if (!trackingState.isTracking) {
      setTrackingState(prev => ({ ...prev, activityType }));
    }
  }, [activityType, trackingState.isTracking]);

  // Methods to control the run tracker
  const startRun = async () => {
    try {
      // Update the activity type to current mode before starting
      runTracker.activityType = activityType;
      
      await runTracker.start();
      setTrackingState(prev => ({
        ...prev,
        isTracking: true,
        isPaused: false,
        distance: 0,
        duration: 0,
        pace: 0,
        estimatedSteps: 0,
        currentSpeed: { value: 0, unit: activityType === ACTIVITY_TYPES.CYCLE ? (localStorage.getItem('distanceUnit') || 'km') === 'km' ? 'km/h' : 'mph' : 'km/h' },
        splits: [],
        elevation: { current: null, gain: 0, loss: 0, lastAltitude: null },
        activityType: activityType,
        pedometerStatus: isPedometerEnabled() ? 'starting' : 'disabled'
      }));
    } catch (error) {
      console.error('Error starting run:', error);
      alert('Could not start tracking. Please check permissions and try again.');
      setTrackingState(prev => ({ ...prev, pedometerStatus: 'error' }));
    }
  };

  const pauseRun = async () => {
    try {
      await runTracker.pause();
      setTrackingState(prev => ({ ...prev, isPaused: true }));
    } catch (error) {
      console.error('Error pausing run:', error);
    }
  };

  const resumeRun = async () => {
    try {
      await runTracker.resume();
      setTrackingState(prev => ({ ...prev, isPaused: false }));
    } catch (error) {
      console.error('Error resuming run:', error);
    }
  };

  const stopRun = async () => {
    try {
      // Prefer lightning address when stopping run so downstream streak-reward logic
      // sends sats to a valid destination.
      const destination = lightningAddress || publicKey;
      await runTracker.stop(destination);
      // State will be updated through the event listeners
    } catch (error) {
      console.error('Error stopping run:', error);
      // Force update state to stopped in case event listeners fail
      setTrackingState(prev => ({
        ...prev,
        isTracking: false,
        isPaused: false,
        distance: 0,
        duration: 0,
        pace: 0,
        estimatedSteps: 0,
        currentSpeed: { value: 0, unit: activityType === ACTIVITY_TYPES.CYCLE ? (localStorage.getItem('distanceUnit') || 'km') === 'km' ? 'km/h' : 'mph' : 'km/h' },
        splits: [],
        elevation: { current: null, gain: 0, loss: 0, lastAltitude: null },
        activityType: activityType,
        pedometerStatus: isPedometerEnabled() ? 'idle' : 'disabled'
      }));
    }
  };

  // Provide both the state and methods to control the run tracker
  const value = {
    ...trackingState,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    runTracker, // Expose the original instance for advanced use cases
    pedometerStatus: trackingState.pedometerStatus
  };

  return (
    <RunTrackerContext.Provider value={value}>
      {children}
    </RunTrackerContext.Provider>
  );
};

RunTrackerProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 