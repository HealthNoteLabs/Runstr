/**
 * Create a workout event for Nostr publishing
 * @param {Object} runData - Run data to include in workout event
 * @param {string} distanceUnit - Unit of distance measurement (km or mi)
 * @returns {Object} Workout event object ready for Nostr publishing
 */
export const createWorkoutEvent = (runData, distanceUnit = 'km') => {
  if (!runData) {
    throw new Error('No run data provided');
  }
  
  // Extract relevant data from run
  const {
    distance,
    duration,
    pace,
    date,
    splits = [],
    elevation = { gain: 0, loss: 0 }
  } = runData;

  // Create base event
  const workoutEvent = {
    kind: 1, // Standard text note
    created_at: Math.floor(Date.now() / 1000),
    content: formatWorkoutContent(runData, distanceUnit),
    tags: [
      ['t', 'workout'],
      ['t', 'runstr'],
      ['t', 'running'],
      ['d', `run-${date || new Date().toISOString()}`],
      ['distance', distance.toString()],
      ['duration', duration.toString()],
      ['pace', pace.toString()],
      ['unit', distanceUnit]
    ]
  };
  
  // Add elevation data if available
  if (elevation && (elevation.gain || elevation.loss)) {
    workoutEvent.tags.push(['elevation', `gain:${elevation.gain},loss:${elevation.loss}`]);
  }
  
  // Add split data if available
  if (splits && splits.length > 0) {
    const splitsString = splits.map(split => 
      `${split.km || split.distance}:${split.time}:${split.pace}`
    ).join(',');
    
    workoutEvent.tags.push(['splits', splitsString]);
  }
  
  return workoutEvent;
};

/**
 * Format workout data into human-readable content
 * @param {Object} runData - Run data to format
 * @param {string} distanceUnit - Unit of distance measurement
 * @returns {string} Formatted content string
 */
export const formatWorkoutContent = (runData, distanceUnit = 'km') => {
  const {
    distance,
    duration,
    pace,
    date,
    splits = [],
    elevation = { gain: 0, loss: 0 }
  } = runData;
  
  // Format the date
  const formattedDate = date ? new Date(date).toLocaleDateString() : 'today';
  
  // Format duration as hours:minutes:seconds
  const durationFormatted = formatDuration(duration);
  
  // Build the content
  let content = `🏃‍♂️ Run completed on ${formattedDate}!\n`;
  content += `📏 Distance: ${distance} ${distanceUnit}\n`;
  content += `⏱️ Duration: ${durationFormatted}\n`;
  content += `⚡ Pace: ${formatPace(pace, distanceUnit)}\n`;
  
  // Add elevation if available
  if (elevation && (elevation.gain || elevation.loss)) {
    content += `📈 Elevation: ${elevation.gain}m gain, ${elevation.loss}m loss\n`;
  }
  
  // Add splits if available
  if (splits && splits.length > 0) {
    content += '\nSplits:\n';
    splits.forEach((split, index) => {
      content += `${index + 1}: ${split.km || split.distance}${distanceUnit} - ${formatDuration(split.time)} - ${formatPace(split.pace, distanceUnit)}\n`;
    });
  }
  
  return content;
};

/**
 * Format duration in seconds to a human-readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string (HH:MM:SS)
 */
export const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return '00:00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0')
  ].join(':');
};

/**
 * Format pace value to a human-readable string
 * @param {number} pace - Pace value
 * @param {string} unit - Unit of distance measurement
 * @returns {string} Formatted pace string
 */
export const formatPace = (pace, unit = 'km') => {
  if (!pace && pace !== 0) return '00:00';
  
  const paceSeconds = pace * 60;
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.floor(paceSeconds % 60);
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} min/${unit}`;
}; 