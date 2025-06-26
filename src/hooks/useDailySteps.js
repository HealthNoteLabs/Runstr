import { useState, useEffect, useCallback, useRef } from 'react';
import { dailyStepCounter } from '../services/DailyStepCounterService';
import { getDailyStepGoal, isAlwaysOnEnabled } from '../utils/dailyStepStorage';

export const useDailySteps = () => {
  const [stepData, setStepData] = useState({
    steps: 0,
    goal: 10000,
    progress: 0,
    date: '',
    isRunning: false,
    isPausedForSpeed: false
  });
  
  const [milestones, setMilestones] = useState([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState(null);
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Update step data from service
  const updateStepData = useCallback(() => {
    if (!isMountedRef.current) return;
    
    try {
      const data = dailyStepCounter.getDailySteps();
      setStepData(data);
      setError(null);
    } catch (err) {
      console.error('Error updating step data:', err);
      setError(err.message);
    }
  }, []);

  // Check if service should be enabled based on settings
  const checkEnabled = useCallback(() => {
    if (!isMountedRef.current) return;
    
    const enabled = isAlwaysOnEnabled();
    setIsEnabled(enabled);
    
    if (enabled && !dailyStepCounter.isRunning) {
      dailyStepCounter.start().catch(err => {
        console.error('Failed to start daily step counter:', err);
        setError(err.message);
      });
    } else if (!enabled && dailyStepCounter.isRunning) {
      dailyStepCounter.stop();
    }
  }, []);

  // Handle step updates from service
  const handleStepsUpdate = useCallback((data) => {
    if (!isMountedRef.current) return;
    setStepData(prev => ({ ...prev, ...data }));
  }, []);

  // Handle milestone achievements
  const handleMilestone = useCallback((milestoneData) => {
    if (!isMountedRef.current) return;
    
    console.log('Milestone achieved:', milestoneData);
    setMilestones(prev => [...prev, {
      ...milestoneData,
      id: Date.now(),
      timestamp: new Date().toISOString()
    }]);
  }, []);

  // Handle daily reset events
  const handleDailyReset = useCallback((resetData) => {
    if (!isMountedRef.current) return;
    
    console.log('Daily steps reset:', resetData);
    updateStepData();
    
    // Clear old milestones
    setMilestones([]);
  }, [updateStepData]);

  // Handle speed pause/resume events
  const handleSpeedPause = useCallback((speedData) => {
    if (!isMountedRef.current) return;
    
    setStepData(prev => ({ 
      ...prev, 
      isPausedForSpeed: speedData.paused 
    }));
  }, []);

  // Handle service start/stop events
  const handleServiceStart = useCallback(() => {
    if (!isMountedRef.current) return;
    updateStepData();
  }, [updateStepData]);

  const handleServiceStop = useCallback(() => {
    if (!isMountedRef.current) return;
    updateStepData();
  }, [updateStepData]);

  // Handle service errors
  const handleError = useCallback((err) => {
    if (!isMountedRef.current) return;
    console.error('Daily step counter error:', err);
    setError(err.message || 'Unknown error occurred');
  }, []);

  // Dismiss a milestone notification
  const dismissMilestone = useCallback((milestoneId) => {
    setMilestones(prev => prev.filter(m => m.id !== milestoneId));
  }, []);

  // Clear all milestone notifications
  const clearMilestones = useCallback(() => {
    setMilestones([]);
  }, []);

  // Manual refresh of step data
  const refresh = useCallback(() => {
    updateStepData();
    checkEnabled();
  }, [updateStepData, checkEnabled]);

  // Update speed for filtering (called from GPS tracking)
  const updateSpeed = useCallback((speed) => {
    if (dailyStepCounter.isRunning) {
      dailyStepCounter.updateSpeed(speed);
    }
  }, []);

  // Setup effect - attach listeners and initialize
  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial setup
    updateStepData();
    checkEnabled();

    // Attach event listeners
    dailyStepCounter.on('stepsUpdate', handleStepsUpdate);
    dailyStepCounter.on('milestone', handleMilestone);
    dailyStepCounter.on('dailyReset', handleDailyReset);
    dailyStepCounter.on('speedPause', handleSpeedPause);
    dailyStepCounter.on('started', handleServiceStart);
    dailyStepCounter.on('stopped', handleServiceStop);
    dailyStepCounter.on('error', handleError);

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      
      // Remove event listeners
      dailyStepCounter.off('stepsUpdate', handleStepsUpdate);
      dailyStepCounter.off('milestone', handleMilestone);
      dailyStepCounter.off('dailyReset', handleDailyReset);
      dailyStepCounter.off('speedPause', handleSpeedPause);
      dailyStepCounter.off('started', handleServiceStart);
      dailyStepCounter.off('stopped', handleServiceStop);
      dailyStepCounter.off('error', handleError);
    };
  }, [
    updateStepData,
    checkEnabled,
    handleStepsUpdate,
    handleMilestone,
    handleDailyReset,
    handleSpeedPause,
    handleServiceStart,
    handleServiceStop,
    handleError
  ]);

  // Settings change effect - monitor localStorage changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (!isMountedRef.current) return;
      
      // React to changes in relevant settings
      if (e.key === 'alwaysOnStepCounter' || 
          e.key === 'usePedometer' || 
          e.key === 'dailyStepGoal') {
        setTimeout(() => {
          checkEnabled();
          updateStepData();
        }, 100); // Small delay to ensure localStorage is updated
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [checkEnabled, updateStepData]);

  // Return hook interface
  return {
    // Current step data
    steps: stepData.steps,
    goal: stepData.goal,
    progress: stepData.progress,
    date: stepData.date,
    
    // Service status
    isRunning: stepData.isRunning,
    isPausedForSpeed: stepData.isPausedForSpeed,
    isEnabled,
    error,
    
    // Milestone notifications
    milestones,
    
    // Actions
    dismissMilestone,
    clearMilestones,
    refresh,
    updateSpeed,
    
    // Service instance (for advanced usage)
    service: dailyStepCounter
  };
}; 