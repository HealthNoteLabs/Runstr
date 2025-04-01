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
      
      // Generate a unique ID if not provided
      const newRun = {
        id: runData.id || Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        date: runData.date || new Date().toLocaleDateString(),
        timestamp: runData.timestamp || Date.now(),
        activityMode: runData.activityMode || 'run',
        ...runData
      };
      
      // Add to beginning of array for most recent first
      const updatedRuns = [newRun, ...runs];
      localStorage.setItem(this.storageKey, JSON.stringify(updatedRuns));
      
      // Notify listeners
      this.notifyListeners(updatedRuns);
      
      return newRun;
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
   * Delete a run
   * @param {string} runId - ID of the run to delete
   * @returns {boolean} Success status
   */
  deleteRun(runId) {
    try {
      const runs = this.getAllRuns();
      const runToDelete = runs.find(run => run.id === runId);
      
      if (!runToDelete) return false;
      
      // Remove the run from the array
      const updatedRuns = runs.filter(run => run.id !== runId);
      
      // Update storage
      localStorage.setItem(this.storageKey, JSON.stringify(updatedRuns));
      
      // Notify listeners
      this.notifyListeners(updatedRuns);
      
      // Dispatch a custom event for run deletion
      const event = new CustomEvent('runDeleted', {
        detail: {
          deletedRun: runToDelete,
          updatedRuns
        }
      });
      document.dispatchEvent(event);
      
      return true;
    } catch (error) {
      console.error('Error deleting run:', error);
      return false;
    }
  }

  /**
   * Calculate pace for a run
   * @param {number} distance - Distance in meters
   * @param {number} duration - Duration in seconds
   * @param {string} unit - Distance unit ('km' or 'mi')
   * @returns {number} Pace in minutes per unit
   */
  calculatePace(distance, duration, unit = 'km') {
    if (!distance || !duration) return 0;
    
    const distanceInUnit = unit === 'km' ? distance / 1000 : distance / 1609.344;
    return (duration / 60) / distanceInUnit;
  }

  /**
   * Format pace for display
   * @param {number} pace - Pace in minutes per unit
   * @param {string} unit - Distance unit ('km' or 'mi')
   * @param {string} activityMode - Activity mode ('run' or 'walk')
   * @returns {string} Formatted pace string
   */
  formatPace(pace, unit = 'km', activityMode = 'run') {
    if (!pace) return '--:--';
    
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    
    if (activityMode === 'walk') {
      return `${pace.toFixed(1)} ${unit}/h`;
    }
    
    return `${minutes}:${seconds.toString().padStart(2, '0')} /${unit}`;
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
   * @param {Function} callback - Callback function to be called when data changes
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove a listener
   * @param {Function} callback - Callback function to remove
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  /**
   * Notify all listeners of data changes
   * @param {Array} updatedRuns - Updated runs array
   */
  notifyListeners(updatedRuns) {
    this.listeners.forEach(callback => callback(updatedRuns));
  }
}

export default new RunDataService(); 