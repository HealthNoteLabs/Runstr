import { resolveTeamName, resolveChallengeNames, cacheTeamName, cacheChallengeNames } from '../services/nameResolver';
import { getDefaultPostingTeamIdentifier } from './settingsManager';
import { getUserPublicKey } from './nostrClient';

/**
 * Get team and challenge associations for a workout record.
 * This function extracts the logic from runPublisher.js to make it reusable
 * across different publishing pathways (dashboard buttons, history page, etc.)
 * 
 * @param {Object} teamChallengeData - Optional pre-selected team/challenge data
 * @returns {Promise<Object>} Object with { teamAssociation, challengeUUIDs, challengeNames, userPubkey }
 */
export const getWorkoutAssociations = async (teamChallengeData = null) => {
  // 🏷️ Get user's public key for team member identification
  let userPubkey = null;
  try {
    userPubkey = await getUserPublicKey() || (typeof window !== 'undefined' && window.nostr ? await window.nostr.getPublicKey() : null);
  } catch (pubkeyErr) {
    console.warn('getWorkoutAssociations: could not get user public key', pubkeyErr);
  }

  // 🏷️ Determine team and challenge associations with enhanced fallback logic
  let teamAssociation = undefined;
  let challengeUUIDs = [];
  let challengeNames = [];
  
  try {
    // Priority 1: Use provided team/challenge data
    if (teamChallengeData) {
      if (teamChallengeData.team) {
        teamAssociation = teamChallengeData.team;
      }
      if (teamChallengeData.challenges && Array.isArray(teamChallengeData.challenges)) {
        challengeUUIDs = teamChallengeData.challenges.map(c => c.uuid).filter(Boolean);
        challengeNames = teamChallengeData.challenges.map(c => c.name).filter(Boolean);
      }
    }
    
    // Priority 2: Auto-detect from localStorage if no explicit data provided
    if (!teamAssociation && !challengeUUIDs.length) {
      console.log('getWorkoutAssociations: auto-detecting team/challenge associations from settings...');
      
      // Look up default team from settings
      const defaultTeamId = getDefaultPostingTeamIdentifier();
      
      if (defaultTeamId) {
        const parts = defaultTeamId.split(':');
        if (parts.length === 2) {
          const [teamCaptainPubkey, teamUUID] = parts;
          
          // Try to resolve team name from cache
          const teamName = resolveTeamName(teamUUID, teamCaptainPubkey);
          
          teamAssociation = {
            teamCaptainPubkey,
            teamUUID,
            teamName: teamName || '', // Use resolved name or empty string
            relayHint: '', // Could be enhanced later
          };
          
          // Also check for active challenge preferences for this auto-detected team
          try {
            const activeKey = `runstr:activeChallenges:${teamUUID}`;
            const stored = JSON.parse(localStorage.getItem(activeKey) || '[]');
            if (Array.isArray(stored) && stored.length > 0) {
              challengeUUIDs = stored;
              challengeNames = resolveChallengeNames(challengeUUIDs, teamUUID);
              
              // If no names were resolved, try fetching from NDK
              if (challengeNames.length === 0) {
                try {
                  const { ndk } = await import('../lib/ndkSingleton');
                  const { fetchTeamChallenges } = await import('../services/nostr/NostrTeamsService');
                  if (ndk && ndk.connect) {
                    const teamAIdentifier = `33404:${teamCaptainPubkey}:${teamUUID}`;
                    const challenges = await fetchTeamChallenges(ndk, teamAIdentifier);
                    
                    // Match UUIDs with fetched challenges and cache names
                    challengeUUIDs.forEach(uuid => {
                      const challenge = challenges.find(c => {
                        const challengeUuid = c.tags.find(t => t[0] === 'd')?.[1];
                        return challengeUuid === uuid;
                      });
                      if (challenge) {
                        const challengeName = challenge.tags.find(t => t[0] === 'name')?.[1];
                        if (challengeName) {
                          challengeNames.push(challengeName);
                          cacheChallengeNames(uuid, teamUUID, challengeName);
                        }
                      }
                    });
                  }
                } catch (challengeNdkError) {
                  console.warn('getWorkoutAssociations: could not fetch challenge data via NDK', challengeNdkError);
                }
              }
            }
          } catch (challengeErr) {
            console.warn('getWorkoutAssociations: error checking challenge participation', challengeErr);
          }
        }
      }
    }

    // Log the associations that will be added to the workout
    if (teamAssociation || challengeUUIDs.length > 0) {
      console.log('getWorkoutAssociations: Found team/challenge associations:', {
        team: teamAssociation?.teamName || teamAssociation?.teamUUID,
        challenges: challengeNames.length > 0 ? challengeNames : challengeUUIDs
      });
    }

  } catch (err) {
    console.warn('getWorkoutAssociations: error determining team/challenge associations', err);
    // Continue without associations rather than failing
  }

  return {
    teamAssociation,
    challengeUUIDs,
    challengeNames,
    userPubkey
  };
}; 