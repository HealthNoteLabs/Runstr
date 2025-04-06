import PropTypes from 'prop-types';

const SplitsList = ({ splits, distanceUnit = 'km', className = '' }) => {
  if (!splits || splits.length === 0) {
    return null;
  }

  // Sort splits by distance (descending) to show most recent first
  const sortedSplits = [...splits].sort((a, b) => b.distance - a.distance);
  
  // Format the unit label
  const unitLabel = distanceUnit === 'km' ? 'Km' : 'Mile';

  // Function to format the pace for display
  const formatSplitPace = (paceInSecondsPerMeter, unit) => {
    // Convert from seconds per meter to minutes per km/mile
    const metersPerUnit = unit === 'km' ? 1000 : 1609.344;
    const secondsPerUnit = paceInSecondsPerMeter * metersPerUnit;
    
    // Convert seconds to minutes:seconds format
    const minutes = Math.floor(secondsPerUnit / 60);
    const seconds = Math.floor(secondsPerUnit % 60);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center mb-2">
        <div className="w-6 h-6 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center mr-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="text-sm text-gray-400">Splits</span>
      </div>
      <div className="bg-[#1a222e]/50 rounded-lg p-2 max-h-48 overflow-y-auto">
        <ul className="divide-y divide-gray-700/30">
          {sortedSplits.map((split, index) => {
            // Format the distance part (e.g., "1" or ".68")
            const distanceDisplay = 
              split.isPartial 
                ? `.${Math.floor((split.distance % 1) * 100)}` 
                : split.distance;
            
            // Format pace for display
            const paceDisplay = formatSplitPace(split.pace, distanceUnit);

            return (
              <li key={index} className="py-1.5 flex justify-between items-center">
                <span className="text-sm font-medium">
                  {unitLabel} {distanceDisplay}
                </span>
                <span className="text-sm text-gray-300">
                  {paceDisplay}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

SplitsList.propTypes = {
  splits: PropTypes.arrayOf(
    PropTypes.shape({
      distance: PropTypes.number.isRequired,
      time: PropTypes.number.isRequired,
      pace: PropTypes.number.isRequired,
      isPartial: PropTypes.bool.isRequired
    })
  ),
  distanceUnit: PropTypes.oneOf(['km', 'mi']),
  className: PropTypes.string
};

export default SplitsList; 