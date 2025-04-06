/**
 * RunDataService.js
 * Centralized service for handling run data throughout the application
 */

class RunDataService {
  constructor() {
    this.storageKey = 'runHistory';
    this.listeners = [];
  }

  /**
   * Get all runs from storage
   * @returns {Array} Array of run objects
   */
  getAllRuns() {
    try {
      const storedRuns = localStorage.getItem(this.storageKey);
      return storedRuns ? JSON.parse(storedRuns) : [];
    } catch (error) {
      console.error('Error loading run data:', error);
      return [];
    }
  }

  /**
   * Save a new run to storage
   * @param {Object} runData - Run data to save
   * @returns {Object} The saved run with generated ID
   */
  saveRun(runData) {
    try {
      const runs = this.getAllRuns();
      
      // Get current activity type or default to 'run'
      const activityType = localStorage.getItem('activityType') || 'run';
      
      // Generate a unique ID if not provided
      const newRun = {
        id: runData.id || Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        date: runData.date || new Date().toLocaleDateString(),
        timestamp: runData.timestamp || Date.now(),
        activityType: runData.activityType || activityType, // Use provided type or current type
        ...runData
      };
      
      // Ensure steps and speed are included in the run data
      const stepsData = runData.steps || 0;
      const speedData = runData.speed || 0;
      
      // Create complete run data object
      const completeRunData = {
        id: newRun.id,
        date: newRun.date,
        timestamp: newRun.timestamp,
        distance: newRun.distance,
        duration: newRun.duration,
        pace: newRun.pace,
        speed: speedData, // Include speed for cycle activities
        splits: newRun.splits || [],
        elevation: newRun.elevation || { gain: 0, loss: 0 },
        unit: newRun.unit || 'km',
        activityType: newRun.activityType,
        steps: stepsData, // Include steps count
        weather: newRun.weather || null,
      };
      
      // Add to beginning of array for most recent first
      const updatedRuns = [completeRunData, ...runs];
      localStorage.setItem(this.storageKey, JSON.stringify(updatedRuns));
      
      // Notify listeners
      this.notifyListeners(updatedRuns);
      
      return completeRunData;
    } catch (error) {
      console.error('Error saving run:', error);
      return null;
    }
  }

  /**
   * Update an existing run
   * @param {string} runId - ID of the run to update
   * @param {Object} updatedData - New data to apply
   * @returns {boolean} Success status
   */
  updateRun(runId, updatedData) {
    try {
      const runs = this.getAllRuns();
      const index = runs.findIndex(run => run.id === runId);
      
      if (index === -1) return false;
      
      // Update the run
      runs[index] = { ...runs[index], ...updatedData };
      localStorage.setItem(this.storageKey, JSON.stringify(runs));
      
      // Notify listeners
      this.notifyListeners(runs);
      
      return true;
    } catch (error) {
      console.error('Error updating run:', error);
      return false;
    }
  }

  /**
   * Delete a run (soft delete)
   * @param {string} runId - ID of the run to delete
   * @returns {boolean} Success status
   */
  deleteRun(runId) {
    try {
      const runs = this.getAllRuns();
      const index = runs.findIndex(run => run.id === runId);
      
      if (index === -1) return false;
      
      // Mark the run as deleted instead of removing it
      runs[index] = { ...runs[index], deleted: true };
      localStorage.setItem(this.storageKey, JSON.stringify(runs));
      
      // Notify listeners
      this.notifyListeners(runs);
      
      return true;
    } catch (error) {
      console.error('Error deleting run:', error);
      return false;
    }
  }

  /**
   * Get all non-deleted runs
   * @returns {Array} Array of active run objects
   */
  getActiveRuns() {
    const allRuns = this.getAllRuns();
    return allRuns.filter(run => !run.deleted);
  }

  /**
   * Get all non-deleted runs of a specific activity type
   * @param {string} activityType - The activity type to filter by (run, walk, cycle)
   * @returns {Array} Array of active run objects of the specified type
   */
  getActiveRunsByType(activityType = 'run') {
    const allRuns = this.getActiveRuns();
    
    // If no type specified or not found, add a default type
    const runsWithType = allRuns.map(run => ({
      ...run,
      activityType: run.activityType || 'run' // Default to 'run' if no type set
    }));
    
    return runsWithType.filter(run => run.activityType === activityType);
  }

  /**
   * Get the most recent run of a specific activity type
   * @param {string} activityType - The activity type to filter by (run, walk, cycle)
   * @returns {Object|null} The most recent run of the specified type, or null if none found
   */
  getMostRecentRunByType(activityType = 'run') {
    const runsOfType = this.getActiveRunsByType(activityType);
    
    if (runsOfType.length === 0) {
      return null;
    }
    
    // Sort by timestamp (most recent first)
    const sortedRuns = [...runsOfType].sort((a, b) => {
      const dateA = new Date(a.timestamp || a.date);
      const dateB = new Date(b.timestamp || b.date);
      return dateB - dateA;
    });
    
    return sortedRuns[0];
  }

  /**
   * Calculate statistics for all active runs of a specific type
   * @param {string} activityType - The activity type to filter by (run, walk, cycle)
   * @returns {Object} Statistics object
   */
  calculateStatsByType(activityType = 'run') {
    const activeRuns = this.getActiveRunsByType(activityType);
    
    if (activeRuns.length === 0) {
      return {
        totalRuns: 0,
        totalDistance: 0,
        totalDuration: 0,
        averagePace: 0,
        totalElevationGain: 0,
        totalElevationLoss: 0,
        totalCalories: 0
      };
    }
    
    const stats = activeRuns.reduce((acc, run) => {
      acc.totalDistance += run.distance || 0;
      acc.totalDuration += run.duration || 0;
      acc.totalElevationGain += (run.elevation?.gain || 0);
      acc.totalElevationLoss += (run.elevation?.loss || 0);
      acc.totalCalories += (run.calories || 0);
      return acc;
    }, {
      totalRuns: activeRuns.length,
      totalDistance: 0,
      totalDuration: 0,
      totalElevationGain: 0,
      totalElevationLoss: 0,
      totalCalories: 0
    });
    
    // Calculate average pace
    if (stats.totalDistance > 0) {
      stats.averagePace = stats.totalDuration / stats.totalDistance;
    }
    
    return stats;
  }

  /**
   * Calculate statistics for all active runs
   * @returns {Object} Statistics object
   */
  calculateStats() {
    const activeRuns = this.getActiveRuns();
    
    if (activeRuns.length === 0) {
      return {
        totalRuns: 0,
        totalDistance: 0,
        totalDuration: 0,
        averagePace: 0,
        totalElevationGain: 0,
        totalElevationLoss: 0,
        totalCalories: 0
      };
    }
    
    const stats = activeRuns.reduce((acc, run) => {
      acc.totalDistance += run.distance || 0;
      acc.totalDuration += run.duration || 0;
      acc.totalElevationGain += (run.elevation?.gain || 0);
      acc.totalElevationLoss += (run.elevation?.loss || 0);
      acc.totalCalories += (run.calories || 0);
      return acc;
    }, {
      totalRuns: activeRuns.length,
      totalDistance: 0,
      totalDuration: 0,
      totalElevationGain: 0,
      totalElevationLoss: 0,
      totalCalories: 0
    });
    
    // Calculate average pace
    if (stats.totalDistance > 0) {
      stats.averagePace = stats.totalDuration / stats.totalDistance;
    }
    
    return stats;
  }

  /**
   * Get run by ID
   * @param {string} runId - ID of the run to get
   * @returns {Object|null} Run object or null if not found
   */
  getRunById(runId) {
    const runs = this.getAllRuns();
    return runs.find(run => run.id === runId) || null;
  }

  /**
   * Calculate pace consistently
   * @param {number} distance - Distance in meters
   * @param {number} duration - Duration in seconds
   * @param {string} unit - Distance unit (km or mi)
   * @returns {number} Pace in minutes per unit
   */
  calculatePace(distance, duration, unit = 'km') {
    if (distance <= 0 || duration <= 0) return 0;
    
    // Convert distance to km or miles
    const distanceInUnit = unit === 'km' ? distance / 1000 : distance / 1609.344;
    
    // Calculate minutes per unit (km or mile)
    return duration / 60 / distanceInUnit;
  }

  /**
   * Format pace consistently across the app
   * @param {number} pace - Pace in minutes per unit
   * @param {string} unit - Distance unit (km or mi)
   * @returns {string} Formatted pace string (e.g., "5:30 min/km")
   */
  formatPace(pace, unit = 'km') {
    if (!pace || pace === 0 || pace === Infinity) {
      return `-- min/${unit}`;
    }
    
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')} min/${unit}`;
  }

  /**
   * Format distance consistently across the app
   * @param {number} distance - Distance in meters
   * @param {string} unit - Distance unit (km or mi)
   * @returns {string} Formatted distance string (e.g., "5.00 km")
   */
  formatDistance(distance, unit = 'km') {
    if (distance === 0) return `0.00 ${unit}`;
    
    const valueInUnit = unit === 'km' 
      ? distance / 1000 
      : distance / 1609.344;
    
    return `${valueInUnit.toFixed(2)} ${unit}`;
  }

  /**
   * Format elevation consistently across the app
   * @param {number} elevation - Elevation in meters
   * @param {string} unit - Distance unit (km or mi)
   * @returns {string} Formatted elevation string (e.g., "120 m" or "394 ft")
   */
  formatElevation(elevation, unit = 'km') {
    if (elevation === undefined || elevation === null) return '--';
    
    if (unit === 'km') {
      return `${Math.round(elevation)} m`;
    } else {
      // Convert to feet for imperial units
      const elevationInFeet = elevation * 3.28084;
      return `${Math.round(elevationInFeet)} ft`;
    }
  }

  /**
   * Format time consistently across the app
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted time string (e.g., "01:30:45")
   */
  formatTime(seconds) {
    if (!seconds && seconds !== 0) return '--:--';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Add a listener for run data changes
   * @param {Function} listener - Callback function
   */
  addListener(listener) {
    if (typeof listener === 'function' && !this.listeners.includes(listener)) {
      this.listeners.push(listener);
    }
  }

  /**
   * Remove a listener
   * @param {Function} listener - Callback function to remove
   */
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Notify all listeners of changes
   * @param {Array} runs - Updated runs array
   */
  notifyListeners(runs) {
    this.listeners.forEach(listener => {
      try {
        listener(runs);
      } catch (error) {
        console.error('Error in run data listener:', error);
      }
    });
  }
}

// Create singleton instance
const runDataService = new RunDataService();

export default runDataService; 