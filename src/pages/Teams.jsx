import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTeams } from '../contexts/TeamsContext';

export const Teams = () => {
  const navigate = useNavigate();
  const { 
    teams, 
    myTeams, 
    loading, 
    error, 
    currentUser,
    clearError 
  } = useTeams();
  
  const [activeTab, setActiveTab] = useState('myTeams');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTeams, setFilteredTeams] = useState([]);

  // Filter teams based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTeams(teams);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = teams.filter(team => 
        team.name.toLowerCase().includes(query) || 
        (team.description && team.description.toLowerCase().includes(query))
      );
      setFilteredTeams(filtered);
    }
  }, [searchQuery, teams]);

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold mb-6 text-center">Clubs & Teams</h1>
      
      {/* Login status indicator */}
      {!currentUser && (
        <div className="mb-6 p-4 bg-yellow-800/20 border border-yellow-700 rounded-lg">
          <p className="text-yellow-400 text-center">
            Sign in to create or join clubs
          </p>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg">
          <p className="text-red-400">{error}</p>
          <button 
            onClick={clearError}
            className="mt-2 text-sm text-red-400 underline"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-6">
        <button
          className={`px-4 py-2 ${activeTab === 'myTeams' 
            ? 'border-b-2 border-blue-500 text-blue-500' 
            : 'text-gray-400'}`}
          onClick={() => setActiveTab('myTeams')}
        >
          My Clubs
        </button>
        <button
          className={`px-4 py-2 ${activeTab === 'allTeams' 
            ? 'border-b-2 border-blue-500 text-blue-500' 
            : 'text-gray-400'}`}
          onClick={() => setActiveTab('allTeams')}
        >
          Discover
        </button>
      </div>
      
      {/* Create team button */}
      <div className="mb-6">
        <Link 
          to="/teams/create"
          className={`block w-full ${currentUser ? 'bg-blue-600' : 'bg-blue-600/50 cursor-not-allowed'} text-white py-3 px-4 rounded-lg text-center font-semibold`}
          onClick={(e) => !currentUser && e.preventDefault()}
        >
          Create New Club
        </Link>
        {!currentUser && (
          <p className="text-center text-sm text-gray-400 mt-2">
            You need to be logged in to create a club
          </p>
        )}
      </div>
      
      {/* Content based on active tab */}
      {activeTab === 'myTeams' ? (
        // My teams tab content
        <div>
          <h2 className="text-xl font-semibold mb-4">My Clubs</h2>
          
          {!currentUser ? (
            <div className="text-center py-8 bg-[#1a222e] rounded-lg">
              <p className="text-gray-400 mb-4">Please log in to see your clubs</p>
            </div>
          ) : loading ? (
            <div className="text-center py-8">
              <div className="loading-spinner mx-auto"></div>
              <p className="mt-4 text-gray-400">Loading your clubs...</p>
            </div>
          ) : myTeams.length > 0 ? (
            <div className="space-y-4">
              {myTeams.map(team => (
                <div 
                  key={team.id}
                  onClick={() => navigate(`/teams/${team.id}`)}
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
                    <div>
                      <h3 className="font-semibold">{team.name}</h3>
                      <p className="text-sm text-gray-400">
                        {team.memberCount || 1} member{(team.memberCount || 1) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-[#1a222e] rounded-lg">
              <p className="text-gray-400 mb-4">You haven&apos;t joined any clubs yet.</p>
              <button
                onClick={() => setActiveTab('allTeams')}
                className="bg-blue-600 text-white py-2 px-6 rounded-lg"
              >
                Discover Clubs
              </button>
            </div>
          )}
        </div>
      ) : (
        // Discover tab content
        <div>
          <h2 className="text-xl font-semibold mb-4">Discover Clubs</h2>
          
          {/* Search box */}
          <div className="mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search for clubs..."
              className="w-full p-3 bg-[#1a222e] border border-gray-700 rounded-lg"
            />
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="loading-spinner mx-auto"></div>
              <p className="mt-4 text-gray-400">Loading clubs...</p>
            </div>
          ) : filteredTeams.length > 0 ? (
            <div className="space-y-4">
              {filteredTeams.map(team => (
                <div 
                  key={team.id}
                  onClick={() => navigate(`/teams/${team.id}`)}
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
                    <div>
                      <h3 className="font-semibold">{team.name}</h3>
                      <p className="text-sm text-gray-400 mb-2">
                        {team.memberCount || 1} member{(team.memberCount || 1) !== 1 ? 's' : ''}
                      </p>
                      {team.description && (
                        <p className="text-sm text-gray-300">{team.description.substring(0, 100)}{team.description.length > 100 ? '...' : ''}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-[#1a222e] rounded-lg">
              <p className="text-gray-400">
                {searchQuery.trim() 
                  ? `No clubs found matching "${searchQuery}"`
                  : "No clubs available. Be the first to create one!"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Teams; 