import { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { TeamItem } from '../components/TeamItem';
import { TeamsContext } from '../contexts/TeamsContext';
import { NostrContext } from '../contexts/NostrContext';
import { TeamSettings } from '../components/TeamSettings';
import { testGroupDiscovery } from '../debug-nip29';
import nip29Bridge from '../services/NIP29Bridge';

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
  const [testResults, setTestResults] = useState(null);
  const [testing, setTesting] = useState(false);
  
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
  
  // Handle test button click
  const handleTestClick = async () => {
    try {
      setTesting(true);
      setTestResults(null);
      
      console.log('Running NIP29 group discovery test...');
      
      // First check if NIP29 is enabled
      const nip29Enabled = localStorage.getItem('nostr_groups_enabled') === 'true';
      if (!nip29Enabled) {
        localStorage.setItem('nostr_groups_enabled', 'true');
        console.log('NIP29 was not enabled. Enabled it now.');
      }
      
      // Test direct relay discovery
      const directResults = await testGroupDiscovery();
      console.log('Direct discovery results:', directResults);
      
      // Try to discover running groups using the bridge if available
      let bridgeResults = { error: 'NIP29Bridge not initialized' };
      
      if (nip29Bridge && nip29Bridge.initialized) {
        try {
          console.log('Testing NIP29Bridge.discoverRunningGroups()...');
          const groups = await nip29Bridge.discoverRunningGroups();
          bridgeResults = { 
            success: groups && groups.length > 0,
            count: groups ? groups.length : 0,
            groups: groups 
          };
          console.log('Bridge discovery results:', bridgeResults);
        } catch (bridgeError) {
          console.error('Error in bridge discovery:', bridgeError);
          bridgeResults = { error: bridgeError.message };
        }
      } else {
        console.log('Attempting to initialize NIP29Bridge...');
        try {
          await nip29Bridge.initialize();
          
          if (nip29Bridge.initialized) {
            const groups = await nip29Bridge.discoverRunningGroups();
            bridgeResults = { 
              success: groups && groups.length > 0,
              count: groups ? groups.length : 0,
              groups: groups 
            };
          }
        } catch (initError) {
          console.error('Error initializing bridge:', initError);
          bridgeResults.error = `Initialization failed: ${initError.message}`;
        }
      }
      
      // Combine results
      setTestResults({
        timestamp: new Date().toISOString(),
        directDiscovery: directResults,
        bridgeDiscovery: bridgeResults,
        settings: {
          nip29Enabled: localStorage.getItem('nostr_groups_enabled') === 'true',
          initialized: nip29Bridge ? nip29Bridge.initialized : false
        }
      });
    } catch (error) {
      console.error('Error running test:', error);
      setTestResults({ error: error.message });
    } finally {
      setTesting(false);
    }
  };
  
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
              <p className="text-gray-400 mb-4">
                {currentUser 
                  ? 'You haven&apos;t joined any clubs yet.'
                  : 'Log in to join or create clubs.'}
              </p>
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
                <div className="space-y-4">
                  <Link 
                    to="/teams/create"
                    className="inline-block bg-blue-600 text-white py-2 px-6 rounded-lg"
                  >
                    Create a Club
                  </Link>
                  
                  {/* Test button */}
                  <div className="mt-6 pt-6 border-t border-gray-700">
                    <button
                      onClick={handleTestClick}
                      disabled={testing}
                      className="inline-block bg-purple-700 text-white py-2 px-6 rounded-lg"
                    >
                      {testing ? 'Testing...' : 'Test NIP29 Groups'}
                    </button>
                  </div>
                  
                  {/* Test results */}
                  {testResults && (
                    <div className="mt-4 p-4 bg-[#0c1524] border border-gray-700 rounded-lg text-left">
                      <h3 className="text-lg font-semibold mb-2">NIP29 Test Results</h3>
                      
                      <div className="mb-3">
                        <p><strong>NIP29 Enabled:</strong> {testResults.settings.nip29Enabled ? 'Yes' : 'No'}</p>
                        <p><strong>Bridge Initialized:</strong> {testResults.settings.initialized ? 'Yes' : 'No'}</p>
                      </div>
                      
                      <h4 className="font-medium mb-1">Direct Relay Query:</h4>
                      {testResults.directDiscovery.error ? (
                        <p className="text-red-400">{testResults.directDiscovery.error}</p>
                      ) : (
                        <p>Found {testResults.directDiscovery.count || 0} groups</p>
                      )}
                      
                      <h4 className="font-medium mt-3 mb-1">Bridge Discovery:</h4>
                      {testResults.bridgeDiscovery.error ? (
                        <p className="text-red-400">{testResults.bridgeDiscovery.error}</p>
                      ) : (
                        <p>Found {testResults.bridgeDiscovery.count || 0} groups</p>
                      )}
                      
                      {/* Suggested action */}
                      <div className="mt-4 pt-3 border-t border-gray-700">
                        <h4 className="font-medium mb-2">Suggested action:</h4>
                        {testResults.directDiscovery.count > 0 && testResults.bridgeDiscovery.count === 0 ? (
                          <div>
                            <p className="text-yellow-400">Groups exist but app can't find them.</p>
                            <p className="mt-1">Try restarting the app or clearing browser storage.</p>
                          </div>
                        ) : testResults.directDiscovery.count === 0 ? (
                          <p>No NIP29 groups found on any relays. This may be a relay connectivity issue.</p>
                        ) : testResults.bridgeDiscovery.count > 0 ? (
                          <p className="text-green-400">NIP29 groups found! There may be a display issue.</p>
                        ) : (
                          <p>Please check browser console for more diagnostic information.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
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