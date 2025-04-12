import { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { TeamItem } from '../components/TeamItem';
import { TeamsContext } from '../contexts/TeamsContext';
import { NostrContext } from '../contexts/NostrContext';
import { TeamSettings } from '../components/TeamSettings';

export const Teams = () => {
  const { 
    teams, 
    myTeams, 
    loading, 
    error, 
    clearError, 
    currentUser 
  } = useContext(TeamsContext);
  
  const { publicKey } = useContext(NostrContext);
  
  const [activeTab, setActiveTab] = useState('myTeams');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTeams, setFilteredTeams] = useState([]);
  
  // Filter teams based on search query
  useEffect(() => {
    if (activeTab === 'allTeams') {
      if (searchQuery.trim() === '') {
        setFilteredTeams(teams);
      } else {
        const query = searchQuery.toLowerCase();
        const results = teams.filter(team => 
          team.name.toLowerCase().includes(query) || 
          (team.description && team.description.toLowerCase().includes(query))
        );
        setFilteredTeams(results);
      }
    }
  }, [teams, searchQuery, activeTab]);
  
  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold mb-6 text-center">Clubs & Teams</h1>
      
      {/* Login status indicator */}
      {!currentUser && !publicKey && (
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
        <button
          className={`px-4 py-2 ${activeTab === 'settings' 
            ? 'border-b-2 border-blue-500 text-blue-500' 
            : 'text-gray-400'}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>
      
      {/* Create team button */}
      <div className="mb-6">
        <Link 
          to="/teams/create"
          className={`block w-full ${currentUser || publicKey ? 'bg-blue-600' : 'bg-blue-600/50 cursor-not-allowed'} text-white py-3 px-4 rounded-lg text-center font-semibold`}
          onClick={(e) => !(currentUser || publicKey) && e.preventDefault()}
        >
          Create New Club
        </Link>
        {!(currentUser || publicKey) && (
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
              <p className="mt-4 text-gray-400">Loading your clubs...</p>
            </div>
          ) : myTeams.length > 0 ? (
            <div className="space-y-4">
              {myTeams.map(team => (
                <TeamItem key={team.id} team={team} />
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
      ) : activeTab === 'allTeams' ? (
        // All teams tab content
        <div>
          <h2 className="text-xl font-semibold mb-4">Discover Clubs</h2>
          
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search for clubs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-3 bg-[#1a222e] border border-gray-700 rounded-lg"
            />
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <p className="mt-4 text-gray-400">Loading clubs...</p>
            </div>
          ) : filteredTeams.length > 0 ? (
            <div className="space-y-4">
              {filteredTeams.map(team => (
                <TeamItem key={team.id} team={team} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-[#1a222e] rounded-lg">
              <p className="text-gray-400 mb-4">
                {searchQuery.trim() 
                  ? `No clubs found matching "${searchQuery}"`
                  : `No clubs available yet. ${currentUser ? 'Be the first to create one!' : 'Log in to create a club!'}`}
              </p>
              {currentUser && !searchQuery.trim() && (
                <Link 
                  to="/teams/create"
                  className="inline-block bg-blue-600 text-white py-2 px-6 rounded-lg"
                >
                  Create a Club
                </Link>
              )}
            </div>
          )}
        </div>
      ) : (
        // Settings tab content
        <TeamSettings />
      )}
    </div>
  );
}; 