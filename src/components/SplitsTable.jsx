import PropTypes from 'prop-types';
import { formatTime, formatPace } from '../utils/formatters';

const SplitsTable = ({ splits, distanceUnit = 'km', totalDistance = 0 }) => {
  if (!splits || splits.length === 0) {
    return null;
  }

  // Format the split text based on whether it's a full unit or partial
  const formatSplitText = (split, isLastSplit = false) => {
    if (isLastSplit) {
      // For partial final split, show distance with time
      const fractionalDistance = (totalDistance - Math.floor(totalDistance)).toFixed(2);
      return `${fractionalDistance}  ${formatTime(split.splitTime)}`;
    }
    // For regular splits
    return `${distanceUnit === 'km' ? 'Km' : 'Mile'} ${split.distance}  ${formatTime(split.splitTime)}`;
  };

  return (
    <div className="w-full overflow-x-auto mt-4">
      <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-700">
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              Split
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              Time
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              Pace
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {splits.map((split, index) => (
            <tr key={index} className="hover:bg-gray-700">
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-200">
                {formatSplitText(split, index === splits.length - 1 && totalDistance > Math.floor(totalDistance))}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-200">
                {formatTime(split.splitTime)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-200">
                {formatPace(split.splitPace, distanceUnit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

SplitsTable.propTypes = {
  splits: PropTypes.arrayOf(PropTypes.shape({
    distance: PropTypes.number.isRequired,
    elapsedTime: PropTypes.number.isRequired,
    splitTime: PropTypes.number.isRequired,
    splitPace: PropTypes.number.isRequired,
    unit: PropTypes.string.isRequired
  })).isRequired,
  distanceUnit: PropTypes.oneOf(['km', 'mi']),
  totalDistance: PropTypes.number
};

export default SplitsTable; 