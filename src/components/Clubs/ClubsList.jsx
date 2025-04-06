import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchRunningGroups } from '../../services/nip29';

export const ClubsList = () => {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const loadClubs = async () => {
      try {
        setLoading(true);
        
        // Set a timeout to prevent infinite loading
        const loadingTimeout = setTimeout(() => {
          // Only show timeout error if we haven't loaded any clubs yet
          if (clubs.length === 0) {
            setLoading(false);
            setError('Loading timed out. Please try again.');
          }
        }, 10000); // 10 seconds timeout
        
        const groups = await fetchRunningGroups();
        
        // Clear the timeout since we got a response
        clearTimeout(loadingTimeout);
        
        setClubs(groups);
        setError(null);
      } catch (err) {
        console.error('Error loading clubs:', err);
        setError('Failed to load running clubs');
      } finally {
        setLoading(false);
      }
    };

    loadClubs();

    // Listen for club data updates from background fetches
    const handleClubsDataUpdate = (event) => {
      if (event.detail && event.detail.clubs) {
        setClubs(event.detail.clubs);
        
        // Show a quick "refreshed" indicator
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1500);
      }
    };

    document.addEventListener('clubsDataUpdated', handleClubsDataUpdate);
    
    return () => {
      document.removeEventListener('clubsDataUpdated', handleClubsDataUpdate);
    };
  }, []);

  const refreshClubs = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      
      const groups = await fetchRunningGroups();
      setClubs(groups);
    } catch (err) {
      console.error('Error refreshing clubs:', err);
      setError('Failed to refresh running clubs');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Running Clubs</h2>
        <div className="flex space-x-2">
          <button
            onClick={refreshClubs}
            className="px-3 py-1 rounded-lg bg-gray-700 text-white text-sm flex items-center"
            disabled={loading || isRefreshing}
          >
            {isRefreshing ? (
              <>
                <div className="w-4 h-4 border-2 border-transparent border-t-white rounded-full animate-spin mr-1"></div>
                Refreshing
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </>
            )}
          </button>
          <Link to="/club/create" className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-sm flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Club
          </Link>
        </div>
      </div>

      {loading && clubs.length === 0 ? (
        <div className="flex flex-col justify-center items-center py-8">
          <div className="loading-spinner mb-4"></div>
          <p className="text-gray-400">Loading running clubs...</p>
        </div>
      ) : error && clubs.length === 0 ? (
        <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={refreshClubs}
            className="mt-2 px-4 py-1 bg-red-700 text-white rounded-lg text-sm"
          >
            Try Again
          </button>
        </div>
      ) : clubs.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-gray-400 mb-4">No running clubs found</p>
          <p className="text-sm text-gray-500 mb-4">Be the first to create a running club!</p>
          <Link
            to="/club/create"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg inline-block"
          >
            Create a Club
          </Link>
        </div>
      ) : (
        <>
          {/* Show a subtle loading indicator when more clubs are being loaded */}
          {loading && clubs.length > 0 && (
            <div className="bg-indigo-900/20 border border-indigo-500 rounded-lg p-2 mb-4 text-center text-xs">
              <div className="flex items-center justify-center">
                <div className="w-3 h-3 border-2 border-transparent border-t-white rounded-full animate-spin mr-2"></div>
                <p className="text-indigo-400">Loading more clubs...</p>
              </div>
            </div>
          )}
          
          {/* Show a refreshed notification */}
          {isRefreshing && clubs.length > 0 && !loading && (
            <div className="bg-green-900/20 border border-green-500 rounded-lg p-2 mb-4 text-center text-xs fade-out">
              <p className="text-green-400">Club list refreshed</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 gap-4">
            {clubs.map((club) => (
              <Link
                key={club.id}
                to={`/club/detail/${encodeURIComponent(club.id)}`}
                className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors"
              >
                <h3 className="text-lg font-semibold mb-2">{club.name}</h3>
                <p className="text-gray-400 text-sm mb-3 line-clamp-2">{club.about}</p>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Created: {new Date(club.createdAt * 1000).toLocaleDateString()}</span>
                  <span className="px-2 py-1 bg-gray-700 rounded-full">View Details</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}; 