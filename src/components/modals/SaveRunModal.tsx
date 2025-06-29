import React, { useState, useEffect } from 'react';
import { useNostr } from '../../hooks/useNostr';
import {
  fetchUserMemberTeams,
  NostrTeamEvent,
  getTeamName,
  getTeamCaptain,
  getTeamUUID,
} from '../../services/nostr/NostrTeamsService';
import { createWorkoutEvent, createAndPublishEvent } from '../../utils/nostr';
import { resolveTeamName, resolveChallengeNames, cacheTeamName } from '../../services/nameResolver';
import { useSeasonSubscription } from '../../hooks/useSeasonSubscription';
import { REWARDS } from '../../config/rewardsConfig';

interface RunData {
  distance: number;
  duration: number;
  activityType?: string;
  notes?: string;
  title?: string;
  date?: number | string; // timestamp or ISO string
  // Add other relevant fields from your actual runData structure
  elevation?: { gain: number; loss: number };
  // Ensure all fields used by createWorkoutEvent are here or in finalRunData
}

interface SaveRunModalProps {
  runData: RunData;
  distanceUnit: string; // 'km' or 'mi'
  onSaveAndPublish: () => void;
  onClose: () => void;
}

interface TeamAssociationOptions {
    teamCaptainPubkey: string;
    teamUUID: string;
    relayHint?: string;
    teamName?: string;
}

const SaveRunModal: React.FC<SaveRunModalProps> = ({ runData, distanceUnit, onSaveAndPublish, onClose }) => {
  const { ndk, publicKey, ndkReady } = useNostr();
  const subscription = useSeasonSubscription(publicKey);
  const [userTeams, setUserTeams] = useState<NostrTeamEvent[]>([]);
  const DEFAULT_KEY = 'runstr:defaultPostingTeamIdentifier';
  const [selectedTeamIdentifier, setSelectedTeamIdentifier] = useState<string>(
    typeof window !== 'undefined' ? localStorage.getItem(DEFAULT_KEY) || '' : ''
  );
  const [isLoadingTeams, setIsLoadingTeams] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [notes, setNotes] = useState(runData.notes || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ndkReady && ndk && publicKey) {
      setIsLoadingTeams(true);
      fetchUserMemberTeams(ndk, publicKey)
        .then(teams => {
          setUserTeams(teams);
        })
        .catch(err => {
          console.error("Error fetching user's teams for modal:", err);
          setError("Could not load your teams for association.");
        })
        .finally(() => setIsLoadingTeams(false));
    }
  }, [ndk, ndkReady, publicKey]);

  const handlePublish = async () => {
    if (!ndkReady || !ndk || !publicKey) {
      setError('Nostr connection not ready or user not logged in.');
      return;
    }

    setIsPublishing(true);
    setError(null);

    let teamAssociation: TeamAssociationOptions | undefined = undefined; // Initialize as undefined
    let challengeUUIDs: string[] = [];
    let challengeNames: string[] = [];

    if (selectedTeamIdentifier) {
      const parts = selectedTeamIdentifier.split(':');
      if (parts.length === 2) {
        const [teamCaptainPubkey, teamUUID] = parts;
        
        // Resolve team name for enhanced content
        const teamName = resolveTeamName(teamUUID, teamCaptainPubkey);
        
        // Cache team name for future use if we have it from the dropdown
        const selectedTeam = userTeams.find(team => 
          getTeamCaptain(team) === teamCaptainPubkey && getTeamUUID(team) === teamUUID
        );
        if (selectedTeam && !teamName) {
          const teamNameFromDropdown = getTeamName(selectedTeam);
          if (teamNameFromDropdown) {
            cacheTeamName(teamUUID, teamCaptainPubkey, teamNameFromDropdown);
          }
        }
        
        teamAssociation = { 
          teamCaptainPubkey, 
          teamUUID, 
          teamName: teamName || (selectedTeam ? getTeamName(selectedTeam) : undefined)
        };
        
        // Get active challenge preferences and resolve names
        const stored = JSON.parse(localStorage.getItem(`runstr:activeChallenges:${teamUUID}`) || '[]');
        if (Array.isArray(stored)) {
          challengeUUIDs = stored;
          challengeNames = resolveChallengeNames(challengeUUIDs, teamUUID);
        }
      }
    }
    
    const finalRunDataForEvent = { 
        ...runData, 
        notes, 
        // Ensure title is present if runData might not have it
        title: runData.title || `${runData.activityType || 'Activity'} on ${new Date(runData.date || Date.now()).toLocaleDateString()}`,
        // Ensure all fields expected by createWorkoutEvent are here
        // activityType, distance, duration, elevation, date are expected from runData prop
    };

    // Prepare season subscription information if user is subscribed
    let seasonSubscription = undefined;
    if (subscription.phase === 'current' && subscription.tier) {
      seasonSubscription = {
        tier: subscription.tier,
        identifier: REWARDS.SEASON_1.identifier
      };
    }

    // createWorkoutEvent expects options.teamAssociation to be of its defined type or undefined
    const eventTemplate = createWorkoutEvent(finalRunDataForEvent, distanceUnit, { 
      teamAssociation, 
      challengeUUIDs, 
      challengeNames, 
      userPubkey: publicKey,
      seasonSubscription 
    });

    if (!eventTemplate) {
      setError('Failed to prepare workout event details.');
      setIsPublishing(false);
      return;
    }

    try {
      const publishedEventOutcome = await createAndPublishEvent(eventTemplate, publicKey);

      if (publishedEventOutcome && publishedEventOutcome.success) {
        console.log('Workout event published via SaveRunModal:', publishedEventOutcome);
        // Persist default posting team for future runs
        if (selectedTeamIdentifier) {
          localStorage.setItem('runstr:defaultPostingTeamIdentifier', selectedTeamIdentifier);
        }
        alert('Run saved and published to Nostr!');
        onSaveAndPublish();
      } else {
        console.error("Publishing failed:", publishedEventOutcome?.error);
        setError(publishedEventOutcome?.error || 'Run was prepared but failed to publish. Check relay connections.');
      }
    } catch (err: any) {
      console.error('Error publishing workout event from modal:', err);
      setError(`Error saving run: ${err.message || 'Unknown error'}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const displayDuration = (secs: number = 0) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = Math.floor(secs % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const displayDistance = (meters: number = 0) => {
    if (distanceUnit === 'km') return `${(meters / 1000).toFixed(2)} km`;
    return `${(meters / 1609.344).toFixed(2)} mi`;
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 p-5 sm:p-6 rounded-lg shadow-xl w-full max-w-lg text-white transform transition-all">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">Save Your {runData.activityType || 'Activity'}</h2>
        
        <div className="mb-4 p-3 bg-gray-700 rounded-md text-sm">
            <p><strong>Distance:</strong> {displayDistance(runData.distance)}</p>
            <p><strong>Duration:</strong> {displayDuration(runData.duration)}</p>
        </div>

        <div className="mb-4">
          <label htmlFor="runNotesModal" className="block text-sm font-medium text-gray-300 mb-1">
            Notes (optional)
          </label>
          <textarea
            id="runNotesModal"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-white focus:border-white transition-colors"
            placeholder={`How was your ${runData.activityType || 'activity'}?`}
          ></textarea>
        </div>

        {isLoadingTeams ? (
          <p className="text-sm text-gray-400 my-3">Loading your teams...</p>
        ) : userTeams.length > 0 ? (
          <div className="mb-4">
            <label htmlFor="teamSelectModal" className="block text-sm font-medium text-gray-300 mb-1">
              Associate with Team (optional)
            </label>
            <select
              id="teamSelectModal"
              value={selectedTeamIdentifier}
              onChange={(e) => setSelectedTeamIdentifier(e.target.value)}
              className="w-full p-2.5 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-purple-500 focus:border-purple-500 appearance-none transition-colors"
            >
              <option value="">-- No Team --</option>
              {userTeams.map(team => {
                const teamNameStr = getTeamName(team);
                const captain = getTeamCaptain(team);
                const uuid = getTeamUUID(team);
                if (!uuid || !captain) return null;
                return (
                  <option key={`${captain}:${uuid}`} value={`${captain}:${uuid}`}>
                    {teamNameStr}
                  </option>
                );
              })}
            </select>
          </div>
        ) : (
          <p className="text-sm text-gray-400 my-3">You are not currently a member of any teams (or failed to load them).</p>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-700/60 text-red-200 border border-red-600 rounded-md text-sm">
            <p><strong>Error:</strong> {error}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing}
            className="px-4 py-2 border border-gray-600 rounded-md text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition-colors w-full sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!ndkReady || isPublishing || isLoadingTeams}
            className="px-5 py-2 bg-black hover:bg-gray-800 border-2 border-white text-white font-bold rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
          >
            {isPublishing ? 'Publishing...' : (isLoadingTeams ? 'Loading Teams...' : 'Save & Publish to Nostr')}
          </button>
        </div>
        {!ndkReady && <p className="text-xs text-yellow-500 mt-2 text-right">Nostr not ready</p>}
      </div>
    </div>
  );
};

export default SaveRunModal; 