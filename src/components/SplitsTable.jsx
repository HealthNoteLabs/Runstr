import PropTypes from 'prop-types';
import { formatTime, formatPace } from '../utils/formatters';
import { useEffect, useState } from 'react';

const SplitsTable = ({ splits, distanceUnit = 'km' }) => {
  const [visibleColumns, setVisibleColumns] = useState({
    distance: true,
    time: true,
    pace: true
  });

  // Responsive column management based on screen size
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 360) { // Very small screens
        setVisibleColumns({
          distance: true,
          time: true,
          pace: false
        });
      } else { // Larger screens
        setVisibleColumns({
          distance: true,
          time: true,
          pace: true
        });
      }
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!splits || splits.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="overflow-x-auto max-w-full pb-2">
        <table className="min-w-full bg-gray-800 rounded-lg">
          <thead>
            <tr className="bg-gray-700">
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[50px]">
                Split
              </th>
              {visibleColumns.distance && (
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[70px]">
                  Distance
                </th>
              )}
              {visibleColumns.time && (
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[70px]">
                  Time
                </th>
              )}
              {visibleColumns.pace && (
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[70px]">
                  Pace
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {splits.map((split, index) => {
              // Calculate individual split time rather than using cumulative time
              const prevSplitTime = index > 0 ? splits[index - 1].time : 0;
              const splitTime = split.time - prevSplitTime;
              
              // Calculate the pace based on the individual split time
              // For a standard unit (1km or 1mi), pace is just the time it took to complete that unit
              const paceMinutes = splitTime / 60; // Convert seconds to minutes
              
              return (
                <tr key={index} className="hover:bg-gray-700">
                  <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-200">
                    {index + 1}
                  </td>
                  {visibleColumns.distance && (
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-200">
                      {distanceUnit === 'km' ? '1 km' : '1 mi'}
                    </td>
                  )}
                  {visibleColumns.time && (
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-200">
                      {formatTime(splitTime)}
                    </td>
                  )}
                  {visibleColumns.pace && (
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-200">
                      {formatPace(paceMinutes, distanceUnit)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

SplitsTable.propTypes = {
  splits: PropTypes.arrayOf(
    PropTypes.shape({
      time: PropTypes.number.isRequired,
      pace: PropTypes.number.isRequired
    })
  ),
  distanceUnit: PropTypes.oneOf(['km', 'mi'])
};

SplitsTable.defaultProps = {
  splits: [],
  distanceUnit: 'km'
};

export default SplitsTable; 