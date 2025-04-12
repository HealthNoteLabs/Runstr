// Constants for accuracy thresholds
const MINIMUM_ACCURACY = 25; // meters - for good precision
const SPEED_THRESHOLD = 12.5; // meters/second (~45 km/h)
const MINIMUM_DISTANCE = 0.02; // meters
const MAXIMUM_DISTANCE_PER_POINT = 50; // meters
const MINIMUM_TIME_DIFF = 0.2; // seconds
const PACE_WINDOW = 15; // Reduced to 15 seconds for more responsive pace updates
const ELEVATION_SMOOTHING = 3;

/**
 * Calculate a moving average for elevation data
 */
function smoothElevation(positions, windowSize = ELEVATION_SMOOTHING) {
  if (positions.length < windowSize) return null;

  const recentPositions = positions.slice(-windowSize);
  const validElevations = recentPositions
    .map((pos) => pos.coords.altitude)
    .filter((alt) => alt !== null && !isNaN(alt));

  if (validElevations.length < windowSize / 2) return null;

  return (
    validElevations.reduce((sum, alt) => sum + alt, 0) / validElevations.length
  );
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  // Input validation
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number'
  ) {
    console.warn('Invalid coordinates provided to calculateDistance');
    return 0;
  }

  // Check for identical points
  if (lat1 === lat2 && lon1 === lon2) return 0;

  try {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;

    // Sanity check on the result
    if (isNaN(distance) || !isFinite(distance)) {
      console.warn('Invalid distance calculation result');
      return 0;
    }

    return distance;
  } catch (error) {
    console.error('Error calculating distance:', error);
    return 0;
  }
}

/**
 * Filter location data for accuracy
 */
export function filterLocation(location, lastLocation) {
  if (!location || !location.coords) {
    console.warn('Invalid location data provided to filterLocation');
    return false;
  }

  // Check for minimum accuracy
  if (location.coords.accuracy > MINIMUM_ACCURACY) {
    console.warn(
      `Point filtered: poor accuracy (${location.coords.accuracy}m)`
    );
    return false;
  }

  if (!lastLocation) {
    return true;
  }

  // Calculate time difference
  const timeDiff = (location.timestamp - lastLocation.timestamp) / 1000;

  // Ensure minimum time between points
  if (timeDiff < MINIMUM_TIME_DIFF) {
    return false;
  }

  // Calculate speed between points
  const distance = calculateDistance(
    lastLocation.coords.latitude,
    lastLocation.coords.longitude,
    location.coords.latitude,
    location.coords.longitude
  );

  const speed = distance / timeDiff;

  // Filter out unrealistic speeds
  if (speed > SPEED_THRESHOLD) {
    console.warn(`Point filtered: unrealistic speed (${speed.toFixed(2)} m/s)`);
    return false;
  }

  // Filter out stationary points
  if (distance < MINIMUM_DISTANCE) {
    return false;
  }

  return true;
}

/**
 * Calculate current pace in minutes per kilometer
 * More sensitive to variations
 */
export function calculatePace(distance, duration, positions = []) {
  if (distance <= 0 || duration <= 0) return 0;

  // If we have positions, calculate pace over recent window
  if (positions.length > 1) {
    const now = positions[positions.length - 1].timestamp;
    const windowStart = now - PACE_WINDOW * 1000;

    // Find positions within our window
    const recentPositions = positions.filter(
      (pos) => pos.timestamp >= windowStart
    );

    if (recentPositions.length > 1) {
      let recentDistance = 0;
      let lastValidPosition = null;

      // Calculate distance in the recent window
      for (const position of recentPositions) {
        if (lastValidPosition) {
          const segmentDistance = calculateDistance(
            lastValidPosition.coords.latitude,
            lastValidPosition.coords.longitude,
            position.coords.latitude,
            position.coords.longitude
          );

          const timeDiff =
            (position.timestamp - lastValidPosition.timestamp) / 1000;
          if (timeDiff > 0) {
            recentDistance += segmentDistance;
          }
        }
        lastValidPosition = position;
      }

      const recentDuration =
        (recentPositions[recentPositions.length - 1].timestamp -
          recentPositions[0].timestamp) /
        1000;

      if (recentDuration > 0 && recentDistance > 0) {
        // Convert to minutes per kilometer
        const speedKmH = recentDistance / 1000 / (recentDuration / 3600);
        return speedKmH > 0 ? 60 / speedKmH : 0;
      }
    }
  }

  // Fallback to overall pace
  const speedKmH = distance / 1000 / (duration / 3600);
  return speedKmH > 0 ? 60 / speedKmH : 0;
}

/**
 * Calculate split times for each kilometer or mile
 * @param {Array} positions - Array of position objects
 * @param {string} unit - The unit to use for splits ('km' or 'mi')
 */
export function calculateSplits(positions, unit = 'km') {
  if (!positions.length) return [];

  const splitDistance = unit === 'km' ? 1000 : 1609.344; // 1km or 1mile in meters
  
  const splits = [];
  let currentSplit = {
    distance: 0,
    duration: 0,
    startTime: positions[0].timestamp
  };

  for (let i = 1; i < positions.length; i++) {
    const distance = calculateDistance(
      positions[i - 1].coords.latitude,
      positions[i - 1].coords.longitude,
      positions[i].coords.latitude,
      positions[i].coords.longitude
    );

    currentSplit.distance += distance;
    currentSplit.duration = positions[i].timestamp - currentSplit.startTime;

    // When we reach the split distance, record the split
    if (currentSplit.distance >= splitDistance) {
      splits.push({
        pace: calculatePace(currentSplit.distance, currentSplit.duration),
        duration: currentSplit.duration,
        distance: currentSplit.distance
      });

      currentSplit = {
        distance: currentSplit.distance - splitDistance,
        duration: 0,
        startTime: positions[i].timestamp
      };
    }
  }

  // Add current incomplete split if we've covered some distance
  if (currentSplit.distance > 0) {
    splits.push({
      pace: calculatePace(currentSplit.distance, currentSplit.duration),
      duration: currentSplit.duration,
      distance: currentSplit.distance,
      incomplete: true
    });
  }

  return splits;
}

/**
 * Calculate workout statistics with improved accuracy
 */
export function calculateStats(positions, elapsedTime = null) {
  if (!positions.length) {
    return {
      distance: 0,
      duration: 0,
      pace: 0,
      currentSpeed: 0,
      splits: [],
      positions: [],
      elevation: {
        current: null,
        gain: 0,
        loss: 0
      }
    };
  }

  // Get user's preferred distance unit
  const distanceUnit = localStorage.getItem('distanceUnit') || 'km';

  // Sort positions by timestamp to ensure correct order
  const sortedPositions = [...positions].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  let totalDistance = 0;
  let currentSpeed = 0;
  let lastValidTime = null;

  // Filter and calculate total distance
  const filteredPositions = [];
  let lastValidPosition = null;

  for (const position of sortedPositions) {
    if (!lastValidPosition || filterLocation(position, lastValidPosition)) {
      const timeDiff = lastValidPosition
        ? (position.timestamp - lastValidPosition.timestamp) / 1000
        : 0;

      if (lastValidPosition) {
        const distance = calculateDistance(
          lastValidPosition.coords.latitude,
          lastValidPosition.coords.longitude,
          position.coords.latitude,
          position.coords.longitude
        );

        // Validate segment with stricter criteria
        const speed = timeDiff > 0 ? distance / timeDiff : 0;
        const isValidSegment =
          distance >= MINIMUM_DISTANCE &&
          distance <= MAXIMUM_DISTANCE_PER_POINT &&
          timeDiff >= MINIMUM_TIME_DIFF &&
          speed <= SPEED_THRESHOLD &&
          position.coords.accuracy <= MINIMUM_ACCURACY;

        if (isValidSegment) {
          totalDistance += distance;
          lastValidTime = position.timestamp;

          // Update current speed using recent valid movement
          if (timeDiff > 0) {
            currentSpeed = 0.7 * currentSpeed + 0.3 * speed; // Smoothed speed
          }
        }
      }

      filteredPositions.push(position);
      lastValidPosition = position;
    }
  }

  // Calculate effective duration
  const duration =
    elapsedTime !== null
      ? elapsedTime
      : lastValidTime
        ? (lastValidTime - sortedPositions[0].timestamp) / 1000
        : 0;

  // Calculate current pace with improved accuracy
  let currentPace = 0;
  if (filteredPositions.length > 1) {
    const now = filteredPositions[filteredPositions.length - 1].timestamp;
    const windowStart = now - PACE_WINDOW * 1000;
    const recentPositions = filteredPositions.filter(
      (pos) => pos.timestamp >= windowStart
    );

    if (recentPositions.length > 1) {
      const recentDistance = calculateRecentDistance(recentPositions);
      const recentDuration =
        (recentPositions[recentPositions.length - 1].timestamp -
          recentPositions[0].timestamp) /
        1000;

      if (recentDuration > 0 && recentDistance > 0) {
        const speedKmH = recentDistance / 1000 / (recentDuration / 3600);
        currentPace = speedKmH > 0 ? 60 / speedKmH : 0;
      }
    }
  }

  // Use current pace if valid, otherwise calculate from total
  const pace =
    currentPace > 0
      ? currentPace
      : totalDistance > 0 && duration > 0
        ? calculatePace(totalDistance, duration)
        : 0;

  return {
    distance: totalDistance,
    duration: duration,
    pace: pace,
    currentSpeed: currentSpeed,
    splits: calculateSplits(filteredPositions, distanceUnit),
    positions: filteredPositions,
    elevation: {
      current: smoothElevation(filteredPositions),
      gain: 0,
      loss: 0
    }
  };
}

/**
 * Calculate recent distance with additional validation
 */
function calculateRecentDistance(positions) {
  let distance = 0;
  let lastPosition = null;

  for (const position of positions) {
    if (lastPosition) {
      const segmentDistance = calculateDistance(
        lastPosition.coords.latitude,
        lastPosition.coords.longitude,
        position.coords.latitude,
        position.coords.longitude
      );

      const timeDiff = (position.timestamp - lastPosition.timestamp) / 1000;
      const speed = timeDiff > 0 ? segmentDistance / timeDiff : 0;

      if (
        speed <= SPEED_THRESHOLD &&
        segmentDistance <= MAXIMUM_DISTANCE_PER_POINT
      ) {
        distance += segmentDistance;
      }
    }
    lastPosition = position;
  }

  return distance;
}
