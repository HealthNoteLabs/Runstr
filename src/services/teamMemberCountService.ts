/**
 * Team Member Count Service
 * Handles counting team members for captain reward calculations
 */

import { ndk } from '../lib/ndkSingleton';
import {
  fetchTeamMemberships,
  getTeamMembers,
  getTeamCaptain,
  fetchTeamEvents,
  NostrTeamEvent
} from './nostr/NostrTeamsService';

interface TeamMemberCount {
  totalMembers: number;
  activeMembers: number;
  teamUUID: string;
  teamName: string;
}

/**
 * Get team member count for a captain
 * @param captainPubkey The captain's public key
 * @returns Promise<TeamMemberCount[]> Array of teams with member counts
 */
export const getCaptainTeamMemberCounts = async (captainPubkey: string): Promise<TeamMemberCount[]> => {
  if (!ndk || !captainPubkey) {
    console.warn('[TeamMemberCount] NDK not ready or no captain pubkey');
    return [];
  }

  try {
    console.log(`[TeamMemberCount] Getting team member counts for captain: ${captainPubkey.substring(0, 16)}...`);

    // Fetch all teams where this user is the captain
    const allTeams = await fetchTeamEvents(ndk);
    const captainTeams = allTeams.filter((team: NostrTeamEvent) => 
      getTeamCaptain(team) === captainPubkey
    );

    console.log(`[TeamMemberCount] Found ${captainTeams.length} teams for captain`);

    const teamCounts: TeamMemberCount[] = [];

    for (const team of captainTeams) {
      try {
        // Get team UUID and name
        const teamUUID = team.tags.find(tag => tag[0] === 'd')?.[1] || 'unknown';
        const teamName = team.tags.find(tag => tag[0] === 'name')?.[1] || 'Unnamed Team';

        // Get members from team event tags
        const taggedMembers = getTeamMembers(team);

        // Get members from membership events
        const teamAIdentifier = `33404:${captainPubkey}:${teamUUID}`;
        const membershipMembers = await fetchTeamMemberships(ndk, teamAIdentifier);

        // Combine and deduplicate members
        const allMembers = Array.from(new Set([...taggedMembers, ...membershipMembers]));
        const totalMembers = allMembers.length;

        console.log(`[TeamMemberCount] Team "${teamName}" (${teamUUID}): ${totalMembers} members`);

        teamCounts.push({
          totalMembers,
          activeMembers: totalMembers, // For now, consider all members as active
          teamUUID,
          teamName
        });

      } catch (teamError: any) {
        console.error(`[TeamMemberCount] Error processing team:`, teamError);
      }
    }

    return teamCounts;

  } catch (error: any) {
    console.error('[TeamMemberCount] Error getting captain team member counts:', error);
    return [];
  }
};

/**
 * Get total member count across all teams for a captain
 * @param captainPubkey The captain's public key
 * @returns Promise<number> Total number of team members across all teams
 */
export const getTotalMemberCountForCaptain = async (captainPubkey: string): Promise<number> => {
  const teamCounts = await getCaptainTeamMemberCounts(captainPubkey);
  return teamCounts.reduce((total, team) => total + team.totalMembers, 0);
};

/**
 * Calculate captain bonus reward based on team member count
 * @param captainPubkey The captain's public key
 * @param baseBonusPerMember Base bonus amount per team member (default: 10 sats)
 * @param maxMembers Maximum members to count for bonus (default: 50)
 * @returns Promise<number> Bonus amount in sats
 */
export const calculateCaptainBonus = async (
  captainPubkey: string,
  baseBonusPerMember: number = 10,
  maxMembers: number = 50
): Promise<number> => {
  const totalMembers = await getTotalMemberCountForCaptain(captainPubkey);
  const countedMembers = Math.min(totalMembers, maxMembers);
  const bonus = countedMembers * baseBonusPerMember;
  
  console.log(`[TeamMemberCount] Captain bonus: ${countedMembers} members × ${baseBonusPerMember} sats = ${bonus} sats`);
  
  return bonus;
};

export default {
  getCaptainTeamMemberCounts,
  getTotalMemberCountForCaptain,
  calculateCaptainBonus
};