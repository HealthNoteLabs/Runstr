/**
 * RunDataManager.js
 * Consolidated service for tracking runs and managing run data
 */
import { registerPlugin } from '@capacitor/core';
import { EventEmitter } from 'tseep';

// Same plugin used in the current implementation
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

class RunDataManager extends EventEmitter {
  constructor() {
    super();
    
    // Core tracking state
    this.isTracking = false;
    this.isPaused = false;
    this.startTime = 0;
    this.pausedTime = 0;
    this.lastPauseTime = 0;
    
    // Run metrics (always stored in base units)
    this.distance = 0;           // meters
    this.duration = 0;           // seconds
    this.pace = 0;               // minutes per unit (km or mi)
    this.positions = [];         // GPS positions
    this.splits = [];            // Split times
    this.lastSplitDistance = 0;  // Used for split calculation
    
    // Elevation data
    this.elevation = {
      current: null,
      gain: 0,
      loss: 0,
      lastAltitude: null
    };
    
    // User preferences
    this.distanceUnit = localStorage.getItem('distanceUnit') || 'km';
    
    // Tracking internals
    this.watchId = null;
    this.timerInterval = null;
    this.paceInterval = null;
    
    // Storage key
    this.storageKey = 'runHistory';
  }

  /**
   * Start tracking a new run
   */
  async start() {
    if (this.isTracking && !this.isPaused) return;
    
    // Update unit from localStorage in case it changed
    this.distanceUnit = localStorage.getItem('distanceUnit') || 'km';
    
    // Reset all values
    this.isTracking = true;
    this.isPaused = false;
    this.startTime = Date.now();
    this.pausedTime = 0;
    this.positions = [];
    this.distance = 0;
    this.duration = 0;
    this.pace = 0;
    this.splits = [];
    this.lastSplitDistance = 0;
    
    // Reset elevation data
    this.elevation = {
      current: null,
      gain: 0,
      loss: 0,
      lastAltitude: null
    };
    
    // Start the tracking processes
    this.startTracking();
    this.startTimer();
    this.startPaceCalculator();
    
    // Emit status change
    this.emit('statusChange', { isTracking: this.isTracking, isPaused: this.isPaused });
    this.emit('trackingStarted');
  }
  
  /**
   * Pause the current run
   */
  async pause() {
    if (!this.isTracking || this.isPaused) return;
    
    this.isPaused = true;
    this.lastPauseTime = Date.now();
    
    // Stop GPS updates while paused
    this.stopTracking();
    
    // Clear intervals
    clearInterval(this.timerInterval);
    clearInterval(this.paceInterval);
    
    // Emit status change
    this.emit('statusChange', { isTracking: this.isTracking, isPaused: this.isPaused });
  }
  
  /**
   * Resume a paused run
   */
  async resume() {
    if (!this.isTracking || !this.isPaused) return;
    
    // Calculate paused time
    if (this.lastPauseTime > 0) {
      this.pausedTime += Date.now() - this.lastPauseTime;
      this.lastPauseTime = 0;
    }
    
    this.isPaused = false;
    
    // Restart tracking processes
    this.startTracking();
    this.startTimer();
    this.startPaceCalculator();
    
    // Emit status change
    this.emit('statusChange', { isTracking: this.isTracking, isPaused: this.isPaused });
  }
  
  /**
   * Stop and save the current run
   */
  async stop() {
    if (!this.isTracking) return;
    
    // Final calculations
    this.duration = Math.floor((Date.now() - this.startTime - this.pausedTime) / 1000);
    
    // Calculate final pace
    if (this.distance > 0 && this.duration > 0) {
      this.pace = this.calculatePace(this.distance, this.duration, this.distanceUnit);
    }
    
    // Prepare final run data
    const finalResults = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      date: new Date().toLocaleDateString(),
      distance: this.distance,
      duration: this.duration,
      pace: this.pace,
      splits: this.splits,
      elevation: {
        gain: this.elevation.gain,
        loss: this.elevation.loss
      },
      unit: this.distanceUnit,
      positions: this.positions
    };
    
    // Save to storage
    this.saveRun(finalResults);
    
    // Reset tracking state
    this.isTracking = false;
    this.isPaused = false;
    
    // Clean up resources
    this.stopTracking();
    this.stopTimer();
    this.stopPaceCalculator();
    
    // Emit events
    this.emit('statusChange', { isTracking: false, isPaused: false });
    this.emit('runCompleted', finalResults);
    
    return finalResults;
  }
  
  /**
   * Start GPS tracking
   */
  async startTracking() {
    try {
      // Request permissions if needed
      const permissions = await BackgroundGeolocation.requestPermissions();
      
      if (permissions.location === 'granted') {
        // Configure the plugin
        await BackgroundGeolocation.configure({
          notificationTitle: 'Runstr',
          notificationText: 'Tracking your run',
          distanceFilter: 10 // meters
        });
        
        // Start tracking
        await BackgroundGeolocation.start();
        
        // Add position listener
        BackgroundGeolocation.addListener('location', (location) => {
          if (!this.isTracking || this.isPaused) return;
          
          // Process the new position
          this.addPosition({
            coords: {
              latitude: location.latitude,
              longitude: location.longitude,
              altitude: location.altitude,
              accuracy: location.accuracy,
              speed: location.speed
            },
            timestamp: location.time
          });
        });
      }
    } catch (error) {
      console.error('Error starting location tracking:', error);
    }
  }
  
  /**
   * Stop GPS tracking
   */
  async stopTracking() {
    try {
      await BackgroundGeolocation.stop();
      BackgroundGeolocation.removeAllListeners();
    } catch (error) {
      console.error('Error stopping location tracking:', error);
    }
  }
  
  /**
   * Start timer to update duration
   */
  startTimer() {
    this.timerInterval = setInterval(() => {
      if (this.isTracking && !this.isPaused) {
        // Calculate elapsed time excluding paused time
        this.duration = Math.floor((Date.now() - this.startTime - this.pausedTime) / 1000);
        this.emit('durationChange', this.duration);
      }
    }, 1000);
  }
  
  /**
   * Stop the timer
   */
  stopTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
  }
  
  /**
   * Start pace calculator
   */
  startPaceCalculator() {
    this.paceInterval = setInterval(() => {
      if (this.isTracking && !this.isPaused) {
        // Only calculate pace if we have distance
        if (this.distance > 0 && this.duration > 0) {
          this.pace = this.calculatePace(this.distance, this.duration, this.distanceUnit);
          this.emit('paceChange', this.pace);
        }
      }
    }, 3000);
  }
  
  /**
   * Stop pace calculator
   */
  stopPaceCalculator() {
    clearInterval(this.paceInterval);
    this.paceInterval = null;
  }
  
  /**
   * Process a new position from GPS
   */
  addPosition(newPosition) {
    // Only process position updates if actively tracking
    if (!this.isTracking || this.isPaused) return;
    
    const lastPos = this.positions.length > 0 ? this.positions[this.positions.length - 1] : null;
    
    // Skip this position if it's too close to the last one
    if (lastPos) {
      const minTimeDiff = 1000; // 1 second minimum between positions
      const timeDiff = newPosition.timestamp - lastPos.timestamp;
      
      if (timeDiff < minTimeDiff) {
        return;
      }
    }
    
    // Add the position to our array
    this.positions.push(newPosition);
    
    // Calculate new distance if we have at least 2 positions
    if (this.positions.length > 1) {
      const prevPos = this.positions[this.positions.length - 2];
      const distance = this.calculateDistance(
        prevPos.coords.latitude,
        prevPos.coords.longitude,
        newPosition.coords.latitude,
        newPosition.coords.longitude
      );
      
      // Add to total distance
      this.distance += distance;
      this.emit('distanceChange', this.distance);
      
      // Update elevation data if available
      if (
        newPosition.coords.altitude !== null &&
        newPosition.coords.altitude !== undefined
      ) {
        // Set current elevation
        this.elevation.current = newPosition.coords.altitude;
        
        // Calculate elevation change if we have a previous altitude
        if (this.elevation.lastAltitude !== null) {
          const elevationChange = newPosition.coords.altitude - this.elevation.lastAltitude;
          
          if (elevationChange > 0) {
            this.elevation.gain += elevationChange;
          } else {
            this.elevation.loss += Math.abs(elevationChange);
          }
          
          this.emit('elevationChange', this.elevation);
        }
        
        // Update last altitude
        this.elevation.lastAltitude = newPosition.coords.altitude;
      }
      
      // Calculate splits
      this.calculateSplits();
    }
  }
  
  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // in meters
  }
  
  /**
   * Calculate and record splits
   */
  calculateSplits() {
    // Determine split distance based on unit (km or mile)
    const splitDistance = this.distanceUnit === 'km' ? 1000 : 1609.344; // meters in km or mile
    
    // Convert current distance to the selected unit 
    const currentDistanceInUnits = this.distance / splitDistance;
    
    // Convert last split distance to the selected unit
    const lastSplitDistanceInUnits = this.lastSplitDistance / splitDistance;
    
    // Check if a new full unit (km or mile) has been completed
    if (Math.floor(currentDistanceInUnits) > Math.floor(lastSplitDistanceInUnits)) {
      // Calculate the split number
      const currentSplitNumber = Math.floor(currentDistanceInUnits);
      
      // Determine elapsed time at previous split
      const previousSplitTime = this.splits.length
        ? this.splits[this.splits.length - 1].time
        : 0;
      
      // Calculate the duration for this split
      const splitDuration = this.duration - previousSplitTime;
      
      // Calculate pace for this split
      const splitPace = splitDuration / (splitDistance / 1000); // pace in seconds per km
      
      // Record the split
      this.splits.push({
        km: currentSplitNumber, // Split number (km or mile)
        time: this.duration,    // Cumulative time
        pace: splitPace,        // Split pace
        isPartial: false        // Indicates a complete split
      });
      
      // Update lastSplitDistance
      this.lastSplitDistance = currentSplitNumber * splitDistance;
      
      // Emit splits updated event
      this.emit('splitRecorded', this.splits);
    }
  }
  
  /**
   * Calculate pace from distance and duration
   */
  calculatePace(distance, duration, unit = 'km') {
    if (distance <= 0 || duration <= 0) return 0;
    
    // Convert distance to km or miles
    const distanceInUnit = unit === 'km' ? distance / 1000 : distance / 1609.344;
    
    // Calculate minutes per unit (km or mile)
    return duration / 60 / distanceInUnit;
  }
  
  /**
   * Format pace for display
   */
  formatPace(pace, unit = null) {
    if (!pace || pace === 0 || pace === Infinity) {
      return `-- min/${unit || this.distanceUnit}`;
    }
    
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')} min/${unit || this.distanceUnit}`;
  }
  
  /**
   * Format distance for display
   */
  formatDistance(distance, unit = null) {
    const displayUnit = unit || this.distanceUnit;
    
    if (distance === 0) return `0.00 ${displayUnit}`;
    
    const valueInUnit = displayUnit === 'km' 
      ? distance / 1000 
      : distance / 1609.344;
    
    return `${valueInUnit.toFixed(2)} ${displayUnit}`;
  }
  
  /**
   * Format time for display
   */
  formatTime(seconds = null) {
    const timeInSeconds = seconds !== null ? seconds : this.duration;
    
    if (!timeInSeconds && timeInSeconds !== 0) return '--:--';
    
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const remainingSeconds = Math.floor(timeInSeconds % 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }
  
  /**
   * Format elevation for display
   */
  formatElevation(elevation = null, unit = null) {
    const displayUnit = unit || this.distanceUnit;
    const elevationValue = elevation !== null ? elevation : (this.elevation?.gain || 0);
    
    if (elevationValue === undefined || elevationValue === null) return '--';
    
    if (displayUnit === 'km') {
      return `${Math.round(elevationValue)} m`;
    } else {
      // Convert to feet for imperial units
      const elevationInFeet = elevationValue * 3.28084;
      return `${Math.round(elevationInFeet)} ft`;
    }
  }
  
  /**
   * Toggle between km and mi
   */
  toggleDistanceUnit() {
    this.distanceUnit = this.distanceUnit === 'km' ? 'mi' : 'km';
    localStorage.setItem('distanceUnit', this.distanceUnit);
    this.emit('unitChanged', this.distanceUnit);
    return this.distanceUnit;
  }
  
  /**
   * Get all runs from storage
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
   * Save a run to storage
   */
  saveRun(runData) {
    try {
      const runs = this.getAllRuns();
      
      // Add to beginning of array for most recent first
      const updatedRuns = [runData, ...runs];
      localStorage.setItem(this.storageKey, JSON.stringify(updatedRuns));
      
      // Dispatch a custom event for other components to listen for
      const event = new CustomEvent('runHistoryUpdated');
      document.dispatchEvent(event);
      
      return runData;
    } catch (error) {
      console.error('Error saving run:', error);
      return null;
    }
  }
  
  /**
   * Delete a run from storage
   */
  deleteRun(runId) {
    try {
      const runs = this.getAllRuns();
      const updatedRuns = runs.filter(run => run.id !== runId);
      
      if (updatedRuns.length === runs.length) return false;
      
      localStorage.setItem(this.storageKey, JSON.stringify(updatedRuns));
      
      // Dispatch a custom event for other components to listen for
      const event = new CustomEvent('runHistoryUpdated');
      document.dispatchEvent(event);
      
      return true;
    } catch (error) {
      console.error('Error deleting run:', error);
      return false;
    }
  }
  
  /**
   * Get current tracking state and metrics
   */
  getCurrentState() {
    return {
      isTracking: this.isTracking,
      isPaused: this.isPaused,
      distance: this.distance,
      duration: this.duration,
      pace: this.pace,
      splits: this.splits,
      elevation: this.elevation,
      distanceUnit: this.distanceUnit,
      formattedDistance: this.formatDistance(this.distance),
      formattedPace: this.formatPace(this.pace),
      formattedTime: this.formatTime(this.duration),
      formattedElevationGain: this.formatElevation(this.elevation.gain)
    };
  }
}

// Create and export a singleton instance
const runDataManager = new RunDataManager();
export default runDataManager; 