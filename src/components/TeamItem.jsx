import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';

/**
 * TeamItem component for rendering a team/club in a list
 */
export const TeamItem = ({ team }) => {
  const navigate = useNavigate();
  
  const handleClick = () => {
    navigate(`/teams/${team.id}`);
  };
  
  return (
    <div 
      onClick={handleClick}
      className="bg-[#1a222e] rounded-lg p-4 cursor-pointer transition-transform hover:scale-[1.01]"
    >
      <div className="flex items-center">
        {team.imageUrl ? (
          <img 
            src={team.imageUrl} 
            alt={team.name} 
            className="w-12 h-12 rounded-full mr-4 object-cover" 
          />
        ) : (
          <div className="w-12 h-12 rounded-full mr-4 bg-blue-900/50 flex items-center justify-center">
            <span className="text-lg font-bold">{team.name.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{team.name}</h3>
            {team.hasNostrGroup && (
              <span className="bg-purple-900/50 text-purple-400 text-xs px-2 py-1 rounded">
                Nostr
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mb-2">
            {team.memberCount || 1} member{(team.memberCount || 1) !== 1 ? 's' : ''}
          </p>
          {team.description && (
            <p className="text-sm text-gray-300">
              {team.description.substring(0, 100)}
              {team.description.length > 100 ? '...' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

TeamItem.propTypes = {
  team: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    imageUrl: PropTypes.string,
    description: PropTypes.string,
    memberCount: PropTypes.number,
    hasNostrGroup: PropTypes.bool
  }).isRequired
}; 