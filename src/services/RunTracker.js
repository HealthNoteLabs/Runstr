import { registerPlugin } from '@capacitor/core';
import { EventEmitter } from 'tseep';
import runDataService, { ACTIVITY_TYPES } from './RunDataService';
import { filterLocation } from '../utils/runCalculations';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

// Define average stride length for step estimation
const AVERAGE_STRIDE_LENGTH_METERS = 0.762; // meters

class RunTracker extends EventEmitter {
  constructor() {
    super();

    this.distance = 0; // in meters
    this.duration = 0; // in seconds
    this.pace = 0; // in seconds per meter
    this.estimatedSteps = 0;
    this.currentSpeed = { value: 0, unit: 'km/h' }; // Default unit, will update based on preference
    this.splits = []; // Array to store split objects { km, time, pace }
    this.positions = [];
    
    // Add elevation tracking data
    this.elevation = {
      current: null,
      gain: 0,
      loss: 0,
      lastAltitude: null
    };

    this.isTracking = false;
    this.isPaused = false;
    this.startTime = 0;
    this.pausedTime = 0; // Total time paused in milliseconds
    this.lastPauseTime = 0; // Timestamp when the run was last paused
    this.lastSplitDistance = 0; // Track last split milestone
    this.activityType = localStorage.getItem('activityMode') || ACTIVITY_TYPES.RUN; // Get current activity type

    this.watchId = null; // For geolocation watch id
    this.timerInterval = null; // For updating duration every second
    this.paceInterval = null; // For calculating pace at regular intervals
    console.log('[RunTracker] Instance created'); // Initial log
  }

  // Helper method to get the current distance unit from localStorage
  getDistanceUnit() {
    return localStorage.getItem('distanceUnit') || 'km';
  }

  toRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1); // Difference in latitude converted to radians
    const dLon = this.toRadians(lon2 - lon1); // Difference in longitude converted to radians

    // Calculate the square of half the chord length between the points
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    // Calculate the angular distance in radians using the arctan function
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Multiply by Earth's radius to get the distance in meters.
    return R * c; // Distance in meters
  }

  calculatePace(distance, duration) {
    // Use the centralized pace calculation method
    // This already considers distanceUnit for its output format (e.g. time for 1km or 1mi)
    return runDataService.calculatePace(distance, duration, this.getDistanceUnit());
  }

  updateElevation(altitude) {
    if (altitude === null || altitude === undefined || isNaN(altitude)) {
      return;
    }
    
    // Set current elevation
    this.elevation.current = altitude;
    
    // Calculate gain and loss if we have a previous altitude reading
    if (this.elevation.lastAltitude !== null) {
      const diff = altitude - this.elevation.lastAltitude;
      
      // Filter out small fluctuations (less than 1 meter)
      if (Math.abs(diff) >= 1) {
        if (diff > 0) {
          this.elevation.gain += diff;
        } else {
          this.elevation.loss += Math.abs(diff);
        }
      }
    }
    
    this.elevation.lastAltitude = altitude;
    
    // Emit elevation change
    this.emit('elevationChange', {...this.elevation});
  }

  addPosition(newPosition) {
    // Only process position updates if actively tracking (not paused and tracking is on)
    if (!this.isTracking || this.isPaused) {
      // Don't process position updates when not actively tracking
      return;
    }

    // Validate incoming position data
    if (!newPosition || typeof newPosition.latitude !== 'number' || typeof newPosition.longitude !== 'number') {
      console.warn('[RunTracker] addPosition called with invalid or incomplete newPosition:', newPosition);
      return;
    }
    console.debug('[RunTracker] addPosition called with newPosition:', JSON.stringify(newPosition));

    // Normalise the incoming position so it always has a `coords` object – this is
    // the shape expected by the shared helper utilities (runCalculations etc.)
    const standardise = (pos) => ({
      ...pos,
      timestamp: pos.timestamp || Date.now(),
      coords: {
        latitude: pos.latitude ?? pos.coords?.latitude ?? 0,
        longitude: pos.longitude ?? pos.coords?.longitude ?? 0,
        accuracy: pos.accuracy ?? pos.coords?.accuracy ?? 0,
        altitude: pos.altitude ?? pos.coords?.altitude ?? null,
      },
    });

    const currentPositionStd = standardise(newPosition);

    if (this.positions.length > 0) {
      const lastRawPosition = this.positions[this.positions.length - 1];
      const lastPositionStd = standardise(lastRawPosition);

      // Use the shared filtering logic to decide whether to accept the point.
      // If the point fails the quality checks, we ignore it entirely.
      if (!filterLocation(currentPositionStd, lastPositionStd)) {
        console.log('[RunTracker] Position rejected by quality filter');
        return;
      }

      const distanceIncrement = this.calculateDistance(
        lastRawPosition.latitude,
        lastRawPosition.longitude,
        newPosition.latitude,
        newPosition.longitude
      );

      // Minimum threshold to additionally smooth out micro-jitter.
      const MOVEMENT_THRESHOLD = 1.5; // metres
      if (distanceIncrement >= MOVEMENT_THRESHOLD) {
        this.distance += distanceIncrement;
        this.emit('distanceChange', this.distance); // Emit distance change

        // If walking, calculate and emit steps
        if (this.activityType === ACTIVITY_TYPES.WALK) {
          this.estimatedSteps = this.distance > 0 ? Math.round(this.distance / AVERAGE_STRIDE_LENGTH_METERS) : 0;
          this.emit('stepsChange', this.estimatedSteps);
        }
      } else {
        console.log(`Filtered out small movement: ${distanceIncrement.toFixed(2)}m`);
      }

      // Check for altitude data and update elevation
      if (newPosition.altitude !== undefined && newPosition.altitude !== null) {
        this.updateElevation(newPosition.altitude);
      }

      // Get current distance unit
      const distanceUnit = this.getDistanceUnit();
      
      // Define the split distance in meters based on selected unit
      const splitDistance = distanceUnit === 'km' ? 1000 : 1609.344; // 1km or 1mile in meters
      
      // Get the current distance in the selected unit (either km or miles)
      const currentDistanceInUnits = distanceUnit === 'km' 
        ? this.distance / 1000  // Convert meters to km
        : this.distance / 1609.344;  // Convert meters to miles
        
      // Get the last split distance in the selected unit
      const lastSplitDistanceInUnits = distanceUnit === 'km'
        ? this.lastSplitDistance / 1000
        : this.lastSplitDistance / 1609.344;
      
      // Check if a new full unit (km or mile) has been completed
      // Using Math.floor ensures we only trigger when a whole unit is completed
      if (Math.floor(currentDistanceInUnits) > Math.floor(lastSplitDistanceInUnits)) {
        // Calculate the current split number (1, 2, 3, etc.)
        const currentSplitNumber = Math.floor(currentDistanceInUnits);

        // Determine the elapsed time at the previous split (or 0 at start)
        const previousSplitTime = this.splits.length
          ? this.splits[this.splits.length - 1].time
          : 0;
        
        // Calculate the duration for this split (time difference)
        const splitDuration = this.duration - previousSplitTime;
        
        // Calculate pace for this split - pace is in time per distance unit
        // Pace should be in seconds per meter for proper formatting later
        const splitPace = splitDuration / splitDistance; 
        
        console.log(`Recording split at ${currentSplitNumber} ${distanceUnit}s with pace ${splitPace}`);

        // Record the split with the unit count, cumulative time, and split pace
        this.splits.push({
          km: currentSplitNumber, // We keep using 'km' field name for compatibility, but it represents the unit number (mile or km)
          time: this.duration,
          pace: splitPace,
          isPartial: false // This is a whole unit split
        });
        
        // Update lastSplitDistance to the whole unit completed (in meters)
        this.lastSplitDistance = currentSplitNumber * splitDistance;

        // Emit an event with updated splits array
        this.emit('splitRecorded', this.splits);
      }
    }

    this.positions.push(currentPositionStd);
    console.debug('[RunTracker] Position added, total positions:', this.positions.length);
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      if (this.isTracking && !this.isPaused) {
        const now = Date.now();
        this.duration = (now - this.startTime - this.pausedTime) / 1000; // Subtract paused time
        this.emit('durationChange', this.duration); // Emit duration change
      }
    }, 1000); // Update every second
  }

  startPaceCalculator() {
    this.paceInterval = setInterval(() => {
      if (this.isTracking && !this.isPaused) {
        if (this.activityType === ACTIVITY_TYPES.CYCLE) {
          if (this.distance > 0 && this.duration > 0) {
            const speedMps = this.distance / this.duration; // m/s
            const unit = this.getDistanceUnit();
            let speedValue;
            let speedUnitString;
            if (unit === 'km') {
              speedValue = (speedMps * 3.6).toFixed(1); // km/h
              speedUnitString = 'km/h';
            } else {
              speedValue = (speedMps * 2.23694).toFixed(1); // mph
              speedUnitString = 'mph';
            }
            this.currentSpeed = { value: speedValue, unit: speedUnitString };
            this.emit('speedChange', this.currentSpeed);
          } else {
            // Reset speed if no distance/duration
            const unit = this.getDistanceUnit();
            this.currentSpeed = { value: '0.0', unit: unit === 'km' ? 'km/h' : 'mph' };
            this.emit('speedChange', this.currentSpeed);
          }
        } else {
          // For non-cycle activities, calculate and emit pace as before
          this.pace = this.calculatePace(this.distance, this.duration);
          this.emit('paceChange', this.pace);
        }
      }
    }, 5000); // Update pace/speed every 5 seconds
  }

  async startTracking() {
    try {
      console.log('[RunTracker] Attempting to startTracking...');
      // We should have already requested permissions by this point
      const permissionsGranted = localStorage.getItem('permissionsGranted') === 'true';
      
      if (!permissionsGranted) {
        console.warn('[RunTracker] Attempting to start tracking without permissions. This should not happen.');
        return;
      }
      
      // First, ensure any existing watchers are cleaned up
      await this.cleanupWatchers();
      console.log('[RunTracker] Watchers cleaned up.');
      
      this.watchId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'Tracking your run...',
          backgroundTitle: 'Runstr',
          foregroundService: true,
          foregroundServiceType: 'location',
          requestPermissions: false, 
          distanceFilter: 10,
          highAccuracy: true,
          staleLocationThreshold: 30000,
          debug: true // Enable plugin debug mode for more logs
        },
        (location, error) => {
          if (error) {
            console.error('[RunTracker] Watcher callback error:', JSON.stringify(error));
            if (error.code === 'NOT_AUTHORIZED') {
              localStorage.setItem('permissionsGranted', 'false');
              console.warn('Location permission is required for tracking. Please enable it in your device settings. (Original alert message)');
              BackgroundGeolocation.openSettings();
            } else {
              console.error(`Location watcher error: ${error.message || 'Unknown error'}. Code: ${error.code}`);
            }
            return; // Stop processing on error
          }

          if (location) {
            console.debug('[RunTracker] Watcher callback received location:', JSON.stringify(location));
            this.addPosition(location);
          } else {
            console.warn('[RunTracker] Watcher callback received null location without an error.');
            // Optionally emit an error or handle as a minor issue
          }
        }
      );

      if (this.watchId) {
        console.log('[RunTracker] BackgroundGeolocation.addWatcher successful, watchId:', this.watchId);
      } else {
        console.error('[RunTracker] BackgroundGeolocation.addWatcher returned invalid watchId.');
      }
      
    } catch (error) {
      console.error('[RunTracker] Error starting background tracking:', error);
    }
  }

  async cleanupWatchers() {
    try {
      // If we have an existing watchId, clean it up
      if (this.watchId) {
        await BackgroundGeolocation.removeWatcher({
          id: this.watchId
        });
        this.watchId = null;
      }
    } catch (error) {
      console.error('Error cleaning up watchers:', error);
    }
  }

  async start() {
    if (this.isTracking && !this.isPaused) return;
    
    // Update activityType from localStorage in case it changed
    this.activityType = localStorage.getItem('activityMode') || ACTIVITY_TYPES.RUN;
    
    this.isTracking = true;
    this.isPaused = false;
    this.startTime = Date.now();
    this.pausedTime = 0; // Reset paused time
    this.positions = [];
    this.distance = 0;
    this.duration = 0;
    this.pace = 0;
    this.estimatedSteps = 0;
    this.currentSpeed = { value: 0, unit: this.getDistanceUnit() === 'km' ? 'km/h' : 'mph' };
    this.splits = [];
    this.lastSplitDistance = 0;
    
    // Reset elevation data
    this.elevation = {
      current: null,
      gain: 0,
      loss: 0,
      lastAltitude: null
    };

    // Hold a partial CPU wake-lock so the OS doesn't suspend GPS callbacks (released in stop())
    try {
      const { KeepAwake } = await import('@capacitor-community/keep-awake');
      await KeepAwake.keepAwake();
    } catch (err) {
      console.warn('KeepAwake plugin not available', err?.message || err);
    }

    this.startTracking();
    this.startTimer(); // Start the timer
    this.startPaceCalculator(); // Start the pace calculator
    
    // Emit status change event
    this.emit('statusChange', { isTracking: this.isTracking, isPaused: this.isPaused });
  }

  async pause() {
    if (!this.isTracking || this.isPaused) return;

    this.isPaused = true;
    this.lastPauseTime = Date.now(); // Record the time when paused
    
    // Use our centralized method to clean up watchers
    await this.cleanupWatchers();

    clearInterval(this.timerInterval); // Stop the timer
    clearInterval(this.paceInterval); // Stop the pace calculator
    
    // Emit status change event
    this.emit('statusChange', { isTracking: this.isTracking, isPaused: this.isPaused });
  }

  async resume() {
    if (!this.isTracking || !this.isPaused) return;

    this.isPaused = false;
    this.pausedTime += Date.now() - this.lastPauseTime; // Add the time spent paused
    this.startTracking();
    this.startTimer(); // Restart the timer
    this.startPaceCalculator(); // Restart the pace calculator
    
    // Emit status change event
    this.emit('statusChange', { isTracking: this.isTracking, isPaused: this.isPaused });
  }

  async stop(publicKey) {
    if (!this.isTracking) return;

    this.isTracking = false;
    this.isPaused = false;
    
    // Final calculations
    this.duration = Math.floor((Date.now() - this.startTime - this.pausedTime) / 1000);
    
    // Calculate speed and pace one last time
    if (this.distance > 0 && this.duration > 0) {
      this.pace = runDataService.calculatePace(this.distance, this.duration, this.getDistanceUnit());
    }
    
    // If we have positions but no splits, calculate them now as a fallback
    if (this.positions.length > 0 && (!this.splits || this.splits.length === 0)) {
      // Use the RunDataService to calculate splits
      const stats = runDataService.calculateStats(this.positions, this.duration);
      if (stats.splits && stats.splits.length > 0) {
        this.splits = stats.splits;
        console.log(`Generated ${this.splits.length} splits on run completion`);
      }
    }
    
    let averageSpeed = null;
    let finalEstimatedSteps = null;

    if (this.activityType === ACTIVITY_TYPES.CYCLE && this.distance > 0 && this.duration > 0) {
        const speedMps = this.distance / this.duration;
        const unit = this.getDistanceUnit();
        averageSpeed = {
            value: (unit === 'km' ? (speedMps * 3.6).toFixed(1) : (speedMps * 2.23694).toFixed(1)),
            unit: unit === 'km' ? 'km/h' : 'mph'
        };
    } else if (this.activityType === ACTIVITY_TYPES.WALK) {
        finalEstimatedSteps = this.distance > 0 ? Math.round(this.distance / AVERAGE_STRIDE_LENGTH_METERS) : 0;
    }

    // Create the final run data object
    const finalResults = {
      distance: this.distance,
      duration: this.duration,
      pace: this.pace, // Existing pace, primarily for runners
      splits: this.splits,
      elevation: { 
        gain: this.elevation.gain,
        loss: this.elevation.loss
      },
      unit: this.getDistanceUnit(),
      activityType: this.activityType,
      ...(averageSpeed && { averageSpeed }), // Add if cycling
      ...(finalEstimatedSteps !== null && { estimatedTotalSteps: finalEstimatedSteps }) // Add if walking
    };
    
    // Save to run history using RunDataService instead of directly to localStorage
    runDataService.saveRun(finalResults, publicKey);
    
    // Clean up resources
    this.stopTracking();
    this.stopTimer();
    this.stopPaceCalculator();
    
    // Release CPU wake-lock
    try {
      const { KeepAwake } = await import('@capacitor-community/keep-awake');
      await KeepAwake.allowSleep();
    } catch (err) {
      console.warn('KeepAwake allowSleep failed / plugin missing', err?.message || err);
    }
    
    // Emit status change and completed event
    this.emit('statusChange', { isTracking: false, isPaused: false });
    this.emit('runCompleted', finalResults);
    
    return finalResults;
  }

  // Restore an active tracking session that was not paused
  restoreTracking(savedState) {
    // Set the base values from saved state
    this.distance = savedState.distance;
    this.duration = savedState.duration;
    this.pace = savedState.pace;
    this.splits = [...savedState.splits];
    this.estimatedSteps = savedState.estimatedTotalSteps || 0;
    this.currentSpeed = savedState.averageSpeed || { value: 0, unit: this.getDistanceUnit() === 'km' ? 'km/h' : 'mph' };
    this.elevation = {
      ...savedState.elevation,
      lastAltitude: savedState.elevation.current
    };
    this.activityType = savedState.activityType || ACTIVITY_TYPES.RUN; // Add activity type or default
    
    // Calculate time difference since the run was saved
    const timeDifference = (new Date().getTime() - savedState.timestamp) / 1000;
    
    // Update duration with elapsed time
    this.duration += timeDifference;
    
    // Set tracking state
    this.isTracking = true;
    this.isPaused = false;
    
    // Set start time to account for elapsed duration
    this.startTime = Date.now() - (this.duration * 1000);
    this.pausedTime = 0;
    this.lastPauseTime = 0;
    
    // Start the tracking services
    this.startTracking();
    this.startTimer();
    this.startPaceCalculator();
    
    // Emit updated values
    this.emit('distanceChange', this.distance);
    this.emit('durationChange', this.duration);
    this.emit('paceChange', this.pace);
    this.emit('splitRecorded', this.splits);
    this.emit('elevationChange', {...this.elevation});
    this.emit('stepsChange', this.estimatedSteps);
    this.emit('speedChange', this.currentSpeed);
  }
  
  // Restore an active tracking session that was paused
  restoreTrackingPaused(savedState) {
    // Set the base values from saved state
    this.distance = savedState.distance;
    this.duration = savedState.duration;
    this.pace = savedState.pace;
    this.splits = [...savedState.splits];
    this.estimatedSteps = savedState.estimatedTotalSteps || 0;
    this.currentSpeed = savedState.averageSpeed || { value: 0, unit: this.getDistanceUnit() === 'km' ? 'km/h' : 'mph' };
    this.elevation = {
      ...savedState.elevation,
      lastAltitude: savedState.elevation.current
    };
    this.activityType = savedState.activityType || ACTIVITY_TYPES.RUN; // Add activity type or default
    
    // Set tracking state
    this.isTracking = true;
    this.isPaused = true;
    
    // Set start time and pause time
    this.startTime = Date.now() - (this.duration * 1000);
    this.pausedTime = 0;
    this.lastPauseTime = Date.now();
    
    // Emit updated values
    this.emit('distanceChange', this.distance);
    this.emit('durationChange', this.duration);
    this.emit('paceChange', this.pace);
    this.emit('splitRecorded', this.splits);
    this.emit('elevationChange', {...this.elevation});
    this.emit('stepsChange', this.estimatedSteps);
    this.emit('speedChange', this.currentSpeed);
  }

  // Make sure the off method is properly documented
  // This is inherited from EventEmitter but we'll add a simple wrapper
  // for clarity and to ensure it's not overridden
  off(event, callback) {
    return super.off(event, callback);
  }
}

// Create and export an instance of the tracker
export const runTracker = new RunTracker();

// Also export the class for type checking and testing
export default RunTracker;
