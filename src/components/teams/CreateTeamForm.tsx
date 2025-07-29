import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNostr } from '../../hooks/useNostr';
import { NDKEvent, NDKKind, NDKTag } from '@nostr-dev-kit/ndk';
import NDK from '@nostr-dev-kit/ndk'; // Import NDK type - Corrected import
import { RefreshCw } from "lucide-react"; // Changed from ReloadIcon @radix-ui/react-icons
import {
  TeamData,
  prepareNip101eTeamEventTemplate,
  getTeamUUID,
  getTeamCaptain
} from '../../services/nostr/NostrTeamsService'; // Added imports
import { createAndPublishEvent } from '../../utils/nostr';

// Define an interface for the Nostr context values
interface NostrContextValues {
  ndk: NDK;
  publicKey: string | null;
  ndkReady: boolean;
  signerAvailable: boolean;
  ndkError: string | null;
  setPublicKey: (pk: string | null) => void;
  lightningAddress: string | null;
  isInitialized: boolean;
  relayCount: number;
  connectSigner: () => Promise<{ pubkey: string | null; error: string | null; }>;
}

const CreateTeamForm: React.FC = () => {
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [teamImage, setTeamImage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {
    ndk: ndkFromContext,
    publicKey,
    ndkReady: ndkReadyFromContext,
    signerAvailable,
    ndkError: ndkErrorFromContext,
    connectSigner,
    relayCount
  } = useNostr() as NostrContextValues; // Type assertion
  const navigate = useNavigate();

  // Determine signer status for debug UI using the new state
  const debugSignerStatus = signerAvailable ? 'Signer Available' : 'Signer NOT Available';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Ensure relays are connected
    if (!ndkReadyFromContext) {
      setError('Nostr not yet connected. Please wait a moment.');
      setIsLoading(false);
      return;
    }

    // Ensure signer & pubkey
    let finalPubkey = publicKey;
    if (!finalPubkey) {
      const signerAttempt = await connectSigner();
      finalPubkey = signerAttempt?.pubkey || null;
      if (!finalPubkey) {
        setError('No signer connected.');
        setIsLoading(false);
        return;
      }
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

    const teamEventTemplate = prepareNip101eTeamEventTemplate(teamData, finalPubkey!);
    if (!teamEventTemplate) {
      setError('Failed to prepare team event.');
      setIsLoading(false);
      return;
    }

    try {
      const result: any = await createAndPublishEvent(teamEventTemplate, null);
      if (result && result.success) {
        const newTeamUUID = getTeamUUID(result);
        const captainPk = getTeamCaptain(result);
        navigate(newTeamUUID && captainPk ? `/teams/${captainPk}/${newTeamUUID}` : '/teams');
      } else {
        setError(result?.error || 'Failed to publish team.');
      }
    } catch (err: any) {
      setError(err.message || 'Error publishing team');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto bg-gray-800 text-white rounded-lg shadow-lg mt-5">
      {/* Debug Display Section */}
      <div style={{ padding: '10px', marginBottom: '15px', backgroundColor: '#374151', border: '1px solid #4B5563', borderRadius: '5px' }}>
        <h4 style={{ fontWeight: 'bold', marginBottom: '5px', color: '#D1D5DB' }}>DEBUG INFO (CreateTeamForm.tsx)</h4>
        <p style={{ fontSize: '0.875rem', color: '#E5E7EB' }}>NDK Ready (from useNostr context): <span style={{ fontWeight: 'bold' }}>{ndkReadyFromContext ? 'YES' : 'NO'}</span></p>
        <p style={{ fontSize: '0.875rem', color: '#E5E7EB' }}>Public Key (from useNostr context): <span style={{ fontWeight: 'bold' }}>{publicKey || 'Not available'}</span></p>
        <p style={{ fontSize: '0.875rem', color: '#E5E7EB' }}>NDK Signer Status (from Context State): <span style={{ fontWeight: 'bold' }}>{debugSignerStatus}</span></p>
        <p style={{ fontSize: '0.875rem', color: '#E5E7EB' }}>Relay Count (from Context): <span style={{ fontWeight: 'bold' }}>{relayCount}</span></p>
        {/* ndkErrorFromContext is not directly available from useNostr, it's part of NostrContext but useNostr() might not expose it directly */}
        <p style={{ fontSize: '0.875rem', color: '#E5E7EB' }}>NDK Init Error (from Context): <span style={{ fontWeight: 'bold' }}>{ndkErrorFromContext || 'None'}</span></p>
        <p style={{ fontSize: '0.875rem', color: '#FCA5A5' }}>Current Form Error: <span style={{ fontWeight: 'bold' }}>{error || 'None'}</span></p>
      </div>
      {/* End Debug Display Section */}

      <h2 className="text-2xl font-bold mb-6 text-center">Create New Team</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="teamName" className="block text-sm font-medium text-gray-300 mb-1">
            Team Name
          </label>
          <input
            type="text"
            id="teamName"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="w-full p-2 border border-border-primary rounded-md bg-bg-tertiary text-text-primary focus:ring-border-focus focus:border-border-focus"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="teamDescription" className="block text-sm font-medium text-gray-300 mb-1">
            Team Description
          </label>
          <textarea
            id="teamDescription"
            value={teamDescription}
            onChange={(e) => setTeamDescription(e.target.value)}
            rows={3}
            className="w-full p-2 border border-border-primary rounded-md bg-bg-tertiary text-text-primary focus:ring-border-focus focus:border-border-focus"
          ></textarea>
        </div>

        <div className="mb-4">
          <label htmlFor="teamImage" className="block text-sm font-medium text-gray-300 mb-1">
            Team Image URL (Optional)
          </label>
          <input
            type="url"
            id="teamImage"
            value={teamImage}
            onChange={(e) => setTeamImage(e.target.value)}
            className="w-full p-2 border border-border-primary rounded-md bg-bg-tertiary text-text-primary focus:ring-border-focus focus:border-border-focus"
            placeholder="https://example.com/image.png"
          />
        </div>

        <div className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 text-text-primary border-border-primary rounded bg-bg-tertiary focus:ring-border-focus"
            />
            <span className="ml-2 text-sm text-gray-300">Publicly visible team</span>
          </label>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-700/50 text-red-200 border border-red-600 rounded-md">
            <p>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !ndkReadyFromContext}
          className="w-full bg-bg-primary hover:bg-bg-tertiary text-text-primary border border-border-primary font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> {/* Using RefreshCw here */}
              Creating Team...
            </div>
          ) : (
            'Create Team'
          )}
        </button>
        {/* Updated conditional message based on more specific checks */}
        {!isLoading && (!ndkReadyFromContext) && (
            <p className="text-xs text-yellow-400 mt-2 text-center">
                {!ndkReadyFromContext ? "Nostr connection not ready... " : ""}
                (Submit will attempt connection)
            </p>
        )}
      </form>
    </div>
  );
};

export default CreateTeamForm; 