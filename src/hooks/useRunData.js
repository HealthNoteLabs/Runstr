/**
 * useRunData.js
 * React hook for accessing run data and functionality across components
 */
import { useState, useEffect } from 'react';
import runDataManager from '../services/RunDataManager';

/**
 * Hook to access run data and tracking functionality
 * @returns {Object} Run data state and methods
 */
export function useRunData() {
  // Initialize state with current values from runDataManager
  const [runData, setRunData] = useState(runDataManager.getCurrentState());
  
  // Set up event listeners for run data changes
  useEffect(() => {
    const handleStatusChange = () => {
      setRunData(runDataManager.getCurrentState());
    };
    
    const handleDistanceChange = () => {
      setRunData(runDataManager.getCurrentState());
    };
    
    const handleDurationChange = () => {
      setRunData(runDataManager.getCurrentState());
    };
    
    const handlePaceChange = () => {
      setRunData(runDataManager.getCurrentState());
    };
    
    const handleElevationChange = () => {
      setRunData(runDataManager.getCurrentState());
    };
    
    const handleSplitRecorded = () => {
      setRunData(runDataManager.getCurrentState());
    };
    
    const handleUnitChanged = () => {
      setRunData(runDataManager.getCurrentState());
    };
    
    // Subscribe to events
    runDataManager.on('statusChange', handleStatusChange);
    runDataManager.on('distanceChange', handleDistanceChange);
    runDataManager.on('durationChange', handleDurationChange);
    runDataManager.on('paceChange', handlePaceChange);
    runDataManager.on('elevationChange', handleElevationChange);
    runDataManager.on('splitRecorded', handleSplitRecorded);
    runDataManager.on('unitChanged', handleUnitChanged);
    
    // Clean up event listeners on unmount
    return () => {
      runDataManager.off('statusChange', handleStatusChange);
      runDataManager.off('distanceChange', handleDistanceChange);
      runDataManager.off('durationChange', handleDurationChange);
      runDataManager.off('paceChange', handlePaceChange);
      runDataManager.off('elevationChange', handleElevationChange);
      runDataManager.off('splitRecorded', handleSplitRecorded);
      runDataManager.off('unitChanged', handleUnitChanged);
    };
  }, []);
  
  // Create methods that can be used in components
  const startRun = async () => {
    await runDataManager.start();
  };
  
  const pauseRun = async () => {
    await runDataManager.pause();
  };
  
  const resumeRun = async () => {
    await runDataManager.resume();
  };
  
  const stopRun = async () => {
    await runDataManager.stop();
  };
  
  const toggleDistanceUnit = () => {
    runDataManager.toggleDistanceUnit();
  };
  
  // Format helpers that use current state
  const formatDistance = (distance) => {
    return runDataManager.formatDistance(distance);
  };
  
  const formatPace = (pace) => {
    return runDataManager.formatPace(pace);
  };
  
  const formatTime = (seconds) => {
    return runDataManager.formatTime(seconds);
  };
  
  const formatElevation = (elevation) => {
    return runDataManager.formatElevation(elevation);
  };
  
  // Data management methods
  const getAllRuns = () => {
    return runDataManager.getAllRuns();
  };
  
  const deleteRun = (runId) => {
    return runDataManager.deleteRun(runId);
  };
  
  // Return state and methods
  return {
    ...runData,
    startRun,
    pauseRun,
    resumeRun, 
    stopRun,
    toggleDistanceUnit,
    formatDistance,
    formatPace,
    formatTime,
    formatElevation,
    getAllRuns,
    deleteRun
  };
} 