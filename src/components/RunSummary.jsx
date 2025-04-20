import PropTypes from 'prop-types';

/**
 * Component for displaying a summary of a run
 */
export const RunSummary = ({ run, distanceUnit = 'km' }) => {
  if (!run) {
    return (
      <div className="no-run-summary">
        No recent runs found
      </div>
    );
  }

  /**
   * Convert run date to a relative format
   * @param {string} dateString - ISO date string
   * @returns {string} Formatted date string
   */
  const convertRunDateToRelative = (dateString) => {
    if (!dateString) return "Unknown date";
    
    const runDate = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if the run was today
    if (runDate.toDateString() === today.toDateString()) {
      return "Today";
    }
    
    // Check if the run was yesterday
    if (runDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    
    // Otherwise return the actual date
    return runDate.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short', 
      day: 'numeric'
    });
  };

  // Extract run data
  const { 
    distance, 
    duration, 
    pace, 
    date, 
    splits = [],
    elevation = { gain: 0, loss: 0 }
  } = run;

  return (
    <div className="run-summary">
      <h3>Run Summary</h3>
      <div className="run-date">{convertRunDateToRelative(date)}</div>
      
      <div className="run-stats">
        <div className="stat-item">
          <span className="stat-label">Distance</span>
          <span className="stat-value">{distance} {distanceUnit}</span>
        </div>
        
        <div className="stat-item">
          <span className="stat-label">Duration</span>
          <span className="stat-value">{duration}</span>
        </div>
        
        <div className="stat-item">
          <span className="stat-label">Pace</span>
          <span className="stat-value">{pace} min/{distanceUnit}</span>
        </div>
        
        {/* Only show elevation if it exists */}
        {(elevation.gain > 0 || elevation.loss > 0) && (
          <div className="stat-item">
            <span className="stat-label">Elevation</span>
            <span className="stat-value">+{elevation.gain}m / -{elevation.loss}m</span>
          </div>
        )}
      </div>
      
      {/* Show splits if they exist */}
      {splits.length > 0 && (
        <div className="run-splits">
          <h4>Splits</h4>
          <ul className="splits-list">
            {splits.map((split, index) => (
              <li key={index} className="split-item">
                <span className="split-km">{split.km || index + 1}</span>
                <span className="split-time">{split.time}</span>
                <span className="split-pace">{split.pace}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

RunSummary.propTypes = {
  run: PropTypes.shape({
    distance: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    duration: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    pace: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    date: PropTypes.string,
    splits: PropTypes.arrayOf(
      PropTypes.shape({
        km: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        time: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        pace: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
      })
    ),
    elevation: PropTypes.shape({
      gain: PropTypes.number,
      loss: PropTypes.number
    })
  }),
  distanceUnit: PropTypes.string
}; 