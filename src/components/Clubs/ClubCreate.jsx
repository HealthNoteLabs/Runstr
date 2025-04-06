import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGroup } from '../../services/nip29';

export const ClubCreate = () => {
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate inputs
    if (!name.trim()) {
      setError('Please enter a club name');
      return;
    }
    
    // Make sure name includes #RUNSTR
    let clubName = name;
    if (!clubName.includes('#RUNSTR')) {
      clubName = `${clubName} #RUNSTR`;
    }
    
    try {
      setIsCreating(true);
      setError(null);
      
      // Create the group
      const result = await createGroup(clubName, about);
      
      if (result.success) {
        // Navigate to the new club's page
        navigate(`/club/detail/${encodeURIComponent(result.groupId)}`);
      } else {
        setError(result.error || 'Failed to create club');
      }
    } catch (err) {
      console.error('Error creating club:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center mb-6">
        <button 
          onClick={() => navigate('/club')}
          className="mr-4 p-2 rounded-full bg-gray-800 hover:bg-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-2xl font-bold">Create Running Club</h2>
      </div>
      
      <div className="bg-gray-800 rounded-lg p-4">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="clubName" className="block text-sm font-medium text-gray-400 mb-1">
              Club Name
            </label>
            <input
              type="text"
              id="clubName"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              placeholder="Lightning Dasher #RUNSTR"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              The #RUNSTR tag will be added automatically if not included
            </p>
          </div>
          
          <div className="mb-6">
            <label htmlFor="clubAbout" className="block text-sm font-medium text-gray-400 mb-1">
              Description
            </label>
            <textarea
              id="clubAbout"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              placeholder="Tell others what your running club is about..."
              rows={4}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
            />
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center"
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <div className="loading-spinner w-5 h-5 mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Club
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}; 