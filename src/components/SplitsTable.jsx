import PropTypes from 'prop-types';
import { formatTime, formatPace } from '../utils/formatters';

const SplitsTable = ({ splits, distanceUnit = 'km' }) => {
  if (!splits || splits.length === 0) {
    return null;
  }

  // Calculate average pace for all splits
  const averagePace = splits.reduce((sum, split) => sum + split.pace, 0) / splits.length;

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-700">
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              Split
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              Distance
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              Time
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              Pace
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              vs Avg
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {splits.map((split, index) => {
            const paceDiff = split.pace - averagePace;
            const paceDiffColor = paceDiff < 0 ? 'text-green-400' : paceDiff > 0 ? 'text-red-400' : 'text-gray-200';
            const paceDiffSign = paceDiff > 0 ? '+' : '';
            
            return (
              <tr key={index} className="hover:bg-gray-700">
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-200">
                  {index + 1}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-200">
                  {distanceUnit === 'km' ? '1 km' : '1 mi'}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-200">
                  {formatTime(split.time)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-200">
                  {formatPace(split.pace, distanceUnit)}
                </td>
                <td className={`px-4 py-2 whitespace-nowrap text-sm ${paceDiffColor}`}>
                  {paceDiffSign}{formatPace(Math.abs(paceDiff), distanceUnit)}
                </td>
              </tr>
            );
          })}
          {/* Add average row */}
          <tr className="bg-gray-700/50 font-semibold">
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-200">
              Avg
            </td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-200">
              {distanceUnit === 'km' ? '1 km' : '1 mi'}
            </td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-200">
              {formatTime(splits.reduce((sum, split) => sum + split.time, 0) / splits.length)}
            </td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-200">
              {formatPace(averagePace, distanceUnit)}
            </td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-200">
              -
            </td>
          </tr>
        </tbody>
      </table>
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