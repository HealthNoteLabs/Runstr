import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRunTracker } from '../contexts/RunTrackerContext';
import { useDistanceUnit } from '../contexts/DistanceUnitContext';
import runDataService from '../services/RunDataService';
import { convertDistance, displayDistance, formatElevation, formatPaceWithUnit } from '../utils/formatters';

export const RunTracker = () => {
  const navigate = useNavigate();
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
  const { distanceUnit } = useDistanceUnit();
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [countdownType, setCountdownType] = useState('start');
  const [activityMode] = useState(localStorage.getItem('activityMode') || 'run');
  const [recentRun, setRecentRun] = useState(null);

  // Load the most recent run
  useEffect(() => {
    const runs = runDataService.getRuns();
    if (runs.length > 0) {
      setRecentRun(runs[0]);
    }
  }, []);

  // Format pace for display
  const formattedPace = formatPaceWithUnit(
    pace,
    distanceUnit
  );

  // Helper function to determine time of day based on timestamp
  const getTimeOfDay = (timestamp) => {
    if (!timestamp) return "Regular";
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
    
    if (runDate.toDateString() === today.toDateString()) return "Today";
    if (runDate.toDateString() === yesterday.toDateString()) return "Yesterday";
    return runDate.toLocaleDateString();
  };

  // Check if permissions have been granted on component mount
  useEffect(() => {
    const permissionsGranted = localStorage.getItem('permissionsGranted') === 'true';
    if (!permissionsGranted) {
      setShowPermissionDialog(true);
    }
  }, []);

  const initiateRun = () => {
    const permissionsGranted = localStorage.getItem('permissionsGranted');
    if (permissionsGranted === 'true') {
      startCountdown('start');
    } else {
      alert('Location permission is required for tracking runs. Please restart the app to grant permissions.');
      localStorage.removeItem('permissionsGranted');
    }
  };

  const handlePermissionContinue = () => {
    localStorage.setItem('permissionsGranted', 'true');
    setShowPermissionDialog(false);
  };

  const handlePermissionCancel = () => {
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
          setTimeout(() => {
            setIsCountingDown(false);
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

  return (
    <div className="flex flex-col min-h-screen bg-[#1a2237] pt-[var(--safe-area-inset-top)]">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {/* Distance Card */}
        <div className="bg-[#111827] rounded-xl shadow-lg flex flex-col p-4">
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
        <div className="bg-[#111827] rounded-xl shadow-lg flex flex-col p-4">
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
        <div className="bg-[#111827] rounded-xl shadow-lg flex flex-col p-4">
          <div className="flex items-center mb-2">
            <div className="w-7 h-7 rounded-full bg-[#F59E0B]/20 flex items-center justify-center mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-sm text-gray-400">{activityMode === 'walk' ? 'Speed' : 'Pace'}</span>
          </div>
          <div className="text-3xl font-bold">{formattedPace.split(' ')[0]}</div>
          <div className="text-sm text-gray-400">{formattedPace.split(' ')[1]}</div>
        </div>

        {/* Elevation Card */}
        <div className="bg-[#111827] rounded-xl shadow-lg flex flex-col p-4">
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
      
      {/* Run Clubs Button */}
      <button 
        className="mx-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-6 rounded-xl shadow-lg flex items-center justify-center text-lg font-semibold mb-4"
        onClick={() => navigate('/club')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Run Clubs
      </button>
      
      {/* Start/Stop Controls */}
      <div className="fixed bottom-[calc(var(--safe-area-inset-bottom)+4rem)] left-0 right-0 px-4 py-2 bg-[#1a2237] shadow-lg">
        {!isTracking ? (
          <button 
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-6 rounded-xl shadow-lg flex items-center justify-center text-lg font-semibold"
            onClick={initiateRun}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start {activityMode === 'walk' ? 'Walk' : 'Run'}
          </button>
        ) : (
          <div className="flex justify-between gap-4">
            {isPaused ? (
              <button 
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-xl shadow-lg font-semibold"
                onClick={resumeRun}
              >
                Resume
              </button>
            ) : (
              <button 
                className="flex-1 bg-yellow-600 text-white py-3 px-6 rounded-xl shadow-lg font-semibold"
                onClick={pauseRun}
              >
                Pause
              </button>
            )}
            <button 
              className="flex-1 bg-red-600 text-white py-3 px-6 rounded-xl shadow-lg font-semibold"
              onClick={() => startCountdown('stop')}
            >
              Stop
            </button>
          </div>
        )}
      </div>
      
      {/* Recent Activity Section */}
      {!isTracking && recentRun && (
        <div className="mx-4 mt-auto mb-24">
          <div className="bg-[#111827] rounded-xl shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a3548]">
              <h3 className="text-lg font-semibold">Recent {activityMode === 'walk' ? 'Walks' : 'Runs'}</h3>
              <span className="text-xs text-gray-400">See All</span>
            </div>
            <div className="p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-[#2a3548] rounded-lg flex items-center justify-center mr-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold">{recentRun.title || `${getTimeOfDay(recentRun.timestamp)} ${activityMode === 'walk' ? 'Walk' : 'Run'}`}</h4>
                  <div className="flex items-center text-xs text-gray-400">
                    <span>{formatRunDate(recentRun.date)} • {displayDistance(recentRun.distance, distanceUnit)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Countdown Overlay */}
      {isCountingDown && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-6xl font-bold mb-4">{countdown}</div>
            <div className="text-xl">{countdownType === 'start' ? 'Starting' : 'Stopping'} {activityMode === 'walk' ? 'Walk' : 'Run'}</div>
          </div>
        </div>
      )}

      {/* Permission Dialog */}
      {showPermissionDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 px-4">
          <div className="bg-[#111827] rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Location Permission Required</h3>
            <p className="text-gray-300 mb-6">
              To track your {activityMode === 'walk' ? 'walks' : 'runs'}, RUNSTR needs access to your location. 
              This data is only used to calculate your distance, pace, and route.
            </p>
            <div className="flex gap-4">
              <button 
                className="flex-1 bg-gray-700 text-white py-2 rounded-lg"
                onClick={handlePermissionCancel}
              >
                Cancel
              </button>
              <button 
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg"
                onClick={handlePermissionContinue}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
