import { registerPlugin } from '@capacitor/core';
import { EventEmitter } from 'tseep';
import runDataService from './RunDataService';
import stepCounterService from './StepCounterService';

// Register the plugin with error handling
let BackgroundGeolocation;
try {
  BackgroundGeolocation = registerPlugin('BackgroundGeolocation');
} catch (error) {
  console.error('Failed to register BackgroundGeolocation plugin:', error);
  // Create a fallback that won't crash
  BackgroundGeolocation = {
    addWatcher: async () => ({ id: 'dummy' }),
    removeWatcher: async () => {},
    openSettings: async () => {}
  };
}

class RunTracker extends EventEmitter {
  constructor() {
    super();

    this.distance = 0; // in meters
    this.duration = 0; // in seconds
    this.pace = 0; // in seconds per meter
    this.splits = []; // Array to store split objects { distance, time, pace, isPartial }
    this.positions = [];
    this.distanceUnit = localStorage.getItem('distanceUnit') || 'km'; // Get user's preferred unit
    
    // Add elevation tracking data
    this.elevation = {
      current: null,
      gain: 0,
      loss: 0,
      lastAltitude: null
    };

    // Add step counter data
    this.steps = 0;
    this.useStepCounter = false; // Will be set based on activity type
    this.stepListenerBound = false;

    this.isTracking = false;
    this.isPaused = false;
    this.startTime = 0;
    this.pausedTime = 0; // Total time paused in milliseconds
    this.lastPauseTime = 0; // Timestamp when the run was last paused
    this.lastSplitDistance = 0; // Track last split milestone
    this.lastPartialUpdateDistance = 0; // Track last partial split update

    this.watchId = null; // For geolocation watch id
    this.timerInterval = null; // For updating duration every second
    this.paceInterval = null; // For calculating pace at regular intervals

    // Try to listen for step counter updates - with error handling
    this.setupStepCounterListener();
  }

  setupStepCounterListener() {
    try {
      // Listen for step counter updates
      this.stepChangeHandler = (steps) => {
        if (this.isTracking && !this.isPaused && this.useStepCounter) {
          this.steps = steps;
          this.emit('stepsChange', steps);
          
          // Estimate distance based on steps (rough estimate)
          // Average step length is about 0.75m
          const estimatedDistance = steps * 0.75;
          
          if (estimatedDistance > this.distance) {
            this.distance = estimatedDistance;
            this.emit('distanceChange', this.distance);
            
            // Update pace based on new distance
            this.pace = this.calculatePace(this.distance, this.duration);
            this.emit('paceChange', this.pace);
          }
        }
      };
      
      stepCounterService.on('stepsChange', this.stepChangeHandler);
      this.stepListenerBound = true;
    } catch (error) {
      console.error('Failed to setup step counter listener:', error);
      this.stepListenerBound = false;
    }
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
    return runDataService.calculatePace(distance, duration, this.distanceUnit);
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
    
    if (this.positions.length > 0) {
      const lastPosition = this.positions[this.positions.length - 1];
      const distanceIncrement = this.calculateDistance(
        lastPosition.latitude,
        lastPosition.longitude,
        newPosition.latitude,
        newPosition.longitude
      );
      
      // Add a minimum threshold to filter out GPS noise (e.g., 3 meters)
      // Only count movement if it's above the threshold
      const MOVEMENT_THRESHOLD = 1.5; // 1.5 meters (reduced from 3m)
      if (distanceIncrement >= MOVEMENT_THRESHOLD) {
        this.distance += distanceIncrement;
        this.emit('distanceChange', this.distance); // Emit distance change
      } else {
        // GPS noise detected, not adding to distance
        console.log(`Filtered out small movement: ${distanceIncrement.toFixed(2)}m`);
      }

      // Check for altitude data and update elevation
      if (newPosition.altitude !== undefined && newPosition.altitude !== null) {
        this.updateElevation(newPosition.altitude);
      }

      // Define the split distance in meters based on selected unit
      const splitDistance = this.distanceUnit === 'km' ? 1000 : 1609.344; // 1km or 1mile in meters
      
      // Get the current distance in the selected unit (either km or miles)
      const currentDistanceInUnits = this.distanceUnit === 'km' 
        ? this.distance / 1000  // Convert meters to km
        : this.distance / 1609.344;  // Convert meters to miles
        
      // Get the last split distance in the selected unit
      const lastSplitDistanceInUnits = this.distanceUnit === 'km'
        ? this.lastSplitDistance / 1000
        : this.lastSplitDistance / 1609.344;
      
      // Get the last partial update distance in units
      const lastPartialUpdateDistanceInUnits = this.distanceUnit === 'km'
        ? this.lastPartialUpdateDistance / 1000
        : this.lastPartialUpdateDistance / 1609.344;
      
      // Check if a new full unit (km or mile) has been completed
      // Using Math.floor ensures we only trigger when a whole unit is completed
      if (Math.floor(currentDistanceInUnits) > Math.floor(lastSplitDistanceInUnits)) {
        // Calculate the current split number (1, 2, 3, etc.)
        const currentSplitNumber = Math.floor(currentDistanceInUnits);

        // Find the elapsed time at the previous split (or 0 at start)
        const previousSplitTime = this.splits.length 
          ? this.splits.filter(split => !split.isPartial).slice(-1)[0]?.time || 0
          : 0;
        
        // Calculate the duration for this split (time difference)
        const splitDuration = this.duration - previousSplitTime;
        
        // Calculate pace for this split (seconds per meter)
        // The pace should be in seconds per meter for proper formatting later
        const splitPace = splitDistance ? splitDuration / splitDistance : 0; 
        
        console.log(`Recording split at ${currentSplitNumber} ${this.distanceUnit}s with pace ${splitPace}`);

        // Record the split with the unit count, cumulative time, and split pace
        this.splits = this.splits.filter(split => !split.isPartial).concat([{
          distance: currentSplitNumber, 
          time: this.duration,
          pace: splitPace,
          isPartial: false
        }]);
        
        // Update lastSplitDistance to the whole unit completed (in meters)
        this.lastSplitDistance = currentSplitNumber * splitDistance;
        this.lastPartialUpdateDistance = this.lastSplitDistance;

        // Emit an event with updated splits array
        this.emit('splitRecorded', this.splits);
      }
      // Update partial split every 0.05 units (approx 50m for km, ~80m for miles)
      // but only if we've moved at least that far since last update
      else if (currentDistanceInUnits - lastPartialUpdateDistanceInUnits >= 0.05) {
        // Calculate the current partial distance
        const partialDistance = currentDistanceInUnits;
        
        // Calculate the pace for this partial segment
        // Use the current overall pace (seconds per meter)
        const splitPace = this.pace;
        
        // Add or update the partial split
        const partialSplit = {
          distance: partialDistance, 
          time: this.duration,
          pace: splitPace,
          isPartial: true
        };
        
        // Replace any existing partial split with the new one
        this.splits = this.splits.filter(split => !split.isPartial).concat([partialSplit]);
        
        // Update the last partial update distance
        this.lastPartialUpdateDistance = this.distance;
        
        // Emit an event with updated splits array
        this.emit('splitRecorded', this.splits);
      }
    }

    this.positions.push(newPosition);
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
        this.pace = this.calculatePace(this.distance, this.duration);
        this.emit('paceChange', this.pace); // Emit pace change
      }
    }, 5000); // Update pace every 5 seconds
  }

  async startTracking() {
    try {
      // We should have already requested permissions by this point
      const permissionsGranted = localStorage.getItem('permissionsGranted') === 'true';
      
      if (!permissionsGranted) {
        console.warn('Attempting to start tracking without permissions. This should not happen.');
        return;
      }
      
      // First, ensure any existing watchers are cleaned up
      await this.cleanupWatchers();
      
      this.watchId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'Tracking your run...',
          backgroundTitle: 'Runstr',
          // Never request permissions here - we've already done it in the permission dialog
          requestPermissions: false, 
          distanceFilter: 10,
          // Add high accuracy mode for better GPS precision
          highAccuracy: true,
          // Increase stale location threshold to get fresher GPS data
          staleLocationThreshold: 30000 // 30 seconds
        },
        (location, error) => {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED') {
              // Permissions were revoked after being initially granted
              localStorage.setItem('permissionsGranted', 'false');
              alert('Location permission is required for tracking. Please enable it in your device settings.');
              BackgroundGeolocation.openSettings();
            }
            return console.error(error);
          }

          this.addPosition(location);
        }
      );

      // If in walk mode, also start the step counter
      if (this.useStepCounter) {
        try {
          await stepCounterService.startTracking();
          this.steps = 0;
          this.emit('stepsChange', this.steps);
        } catch (error) {
          console.error('Error starting step counter:', error);
          // Continue anyway, tracking will work without step counter
        }
      }
    } catch (error) {
      console.error('Error in startTracking:', error);
      // Attempt to clean up if error occurs
      this.cleanupResources();
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

      // If using step counter, also stop that
      if (this.useStepCounter) {
        try {
          await stepCounterService.stopTracking();
        } catch (error) {
          console.error('Error stopping step counter:', error);
          // Continue with cleanup even if this fails
        }
      }
    } catch (error) {
      console.error('Error in cleanupWatchers:', error);
      // Try to do basic cleanup even if there's an error
      this.watchId = null;
    }
  }

  async start() {
    try {
      if (this.isTracking && !this.isPaused) return;

      // Get current activity type
      const activityType = localStorage.getItem('activityType') || 'run';
      // Use step counter for walk mode
      this.useStepCounter = (activityType === 'walk');

      // Update distanceUnit from localStorage in case it changed
      this.distanceUnit = localStorage.getItem('distanceUnit') || 'km';
      
      this.isTracking = true;
      this.isPaused = false;
      this.startTime = Date.now();
      this.pausedTime = 0; // Reset paused time
      this.positions = [];
      this.distance = 0;
      this.duration = 0;
      this.pace = 0;
      this.splits = [];
      this.steps = 0; // Reset step count
      this.lastSplitDistance = 0;
      this.lastPartialUpdateDistance = 0;
      
      // Reset elevation data
      this.elevation = {
        current: null,
        gain: 0,
        loss: 0,
        lastAltitude: null
      };

      // Check if step counter listener is set up
      if (this.useStepCounter && !this.stepListenerBound) {
        this.setupStepCounterListener();
      }

      this.startTracking();
      this.startTimer(); // Start the timer
      this.startPaceCalculator(); // Start the pace calculator
      
      // Emit status change event
      this.emit('statusChange', { isTracking: this.isTracking, isPaused: this.isPaused });
    } catch (error) {
      console.error('Error in start:', error);
      // Clean up if start fails
      this.cleanupResources();
      this.isTracking = false;
      this.isPaused = false;
      this.emit('statusChange', { isTracking: false, isPaused: false });
      throw error; // Re-throw so UI can show error
    }
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

  async stop() {
    if (!this.isTracking) return;

    try {
      this.isTracking = false;
      this.isPaused = false;
      
      // Final calculations
      this.duration = Math.floor((Date.now() - this.startTime - this.pausedTime) / 1000);
      
      // Calculate speed and pace one last time
      if (this.distance > 0 && this.duration > 0) {
        this.pace = runDataService.calculatePace(this.distance, this.duration, this.distanceUnit);
      }
      
      // Get the current activity type
      const activityType = localStorage.getItem('activityType') || 'run';
      
      // Create the final run data object
      const finalResults = {
        distance: this.distance,
        duration: this.duration,
        pace: this.pace,
        splits: this.splits,
        elevation: { 
          gain: this.elevation.gain,
          loss: this.elevation.loss
        },
        unit: this.distanceUnit,
        activityType: activityType,
        steps: this.useStepCounter ? this.steps : 0 // Include step count if step counter was used
      };
      
      // Save to run history using RunDataService instead of directly to localStorage
      try {
        runDataService.saveRun(finalResults);
      } catch (error) {
        console.error('Error saving run data:', error);
      }
      
      // Clean up resources
      this.cleanupResources();
      
      // If using step counter, reset it
      if (this.useStepCounter) {
        try {
          stepCounterService.resetSteps();
        } catch (error) {
          console.error('Error resetting step counter:', error);
        }
      }
      
      // Emit status change and completed event
      this.emit('statusChange', { isTracking: false, isPaused: false });
      this.emit('runCompleted', finalResults);
      
      return finalResults;
    } catch (error) {
      console.error('Error in stop:', error);
      // Make sure we clean up even if there's an error
      this.cleanupResources();
      this.isTracking = false;
      this.isPaused = false;
      this.emit('statusChange', { isTracking: false, isPaused: false });
      return { distance: this.distance, duration: this.duration, error: true };
    }
  }

  // Restore an active tracking session that was not paused
  restoreTracking(savedState) {
    // Set the base values from saved state
    this.distance = savedState.distance;
    this.duration = savedState.duration;
    this.pace = savedState.pace;
    this.splits = [...savedState.splits];
    this.elevation = {
      ...savedState.elevation,
      lastAltitude: savedState.elevation.current
    };
    
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
    
    // Determine the last split distance based on the last non-partial split
    const lastNonPartialSplit = [...this.splits].filter(split => !split.isPartial).pop();
    if (lastNonPartialSplit) {
      const splitDistance = this.distanceUnit === 'km' ? 1000 : 1609.344;
      this.lastSplitDistance = lastNonPartialSplit.distance * splitDistance;
    } else {
      this.lastSplitDistance = 0;
    }
    
    // Set last partial update distance
    this.lastPartialUpdateDistance = this.lastSplitDistance;
    
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
  }
  
  // Restore an active tracking session that was paused
  restoreTrackingPaused(savedState) {
    // Set the base values from saved state
    this.distance = savedState.distance;
    this.duration = savedState.duration;
    this.pace = savedState.pace;
    this.splits = [...savedState.splits];
    this.elevation = {
      ...savedState.elevation,
      lastAltitude: savedState.elevation.current
    };
    
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
  }

  // Clean up all resources to prevent memory leaks
  cleanupResources() {
    try {
      if (this.watchId) {
        try {
          BackgroundGeolocation.removeWatcher({
            id: this.watchId
          });
        } catch (e) {
          console.error('Error removing watcher:', e);
        }
        this.watchId = null;
      }
      
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      
      if (this.paceInterval) {
        clearInterval(this.paceInterval);
        this.paceInterval = null;
      }
      
      // Also stop step counter if needed
      if (this.useStepCounter) {
        try {
          stepCounterService.stopTracking();
        } catch (e) {
          console.error('Error stopping step counter:', e);
        }
      }
    } catch (error) {
      console.error('Error in cleanupResources:', error);
    }
  }

  // Make sure the off method is properly documented
  // This is inherited from EventEmitter but we'll add a simple wrapper
  // for clarity and to ensure it's not overridden
  off(event, callback) {
    return super.off(event, callback);
  }
}

// Create and export a singleton instance
const runTracker = new RunTracker();
export { runTracker };
export default RunTracker;
