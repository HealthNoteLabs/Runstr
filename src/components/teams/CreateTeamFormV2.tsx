import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNostr } from '../../hooks/useNostr';
import { useAuth } from '../../hooks/useAuth';
import { payLnurl, getInvoiceFromLnAddress } from '../../utils/lnurlPay';
import { RefreshCw } from "lucide-react";
import {
  TeamData,
  prepareNip101eTeamEventTemplate,
  getTeamUUID,
  getTeamCaptain,
  prepareTeamSubscriptionReceiptEvent
} from '../../services/nostr/NostrTeamsService';
import { createAndPublishEvent } from '../../utils/nostr';
import { useIsSeasonCaptain } from '../../hooks/useSeasonSubscription';
import { Season1SubscriptionCard } from '../Season1SubscriptionCard';

// This is a new, simplified form component built from scratch
// It uses the same robust createAndPublishEvent helper as other working parts of the app.

const CreateTeamFormV2: React.FC = () => {
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [teamImage, setTeamImage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { publicKey, connectSigner } = useNostr() as any;
  const { wallet } = useAuth();
  const navigate = useNavigate();

  // Check if user is a Season 1 Captain
  const isSeasonCaptain = useIsSeasonCaptain(publicKey);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    let finalPubkey = publicKey;
    if (!finalPubkey) {
      const signerResult = await connectSigner();
      finalPubkey = signerResult?.pubkey || null;
      if (!finalPubkey) {
        setError('A signer is required to create a team.');
        setIsLoading(false);
        return;
      }
    }

    // Check Captain subscription requirement
    if (!isSeasonCaptain) {
      setError('Only Season 1 Captains can create teams. Please upgrade your subscription.');
      setIsLoading(false);
      return;
    }

    if (!teamName.trim()) {
      setError('Team name is required.');
      setIsLoading(false);
      return;
    }

    // Payment system disabled for teams feature
    // TODO: Re-enable payment system if needed in the future
    console.log('Team creation: Payment system disabled, proceeding without payment');

    const teamData: TeamData = {
      name: teamName,
      description: teamDescription,
      isPublic,
      image: teamImage.trim() || undefined,
    };

    const teamEventTemplate = prepareNip101eTeamEventTemplate(teamData, finalPubkey);

    if (!teamEventTemplate) {
      setError('Failed to prepare the team event.');
      setIsLoading(false);
      return;
    }

    try {
      const result: any = await createAndPublishEvent(teamEventTemplate, null);
      
      if (result && result.success) {
        const newTeamUUID = getTeamUUID(result);
        const captainPk = getTeamCaptain(result);
        if (newTeamUUID && captainPk) {
          // Subscription receipt disabled - no payment required
          navigate(`/teams/${captainPk}/${newTeamUUID}`);
        } else {
          console.error('V2 Form: Failed to get UUID/captain from published event.');
          navigate('/teams');
        }
      } else {
        setError(result?.error || 'Failed to publish the team event. Please try again.');
      }
    } catch (err: any) {
      console.error('CreateTeamFormV2 publish error:', err);
      setError(err.message || 'An unknown error occurred during publishing.');
    } finally {
      setIsLoading(false);
    }
  };

  // If user is not connected, show normal form with disabled state
  if (!publicKey) {
    return (
      <div className="p-4 max-w-md mx-auto bg-gray-800 text-white rounded-lg shadow-lg mt-5">
        <h2 className="text-2xl font-bold mb-6 text-center">Create New Team</h2>
        
        <div className="mb-6 p-4 bg-blue-900/50 border border-blue-500 rounded-lg text-center">
          <p className="text-blue-200 mb-4">Please connect your Nostr account to create a team.</p>
          <button
            onClick={() => navigate('/teams')}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Back to Teams
          </button>
        </div>
      </div>
    );
  }

  // If user is not a Season 1 Captain, show subscription requirement
  if (!isSeasonCaptain) {
    return (
      <div className="p-4 max-w-md mx-auto bg-gray-800 text-white rounded-lg shadow-lg mt-5">
        <h2 className="text-2xl font-bold mb-6 text-center">Create New Team</h2>
        
        <div className="mb-6 p-4 bg-yellow-900/50 border border-yellow-500 rounded-lg">
          <div className="flex items-center mb-2">
            <span className="text-yellow-400 mr-2">👑</span>
            <h3 className="font-semibold text-yellow-200">Captain Subscription Required</h3>
          </div>
          <p className="text-yellow-100 text-sm mb-4">
            Only Season 1 Captains can create teams. This premium feature includes team management, 
            challenge creation, and exclusive captain badges.
          </p>
          <div className="text-center">
            <Season1SubscriptionCard className="inline-block" />
          </div>
        </div>
        
        <div className="text-center">
          <button
            onClick={() => navigate('/teams')}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Back to Teams
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto bg-gray-800 text-white rounded-lg shadow-lg mt-5">
      <h2 className="text-2xl font-bold mb-6 text-center">Create New Team</h2>
      
      {/* Captain Status Indicator */}
      <div className="mb-4 p-3 bg-green-800/50 border border-green-600 rounded-lg">
        <div className="flex items-center">
          <span className="text-green-400 mr-2">👑</span>
          <span className="text-green-200 font-semibold">Season 1 Captain</span>
        </div>
        <p className="text-green-100 text-sm mt-1">You can create and manage teams</p>
      </div>
      
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
            className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-purple-500 focus:border-purple-500"
            required
            placeholder="e.g., Morning Runners Club"
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
            className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-purple-500 focus:border-purple-500"
            placeholder="Describe your team's goals and who should join..."
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
            className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-purple-500 focus:border-purple-500"
            placeholder="https://example.com/team-logo.png"
          />
        </div>

        <div className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 text-purple-600 border-gray-500 rounded bg-gray-700 focus:ring-purple-500"
            />
            <span className="ml-2 text-sm text-gray-300">Make this team publicly visible and joinable</span>
          </label>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 text-red-200 border border-red-500 rounded-md">
            <p>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Creating Team...
            </div>
          ) : (
            'Create Team'
          )}
        </button>
      </form>
    </div>
  );
};

export default CreateTeamFormV2; 