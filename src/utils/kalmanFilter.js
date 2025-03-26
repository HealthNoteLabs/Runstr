/**
 * Simple Kalman filter implementation for GPS tracking
 * Optimized for running movement patterns with improved accuracy
 */
export class KalmanFilter {
  constructor() {
    // State
    this.lat = 0;
    this.lng = 0;
    this.variance = 0;
    this.lastTimestamp = 0;
    this.lastSpeed = 0;
    
    // Process noise
    this.processNoise = 0.1; // Reduced from default to be more stable
    this.measurementNoise = 0.1; // Reduced from default to trust measurements more
    this.minVariance = 0.01; // Minimum variance threshold
    
    // Movement constraints
    this.maxSpeed = 20; // Maximum speed in m/s (72 km/h)
    this.maxAcceleration = 2; // Maximum acceleration in m/s²
  }

  /**
   * Update the filter with a new measurement
   */
  update(lat, lng, accuracy, timestamp = Date.now()) {
    // Input validation
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      typeof accuracy !== 'number'
    ) {
      console.warn('Invalid input to Kalman filter');
      return { lat: this.lat, lng: this.lng, accuracy: Math.sqrt(this.variance) };
    }

    // Initialize if this is the first update
    if (this.lat === 0 && this.lng === 0) {
      this.lat = lat;
      this.lng = lng;
      this.lastTimestamp = timestamp;
      return { lat, lng, accuracy };
    }

    // Calculate time difference
    const timeDiff = (timestamp - this.lastTimestamp) / 1000;
    if (timeDiff <= 0) return { lat: this.lat, lng: this.lng, accuracy: Math.sqrt(this.variance) };

    // Calculate current speed
    const distance = this.calculateDistance(lat, lng);
    const currentSpeed = distance / timeDiff;

    // Check if movement is reasonable
    const isReasonableSpeed = currentSpeed <= this.maxSpeed;
    const isReasonableAcceleration = Math.abs(currentSpeed - this.lastSpeed) / timeDiff <= this.maxAcceleration;

    // Adjust measurement noise based on accuracy and movement
    const accuracyFactor = accuracy / 10; // Normalize accuracy to 0-1 range
    const speedNoiseFactor = isReasonableSpeed && isReasonableAcceleration ? 1 : 2;

    // Calculate Kalman gain with limits
    const K = this.variance / (this.variance + this.measurementNoise * accuracyFactor * speedNoiseFactor);
    const maxK = Math.min(0.3, 1 / (accuracyFactor * speedNoiseFactor)); // Reduced from 0.5 to 0.3
    const limitedK = Math.min(K, maxK);

    // Calculate position updates with movement constraints
    const latDiff = lat - this.lat;
    const lngDiff = lng - this.lng;

    // Maximum allowed movement based on speed and acceleration
    const maxDistance = this.calculateMaxDistance(timeDiff, currentSpeed);
    const maxLatDiff = maxDistance / 111111; // Approximate degrees latitude
    const maxLngDiff = maxDistance / (111111 * Math.cos((this.lat * Math.PI) / 180));

    // Apply bounded updates
    const actualLatDiff = Math.abs(latDiff) > maxLatDiff ? maxLatDiff * Math.sign(latDiff) : latDiff;
    const actualLngDiff = Math.abs(lngDiff) > maxLngDiff ? maxLngDiff * Math.sign(lngDiff) : lngDiff;

    // Update state with reduced smoothing for stationary positions
    if (distance < 1) { // If movement is less than 1 meter
      this.lat += limitedK * 0.5 * actualLatDiff; // Reduce movement by 50%
      this.lng += limitedK * 0.5 * actualLngDiff;
    } else {
      this.lat += limitedK * actualLatDiff;
      this.lng += limitedK * actualLngDiff;
    }

    this.variance = Math.max((1 - limitedK) * this.variance, this.minVariance);
    this.lastTimestamp = timestamp;
    this.lastSpeed = isReasonableAcceleration ? currentSpeed : this.lastSpeed;

    return {
      lat: this.lat,
      lng: this.lng,
      accuracy: Math.sqrt(this.variance)
    };
  }

  /**
   * Calculate maximum allowed distance based on speed and acceleration
   */
  calculateMaxDistance(timeDiff) {
    const maxSpeedIncrease = this.maxAcceleration * timeDiff;
    const maxPossibleSpeed = Math.min(
      this.maxSpeed,
      this.lastSpeed + maxSpeedIncrease
    );

    return Math.min(
      this.maxSpeed * timeDiff,
      (this.lastSpeed + maxPossibleSpeed) * 0.5 * timeDiff
    );
  }

  /**
   * Calculate distance to a new point in meters
   */
  calculateDistance(lat2, lng2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (this.lat * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - this.lat) * Math.PI) / 180;
    const Δλ = ((lng2 - this.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Reset the filter
   */
  reset() {
    this.lat = 0;
    this.lng = 0;
    this.variance = 0;
    this.lastTimestamp = 0;
    this.lastSpeed = 0;
  }
}
