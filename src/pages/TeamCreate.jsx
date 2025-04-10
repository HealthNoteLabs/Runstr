import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeamsContext } from '../contexts/TeamsContext';
import { NostrContext } from '../contexts/NostrContext';
import { getUserPublicKey } from '../utils/nostrClient';

export const TeamCreate = () => {
  const navigate = useNavigate();
  const { createTeam, error, clearError, currentUser, nostrIntegrationEnabled } = useContext(TeamsContext);
  const { publicKey, requestNostrPermissions } = useContext(NostrContext);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: true,
    enableNostr: nostrIntegrationEnabled
  });
  
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasNostrAuth, setHasNostrAuth] = useState(false);
  
  // Check if user has Nostr auth
  useEffect(() => {
    const checkNostrAuth = async () => {
      const pubkey = await getUserPublicKey();
      setHasNostrAuth(!!pubkey);
    };
    
    checkNostrAuth();
  }, [publicKey]);
  
  // Redirect to teams page if not logged in
  useEffect(() => {
    if (!currentUser && !publicKey) {
      navigate('/teams');
    }
  }, [currentUser, publicKey, navigate]);
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Handle Nostr authentication request
  const handleNostrAuth = async () => {
    try {
      const success = await requestNostrPermissions();
      if (success) {
        setHasNostrAuth(true);
      } else {
        setFormError('Failed to get Nostr permissions. Please try again or disable Nostr integration.');
      }
    } catch (error) {
      console.error('Error requesting Nostr permissions:', error);
      setFormError('Error requesting Nostr permissions');
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      setFormError('');
      clearError();
      
      // Validate form
      if (!formData.name.trim()) {
        setFormError('Club name is required');
        setIsSubmitting(false);
        return;
      }
      
      // Check if Nostr permissions are needed but not granted
      if (formData.enableNostr && !hasNostrAuth) {
        setFormError('Nostr permissions are required to create a club with Nostr integration. Please click "Connect to Nostr" first or disable Nostr integration.');
        setIsSubmitting(false);
        return;
      }
      
      // Create the team
      const newTeam = await createTeam({
        name: formData.name.trim(),
        description: formData.description.trim(),
        isPublic: formData.isPublic,
        enableNostr: formData.enableNostr,
        createdAt: new Date().toISOString()
      });
      
      if (newTeam) {
        // Navigate to the new team page
        navigate(`/teams/${newTeam.id}`);
      } else {
        setFormError('Failed to create team. Please try again.');
      }
    } catch (error) {
      console.error('Error creating team:', error);
      setFormError(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Render loading state or redirect if not logged in
  if (!currentUser && !publicKey) {
    return (
      <div className="px-4 pt-6 text-center">
        <h1 className="text-2xl font-bold mb-6">Access Denied</h1>
        <div className="bg-[#1a222e] rounded-lg p-6">
          <p className="text-red-400 mb-4">You must be logged in to create a club</p>
          <p className="text-gray-400 mb-6">Redirecting you to the teams page...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold mb-6 text-center">Create New Club</h1>
      
      {/* Error messages */}
      {(error || formError) && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg">
          <p className="text-red-400">{error || formError}</p>
          <button 
            onClick={() => {
              clearError();
              setFormError('');
            }}
            className="mt-2 text-sm text-red-400 underline"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Create team form */}
      <form onSubmit={handleSubmit} className="bg-[#1a222e] rounded-lg p-6">
        <div className="mb-4">
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Club Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter club name"
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="description" className="block text-sm font-medium mb-2">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe your club (optional)"
            rows={4}
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="isPublic"
              checked={formData.isPublic}
              onChange={handleChange}
              className="mr-2 h-4 w-4"
            />
            <span className="text-sm">
              Make this club publicly discoverable
            </span>
          </label>
        </div>
        
        {nostrIntegrationEnabled && (
          <div className="mb-6 p-4 bg-purple-900/20 border border-purple-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="enableNostr"
                  checked={formData.enableNostr}
                  onChange={handleChange}
                  className="mr-2 h-4 w-4"
                />
                <span>
                  Enable Nostr integration for this club
                </span>
              </label>
              
              {formData.enableNostr && !hasNostrAuth && (
                <button
                  type="button"
                  onClick={handleNostrAuth}
                  className="px-3 py-1 bg-purple-700 text-white rounded-lg text-sm"
                >
                  Connect to Nostr
                </button>
              )}
            </div>
            
            <p className="mt-2 text-xs text-gray-400">
              This will create a corresponding Nostr group on the Nostr network,
              allowing interoperability with other Nostr clients.
            </p>
            
            {formData.enableNostr && (
              <div className="mt-3 text-xs">
                <p className="text-white">
                  Nostr Status: {hasNostrAuth ? (
                    <span className="text-green-400">Connected ✓</span>
                  ) : (
                    <span className="text-red-400">Not Connected ✗</span>
                  )}
                </p>
                {!hasNostrAuth && (
                  <p className="text-yellow-400 mt-1">
                    You must connect to Nostr before creating a club with Nostr integration.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => navigate('/teams')}
            className="px-4 py-2 mr-2 bg-gray-700 text-white rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || (formData.enableNostr && !hasNostrAuth)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Club'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TeamCreate; 