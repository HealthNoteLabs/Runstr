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

  return (
    <div className="p-4 max-w-md mx-auto bg-gray-800 text-white rounded-lg shadow-lg mt-5">
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
            className="w-full p-2 border border-border-primary rounded-md bg-bg-tertiary text-text-primary focus:ring-border-focus focus:border-border-focus"
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
            className="w-full p-2 border border-border-primary rounded-md bg-bg-tertiary text-text-primary focus:ring-border-focus focus:border-border-focus"
            placeholder="https://example.com/team-logo.png"
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
          className="w-full bg-bg-primary hover:bg-bg-tertiary text-text-primary border border-border-primary font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
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