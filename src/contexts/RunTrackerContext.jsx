import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { runTracker } from '../services/RunTracker';
import { useActivityMode } from './ActivityModeContext';
import { ACTIVITY_TYPES } from '../services/RunDataService';
import { useMobileStorage } from './MobileStorageContext';

// Create the context
const RunTrackerContext = createContext(null);

// Create default state
const createDefaultState = () => ({
  isTracking: false,
  isPaused: false,
  distance: 0,
  duration: 0,
  pace: 0,
  splits: [],
  elevation: { current: null, gain: 0, loss: 0, lastAltitude: null },
  activityType: ACTIVITY_TYPES.RUN
});

// Custom hook to use the run tracker context
export const useRunTracker = () => {
  const context = useContext(RunTrackerContext);
  if (!context) {
    console.error('useRunTracker must be used within a RunTrackerProvider');
    // Return a fallback object with no-op functions to prevent crashes
    return {
      ...createDefaultState(),
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
  const [initError, setInitError] = useState(null);

  // Initialize state with try/catch to prevent fatal errors on startup
  const [trackingState, setTrackingState] = useState(() => {
    try {
      if (!runTracker) {
        console.error('RunTracker instance is not available');
        return createDefaultState();
      }
      
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
      setInitError(error);
      return createDefaultState();
    }
  });

  // Listen for changes in the run tracker state
  useEffect(() => {
    if (!runTracker || initError) {
      console.error('Cannot set up RunTracker listeners due to initialization error:', initError);
      return () => {};
    }
    
    try {
      // Handler functions for run tracker events
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
  
      const handleStatusChange = ({ isTracking, isPaused }) => {
        setTrackingState(prev => ({ ...prev, isTracking, isPaused }));
      };
  
      const handleRunCompleted = () => {
        setTrackingState(prev => ({
          ...prev,
          isTracking: false,
          isPaused: false,
          distance: 0,
          duration: 0,
          pace: 0,
          splits: [],
          elevation: { current: null, gain: 0, loss: 0, lastAltitude: null }
        }));
      };
  
      // Register event listeners for run tracker events
      runTracker.on('distanceChange', handleDistanceChange);
      runTracker.on('durationChange', handleDurationChange);
      runTracker.on('paceChange', handlePaceChange);
      runTracker.on('splitRecorded', handleSplitRecorded);
      runTracker.on('elevationChange', handleElevationChange);
      runTracker.on('statusChange', handleStatusChange);
      runTracker.on('runCompleted', handleRunCompleted);
  
      // Remove event listeners when component unmounts
      return () => {
        try {
          runTracker.off('distanceChange', handleDistanceChange);
          runTracker.off('durationChange', handleDurationChange);
          runTracker.off('paceChange', handlePaceChange);
          runTracker.off('splitRecorded', handleSplitRecorded);
          runTracker.off('elevationChange', handleElevationChange);
          runTracker.off('statusChange', handleStatusChange);
          runTracker.off('runCompleted', handleRunCompleted);
        } catch (cleanupError) {
          console.error('Error cleaning up RunTracker event listeners:', cleanupError);
        }
      };
    } catch (error) {
      console.error('Error setting up RunTracker event listeners:', error);
      return () => {};
    }
  }, [initError]);

  // Check for active run on component mount
  useEffect(() => {
    if (!storage.isReady || !runTracker || initError) {
      console.log('Storage not ready or RunTracker initialization error, skipping active run check');
      return;
    }
    
    // Attempt to restore active run from storage if there is one
    const checkForActiveRun = async () => {
      try {
        // Look for active run in storage
        const activeRun = await storage.getJSON('activeRun');
        
        if (activeRun) {
          console.log('Found active run in storage:', activeRun);
          // Check if the run is still valid (e.g., not too old)
          const timestamp = activeRun.timestamp || 0;
          const currentTime = new Date().getTime();
          const hoursSinceStarted = (currentTime - timestamp) / (1000 * 60 * 60);
          
          // If run started more than 12 hours ago, consider it abandoned
          if (hoursSinceStarted > 12) {
            console.log('Active run is too old (>12h), removing');
            await storage.removeItem('activeRun');
            return;
          }
          
          // Restore the run state
          if (activeRun.isPaused) {
            console.log('Restoring paused run');
            runTracker.restoreTrackingPaused(activeRun);
          } else {
            console.log('Restoring active run');
            await runTracker.restoreTracking(activeRun);
          }
        }
      } catch (error) {
        console.error('Error checking for active run:', error);
        // Non-fatal error, just log it
      }
    };
    
    checkForActiveRun();
  }, [storage.isReady, initError]);

  // Save active run to storage when tracking state changes
  useEffect(() => {
    if (!storage.isReady || !runTracker || initError) {
      return;
    }
    
    // Only save if currently tracking
    if (trackingState.isTracking) {
      const saveActiveRun = async () => {
        try {
          const activeRunData = {
            isTracking: trackingState.isTracking,
            isPaused: trackingState.isPaused,
            distance: trackingState.distance,
            duration: trackingState.duration,
            pace: trackingState.pace,
            splits: trackingState.splits,
            elevation: trackingState.elevation,
            activityType: trackingState.activityType,
            timestamp: new Date().getTime()
          };
          
          await storage.setJSON('activeRun', activeRunData);
        } catch (error) {
          console.error('Error saving active run:', error);
        }
      };
      
      saveActiveRun();
    } else {
      // Remove active run from storage when no longer tracking
      storage.removeItem('activeRun').catch(err => 
        console.error('Error removing active run:', err)
      );
    }
  }, [trackingState, storage.isReady, initError]);

  // Update activity type when it changes
  useEffect(() => {
    if (!trackingState.isTracking) {
      setTrackingState(prev => ({ ...prev, activityType }));
    }
  }, [activityType, trackingState.isTracking]);

  // Methods to control the run tracker - with error handling
  const startRun = async () => {
    if (!runTracker || initError) {
      console.error('Cannot start run: RunTracker not properly initialized');
      return;
    }
    
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
    if (!runTracker || initError) {
      console.error('Cannot pause run: RunTracker not properly initialized');
      return;
    }
    
    try {
      await runTracker.pause();
      setTrackingState(prev => ({ ...prev, isPaused: true }));
    } catch (error) {
      console.error('Error pausing run:', error);
    }
  };

  const resumeRun = async () => {
    if (!runTracker || initError) {
      console.error('Cannot resume run: RunTracker not properly initialized');
      return;
    }
    
    try {
      await runTracker.resume();
      setTrackingState(prev => ({ ...prev, isPaused: false }));
    } catch (error) {
      console.error('Error resuming run:', error);
    }
  };

  const stopRun = async () => {
    if (!runTracker || initError) {
      console.error('Cannot stop run: RunTracker not properly initialized');
      return;
    }
    
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
    // State
    isTracking: trackingState.isTracking,
    isPaused: trackingState.isPaused,
    distance: trackingState.distance,
    duration: trackingState.duration,
    pace: trackingState.pace,
    splits: trackingState.splits,
    elevation: trackingState.elevation,
    activityType: trackingState.activityType,
    // Methods
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    // For direct access if needed
    runTracker,
    initError
  };
  
  // Render the context provider with the value
  return (
    <RunTrackerContext.Provider value={value}>
      {children}
    </RunTrackerContext.Provider>
  );
};

RunTrackerProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export default RunTrackerContext; 