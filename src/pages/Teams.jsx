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
    setUser,
    clearError 
  } = useTeams();
  
  const [activeTab, setActiveTab] = useState('myTeams');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTeams, setFilteredTeams] = useState([]);
  const [tempUserId, setTempUserId] = useState(() => {
    return currentUser || '';
  });

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

  // Handle temp user ID change for demo purposes
  const handleUserIdChange = (e) => {
    setTempUserId(e.target.value);
  };

  // Set user ID for demo purposes
  const handleSetUser = () => {
    if (tempUserId.trim()) {
      setUser(tempUserId.trim());
    }
  };

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold mb-6 text-center">Clubs & Teams</h1>
      
      {/* For demonstration - allows setting user ID */}
      <div className="mb-6 p-4 bg-[#1a222e] rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Demo Login</h2>
        <div className="flex">
          <input
            type="text"
            value={tempUserId}
            onChange={handleUserIdChange}
            placeholder="Enter any user ID"
            className="flex-1 p-2 bg-[#111827] border border-gray-700 rounded-l-lg"
          />
          <button
            onClick={handleSetUser}
            className="bg-blue-600 px-4 py-2 rounded-r-lg"
          >
            Set User
          </button>
        </div>
        {currentUser && (
          <p className="mt-2 text-sm text-green-400">
            Logged in as: {currentUser.substring(0, 10)}...
          </p>
        )}
      </div>
      
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
          className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg text-center font-semibold"
        >
          Create New Club
        </Link>
      </div>
      
      {/* Content based on active tab */}
      {activeTab === 'myTeams' ? (
        // My teams tab content
        <div>
          <h2 className="text-xl font-semibold mb-4">My Clubs</h2>
          
          {loading ? (
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