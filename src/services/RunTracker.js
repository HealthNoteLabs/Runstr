import { registerPlugin } from '@capacitor/core';
import { EventEmitter } from 'tseep';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

class RunTracker extends EventEmitter {
  constructor() {
    super();

    this.distance = 0; // in meters
    this.duration = 0; // in seconds
    this.pace = 0; // in seconds per meter
    this.splits = []; // Array to store split objects { km, time, pace }
    this.positions = [];
    this.distanceUnit = localStorage.getItem('distanceUnit') || 'km'; // Get user's preferred unit
    
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

    this.watchId = null; // For geolocation watch id
    this.timerInterval = null; // For updating duration every second
    this.paceInterval = null; // For calculating pace at regular intervals
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
    if (distance === 0) return 0;
    return duration / distance; // Pace in seconds per meter
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
    if (this.positions.length > 0) {
      const lastPosition = this.positions[this.positions.length - 1];
      
      // Calculate time difference between points
      const timeDiff = (newPosition.timestamp - lastPosition.timestamp) / 1000;
      
      // Skip if time difference is negative (out of order GPS points)
      if (timeDiff < 0) {
        console.warn('Skipping position with negative time difference');
        return;
      }
      
      const distanceIncrement = this.calculateDistance(
        lastPosition.latitude,
        lastPosition.longitude,
        newPosition.latitude,
        newPosition.longitude
      );
      
      // Improved filtering for realistic movement
      // 1. Higher movement threshold to filter noise
      // 2. Maximum speed check to filter GPS jumps
      // 3. Accuracy threshold to ensure quality data
      
      const MIN_MOVEMENT_THRESHOLD = 3; // 3 meters minimum to count as movement
      const MAX_SPEED = 10; // 10 meters per second (~36 km/h) maximum realistic speed
      const MAX_REASONABLE_DISTANCE = MAX_SPEED * timeDiff;
      const ACCURACY_THRESHOLD = 20; // Only accept points with accuracy better than 20 meters
      
      const isRealisticMovement = 
        distanceIncrement >= MIN_MOVEMENT_THRESHOLD && 
        distanceIncrement <= MAX_REASONABLE_DISTANCE &&
        newPosition.accuracy <= ACCURACY_THRESHOLD;
      
      // Log suspicious movements for debugging
      if (distanceIncrement > MAX_REASONABLE_DISTANCE) {
        console.warn(`Filtered out suspicious movement in tracker: ${distanceIncrement.toFixed(2)}m in ${timeDiff.toFixed(2)}s`);
      }
      
      if (isRealisticMovement) {
        this.distance += distanceIncrement;
        this.emit('distanceChange', this.distance); // Emit distance change
        
        // Check if we have exceeded the next split distance and emit a split event
        const currentSplitDistance = Math.floor(this.distance / 1000);
        if (currentSplitDistance > this.lastSplitDistance) {
          this.lastSplitDistance = currentSplitDistance;
          this.emit('split', currentSplitDistance); // Emit split event with km value
        }
      }
    }
    
    // Add position to history regardless of filtering
    // This gives us a complete GPS trace for the activity
    this.positions.push(newPosition);
    
    // Update current pace estimate
    this.currentPace = this.calculatePace(this.distance, this.duration);
    this.emit('paceChange', this.currentPace); // Emit pace change
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
    } catch (error) {
      console.error('Error starting background tracking:', error);
    }
  }

  async start() {
    if (this.isTracking && !this.isPaused) return;

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
    this.lastSplitDistance = 0;
    
    // Reset elevation data
    this.elevation = {
      current: null,
      gain: 0,
      loss: 0,
      lastAltitude: null
    };

    this.startTracking();
    this.startTimer(); // Start the timer
    this.startPaceCalculator(); // Start the pace calculator
  }

  async pause() {
    if (!this.isTracking || this.isPaused) return;

    this.isPaused = true;
    this.lastPauseTime = Date.now(); // Record the time when paused
    BackgroundGeolocation.removeWatcher({
      id: this.watchId
    });

    clearInterval(this.timerInterval); // Stop the timer
    clearInterval(this.paceInterval); // Stop the pace calculator
  }

  async resume() {
    if (!this.isTracking || !this.isPaused) return;

    this.isPaused = false;
    this.pausedTime += Date.now() - this.lastPauseTime; // Add the time spent paused
    this.startTracking();
    this.startTimer(); // Restart the timer
    this.startPaceCalculator(); // Restart the pace calculator
  }

  stop() {
    if (!this.isTracking) return;

    this.isTracking = false;
    BackgroundGeolocation.removeWatcher({
      id: this.watchId
    });

    clearInterval(this.timerInterval); // Stop the timer
    clearInterval(this.paceInterval); // Stop the pace calculator

    // Define the split distance based on selected unit
    const splitDistance = this.distanceUnit === 'km' ? 1000 : 1609.344; // 1km or 1mile in meters
    
    // If there's an incomplete split (current split distance > 0), calculate its pace.
    const incompleteSplitDistance = this.distance - this.lastSplitDistance;
    if (incompleteSplitDistance > 0) {
      const lastSplitTime = this.splits.length
        ? this.splits[this.splits.length - 1].time
        : 0;
      const incompleteSplitTime = this.duration - lastSplitTime;
      const incompleteSplitPace = this.calculatePace(
        incompleteSplitDistance,
        incompleteSplitTime
      );

      const currentSplit = Math.ceil(this.distance / splitDistance);

      this.splits.push({
        km: currentSplit,
        time: this.duration,
        pace: incompleteSplitPace
      });
    }

    // Emit final values
    this.emit('distanceChange', this.distance);
    this.emit('durationChange', this.duration);
    this.emit('paceChange', this.pace);
    this.emit('splitRecorded', this.splits);
    this.emit('elevationChange', {...this.elevation}); // Emit final elevation data
    this.emit('stopped', {
      distance: this.distance,
      duration: this.duration,
      pace: this.pace,
      splits: this.splits,
      elevation: {...this.elevation} // Include elevation data in stopped event
    });
  }
}

export const runTracker = new RunTracker();
