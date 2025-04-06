import { useState, useEffect, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { 
  createAndPublishEvent, 
  formatRunEvent, 
  formatEnhancedRunEvent, 
  formatHealthProfileEvent, 
  formatHealthRecordEvent 
} from '../utils/nostr';
import { useRunStats } from '../hooks/useRunStats';
import { useRunProfile } from '../hooks/useRunProfile';
import { useActivityType } from '../contexts/ActivityTypeContext';
import { formatTime, displayDistance, formatElevation, formatDate } from '../utils/formatters';
import runDataService from '../services/RunDataService';

// Error boundary component to catch rendering errors
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });
    console.error("Stats error boundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container p-4 bg-red-900/30 rounded-lg m-4">
          <h3 className="text-xl font-bold mb-2">Something went wrong</h3>
          <p className="mb-4">There was an error loading the stats. Please try refreshing the page.</p>
          <button 
            onClick={() => { 
              this.setState({ hasError: false });
              if (this.props.onReset) this.props.onReset();
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Add PropTypes validation
ErrorBoundary.propTypes = {
  children: PropTypes.node,
  onReset: PropTypes.func
};

export const RunHistory = () => {
  const navigate = useNavigate();
  const { activityType, getActivityTypeLabel } = useActivityType();
  const activityLabel = getActivityTypeLabel();
  const activityLabelLower = activityLabel.toLowerCase();
  
  // State for run history
  const [runHistory, setRunHistory] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState(() => localStorage.getItem('distanceUnit') || 'km');
  const [statsError, setStatsError] = useState(false);

  // Get user profile and distance unit from custom hooks
  const { userProfile: profile } = useRunProfile();

  const {
    stats,
    calculateStats,
    calculateCaloriesBurned
  } = useRunStats(runHistory, profile);

  // Reset stats error state
  const resetStatsError = () => {
    setStatsError(false);
    loadRunHistory();
  };

  // Load run history on component mount and listen for updates
  useEffect(() => {
    loadRunHistory();
    
    // Add event listener for run history updates
    const handleRunHistoryUpdate = () => {
      console.log("Run history update event received");
      loadRunHistory();
    };
    
    document.addEventListener('runHistoryUpdated', handleRunHistoryUpdate);
    document.addEventListener('runCompleted', handleRunHistoryUpdate);
    
    // Make sure to close any active subscriptions when unmounting to prevent interference with Feed
    return () => {
      document.removeEventListener('runHistoryUpdated', handleRunHistoryUpdate);
      document.removeEventListener('runCompleted', handleRunHistoryUpdate);
      
      // Inform the app that Stats page is unloaded
      document.dispatchEvent(new CustomEvent('statsPageUnloaded'));
      
      // Reset stats error state on unmount
      setStatsError(false);
    };
  }, [activityType]); // Reload when activity type changes

  // Listen for changes to the distance unit in localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const newUnit = localStorage.getItem('distanceUnit') || 'km';
      if (newUnit !== distanceUnit) {
        setDistanceUnit(newUnit);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Using a shorter interval for Android optimization
    const checkInterval = setInterval(() => {
      // Check for unit changes
      const currentUnit = localStorage.getItem('distanceUnit') || 'km';
      if (currentUnit !== distanceUnit) {
        setDistanceUnit(currentUnit);
      }
      
      // Check for run history changes
      const storedRuns = localStorage.getItem('runHistory');
      if (storedRuns) {
        const parsedRuns = JSON.parse(storedRuns);
        if (parsedRuns.length !== runHistory.length) {
          loadRunHistory();
        }
      }
    }, 1500); // Increased from 1000ms to 1500ms to reduce battery usage

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, [distanceUnit, runHistory.length, setDistanceUnit]);

  // Load and process run history from localStorage
  const loadRunHistory = () => {
    try {
      // Use RunDataService to get active runs of the current type
      const activeRuns = runDataService.getActiveRunsByType(activityType);
      
      // Sort runs by date (newest first)
      const sortedRuns = [...activeRuns].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });

      setRunHistory(sortedRuns);
      
      // Recalculate stats only for the current activity type
      calculateStats(sortedRuns, profile);
    } catch (error) {
      console.error(`Error loading ${activityLabelLower} history:`, error);
      setRunHistory([]);
      setStatsError(true);
    }
  };

  const handleDeleteRun = async (runId) => {
    if (window.confirm(`Are you sure you want to delete this ${activityLabelLower}? This action cannot be undone.`)) {
      try {
        const success = runDataService.deleteRun(runId);
        if (success) {
          // Show success message
          if (window.Android && window.Android.showToast) {
            window.Android.showToast(`${activityLabel} deleted successfully`);
          } else {
            alert(`${activityLabel} deleted successfully`);
          }
          
          // Reload history to update UI
          loadRunHistory();
        } else {
          throw new Error(`Failed to delete ${activityLabelLower}`);
        }
      } catch (error) {
        console.error(`Error deleting ${activityLabelLower}:`, error);
        
        if (window.Android && window.Android.showToast) {
          window.Android.showToast(`Failed to delete ${activityLabelLower}: ` + error.message);
        } else {
          alert(`Failed to delete ${activityLabelLower}: ` + error.message);
        }
      }
    }
  };

  const handlePostToNostr = async (run) => {
    try {
      const content = `
Just completed a ${activityLabelLower} with Runstr! 🏃‍♂️💨

⏱️ Duration: ${formatTime(run.duration)}
📏 Distance: ${displayDistance(run.distance, distanceUnit)}
⚡ Pace: ${(run.duration / 60 / (distanceUnit === 'km' ? run.distance/1000 : run.distance/1609.344)).toFixed(2)} min/${distanceUnit}
🔥 Calories: ${calculateCaloriesBurned(run.distance, run.duration)} kcal
${run.elevation ? `\n🏔️ Elevation Gain: ${formatElevation(run.elevation.gain, distanceUnit)}\n📉 Elevation Loss: ${formatElevation(run.elevation.loss, distanceUnit)}` : ''}
#Runstr #${activityLabel}
`.trim();

      const eventTemplate = {
        kind: 1,
        content: content,
        tags: [
          ['t', 'Runstr'],
          ['t', activityLabel]
        ]
      };

      await createAndPublishEvent(eventTemplate);
      
      // Show success message
      if (window.Android && window.Android.showToast) {
        window.Android.showToast(`Successfully shared ${activityLabelLower} to Nostr!`);
      } else {
        alert(`Successfully shared ${activityLabelLower} to Nostr!`);
      }
      
      setShowModal(false);
    } catch (error) {
      console.error(`Error sharing ${activityLabelLower} to Nostr:`, error);
      
      if (window.Android && window.Android.showToast) {
        window.Android.showToast(`Failed to share ${activityLabelLower} to Nostr: ` + error.message);
      } else {
        alert(`Failed to share ${activityLabelLower} to Nostr: ` + error.message);
      }
    }
  };

  const handleSaveToNostr = async (run) => {
    try {
      console.log(`Running handleSaveToNostr with ${activityLabelLower}:`, run);
      
      // Check if the run has all required fields
      if (!run || !run.distance || !run.duration) {
        console.error(`${activityLabel} is missing required fields:`, run);
        throw new Error(`${activityLabel} is missing required data`);
      }
      
      // Ensure run has elevation data
      if (!run.elevation) {
        run.elevation = { gain: 0, loss: 0 };
      }
      
      console.log('formatRunEvent function available:', typeof formatRunEvent === 'function');
      
      const runEvent = formatRunEvent(run, distanceUnit);
      console.log('Generated runEvent:', runEvent);
      
      await createAndPublishEvent(runEvent);
      
      // Show success message
      if (window.Android && window.Android.showToast) {
        window.Android.showToast(`Successfully saved ${activityLabelLower} to Nostr!`);
      } else {
        alert(`Successfully saved ${activityLabelLower} to Nostr!`);
      }
    } catch (error) {
      console.error(`Detailed error in handleSaveToNostr for ${activityLabelLower}:`, error);
      
      if (window.Android && window.Android.showToast) {
        window.Android.showToast(`Failed to save ${activityLabelLower} to Nostr: ` + error.message);
      } else {
        alert(`Failed to save ${activityLabelLower} to Nostr: ` + error.message);
      }
    }
  };

  const handleSaveHealthData = async (run) => {
    try {
      console.log(`Running handleSaveHealthData with ${activityLabelLower}:`, run);
      
      // Check if the run has all required fields
      if (!run || !run.distance || !run.duration) {
        console.error(`${activityLabel} is missing required fields:`, run);
        throw new Error(`${activityLabel} is missing required data`);
      }
      
      // Ensure run has elevation data
      if (!run.elevation) {
        run.elevation = { gain: 0, loss: 0 };
      }
      
      console.log('formatEnhancedRunEvent function available:', typeof formatEnhancedRunEvent === 'function');
      
      // Calculate calories burned
      const caloriesBurned = calculateCaloriesBurned(run.distance, run.duration);
      
      // Create enhanced workout record with calories
      const workoutEvent = formatEnhancedRunEvent(run, caloriesBurned, distanceUnit);
      console.log('Generated workoutEvent:', workoutEvent);
      
      const workoutResult = await createAndPublishEvent(workoutEvent);
      
      // Get user profile data
      const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      if (userProfile.weight && userProfile.height && userProfile.gender) {
        const healthProfileEvent = formatHealthProfileEvent(userProfile);
        await createAndPublishEvent(healthProfileEvent);
      }
      
      // Create health record
      const healthData = {
        weight: userProfile.weight || 0,
        restingCalories: Math.round(caloriesBurned * 0.2) // Simplified calculation
      };
      
      const healthRecordEvent = formatHealthRecordEvent(healthData, workoutResult.id);
      await createAndPublishEvent(healthRecordEvent);
      
      // Show success message
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Successfully saved health data to Nostr!');
      } else {
        alert('Successfully saved health data to Nostr!');
      }
    } catch (error) {
      console.error('Detailed error in handleSaveHealthData:', error);
      
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to save health data to Nostr: ' + error.message);
      } else {
        alert('Failed to save health data to Nostr: ' + error.message);
      }
    }
  };

  // Toggle distance unit function
  const toggleDistanceUnit = () => {
    const newUnit = distanceUnit === 'km' ? 'mi' : 'km';
    setDistanceUnit(newUnit);
    localStorage.setItem('distanceUnit', newUnit);
  };

  // Add function to format steps
  const formatSteps = (steps) => {
    if (!steps) return '';
    return steps.toLocaleString();
  };
  
  // Format pace for display
  const formatPace = (pace) => {
    if (!pace) return '0:00';
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Format speed for display
  const formatSpeed = (speed) => {
    if (!speed || isNaN(speed)) return '0.0';
    return speed.toFixed(1);
  };
  
  // Get time of day label based on timestamp
  const getTimeOfDay = (timestamp) => {
    if (!timestamp) return 'Recent';
    
    const date = new Date(timestamp);
    const hour = date.getHours();
    
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 21) return 'Evening';
    return 'Night';
  };

  return (
    <div className="run-history">
      <ErrorBoundary onReset={resetStatsError}>
        <div className="stats-overview">
          <h2>STATS</h2>
          <div className="flex justify-center my-4">
            <div className="flex rounded-full bg-[#1a222e] p-1">
              <button 
                className={`px-6 py-2 rounded-full text-sm ${distanceUnit === 'km' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
                onClick={() => distanceUnit !== 'km' && toggleDistanceUnit()}
              >
                Kilometers
              </button>
              <button 
                className={`px-6 py-2 rounded-full text-sm ${distanceUnit === 'mi' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
                onClick={() => distanceUnit !== 'mi' && toggleDistanceUnit()}
              >
                Miles
              </button>
            </div>
          </div>
          <button 
            className="profile-btn" 
            onClick={() => navigate('/profile')}
            title="Update your profile for accurate calorie calculations"
          >
            Update Profile
          </button>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Distance</h3>
              <p>{!stats ? '0.00 ' + distanceUnit : displayDistance(stats.totalDistance || 0, distanceUnit)}</p>
            </div>
            <div className="stat-card">
              <h3>Total {activityLabel}s</h3>
              <p>{!stats ? '0' : (stats.totalRuns || 0)}</p>
            </div>
            <div className="stat-card">
              <h3>Current Streak</h3>
              <p>{!stats ? '0' : (stats.currentStreak || 0)} days</p>
            </div>
            
            {activityType === 'cycle' ? (
              <div className="stat-card">
                <h3>Average Speed</h3>
                <p>
                  {!stats || typeof stats.averageSpeed !== 'number' || stats.averageSpeed <= 0
                    ? '-' 
                    : `${stats.averageSpeed.toFixed(1)}`}{' '}
                  {distanceUnit === 'km' ? 'km/h' : 'mph'}
                </p>
              </div>
            ) : (
              <div className="stat-card">
                <h3>Average Pace</h3>
                <p>
                  {!stats || typeof stats.averagePace !== 'number' || stats.averagePace <= 0
                    ? '-' 
                    : `${Math.floor(stats.averagePace)}:${Math.round(stats.averagePace % 1 * 60).toString().padStart(2, '0')}`}{' '}
                  min/{distanceUnit}
                </p>
              </div>
            )}
            
            {activityType === 'cycle' ? (
              <div className="stat-card">
                <h3>Top Speed</h3>
                <p>
                  {!stats || typeof stats.topSpeed !== 'number' || stats.topSpeed <= 0
                    ? '-'
                    : `${stats.topSpeed.toFixed(1)}`}{' '}
                  {distanceUnit === 'km' ? 'km/h' : 'mph'}
                </p>
              </div>
            ) : (
              <div className="stat-card">
                <h3>Fastest Pace</h3>
                <p>
                  {!stats || typeof stats.fastestPace !== 'number' || stats.fastestPace <= 0
                    ? '-'
                    : `${Math.floor(stats.fastestPace)}:${Math.round(stats.fastestPace % 1 * 60).toString().padStart(2, '0')}`}{' '}
                  min/{distanceUnit}
                </p>
              </div>
            )}
            
            <div className="stat-card">
              <h3>Longest {activityLabel}</h3>
              <p>{!stats ? '0.00 ' + distanceUnit : displayDistance(stats.longestRun || 0, distanceUnit)}</p>
            </div>
          </div>

          <div className="calorie-stats">
            <h3>Calorie Tracking</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <h4>Total Calories Burned</h4>
                <p>{!stats ? '0' : (stats.totalCaloriesBurned || 0).toLocaleString()} kcal</p>
              </div>
              <div className="stat-card">
                <h4>Avg. Calories per {distanceUnit.toUpperCase()}</h4>
                <p>{!stats ? '0' : Math.round(stats.averageCaloriesPerKm || 0)} kcal</p>
              </div>
            </div>
          </div>

          <div className="recent-stats">
            <h3>Recent Activity</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <h4>This Week</h4>
                <p>{!stats ? '0.00 ' + distanceUnit : displayDistance(stats.thisWeekDistance || 0, distanceUnit)}</p>
              </div>
              <div className="stat-card">
                <h4>This Month</h4>
                <p>{!stats ? '0.00 ' + distanceUnit : displayDistance(stats.thisMonthDistance || 0, distanceUnit)}</p>
              </div>
            </div>
          </div>

          <div className="personal-bests">
            <h3>Personal Bests</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <h4>5K</h4>
                <p>
                  {!stats || !stats.personalBests || stats.personalBests['5k'] === 0 || typeof stats.personalBests['5k'] !== 'number'
                    ? '-'
                    : `${Math.floor(stats.personalBests['5k'])}:${Math.round((stats.personalBests['5k'] % 1) * 60).toString().padStart(2, '0')}`}{' '}
                  min/{distanceUnit}
                </p>
              </div>
              <div className="stat-card">
                <h4>10K</h4>
                <p>
                  {!stats || !stats.personalBests || stats.personalBests['10k'] === 0 || typeof stats.personalBests['10k'] !== 'number'
                    ? '-'
                    : `${Math.floor(stats.personalBests['10k'])}:${Math.round((stats.personalBests['10k'] % 1) * 60).toString().padStart(2, '0')}`}{' '}
                  min/{distanceUnit}
                </p>
              </div>
              <div className="stat-card">
                <h4>Half Marathon</h4>
                <p>
                  {!stats || !stats.personalBests || stats.personalBests['halfMarathon'] === 0 || typeof stats.personalBests['halfMarathon'] !== 'number'
                    ? '-'
                    : `${Math.floor(stats.personalBests['halfMarathon'])}:${Math.round((stats.personalBests['halfMarathon'] % 1) * 60).toString().padStart(2, '0')}`}{' '}
                  min/{distanceUnit}
                </p>
              </div>
              <div className="stat-card">
                <h4>Marathon</h4>
                <p>
                  {!stats || !stats.personalBests || stats.personalBests['marathon'] === 0 || typeof stats.personalBests['marathon'] !== 'number'
                    ? '-'
                    : `${Math.floor(stats.personalBests['marathon'])}:${Math.round((stats.personalBests['marathon'] % 1) * 60).toString().padStart(2, '0')}`}{' '}
                  min/{distanceUnit}
                </p>
              </div>
            </div>
          </div>

          <div className="elevation-stats-overview">
            <h3>Elevation Data</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <h4>Total Elevation Gain</h4>
                <p>
                  {formatElevation(
                    !runHistory || !Array.isArray(runHistory) ? 0 : 
                    runHistory.reduce((sum, run) => sum + ((run?.elevation?.gain) || 0), 0),
                    distanceUnit
                  )}
                </p>
              </div>
              <div className="stat-card">
                <h4>Total Elevation Loss</h4>
                <p>
                  {formatElevation(
                    !runHistory || !Array.isArray(runHistory) ? 0 : 
                    runHistory.reduce((sum, run) => sum + ((run?.elevation?.loss) || 0), 0),
                    distanceUnit
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </ErrorBoundary>

      <h2>{activityLabel} History</h2>
      <div className="run-list">
        {runHistory.length === 0 ? (
          <div className="no-runs">
            <p>No {activityLabelLower}s recorded yet. Start your first {activityLabelLower} to see it here!</p>
          </div>
        ) : (
          runHistory.map((run) => (
            <div key={run.id} className="run-card">
              <div className="run-header">
                <h3>{run.title || `${getTimeOfDay(run.timestamp)} ${activityLabel}`}</h3>
                <span className="run-date">{formatDate(run.date)}</span>
              </div>
              <div className="run-stats">
                <div className="run-stat">
                  <div className="stat-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="stat-value">
                    <span>{displayDistance(run.distance, distanceUnit)}</span>
                    <span className="stat-label">{distanceUnit}</span>
                  </div>
                </div>
                <div className="run-stat">
                  <div className="stat-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="stat-value">
                    <span>{runDataService.formatTime(run.duration)}</span>
                    <span className="stat-label">time</span>
                  </div>
                </div>
                
                {run.activityType === 'walk' && run.steps ? (
                  // Display steps for walk activities
                  <div className="run-stat">
                    <div className="stat-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="stat-value">
                      <span>{formatSteps(run.steps)}</span>
                      <span className="stat-label">steps</span>
                    </div>
                  </div>
                ) : run.activityType === 'cycle' ? (
                  // Display speed for cycle activities, whether run.speed exists or not
                  <div className="run-stat">
                    <div className="stat-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="stat-value">
                      <span>{formatSpeed(run.speed)}</span>
                      <span className="stat-label">{distanceUnit === 'km' ? 'km/h' : 'mph'}</span>
                    </div>
                  </div>
                ) : (
                  // Display pace for run activities
                  <div className="run-stat">
                    <div className="stat-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div className="stat-value">
                      <span>{formatPace(run.pace)}</span>
                      <span className="stat-label">min/{distanceUnit}</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="run-actions flex flex-wrap gap-2 justify-end">
                <button
                  onClick={() => handlePostToNostr(run)}
                  className="text-xs text-indigo-400 flex items-center hover:text-indigo-300 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>
                <button
                  onClick={() => handleSaveToNostr(run)}
                  className="text-xs text-indigo-400 flex items-center hover:text-indigo-300 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save to Nostr
                </button>
                <button
                  onClick={() => handleSaveHealthData(run)}
                  className="text-xs text-indigo-400 flex items-center hover:text-indigo-300 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Save Health Data
                </button>
                <button
                  onClick={() => handleDeleteRun(run.id)}
                  className="text-xs text-red-400 flex items-center hover:text-red-300 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Post {activityLabel} to Nostr</h3>
            <textarea
              placeholder="Add any additional comments or hashtags..."
              rows={4}
            />
            <div className="modal-buttons">
              <button>
                Post
              </button>
              <button onClick={() => setShowModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
