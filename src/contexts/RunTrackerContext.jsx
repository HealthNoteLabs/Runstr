import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { runTracker } from '../services/RunTracker';
import { useActivityMode } from './ActivityModeContext';
import { ACTIVITY_TYPES } from '../services/RunDataService';
import { useMobileStorage } from './MobileStorageContext';

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
      splits: [],
      elevation: { current: null, gain: 0, loss: 0 },
      activityType: ACTIVITY_TYPES.RUN,
      startRun: () => console.warn('RunTracker not initialized'),
      pauseRun: () => console.warn('RunTracker not initialized'),
      resumeRun: () => console.warn('RunTracker not initialized'),
      stopRun: () => console.warn('RunTracker not initialized'),
      runTracker
    };
  }
  return context;
};

// Provider component
export const RunTrackerProvider = ({ children }) => {
  const { mode: activityType } = useActivityMode();
  const storage = useMobileStorage();

  // Initialize state with try/catch to prevent fatal errors on startup
  const [trackingState, setTrackingState] = useState(() => {
    try {
      return {
        isTracking: runTracker.isTracking,
        isPaused: runTracker.isPaused,
        distance: runTracker.distance,
        duration: runTracker.duration,
        pace: runTracker.pace,
        splits: runTracker.splits,
        elevation: runTracker.elevation,
        activityType: runTracker.activityType || activityType
      };
    } catch (error) {
      console.error('Error initializing run tracker state:', error);
      return {
        isTracking: false,
        isPaused: false,
        distance: 0,
        duration: 0,
        pace: 0,
        splits: [],
        elevation: { current: null, gain: 0, loss: 0, lastAltitude: null },
        activityType: activityType
      };
    }
  });

  // Listen for changes in the run tracker state
  useEffect(() => {
    if (!storage.isReady) return; // Don't set up listeners if storage isn't ready
    
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

      const handleStatusChange = () => {
        setTrackingState(prev => ({
          ...prev,
          isTracking: runTracker.isTracking,
          isPaused: runTracker.isPaused
        }));
      };

      // Handler for saving completed runs to localStorage
      const handleRunStopped = (finalResults) => {
        console.log('Run completed:', finalResults);
        // The actual saving is now handled by the RunTracker service using RunDataService
      };

      // Subscribe to events from the run tracker
      runTracker.on('distanceChange', handleDistanceChange);
      runTracker.on('durationChange', handleDurationChange);
      runTracker.on('paceChange', handlePaceChange);
      runTracker.on('splitRecorded', handleSplitRecorded);
      runTracker.on('elevationChange', handleElevationChange);
      runTracker.on('statusChange', handleStatusChange);
      runTracker.on('stopped', handleRunStopped);

      // Check for active run state in storage on mount
      const loadActiveRunState = async () => {
        try {
          const savedRunState = await storage.getJSON('activeRunState', null);
          if (savedRunState) {
            // Update state
            setTrackingState({
              isTracking: savedRunState.isRunning,
              isPaused: savedRunState.isPaused,
              distance: savedRunState.distance,
              duration: savedRunState.duration,
              pace: savedRunState.pace,
              splits: savedRunState.splits,
              elevation: savedRunState.elevation,
              activityType: savedRunState.activityType || activityType
            });
            
            // Restore tracking if active and not paused
            if (savedRunState.isRunning && !savedRunState.isPaused) {
              runTracker.restoreTracking(savedRunState);
            } else if (savedRunState.isRunning && savedRunState.isPaused) {
              // We need to ensure the runTracker internal state matches our paused state
              runTracker.isTracking = true;
              runTracker.isPaused = true;
              runTracker.distance = savedRunState.distance;
              runTracker.duration = savedRunState.duration;
              runTracker.pace = savedRunState.pace;
              runTracker.splits = [...savedRunState.splits];
              runTracker.elevation = {...savedRunState.elevation};
              runTracker.activityType = savedRunState.activityType || activityType;
            }
          }
        } catch (error) {
          console.error('Error restoring run state:', error);
          // If restoration fails, remove potentially corrupted state
          await storage.removeItem('activeRunState');
        }
      };
      
      loadActiveRunState();

      // Cleanup event listeners on unmount
      return () => {
        runTracker.off('distanceChange', handleDistanceChange);
        runTracker.off('durationChange', handleDurationChange);
        runTracker.off('paceChange', handlePaceChange);
        runTracker.off('splitRecorded', handleSplitRecorded);
        runTracker.off('elevationChange', handleElevationChange); 
        runTracker.off('statusChange', handleStatusChange);
        runTracker.off('stopped', handleRunStopped);
      };
    } catch (error) {
      console.error('Error setting up run tracker event listeners:', error);
      // Return empty cleanup function
      return () => {};
    }
  }, [activityType, storage, storage.isReady]); // Include activityType and storage in dependencies

  // Save run state to storage when it changes
  useEffect(() => {
    if (!storage.isReady || !trackingState.isTracking) return;
    
    try {
      const saveRunState = async () => {
        const runData = {
          isRunning: trackingState.isTracking,
          isPaused: trackingState.isPaused,
          distance: trackingState.distance,
          duration: trackingState.duration,
          pace: trackingState.pace,
          splits: trackingState.splits,
          elevation: trackingState.elevation,
          activityType: trackingState.activityType,
          timestamp: new Date().getTime()
        };
        
        await storage.setJSON('activeRunState', runData);
      };
      
      saveRunState();
    } catch (error) {
      console.error('Error saving run state:', error);
    }
    
    return () => {
      // If tracking stops, clear active run state
      if (!trackingState.isTracking) {
        storage.removeItem('activeRunState')
          .catch(error => console.error('Error removing active run state:', error));
      }
    };
  }, [trackingState, storage, storage.isReady]);

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
      setTrackingState({
        isTracking: true,
        isPaused: false,
        distance: 0,
        duration: 0,
        pace: 0,
        splits: [],
        elevation: { current: null, gain: 0, loss: 0, lastAltitude: null },
        activityType: activityType
      });
    } catch (error) {
      console.error('Error starting run:', error);
      alert('Could not start tracking. Please check permissions and try again.');
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
      await runTracker.stop();
      // State will be updated through the event listeners
    } catch (error) {
      console.error('Error stopping run:', error);
      // Force update state to stopped in case event listeners fail
      setTrackingState({
        isTracking: false,
        isPaused: false,
        distance: 0,
        duration: 0,
        pace: 0,
        splits: [],
        elevation: { current: null, gain: 0, loss: 0, lastAltitude: null },
        activityType: activityType
      });
    }
  };

  // Provide both the state and methods to control the run tracker
  const value = {
    ...trackingState,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    runTracker // Expose the original instance for advanced use cases
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