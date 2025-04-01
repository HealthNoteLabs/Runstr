import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useEvent } from '../contexts/EventContext';
import { formatPace } from '../utils/formatters';

export const EventLeaderboard = ({ eventId, clubId }) => {
  const { getEventLeaderboard } = useEvent();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLeaderboard = async () => {
      setLoading(true);
      const results = await getEventLeaderboard(eventId, clubId);
      setLeaderboard(results);
      setLoading(false);
    };

    loadLeaderboard();
  }, [eventId, clubId, getEventLeaderboard]);

  if (loading) {
    return (
      <div className="bg-[#1a222e] rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="bg-[#1a222e] rounded-xl p-6">
        <h3 className="text-xl font-bold mb-4">Leaderboard</h3>
        <p className="text-gray-400">No results yet. Be the first to submit your run!</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a222e] rounded-xl p-6">
      <h3 className="text-xl font-bold mb-4">Leaderboard</h3>
      <div className="space-y-3">
        {leaderboard.map((result, index) => (
          <div
            key={result.id}
            className={`flex items-center justify-between p-3 rounded-lg ${
              index === 0
                ? 'bg-yellow-500/20 border border-yellow-500/50'
                : index === 1
                ? 'bg-gray-400/20 border border-gray-400/50'
                : index === 2
                ? 'bg-amber-700/20 border border-amber-700/50'
                : 'bg-gray-700/20 border border-gray-700/50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <span className="text-lg font-bold w-8">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
              </span>
              <span className="font-medium">{result.runnerName}</span>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">
                {result.distance.toFixed(2)}km in {formatPace(result.pace)}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(result.timestamp).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

EventLeaderboard.propTypes = {
  eventId: PropTypes.string.isRequired,
  clubId: PropTypes.string.isRequired
}; 