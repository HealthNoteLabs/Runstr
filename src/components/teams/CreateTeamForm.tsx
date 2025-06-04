import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNostr } from '../../hooks/useNostr';
import {
  prepareNip101eTeamEventTemplate,
  getTeamUUID,
  getTeamCaptain,
  TeamData,
} from '../../services/nostr/NostrTeamsService';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { awaitNDKReady, ndk as ndkSingleton } from '../../lib/ndkSingleton';

// Define props for the modal component
interface CreateTeamFormProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateTeamForm: React.FC<CreateTeamFormProps> = ({ isOpen, onClose }) => {
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [teamImage, setTeamImage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // Form-specific error
  
  const {
    ndk: ndkFromContext,
    publicKey,
    ndkReady: ndkReadyFromContext,
    ndkError: ndkErrorFromContext,
    reInitializeNostrSystem,
  } = useNostr();
  const navigate = useNavigate();

  const debugSignerStatus = ndkFromContext?.signer ? 'Signer Available' : 'Signer NOT Available';
  const debugRelayStats = ndkFromContext?.pool?.stats();
  const debugConnectedRelays = debugRelayStats?.connected || 0;
  const debugTotalRelays = debugRelayStats?.total || 0;

  // Effect to reset form state when modal visibility changes or on unmount
  useEffect(() => {
    if (!isOpen) {
      // Reset form fields when modal is closed or initially not open
      setTeamName('');
      setTeamDescription('');
      setTeamImage('');
      setIsPublic(true);
      setError(null); // Clear any previous errors
      setIsLoading(false); // Reset loading state
    } else {
      // Optional: Clear only errors when modal opens, keep other fields if desired
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    let currentNdkReady = ndkReadyFromContext;
    let ndkInstance = ndkFromContext;

    // Enhanced connection checking and fallback logic
    if (!currentNdkReady) {
      console.log("CreateTeamForm (Modal): NDK not ready from context, attempting awaitNDKReady...");
      try {
        currentNdkReady = await awaitNDKReady();
        if (currentNdkReady && ndkSingleton) {
          console.log("CreateTeamForm (Modal): awaitNDKReady succeeded, using ndkSingleton.");
          ndkInstance = ndkSingleton;
        } else {
          console.log("CreateTeamForm (Modal): awaitNDKReady also failed, but checking signer availability...");
          // Even if NDK isn't ready, we might be able to sign and store for later publishing
          ndkInstance = ndkSingleton; // Use singleton even if not "ready"
        }
      } catch (awaitError) {
        console.error("CreateTeamForm (Modal): Error during awaitNDKReady:", awaitError);
        ndkInstance = ndkSingleton; // Still try with singleton
      }
    }

    // Check for basic requirements
    if (!ndkInstance) {
      setError('Nostr client not available. Please restart the app and try again.');
      setIsLoading(false);
      return;
    }
    
    if (!publicKey) {
      setError('Authentication required. Please connect your Nostr signer (Amber or similar) and try again.');
      setIsLoading(false);
      return;
    }
    
    if (!ndkInstance.signer) {
      setError('Nostr signer not available. Please ensure Amber or your preferred signer is connected and authorized.');
      setIsLoading(false);
      return;
    }
    
    if (!teamName.trim()) {
      setError('Team name is required.');
      setIsLoading(false);
      return;
    }

    // Warn about relay status but allow proceed with signing
    const relayStats = ndkInstance.pool?.stats();
    const connectedRelays = relayStats?.connected || 0;
    
    if (connectedRelays === 0) {
      console.warn("CreateTeamForm: No relays connected, but proceeding with signing. Event will be published when relays reconnect.");
      // Could optionally show a warning but allow user to proceed
      // setError('No relay connections available. The team will be created but may not be published immediately. Continue anyway?');
      // For now, we'll proceed and let the publish attempt handle failures
    }

    const teamData: TeamData = {
      name: teamName,
      description: teamDescription,
      isPublic,
      image: teamImage.trim() || undefined,
    };
    
    const teamEventTemplate = prepareNip101eTeamEventTemplate(teamData, publicKey);
    if (!teamEventTemplate) {
      setError('Failed to prepare team event. Please check your input and try again.');
      setIsLoading(false);
      return;
    }

    try {
      console.log('CreateTeamForm: Creating and signing team event...');
      const ndkTeamEvent = new NDKEvent(ndkInstance, teamEventTemplate);
      
      // Sign the event (this should work even without relay connections)
      console.log('CreateTeamForm: Signing team event...');
      await ndkTeamEvent.sign();
      console.log('CreateTeamForm: ✅ Team event signed successfully');
      
      // Attempt to publish (this requires relay connections)
      console.log('CreateTeamForm: Attempting to publish team event...');
      const teamPublishedRelays = await ndkTeamEvent.publish();
      console.log('CreateTeamForm: Team event published to relays:', teamPublishedRelays);
      
      if (teamPublishedRelays.size > 0) {
        console.log(`CreateTeamForm: ✅ Successfully published to ${teamPublishedRelays.size} relay(s)`);
        const newTeamUUID = getTeamUUID(ndkTeamEvent.rawEvent());
        const captain = getTeamCaptain(ndkTeamEvent.rawEvent());
        onClose(); // Close modal on success
        if (newTeamUUID && captain) {
          navigate(`/teams/${captain}/${newTeamUUID}`);
        } else {
          console.error("Failed to get UUID or captain from published team event after successful publish.");
          navigate('/teams'); // Fallback to main teams page
        }
      } else {
        // Event was signed but not published - offer user options
        console.warn('CreateTeamForm: Event signed but not published to any relays');
        setError('Team was created and signed, but could not be published to Nostr relays. This might be due to network issues. You can try again later or check your connection.');
      }
    } catch (err: any) {
      console.error('Error creating NIP-101e team:', err);
      
      // Provide more specific error messages
      if (err.message?.includes('signer')) {
        setError('Signer error: Unable to sign the team creation event. Please check your Amber connection and try again.');
      } else if (err.message?.includes('network') || err.message?.includes('connection')) {
        setError('Network error: Unable to publish the team event. Please check your internet connection and try again.');
      } else if (err.message?.includes('relay')) {
        setError('Relay error: Unable to connect to Nostr relays. The team was created but may not be visible immediately.');
      } else {
        setError(err.message || 'An unexpected error occurred while creating the team. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null; // Don't render anything if the modal is not open
  }

  // Modal Outer Container (Overlay)
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)', // Semi-transparent black overlay
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000, // Ensure it's on top
    }}>
      {/* Modal Content Box */}
      <div className="bg-gray-800 text-white rounded-lg shadow-xl p-6 w-full max-w-md mx-auto" style={{maxHeight: '90vh', overflowY: 'auto'}}>
        <div style={{ padding: '10px', marginBottom: '15px', backgroundColor: '#374151', border: '1px solid #4B5563', borderRadius: '5px' }}>
          <h4 style={{ fontWeight: 'bold', marginBottom: '5px', color: '#D1D5DB' }}>DEBUG INFO (CreateTeamForm Modal)</h4>
          <p style={{ fontSize: '0.875rem', color: '#E5E7EB' }}>NDK Ready (Context): <span style={{ fontWeight: 'bold', color: ndkReadyFromContext ? '#10B981' : '#EF4444' }}>{ndkReadyFromContext ? 'YES' : 'NO'}</span></p>
          <p style={{ fontSize: '0.875rem', color: '#E5E7EB' }}>Relays: <span style={{ fontWeight: 'bold', color: debugConnectedRelays > 0 ? '#10B981' : '#EF4444' }}>{debugConnectedRelays}/{debugTotalRelays} Connected</span></p>
          <p style={{ fontSize: '0.875rem', color: '#E5E7EB' }}>Public Key (Context): <span style={{ fontWeight: 'bold', color: publicKey ? '#10B981' : '#EF4444' }}>{publicKey ? `${publicKey.substring(0,20)}...` : 'Not available'}</span></p>
          <p style={{ fontSize: '0.875rem', color: '#E5E7EB' }}>NDK Signer (Context NDK): <span style={{ fontWeight: 'bold', color: ndkFromContext?.signer ? '#10B981' : '#EF4444' }}>{debugSignerStatus}</span></p>
          <p style={{ fontSize: '0.875rem', color: '#F87171' }}>NDK Error (Context): <span style={{ fontWeight: 'bold' }}>{ndkErrorFromContext || 'None'}</span></p>
          <p style={{ fontSize: '0.875rem', color: '#FCA5A5' }}>Form Error: <span style={{ fontWeight: 'bold' }}>{error || 'None'}</span></p>
          {!ndkReadyFromContext && typeof reInitializeNostrSystem === 'function' && (
            <button 
              onClick={() => { setError(null); reInitializeNostrSystem(); }}
              style={{ marginTop: '10px', padding: '5px 10px', backgroundColor: '#F59E0B', color: 'black', borderRadius: '4px', border: 'none' }}
              disabled={isLoading}
            >
              {isLoading ? 'Retrying...' : 'Retry Nostr Connection'}
            </button>
          )}
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Create New Team</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white text-2xl font-semibold"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="teamNameModal" className="block text-sm font-medium text-gray-300 mb-1">Team Name</label>
            <input type="text" id="teamNameModal" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div className="mb-4">
            <label htmlFor="teamDescriptionModal" className="block text-sm font-medium text-gray-300 mb-1">Team Description</label>
            <textarea id="teamDescriptionModal" value={teamDescription} onChange={(e) => setTeamDescription(e.target.value)} rows={3} className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"></textarea>
          </div>
          <div className="mb-4">
            <label htmlFor="teamImageModal" className="block text-sm font-medium text-gray-300 mb-1">Team Image URL (Optional)</label>
            <input type="url" id="teamImageModal" value={teamImage} onChange={(e) => setTeamImage(e.target.value)} className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500" placeholder="https://example.com/image.png" />
          </div>
          <div className="mb-6">
            <label className="flex items-center">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-500 rounded bg-gray-700 focus:ring-blue-500" />
              <span className="ml-2 text-sm text-gray-300">Publicly visible team</span>
            </label>
          </div>
          {error && (
            <div className="mb-4 p-3 bg-red-700/50 text-red-200 border border-red-600 rounded-md"><p>{error}</p></div>
          )}
          <div className="flex justify-end space-x-3 mt-4">
             <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-md transition duration-150 ease-in-out">
                Cancel
            </button>
            <button type="submit" disabled={isLoading || !ndkReadyFromContext || !publicKey || !ndkFromContext?.signer} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out">
              {isLoading ? 'Creating Team...' : 'Create Team'}
            </button>
          </div>
          {!isLoading && (!ndkReadyFromContext || !publicKey || !ndkFromContext?.signer) && (
            <p className="text-xs text-yellow-400 mt-3 text-center">
              {!ndkReadyFromContext ? "Nostr connection not ready... " : ""}
              {ndkReadyFromContext && !publicKey ? "Public key not found (Signer not connected)... " : ""}
              {ndkReadyFromContext && publicKey && !ndkFromContext?.signer ? "Signer not attached to NDK... " : ""}
              (Retry or check connection)
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default CreateTeamForm; 