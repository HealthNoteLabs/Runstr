import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchRunningGroups } from '../../services/nip29';

export const ClubsList = () => {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadClubs = async () => {
      try {
        setLoading(true);
        
        // Set a timeout to prevent infinite loading
        const loadingTimeout = setTimeout(() => {
          setLoading(false);
          setError('Loading timed out. Please try again.');
        }, 15000); // 15 seconds timeout
        
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
  }, []);

  const refreshClubs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Set a timeout to prevent infinite loading
      const loadingTimeout = setTimeout(() => {
        setLoading(false);
        setError('Loading timed out. Please try again.');
      }, 15000); // 15 seconds timeout
      
      const groups = await fetchRunningGroups();
      
      // Clear the timeout since we got a response
      clearTimeout(loadingTimeout);
      
      setClubs(groups);
    } catch (err) {
      console.error('Error refreshing clubs:', err);
      setError('Failed to refresh running clubs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Running Clubs</h2>
        <div className="flex space-x-2">
          <Link to="/club/feed" className="px-3 py-1 rounded-lg bg-gray-700 text-white text-sm flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            View Feed
          </Link>
          <button
            onClick={refreshClubs}
            className="px-3 py-1 rounded-lg bg-gray-700 text-white text-sm flex items-center"
            disabled={loading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <Link to="/club/create" className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-sm flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Club
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center py-8">
          <div className="loading-spinner mb-4"></div>
          <p className="text-gray-400">Loading running clubs...</p>
        </div>
      ) : error ? (
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
      )}
    </div>
  );
}; 