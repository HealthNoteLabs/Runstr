import { registerPlugin } from '@capacitor/core';
import { EventEmitter } from 'tseep';
import runDataService, { ACTIVITY_TYPES } from './RunDataService';
import { filterLocation } from '../utils/runCalculations';
import { isGrapheneOS, getAccuracyThreshold, getMovementThreshold, getGPSStallThreshold } from '../utils/grapheneDetection';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

// Define average stride length for step estimation
const AVERAGE_STRIDE_LENGTH_METERS = 0.62; // meters (adjusted from 0.73)

// Helper function to estimate stride length based on height
const estimateStrideLength = (heightCm) => {
  if (!heightCm || heightCm < 100 || heightCm > 250) {
    // Return default if no height or unrealistic height
    return AVERAGE_STRIDE_LENGTH_METERS;
  }
  
  // Convert cm to inches
  const heightInches = heightCm / 2.54;
  
  // Use gender-neutral average formula (average of male and female factors)
  // Male: height × 0.415, Female: height × 0.413, Average: height × 0.414
  const strideLengthInches = heightInches * 0.414;
  
  // Convert inches to meters
  const strideLengthMeters = strideLengthInches * 0.0254;
  
  return strideLengthMeters;
};

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
    
    // Add simple distance goal tracking
    this.distanceGoal = null; // Target distance in meters, null = no goal
    
    // Add stride length property that can be customized
    this.strideLength = this.getCustomStrideLength();
    
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
    this.smoothedSpeedMps = 0; // For smoothing speed calculations in cycling mode
    
    // GPS heartbeat monitoring
    this.lastGPSUpdate = null;
    this.gpsHeartbeatInterval = null;
    this.gpsStallThreshold = getGPSStallThreshold(); // GrapheneOS-aware threshold
  }

  // Helper method to get the current distance unit from localStorage
  getDistanceUnit() {
    return localStorage.getItem('distanceUnit') || 'km';
  }

  // Helper method to detect GrapheneOS (delegates to shared utility)
  isGrapheneOS() {
    return isGrapheneOS();
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

  /**
   * Calculate current speed from recent GPS positions using a time window
   * This provides more accurate instantaneous speed for cycling
   * @returns {number} Speed in m/s, or 0 if not enough data
   */
  calculateCurrentSpeed() {
    const SPEED_WINDOW = 10; // Use 10-second window for speed calculation
    
    if (this.positions.length < 2) {
      return 0;
    }

    const now = this.positions[this.positions.length - 1].timestamp;
    const windowStart = now - SPEED_WINDOW * 1000; // 10 seconds ago

    // Find positions within our time window
    const recentPositions = this.positions.filter(
      (pos) => pos.timestamp >= windowStart
    );

    if (recentPositions.length < 2) {
      // Fall back to total average if not enough recent data
      if (this.distance > 0 && this.duration > 0) {
        return this.distance / this.duration; // m/s
      }
      return 0;
    }

    let recentDistance = 0;
    let lastValidPosition = null;

    // Calculate distance traveled in the recent window
    for (const position of recentPositions) {
      if (lastValidPosition) {
        const segmentDistance = this.calculateDistance(
          lastValidPosition.coords.latitude,
          lastValidPosition.coords.longitude,
          position.coords.latitude,
          position.coords.longitude
        );

        const timeDiff = (position.timestamp - lastValidPosition.timestamp) / 1000;
        if (timeDiff > 0) {
          recentDistance += segmentDistance;
        }
      }
      lastValidPosition = position;
    }

    const recentDuration = (recentPositions[recentPositions.length - 1].timestamp - recentPositions[0].timestamp) / 1000;

    if (recentDuration > 0 && recentDistance > 0) {
      return recentDistance / recentDuration; // m/s
    }

    // Fall back to total average if calculation fails
    if (this.distance > 0 && this.duration > 0) {
      return this.distance / this.duration; // m/s
    }

    return 0;
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
      console.log('[GPS Debug] Position rejected: not tracking or paused', { isTracking: this.isTracking, isPaused: this.isPaused });
      return;
    }

    // Enhanced GPS debugging for GrapheneOS
    const accuracy = newPosition.accuracy ?? newPosition.coords?.accuracy ?? 999;
    const isGraphene = this.isGrapheneOS();
    const rawLat = newPosition.latitude ?? newPosition.coords?.latitude;
    const rawLon = newPosition.longitude ?? newPosition.coords?.longitude;
    
    // COMPREHENSIVE GRAPHENE DIAGNOSTIC - Log every detail
    console.log('[GPS COMPREHENSIVE DEBUG]', {
      raw_accuracy: accuracy,
      raw_lat: rawLat,
      raw_lon: rawLon,
      timestamp: newPosition.timestamp || Date.now(),
      isGrapheneOS: isGraphene,
      positionCount: this.positions.length,
      currentDistance: this.distance,
      full_position_object: newPosition
    });

    // Use shared GrapheneOS-aware accuracy threshold
    const accuracyThreshold = getAccuracyThreshold();
    if (accuracy > accuracyThreshold) {
      console.log(`[GPS Debug] Position filtered: poor accuracy (${accuracy}m) - threshold: ${accuracyThreshold}m`);
      return;
    }

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

    // Validate coordinates are within valid ranges
    const lat = currentPositionStd.coords.latitude;
    const lon = currentPositionStd.coords.longitude;
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      console.log(`[GPS Debug] Position filtered: invalid coordinates (${lat}, ${lon})`);
      console.log('[GPS Debug] Invalid coordinate details:', { 
        lat_isNaN: isNaN(lat), 
        lon_isNaN: isNaN(lon),
        lat_range_valid: lat >= -90 && lat <= 90,
        lon_range_valid: lon >= -180 && lon <= 180,
        originalPosition: newPosition
      });
      return;
    }

    // Keep duration accurate even when JS timers are throttled in background.
    // Uses GPS timestamp so splits don\'t get 0:00 durations.
    this.duration = (currentPositionStd.timestamp - this.startTime - this.pausedTime) / 1000;
    this.emit('durationChange', this.duration);

    if (this.positions.length > 0) {
      const lastRawPosition = this.positions[this.positions.length - 1];
      const lastPositionStd = standardise(lastRawPosition);

      // Use the shared filtering logic to decide whether to accept the point.
      // If the point fails the quality checks, we ignore it entirely.
      // The filterLocation function is now GrapheneOS-aware, so no bypass needed
      if (!filterLocation(currentPositionStd, lastPositionStd)) {
        console.log('[GPS Debug] Position rejected by quality filter');
        console.log('[GPS Debug] Filter rejection details:', {
          currentPos: { lat: currentPositionStd.coords.latitude, lon: currentPositionStd.coords.longitude },
          lastPos: { lat: lastPositionStd.coords.latitude, lon: lastPositionStd.coords.longitude },
          timeDiff: currentPositionStd.timestamp - lastPositionStd.timestamp,
          isGrapheneOS: isGraphene
        });
        return;
      }

      let distanceIncrement = this.calculateDistance(
        lastRawPosition.latitude || lastRawPosition.coords?.latitude,
        lastRawPosition.longitude || lastRawPosition.coords?.longitude,
        newPosition.latitude || newPosition.coords?.latitude,
        newPosition.longitude || newPosition.coords?.longitude
      );
      
      // GrapheneOS fallback calculation if main calc returns 0 or NaN
      if (isGraphene && (isNaN(distanceIncrement) || distanceIncrement === 0)) {
        console.log('[GrapheneOS] Primary distance calculation failed, trying fallback');
        
        // Try with standardized coordinates
        const fallbackDistance = this.calculateDistance(
          lastPositionStd.coords.latitude,
          lastPositionStd.coords.longitude,
          currentPositionStd.coords.latitude,
          currentPositionStd.coords.longitude
        );
        
        console.log(`[GrapheneOS] Fallback distance: ${fallbackDistance}m`);
        if (!isNaN(fallbackDistance) && fallbackDistance > 0) {
          distanceIncrement = fallbackDistance;
          console.log('[GrapheneOS] Using fallback distance calculation');
        }
      }

      // Use shared GrapheneOS-aware movement threshold
      const MOVEMENT_THRESHOLD = getMovementThreshold();
      
      console.log(`[Distance Debug] Increment: ${distanceIncrement.toFixed(3)}m, Threshold: ${MOVEMENT_THRESHOLD}m, Total: ${this.distance.toFixed(2)}m`);
      console.log(`[Distance Debug] Movement acceptance test: ${distanceIncrement >= MOVEMENT_THRESHOLD ? 'ACCEPTED' : 'REJECTED'}`);
      
      if (distanceIncrement >= MOVEMENT_THRESHOLD) {
        this.distance += distanceIncrement;
        this.emit('distanceChange', this.distance); // Emit distance change

        // Check distance goal and auto-stop if reached
        if (this.distanceGoal && this.distance >= this.distanceGoal) {
          console.log(`Distance goal reached! Distance: ${this.distance}m, Goal: ${this.distanceGoal}m`);
          // Emit goal reached event for context to handle
          this.emit('goalReached', { distance: this.distance, goal: this.distanceGoal });
          return; // Exit early since run will be stopping
        }

        // If walking, calculate and emit steps
        if (this.activityType === ACTIVITY_TYPES.WALK) {
          this.estimatedSteps = this.distance > 0 ? Math.round(this.distance / this.strideLength) : 0;
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
    
    // GrapheneOS Zero Distance Debugging - track position acceptance
    if (isGraphene) {
      this.grapheneDebugCounter = (this.grapheneDebugCounter || 0) + 1;
      this.grapheneLastPositionTime = Date.now();
      
      console.log(`[GrapheneOS] POSITION ACCEPTED #${this.grapheneDebugCounter}`);
      console.log(`[GrapheneOS] Total positions stored: ${this.positions.length}`);
      console.log(`[GrapheneOS] Current total distance: ${this.distance.toFixed(3)}m`);
      console.log(`[GrapheneOS] Time since last position: ${this.grapheneLastPositionTime - (this.positions[this.positions.length - 2]?.timestamp || this.grapheneLastPositionTime)}ms`);
      
      // This should no longer happen with the fix, but keep for debugging
      if (this.positions.length > 3 && this.distance === 0) {
        console.log(`[GrapheneOS] WARNING: ${this.positions.length} positions accepted but ZERO distance accumulated!`);
        console.log('[GrapheneOS] This may indicate GPS is providing identical coordinates');
        console.log('[GrapheneOS] Last 3 positions:', this.positions.slice(-3).map(p => ({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          timestamp: p.timestamp
        })));
      }
    }
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
          // Use recent positions for more accurate current speed calculation
          const rawSpeedMps = this.calculateCurrentSpeed(); // m/s from recent GPS positions
          
          // Apply exponential smoothing to reduce GPS noise (similar to runCalculations.js)
          // Use 70% of previous smoothed speed + 30% of new reading for stability
          if (rawSpeedMps > 0) {
            this.smoothedSpeedMps = 0.7 * this.smoothedSpeedMps + 0.3 * rawSpeedMps;
          } else {
            // If no movement detected, gradually decay the smoothed speed
            this.smoothedSpeedMps = 0.8 * this.smoothedSpeedMps;
          }

          const unit = this.getDistanceUnit();
          let speedValue;
          let speedUnitString;
          
          if (this.smoothedSpeedMps > 0) {
            if (unit === 'km') {
              speedValue = (this.smoothedSpeedMps * 3.6); // km/h
              speedUnitString = 'km/h';
              // Apply minimum speed threshold - don't show speeds below 0.1 km/h
              if (speedValue < 0.1) {
                speedValue = 0.0;
              }
              speedValue = speedValue.toFixed(1);
            } else {
              speedValue = (this.smoothedSpeedMps * 2.23694); // mph
              speedUnitString = 'mph';
              // Apply minimum speed threshold - don't show speeds below 0.1 mph
              if (speedValue < 0.1) {
                speedValue = 0.0;
              }
              speedValue = speedValue.toFixed(1);
            }
          } else {
            // Reset speed if no valid calculation possible
            speedValue = '0.0';
            speedUnitString = unit === 'km' ? 'km/h' : 'mph';
          }
          
          this.currentSpeed = { value: speedValue, unit: speedUnitString };
          this.emit('speedChange', this.currentSpeed);
        } else {
          // For non-cycle activities, calculate and emit pace as before
          this.pace = this.calculatePace(this.distance, this.duration);
          this.emit('paceChange', this.pace);
        }
      }
    }, 1000); // Update pace/speed every 1 second for more responsive cycling
  }

  /**
   * Get GPS configuration optimized for the current activity type and GrapheneOS
   * @returns {Object} GPS configuration object
   */
  getGpsConfig() {
    const isGraphene = this.isGrapheneOS();
    
    const baseConfig = {
      highAccuracy: true,
      staleLocationThreshold: isGraphene ? 45000 : 30000, // More lenient for GrapheneOS
      interval: isGraphene ? 3000 : 5000, // More frequent updates for GrapheneOS
      fastestInterval: isGraphene ? 3000 : 5000,
      activitiesInterval: 10000,
      locationProvider: isGraphene ? 'gps' : 3, // Explicit GPS provider for GrapheneOS
      saveBatteryOnBackground: false,
      stopOnTerminate: false,
      startOnBoot: false,
      debug: isGraphene // Enable debug mode for GrapheneOS
    };

    // Activity-specific optimizations
    if (this.activityType === ACTIVITY_TYPES.CYCLE) {
      return {
        ...baseConfig,
        distanceFilter: isGraphene ? 1 : 2, // More sensitive for GrapheneOS cycling
        interval: isGraphene ? 2000 : 3000,    // More frequent intervals
        fastestInterval: isGraphene ? 2000 : 3000,
      };
    } else {
      // Running and walking use more conservative settings
      return {
        ...baseConfig,
        distanceFilter: isGraphene ? 2 : 5, // More sensitive for GrapheneOS
      };
    }
  }

  /**
   * Check if the app is whitelisted from battery optimization
   * @returns {Promise<boolean>} True if whitelisted or check unavailable
   */
  async checkBatteryOptimization() {
    try {
      const platform = navigator.userAgent.toLowerCase().includes('android') ? 'android' : 'other';
      if (platform !== 'android') return true; // Not Android, assume OK
      
      const { BatteryOptimization } = await import('@capawesome-team/capacitor-android-battery-optimization');
      if (!BatteryOptimization?.isIgnoringBatteryOptimizations) return true; // Plugin not available, assume OK
      
      const status = await BatteryOptimization.isIgnoringBatteryOptimizations();
      return status?.value || false;
    } catch (err) {
      console.warn('Could not check battery optimization status:', err);
      return true; // Assume OK if we can't check
    }
  }

  /**
   * Start GPS heartbeat monitoring to detect when GPS stops working
   */
  startGPSHeartbeat() {
    // Clear any existing heartbeat
    this.stopGPSHeartbeat();
    
    this.lastGPSUpdate = Date.now();
    this.gpsHeartbeatInterval = setInterval(() => {
      if (!this.isTracking || this.isPaused) {
        return; // Don't check when not actively tracking
      }
      
      const timeSinceLastUpdate = Date.now() - this.lastGPSUpdate;
      if (timeSinceLastUpdate > this.gpsStallThreshold) {
        console.warn(`GPS may have been killed by battery optimization. No updates for ${timeSinceLastUpdate}ms`);
        this.emit('gpsStalled', { 
          timeSinceLastUpdate,
          message: 'GPS tracking may have been stopped by battery optimization. Please check your battery settings.'
        });
        
        // Try to recover GPS automatically
        this.attemptGPSRecovery();
      }
    }, 15000); // Check every 15 seconds
    
    console.log('GPS heartbeat monitoring started');
  }

  /**
   * Stop GPS heartbeat monitoring
   */
  stopGPSHeartbeat() {
    if (this.gpsHeartbeatInterval) {
      clearInterval(this.gpsHeartbeatInterval);
      this.gpsHeartbeatInterval = null;
      console.log('GPS heartbeat monitoring stopped');
    }
  }

  /**
   * Attempt to recover GPS tracking when it appears to have stalled
   */
  async attemptGPSRecovery() {
    console.log('Attempting GPS recovery...');
    
    try {
      // Clean up existing watchers
      await this.cleanupWatchers();
      
      // Wait a moment before restarting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Restart tracking
      await this.startTracking();
      
      // Reset the heartbeat timer
      this.lastGPSUpdate = Date.now();
      
      this.emit('gpsRecoveryAttempt', { 
        timestamp: Date.now(),
        message: 'Attempted to restart GPS tracking'
      });
      
      console.log('GPS recovery attempt completed');
    } catch (error) {
      console.error('GPS recovery failed:', error);
      this.emit('gpsRecoveryFailed', { 
        error: error.message,
        message: 'Could not restart GPS tracking. Please stop and restart your run.'
      });
    }
  }

  async startTracking() {
    try {
      // We should have already requested permissions by this point
      const permissionsGranted = localStorage.getItem('permissionsGranted') === 'true';
      
      if (!permissionsGranted) {
        console.warn('Attempting to start tracking without permissions. This should not happen.');
        return;
      }

      // Additional safety check: verify actual system permissions if possible
      try {
        // This will help catch cases where localStorage is out of sync with actual permissions
        await BackgroundGeolocation.addWatcher(
          {
            id: 'permission_test_' + Date.now(),
            requestPermissions: false,
            backgroundMessage: 'Testing permissions...',
            backgroundTitle: 'Runstr',
            highAccuracy: true,
            distanceFilter: 999999, // Very high to avoid actual location updates
            interval: 600000, // 10 minutes - won't actually fire
          },
          (location, error) => {
            if (error && (error.code === 'NOT_AUTHORIZED' || error.message?.includes('permission'))) {
              console.warn('Permission check failed, updating localStorage');
              localStorage.setItem('permissionsGranted', 'false');
              this.emit('permissionError', error);
            }
          }
        );
        // Clean up the test watcher immediately
        setTimeout(async () => {
          try {
            await BackgroundGeolocation.removeWatcher({ id: 'permission_test_' + (Date.now() - 100) });
          } catch (e) {
            // Ignore cleanup errors for test watcher
          }
        }, 100);
      } catch (permissionTestError) {
        console.warn('Permission validation failed:', permissionTestError);
        if (permissionTestError.message?.includes('permission')) {
          localStorage.setItem('permissionsGranted', 'false');
          this.emit('permissionError', permissionTestError);
          return;
        }
      }
      
      // First, ensure any existing watchers are cleaned up
      await this.cleanupWatchers();
      
      // Generate a unique ID for this tracking session
      const sessionId = 'tracking_' + Date.now();
      
      // Get activity-optimized GPS configuration
      const gpsConfig = this.getGpsConfig();
      
      this.watchId = await BackgroundGeolocation.addWatcher(
        {
          id: sessionId,
          backgroundMessage: `Tracking your ${this.activityType === ACTIVITY_TYPES.CYCLE ? 'cycle' : this.activityType === ACTIVITY_TYPES.WALK ? 'walk' : 'run'}...`,
          backgroundTitle: 'Runstr',
          foregroundService: true,
          foregroundServiceType: 'location',
          requestPermissions: false, // Don't request here, should already have them
          notificationTitle: 'Runstr - Tracking Active',
          notificationText: `Recording your ${this.activityType === ACTIVITY_TYPES.CYCLE ? 'cycle' : this.activityType === ACTIVITY_TYPES.WALK ? 'walk' : 'run'}`,
          ...gpsConfig // Apply activity-specific GPS settings
        },
        (location, error) => {
          if (error) {
            console.error('Location tracking error:', error);
            
            if (error.code === 'NOT_AUTHORIZED' || error.message?.includes('permission')) {
              // Permissions were revoked after being initially granted
              localStorage.setItem('permissionsGranted', 'false');
              
              // Emit an error event that the UI can listen to
              this.emit('permissionError', error);
              
              // Try to clean up and stop tracking
              this.cleanupWatchers();
              
              // Show a user-friendly message for GrapheneOS users
              const isGraphene = this.isGrapheneOS();
              const message = isGraphene 
                ? 'Location permission was revoked. On GrapheneOS, please:\n1. Go to Settings > Apps > Runstr > Permissions\n2. Set Location to "Allow all the time"\n3. Disable battery optimization: Settings > Apps > Runstr > Battery > Don\'t optimize\n4. Check Network permission is enabled'
                : 'Location permission was revoked. Please go to Settings > Apps > Runstr > Permissions and re-enable Location access.';
              
              alert(message);
              
              // Try to open settings
              BackgroundGeolocation.openSettings().catch(err => {
                console.warn('Could not open settings:', err);
              });
            }
            return;
          }

          // Successfully got location
          this.lastGPSUpdate = Date.now(); // Update heartbeat timestamp
          this.addPosition(location);
        }
      );
      
      console.log(`Background tracking started for ${this.activityType} with ID:`, this.watchId);
      console.log('GPS Config:', gpsConfig);
      
    } catch (error) {
      console.error('Error starting background tracking:', error);
      
      // Check if it's a permission-related error
      if (error.message?.includes('permission') || error.code === 'NOT_AUTHORIZED') {
        localStorage.setItem('permissionsGranted', 'false');
        this.emit('permissionError', error);
        
        // Enhanced error message for GrapheneOS users
        const isGraphene = this.isGrapheneOS();
        const message = isGraphene
          ? 'Location permission is required. On GrapheneOS, please:\n1. Settings > Apps > Runstr > Permissions > Location: "Allow all the time"\n2. Settings > Apps > Runstr > Battery > Don\'t optimize\n3. Check Network permission is enabled\n4. Restart the app after changes'
          : 'Location permission is required. Please enable it in Settings > Apps > Runstr > Permissions.';
        
        alert(message);
        
        try {
          await BackgroundGeolocation.openSettings();
        } catch (settingsError) {
          console.warn('Could not open settings:', settingsError);
        }
      }
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
    
    // GrapheneOS diagnostic on startup
    const isGraphene = this.isGrapheneOS();
    if (isGraphene) {
      console.log('[GrapheneOS] DETAILED DIAGNOSTIC START');
      console.log('[GrapheneOS] User Agent:', navigator.userAgent);
      console.log('[GrapheneOS] Local Storage isGrapheneOS:', localStorage.getItem('isGrapheneOS'));
      console.log('[GrapheneOS] Network Permission Available:', navigator.permissions ? 'Yes' : 'No');
      console.log('[GrapheneOS] Geolocation Available:', navigator.geolocation ? 'Yes' : 'No');
      console.log('[GrapheneOS] Online Status:', navigator.onLine);
      console.log('[GrapheneOS] Enhanced GPS settings enabled');
      console.log('[GrapheneOS] Using accuracy threshold:', getAccuracyThreshold(), 'm');
      console.log('[GrapheneOS] Using movement threshold:', getMovementThreshold(), 'm');
      
      this.emit('grapheneOSDetected', {
        message: 'GrapheneOS detected - using optimized GPS settings for privacy-focused OS'
      });
      
      // GrapheneOS Zero Distance Debugging
      this.grapheneDebugCounter = 0;
      this.grapheneLastPositionTime = 0;
    }
    
    // Check battery optimization before starting
    const isBatteryOptimized = await this.checkBatteryOptimization();
    if (!isBatteryOptimized) {
      console.warn('Battery optimization is enabled - GPS tracking may be unreliable');
      const message = isGraphene 
        ? 'Battery optimization is enabled. On GrapheneOS, go to Settings > Apps > Runstr > Battery and select "Don\'t optimize" for reliable GPS tracking.'
        : 'Battery optimization is enabled for Runstr. This may cause GPS tracking to stop unexpectedly. Please disable battery optimization in your device settings.';
      
      this.emit('batteryOptimizationWarning', {
        message: message,
        canProceed: true // Allow user to proceed anyway
      });
      // Don't return here - let user proceed but warn them
    }
    
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
    this.smoothedSpeedMps = 0; // Reset smoothed speed for new session
    
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
    this.startGPSHeartbeat(); // Start GPS monitoring
    
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
    this.stopGPSHeartbeat(); // Stop GPS monitoring while paused
    
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
    this.startGPSHeartbeat(); // Restart GPS monitoring
    
    // Emit status change event
    this.emit('statusChange', { isTracking: this.isTracking, isPaused: this.isPaused });
  }

  async stop(publicKey) {
    if (!this.isTracking) return;

    this.isTracking = false;
    this.isPaused = false;
    
    // Clear any active distance goal when run stops
    this.distanceGoal = null;
    
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
        finalEstimatedSteps = this.distance > 0 ? Math.round(this.distance / this.strideLength) : 0;
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
    this.stopGPSHeartbeat();
    
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
    this.startGPSHeartbeat();
    
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

  // Distance goal management methods
  setDistanceGoal(meters) {
    this.distanceGoal = meters && meters > 0 ? meters : null;
  }

  clearDistanceGoal() {
    this.distanceGoal = null;
  }

  getDistanceGoal() {
    return this.distanceGoal;
  }

  // Get custom stride length from settings or calculate from height
  getCustomStrideLength() {
    // First check if user has set a custom stride length
    const customStrideLength = parseFloat(localStorage.getItem('customStrideLength'));
    if (customStrideLength && customStrideLength > 0) {
      // UI for setting this is removed. To enforce default, we should make this function simply return AVERAGE_STRIDE_LENGTH_METERS
      // return customStrideLength; 
    }
    
    // Otherwise, try to calculate from height
    const userHeight = parseFloat(localStorage.getItem('userHeight')); // in cm
    if (userHeight && userHeight > 0) {
      // Similar to above, UI is removed. To enforce default:
      // return estimateStrideLength(userHeight);
    }
    
    // Default to average if no custom settings
    return AVERAGE_STRIDE_LENGTH_METERS;
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
