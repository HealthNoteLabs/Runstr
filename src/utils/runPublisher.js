import { createWorkoutEvent, createAndPublishEvent } from './nostr_simple';
import { getActiveRelayList } from '../contexts/SettingsContext';
import { resolveTeamName, resolveChallengeNames, cacheTeamName, cacheChallengeNames } from '../services/nameResolver';
import { getDefaultPostingTeamIdentifier } from './settingsManager';
import AuthService from '../services/AuthService';

/**
 * Publish a run's workout summary (kind 1301) plus optional NIP-101h events.
 * @param {Object} run  Run record saved in local storage.
 * @param {string} distanceUnit 'km' | 'mi'
 * @param {Object} settings User's publishing preferences from SettingsContext.
 * @param {Object} teamChallengeData Optional pre-selected team/challenge data
 * @returns {Promise<Array>} resolved array of publish results
 */
export const publishRun = async (run, distanceUnit = 'km', settings = {}, teamChallengeData = null) => {
  if (!run) throw new Error('publishRun: run is required');

  const results = [];
  const relayList = getActiveRelayList();

  // 🏷️ Get user's public key for team member identification
  const userPubkey = AuthService.getPublicKey();
  if (!userPubkey) {
    throw new Error('No user public key available. Please log in first.');
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
    } else {
      // Priority 2: Use default posting team setting
      const defaultTeamId = getDefaultPostingTeamIdentifier();
      if (defaultTeamId) {
        const parts = defaultTeamId.split(':');
        if (parts.length === 2) {
          const [teamCaptainPubkey, teamUUID] = parts;
          
          // Resolve team name for enhanced content
          let teamName = resolveTeamName(teamUUID, teamCaptainPubkey);
          
          // Priority 3: Try to fetch team name from NDK if not cached
          if (!teamName) {
            try {
              console.log('runPublisher: Attempting to fetch team name from NDK for:', teamUUID);
              // Import NDK services dynamically to avoid circular dependencies
              const { ndk, ndkReadyPromise } = await import('../lib/ndkSingleton');
              const { fetchTeamById, getTeamName } = await import('../services/nostr/NostrTeamsService');
              
              // Wait for NDK to be ready with timeout
              const isNdkReady = await Promise.race([
                ndkReadyPromise,
                new Promise(resolve => setTimeout(() => resolve(false), 5000)) // 5 second timeout
              ]);
              
              if (isNdkReady && ndk && ndk.pool && ndk.pool.relays && ndk.pool.relays.size > 0) {
                console.log('runPublisher: NDK is ready, fetching team data...');
                const teamEvent = await fetchTeamById(ndk, teamCaptainPubkey, teamUUID);
                if (teamEvent) {
                  teamName = getTeamName(teamEvent);
                  if (teamName && teamName !== 'Unnamed Team') {
                    console.log('runPublisher: Successfully fetched team name:', teamName);
                    // Cache the team name for future use
                    cacheTeamName(teamUUID, teamCaptainPubkey, teamName);
                  } else {
                    console.log('runPublisher: Team event found but no valid name');
                  }
                } else {
                  console.log('runPublisher: No team event found for:', teamUUID);
                }
              } else {
                console.log('runPublisher: NDK not ready or not connected, skipping team name fetch');
              }
            } catch (ndkError) {
              console.warn('runPublisher: could not fetch team data via NDK', ndkError);
            }
          } else {
            console.log('runPublisher: Using cached team name:', teamName);
          }
          
          teamAssociation = { 
            teamCaptainPubkey, 
            teamUUID,
            teamName: teamName || undefined // Only include if we have it
          };
          
          // 🏆 Get challenge participation for this team
          try {
            const activeKey = `runstr:activeChallenges:${teamUUID}`;
            const stored = JSON.parse(localStorage.getItem(activeKey) || '[]');
            if (Array.isArray(stored) && stored.length > 0) {
              challengeUUIDs = stored;
              challengeNames = resolveChallengeNames(challengeUUIDs, teamUUID);
              
              // If no names were resolved, try fetching from NDK
              if (challengeNames.length === 0) {
                try {
                  const { ndk, ndkReadyPromise } = await import('../lib/ndkSingleton');
                  const { fetchTeamChallenges } = await import('../services/nostr/NostrTeamsService');
                  
                  // Wait for NDK to be ready with timeout
                  const isNdkReady = await Promise.race([
                    ndkReadyPromise,
                    new Promise(resolve => setTimeout(() => resolve(false), 5000)) // 5 second timeout
                  ]);
                  
                  if (isNdkReady && ndk && ndk.pool && ndk.pool.relays && ndk.pool.relays.size > 0) {
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
                  console.warn('runPublisher: could not fetch challenge data via NDK', challengeNdkError);
                }
              }
            }
          } catch (challengeErr) {
            console.warn('runPublisher: could not retrieve challenge participation', challengeErr);
          }
        }
      } else {
        // Priority 3: AUTO-DETECT - Use user's first team if no default is set
        try {
          const { ndk, ndkReadyPromise } = await import('../lib/ndkSingleton');
          const { fetchUserMemberTeams, getTeamCaptain, getTeamUUID, getTeamName } = await import('../services/nostr/NostrTeamsService');
          
          // Wait for NDK to be ready with timeout
          const isNdkReady = await Promise.race([
            ndkReadyPromise,
            new Promise(resolve => setTimeout(() => resolve(false), 5000)) // 5 second timeout
          ]);
          
          if (isNdkReady && ndk && ndk.pool && ndk.pool.relays && ndk.pool.relays.size > 0 && userPubkey) {
            console.log('runPublisher: Auto-detecting user teams...');
            const userTeams = await fetchUserMemberTeams(ndk, userPubkey);
            if (userTeams && userTeams.length > 0) {
              const firstTeam = userTeams[0];
              const teamCaptainPubkey = getTeamCaptain(firstTeam);
              const teamUUID = getTeamUUID(firstTeam);
              const teamName = getTeamName(firstTeam);
              
              if (teamCaptainPubkey && teamUUID) {
                console.log('runPublisher: Auto-detected team for associations:', teamName || teamUUID);
                
                // Cache the team name if we have it
                if (teamName && teamName !== 'Unnamed Team') {
                  cacheTeamName(teamUUID, teamCaptainPubkey, teamName);
                }
                
                teamAssociation = { 
                  teamCaptainPubkey, 
                  teamUUID,
                  teamName 
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
                        const { fetchTeamChallenges } = await import('../services/nostr/NostrTeamsService');
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
                      } catch (challengeNdkError) {
                        console.warn('runPublisher: could not fetch challenge data via NDK for auto-detected team', challengeNdkError);
                      }
                    }
                  }
                } catch (challengeErr) {
                  console.warn('runPublisher: could not retrieve challenge participation for auto-detected team', challengeErr);
                }
              }
            }
          } else {
            console.log('runPublisher: NDK not ready or no user pubkey, skipping auto-detection');
          }
        } catch (autoDetectErr) {
          console.warn('runPublisher: could not auto-detect user team', autoDetectErr);
        }
      }
    }

    // Log the associations that will be added to the workout
    if (teamAssociation || challengeUUIDs.length > 0) {
      console.log('runPublisher: Adding team/challenge associations:', {
        team: teamAssociation?.teamName || teamAssociation?.teamUUID,
        challenges: challengeNames.length > 0 ? challengeNames : challengeUUIDs
      });
    }

  } catch (err) {
    console.warn('runPublisher: error determining team/challenge associations', err);
    // Continue without associations rather than failing
  }

  // 1️⃣ Publish workout summary if not already published earlier (ALWAYS PUBLISHED)
  if (!run.nostrWorkoutEventId) {
    // Pass team association, challenge UUIDs, and resolved names to createWorkoutEvent
    const summaryTemplate = createWorkoutEvent(run, distanceUnit, { teamAssociation, challengeUUIDs, challengeNames, userPubkey });
    try {
      const summaryResult = await createAndPublishEvent(summaryTemplate, null, { relays: relayList });
      results.push({ kind: 1301, success: true, result: summaryResult });
      if (summaryResult?.id) {
        run.nostrWorkoutEventId = summaryResult.id;
      }
    } catch (err) {
      console.error('publishRun: failed for kind 1301', err);
      results.push({ kind: 1301, success: false, error: err.message });
      return results; // bail if summary fails
    }
  }

  // PHASE-1 SIMPLIFICATION: Skip all NIP-101h follow-up publishing. Return after summary.
  return results;
}; 