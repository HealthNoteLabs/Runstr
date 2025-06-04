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

const CreateTeamForm: React.FC = () => {
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
    ndkError: ndkErrorFromContext, // Get NDK error from context
    reInitializeNostrSystem,     // Get re-init function from context
  } = useNostr();
  const navigate = useNavigate();

  const debugSignerStatus = ndkFromContext?.signer ? 'Signer Available' : 'Signer NOT Available';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Clear form-specific error
    setIsLoading(true);

    let currentNdkReady = ndkReadyFromContext;
    let ndkInstance = ndkFromContext;

    if (!currentNdkReady) {
      console.log("CreateTeamForm: NDK not ready from context, attempting awaitNDKReady...");
      currentNdkReady = await awaitNDKReady();
      if (currentNdkReady) {
        console.log("CreateTeamForm: awaitNDKReady succeeded, using ndkSingleton.");
        ndkInstance = ndkSingleton; // If context was not ready but awaitNDKReady works, use the singleton
      } else {
        console.log("CreateTeamForm: awaitNDKReady also failed.");
      }
    }

    if (!currentNdkReady || !ndkInstance) {
      setError('Nostr client is not ready. Please try retrying the connection or check your settings.');
      setIsLoading(false);
      return;
    }
    if (!publicKey) {
      setError('Public key not found. Please make sure you are logged in with Amber or another signer.');
      setIsLoading(false);
      return;
    }
    if (!ndkInstance.signer) {
      setError('Nostr signer (e.g., Amber) is not attached. Please ensure your signer is connected and authorized.');
      setIsLoading(false);
      return;
    }
    if (!teamName.trim()) {
      setError('Team name is required.');
      setIsLoading(false);
      return;
    }

    const teamData: TeamData = {
      name: teamName,
      description: teamDescription,
      isPublic,
      image: teamImage.trim() || undefined,
    };
    const teamEventTemplate = prepareNip101eTeamEventTemplate(teamData, publicKey);
    if (!teamEventTemplate) {
      setError('Failed to prepare team event.');
      setIsLoading(false);
      return;
    }

    try {
      const ndkTeamEvent = new NDKEvent(ndkInstance, teamEventTemplate);
      await ndkTeamEvent.sign();
      const teamPublishedRelays = await ndkTeamEvent.publish();
      console.log('NIP-101e Team event published to relays:', teamPublishedRelays);
      if (teamPublishedRelays.size > 0) {
        const newTeamUUID = getTeamUUID(ndkTeamEvent.rawEvent());
        const captain = getTeamCaptain(ndkTeamEvent.rawEvent());
        if (newTeamUUID && captain) {
          navigate(`/teams/${captain}/${newTeamUUID}`);
        } else {
          console.error("Failed to get UUID or captain from published team event.");
          navigate('/teams');
        }
      } else {
        setError('Team event was signed but failed to publish to any relays. Please check your relay connections.');
      }
    } catch (err: any) {
      console.error('Error creating NIP-101e team:', err);
      setError(err.message || 'An unknown error occurred while creating the team.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto bg-gray-800 text-white rounded-lg shadow-lg mt-5">
      <div style={{ padding: '10px', marginBottom: '15px', backgroundColor: '#374151', border: '1px solid #4B5563', borderRadius: '5px' }}>
        <h4 style={{ fontWeight: 'bold', marginBottom: '5px', color: '#D1D5DB' }}>DEBUG INFO (CreateTeamForm.tsx)</h4>
        <p style={{ fontSize: '0.875rem', color: '#E5E7EB' }}>NDK Ready (from Context): <span style={{ fontWeight: 'bold' }}>{ndkReadyFromContext ? 'YES' : 'NO'}</span></p>
        <p style={{ fontSize: '0.875rem', color: '#E5E7EB' }}>Public Key (from Context): <span style={{ fontWeight: 'bold' }}>{publicKey || 'Not available'}</span></p>
        <p style={{ fontSize: '0.875rem', color: '#E5E7EB' }}>NDK Signer (from Context NDK): <span style={{ fontWeight: 'bold' }}>{debugSignerStatus}</span></p>
        <p style={{ fontSize: '0.875rem', color: '#F87171' }}>NDK Error (from Context): <span style={{ fontWeight: 'bold' }}>{ndkErrorFromContext || 'None'}</span></p>
        <p style={{ fontSize: '0.875rem', color: '#FCA5A5' }}>Current Form Error: <span style={{ fontWeight: 'bold' }}>{error || 'None'}</span></p>
        {!ndkReadyFromContext && typeof reInitializeNostrSystem === 'function' && (
          <button 
            onClick={() => { setError(null); reInitializeNostrSystem(); }}
            style={{ marginTop: '10px', padding: '5px 10px', backgroundColor: '#F59E0B', color: 'black', borderRadius: '4px', border: 'none' }}
          >
            Retry Nostr Connection
          </button>
        )}
      </div>

      <h2 className="text-2xl font-bold mb-6 text-center">Create New Team</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="teamName" className="block text-sm font-medium text-gray-300 mb-1">Team Name</label>
          <input type="text" id="teamName" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500" required />
        </div>
        <div className="mb-4">
          <label htmlFor="teamDescription" className="block text-sm font-medium text-gray-300 mb-1">Team Description</label>
          <textarea id="teamDescription" value={teamDescription} onChange={(e) => setTeamDescription(e.target.value)} rows={3} className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"></textarea>
        </div>
        <div className="mb-4">
          <label htmlFor="teamImage" className="block text-sm font-medium text-gray-300 mb-1">Team Image URL (Optional)</label>
          <input type="url" id="teamImage" value={teamImage} onChange={(e) => setTeamImage(e.target.value)} className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500" placeholder="https://example.com/image.png" />
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
        <button type="submit" disabled={isLoading || !ndkReadyFromContext || !publicKey || !ndkFromContext?.signer} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out">
          {isLoading ? 'Creating Team...' : 'Create Team'}
        </button>
        {!isLoading && (!ndkReadyFromContext || !publicKey || !ndkFromContext?.signer) && (
          <p className="text-xs text-yellow-400 mt-2 text-center">
            {!ndkReadyFromContext ? "Nostr connection not ready... " : ""}
            {ndkReadyFromContext && !publicKey ? "Public key not found (Signer not connected)... " : ""}
            {ndkReadyFromContext && publicKey && !ndkFromContext?.signer ? "Signer not attached to NDK... " : ""}
            (Submit will attempt connection)
          </p>
        )}
      </form>
    </div>
  );
};

export default CreateTeamForm; 