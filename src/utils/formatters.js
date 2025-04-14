/**
 * Format time in seconds to HH:MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
export const formatTime = (seconds) => {
  // Round to 2 decimal places to avoid excessive precision
  seconds = Math.round(seconds * 100) / 100;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Format distance in meters to km or miles
 * @param {number} meters - Distance in meters
 * @param {string} unit - Distance unit ('km' or 'mi')
 * @returns {string} Formatted distance string
 */
export const displayDistance = (meters, unit = 'km') => {
  // Ensure value is a number and not too small
  const numValue = Number(meters);
  if (isNaN(numValue) || numValue < 0.01) {
    return `0.00 ${unit}`;
  }
  
  // Convert from meters to km or miles as needed
  const converted = unit === 'mi' ? numValue / 1609.344 : numValue / 1000;
  
  // Format to 2 decimal places
  return `${converted.toFixed(2)} ${unit}`;
};

/**
 * Format elevation in meters to meters or feet
 * @param {number} meters - Elevation in meters
 * @param {string} unit - Distance unit system ('km' for metric, 'mi' for imperial)
 * @returns {string} Formatted elevation string
 */
export const formatElevation = (meters, unit = 'km') => {
  if (!meters || meters === null || isNaN(meters)) return '-- ';
  
  if (unit === 'mi') {
    // Convert to feet (1 meter = 3.28084 feet)
    return `${Math.round(meters * 3.28084)} ft`;
  } else {
    return `${Math.round(meters)} m`;
  }
};

/**
 * Format date to a consistent readable format
 * @param {string} dateString - Date string to format
 * @returns {string} Formatted date string
 */
export const formatDate = (dateString) => {
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return new Date().toLocaleDateString();
    }
    
    // Check if date is in the future (use current date instead)
    const now = new Date();
    if (date > now) {
      return now.toLocaleDateString();
    }
    
    return date.toLocaleDateString();
  } catch (error) {
    console.error('Error formatting date:', error);
    return new Date().toLocaleDateString();
  }
};

/**
 * Format pace to MM:SS format
 * @param {number} pace - Pace in minutes per unit
 * @param {string} unit - Distance unit ('km' or 'mi')
 * @returns {string} Formatted pace string
 */
export const formatPace = (pace, unit = 'km') => {
  if (!pace || pace === 0 || pace === Infinity) {
    return '-- min/' + unit;
  }
  
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')} min/${unit}`;
};

/**
 * Convert a distance in meters to kilometers or miles.
 *
 * @param {number} meters - The distance in meters.
 * @param {string} unit - The unit to convert to ("km" or "mi").
 * @returns {number} The converted distance.
 */
export function convertDistance(meters, unit) {
  if (typeof meters !== 'number' || meters < 0) {
    throw new Error('Please provide a valid distance in meters.');
  }

  switch (unit.toLowerCase()) {
    case 'km':
      return (meters / 1000).toFixed(2);
    case 'mi':
      // 1 mile = 1609.344 meters
      return (meters / 1609.344).toFixed(2);
    default:
      throw new Error('Invalid unit. Please use "km" or "miles".');
  }
}

/**
 * Converts a pace from seconds per meter to a human-readable pace format (minutes per kilometer or mile).
 *
 * @param {number} pace - The pace in seconds per meter.
 * @param {string} unit - The unit to format pace in ("km" or "mi"). Defaults to "km".
 * @returns {string} A formatted pace string in "MM:SS" per kilometer/mile format.
 */
export function formatPaceWithUnit(pace, unit = 'km') {
  return `${formatPace(pace, unit)} min/${unit}`;
}
