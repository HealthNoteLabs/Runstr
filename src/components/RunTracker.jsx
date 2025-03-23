import { useState, useEffect } from 'react';
import { useRunTracker } from '../contexts/RunTrackerContext';
import { convertDistance, formatPaceWithUnit, formatTime } from '../utils/formatters';
import { PermissionDialog } from './PermissionDialog';

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
    stopRun
  } = useRunTracker();

  const [distanceUnit, setDistanceUnit] = useState(
    () => localStorage.getItem('distanceUnit') || 'km'
  );
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [countdown, setCountdown] = useState(0); // Countdown timer value
  const [isCountingDown, setIsCountingDown] = useState(false); // Flag to indicate countdown is in progress
  const [countdownType, setCountdownType] = useState(''); // 'start' or 'stop'

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
      alert('Location permission is required for tracking runs. Please restart the app to grant permissions.');
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

  const toggleDistanceUnit = () => {
    const newUnit = distanceUnit === 'km' ? 'mi' : 'km';
    setDistanceUnit(newUnit);
    localStorage.setItem('distanceUnit', newUnit);
  };

  const formatElevation = (meters) => {
    if (meters === null || isNaN(meters)) return '-';
    
    // Convert from meters based on distance unit preference
    if (distanceUnit === 'mi') {
      // Convert to feet (1m ≈ 3.28084ft)
      return `${Math.round(meters * 3.28084)}ft`;
    }
    // Keep as meters
    return `${Math.round(meters)}m`;
  };

  return (
    <div className="run-tracker">
      {/* Run controls */}
      {!isTracking ? (
        <button className="start-button" onClick={initiateRun}>
          Start Run
        </button>
      ) : (
        <div className="run-controls">
          {isPaused ? (
            <button className="resume-button" onClick={resumeRun}>
              Resume
            </button>
          ) : (
            <button className="pause-button" onClick={pauseRun}>
              Pause
            </button>
          )}
          <button className="stop-button" onClick={() => startCountdown('stop')}>
            Stop
          </button>
        </div>
      )}
      
      {/* Display run metrics */}
      <div className="metrics">
        <div className="distance">
          Distance: {convertDistance(distance, distanceUnit)} {distanceUnit}
        </div>
        <div className="duration">
          Time: {formatTime(duration)}
        </div>
        <div className="pace">
          Pace: {formatPaceWithUnit(pace, distanceUnit)}
        </div>
        {elevation && (
          <div className="elevation">
            Elevation: +{formatElevation(elevation.gain)} / -{formatElevation(elevation.loss)}
          </div>
        )}
      </div>
      
      {/* Unit toggle button */}
      <button className="unit-toggle" onClick={toggleDistanceUnit}>
        Switch to {distanceUnit === 'km' ? 'miles' : 'kilometers'}
      </button>
      
      {/* Display permission dialog if needed */}
      {showPermissionDialog && (
        <PermissionDialog
          onContinue={handlePermissionContinue}
          onCancel={handlePermissionCancel}
        />
      )}
      
      {/* Countdown overlay */}
      {isCountingDown && (
        <div className="countdown-overlay">
          <div className="countdown-container">
            <div className="countdown">{countdown}</div>
            <div className="countdown-message">
              {countdownType === 'start' ? 'Starting run...' : 'Stopping run...'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
