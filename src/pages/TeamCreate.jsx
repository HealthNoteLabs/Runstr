import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeams } from '../contexts/TeamsContext';

export const TeamCreate = () => {
  const navigate = useNavigate();
  const { createTeam, error, clearError, currentUser } = useTeams();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    isPublic: true
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  
  // Handle input change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Form validation
    if (!formData.name.trim()) {
      setFormError('Club name is required');
      return;
    }
    
    if (!currentUser) {
      setFormError('You must be logged in to create a club');
      return;
    }
    
    // Clear errors
    setFormError('');
    clearError();
    setIsSubmitting(true);
    
    try {
      // Create the team
      const newTeam = await createTeam(formData);
      
      if (newTeam) {
        // Navigate to the new team's page
        navigate(`/teams/${newTeam.id}`);
      } else {
        setFormError('Failed to create club. Please try again.');
      }
    } catch (err) {
      setFormError(err.message || 'An error occurred while creating the club');
    } finally {
      setIsSubmitting(false);
    }
  };
  
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
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
            Club Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter club name"
            className="w-full p-3 bg-[#111827] border border-gray-700 rounded-lg"
            required
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="What&apos;s this club about?"
            className="w-full p-3 bg-[#111827] border border-gray-700 rounded-lg min-h-[100px]"
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-300 mb-1">
            Club Image URL
          </label>
          <input
            type="url"
            id="imageUrl"
            name="imageUrl"
            value={formData.imageUrl}
            onChange={handleChange}
            placeholder="https://example.com/image.jpg"
            className="w-full p-3 bg-[#111827] border border-gray-700 rounded-lg"
          />
          <p className="mt-1 text-xs text-gray-500">
            Enter a URL for your club&apos;s image (optional)
          </p>
        </div>
        
        <div className="mb-6">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isPublic"
              name="isPublic"
              checked={formData.isPublic}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-300">
              Make this club public (anyone can join)
            </label>
          </div>
        </div>
        
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/teams')}
            className="px-4 py-2 text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !currentUser}
            className={`px-4 py-2 bg-blue-600 text-white rounded-lg ${
              (isSubmitting || !currentUser) ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? 'Creating...' : 'Create Club'}
          </button>
        </div>
        
        {!currentUser && (
          <p className="mt-4 text-sm text-red-400 text-center">
            You must be logged in to create a club
          </p>
        )}
      </form>
    </div>
  );
};

export default TeamCreate; 