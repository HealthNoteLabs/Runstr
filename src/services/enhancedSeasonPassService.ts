/**
 * Enhanced Season Pass Service - Manages RUNSTR Season 1 participants from multiple sources
 * 
 * This service handles the participant list for RUNSTR Season 1 by combining:
 * 1. Local storage (existing behavior for offline/fallback)
 * 2. Nostr NIP-51 participant list (new centralized source)
 * 
 * The service prioritizes the Nostr list when available and falls back to localStorage.
 */

import { ndk, ndkReadyPromise } from '../lib/ndkSingleton';
import seasonPassService, { SeasonPassParticipant } from './seasonPassService';

// Constants for the Nostr participant list
const ADMIN_PUBKEY = 'f241654d23b2aede8275dedd1eba1791e292d9ee0d887752e68a404debc888cc';
const PARTICIPANT_LIST_D_TAG = 'runstr-season-1-participants';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Current production event: 59ae5e4138ec6604bee27a5ac0db08147b3cae493510c76a71e64f8339846708
// Published to: relay.damus.io, nos.lol, relay.nostr.band

// Cache for Nostr participants
interface NostrParticipantCache {
  participants: string[];
  timestamp: number;
  lastEventId?: string;
}

let nostrCache: NostrParticipantCache | null = null;

/**
 * Fetch the participant list from Nostr using NIP-51
 * @returns Promise<string[]> Array of participant pubkeys from Nostr
 */
const fetchNostrParticipants = async (): Promise<string[]> => {
  try {
    console.log('[EnhancedSeasonPass] Fetching participant list from Nostr...');
    
    // Wait for NDK to be ready
    const ndkReady = await ndkReadyPromise;
    if (!ndkReady) {
      console.warn('[EnhancedSeasonPass] NDK not ready, falling back to localStorage only');
      return [];
    }

    // Query for the NIP-51 participant list
    const events = await ndk.fetchEvents({
      kinds: [30000], // NIP-51 list
      authors: [ADMIN_PUBKEY],
      '#d': [PARTICIPANT_LIST_D_TAG]
    });

    if (!events || events.size === 0) {
      console.log('[EnhancedSeasonPass] No participant list found on Nostr');
      return [];
    }

    // Get the most recent event (should only be one with this d-tag)
    const eventArray = Array.from(events);
    const latestEvent = eventArray.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];

    console.log('[EnhancedSeasonPass] Found participant list event:', {
      id: latestEvent.id,
      created_at: latestEvent.created_at,
      tagCount: latestEvent.tags?.length || 0
    });

    // Extract participant pubkeys from 'p' tags
    const participants = latestEvent.tags
      ?.filter(tag => tag[0] === 'p' && tag[1])
      ?.map(tag => tag[1]) || [];

    console.log(`[EnhancedSeasonPass] Extracted ${participants.length} participants from Nostr list`);
    
    // Update cache
    nostrCache = {
      participants,
      timestamp: Date.now(),
      lastEventId: latestEvent.id
    };

    return participants;

  } catch (error) {
    console.error('[EnhancedSeasonPass] Error fetching participants from Nostr:', error);
    return [];
  }
};

/**
 * Get participants from Nostr with caching
 * @param forceRefresh Force refresh of the cache
 * @returns Promise<string[]> Array of participant pubkeys
 */
const getCachedNostrParticipants = async (forceRefresh = false): Promise<string[]> => {
  // Check if we have a valid cache
  if (!forceRefresh && nostrCache && (Date.now() - nostrCache.timestamp) < CACHE_DURATION) {
    console.log(`[EnhancedSeasonPass] Using cached Nostr participants (${nostrCache.participants.length} participants)`);
    return nostrCache.participants;
  }

  // Fetch fresh data
  return await fetchNostrParticipants();
};

/**
 * Get merged participants from both localStorage and Nostr
 * @param forceNostrRefresh Force refresh of Nostr cache
 * @returns Promise<string[]> Combined array of unique participant pubkeys
 */
export const getMergedParticipants = async (forceNostrRefresh = false): Promise<string[]> => {
  try {
    // Get participants from both sources in parallel
    const [localParticipants, nostrParticipants] = await Promise.allSettled([
      Promise.resolve(seasonPassService.getParticipants()),
      getCachedNostrParticipants(forceNostrRefresh)
    ]);

    const localPubkeys = localParticipants.status === 'fulfilled' ? localParticipants.value : [];
    const nostrPubkeys = nostrParticipants.status === 'fulfilled' ? nostrParticipants.value : [];

    // Merge and deduplicate
    const allPubkeys = [...new Set([...localPubkeys, ...nostrPubkeys])];

    console.log('[EnhancedSeasonPass] Merged participants:', {
      localCount: localPubkeys.length,
      nostrCount: nostrPubkeys.length,
      totalUnique: allPubkeys.length
    });

    return allPubkeys;

  } catch (error) {
    console.error('[EnhancedSeasonPass] Error merging participants:', error);
    // Fallback to just localStorage
    return seasonPassService.getParticipants();
  }
};

/**
 * Check if a pubkey is a participant (checks both sources)
 * @param pubkey The public key to check
 * @param forceNostrRefresh Force refresh of Nostr cache
 * @returns Promise<boolean> True if the pubkey is a participant
 */
export const isEnhancedParticipant = async (pubkey: string, forceNostrRefresh = false): Promise<boolean> => {
  if (!pubkey || typeof pubkey !== 'string') {
    return false;
  }

  try {
    // First check localStorage (fast)
    if (seasonPassService.isParticipant(pubkey)) {
      return true;
    }

    // Then check Nostr participants
    const nostrParticipants = await getCachedNostrParticipants(forceNostrRefresh);
    return nostrParticipants.includes(pubkey.trim());

  } catch (error) {
    console.error('[EnhancedSeasonPass] Error checking participant status:', error);
    // Fallback to localStorage only
    return seasonPassService.isParticipant(pubkey);
  }
};

/**
 * Get enhanced participant count (from both sources)
 * @param forceNostrRefresh Force refresh of Nostr cache
 * @returns Promise<number> Total number of unique participants
 */
export const getEnhancedParticipantCount = async (forceNostrRefresh = false): Promise<number> => {
  try {
    const allParticipants = await getMergedParticipants(forceNostrRefresh);
    return allParticipants.length;
  } catch (error) {
    console.error('[EnhancedSeasonPass] Error getting participant count:', error);
    return seasonPassService.getParticipantCount();
  }
};

/**
 * Get source breakdown for debugging
 * @returns Promise<object> Breakdown of participant sources
 */
export const getParticipantSourceBreakdown = async (): Promise<{
  localStorage: string[];
  nostr: string[];
  merged: string[];
  cacheInfo: {
    hasCache: boolean;
    cacheAge?: number;
    lastEventId?: string;
  };
}> => {
  try {
    const [localParticipants, nostrParticipants] = await Promise.allSettled([
      Promise.resolve(seasonPassService.getParticipants()),
      getCachedNostrParticipants(false)
    ]);

    const localPubkeys = localParticipants.status === 'fulfilled' ? localParticipants.value : [];
    const nostrPubkeys = nostrParticipants.status === 'fulfilled' ? nostrParticipants.value : [];
    const merged = [...new Set([...localPubkeys, ...nostrPubkeys])];

    return {
      localStorage: localPubkeys,
      nostr: nostrPubkeys,
      merged,
      cacheInfo: {
        hasCache: !!nostrCache,
        cacheAge: nostrCache ? Date.now() - nostrCache.timestamp : undefined,
        lastEventId: nostrCache?.lastEventId
      }
    };
  } catch (error) {
    console.error('[EnhancedSeasonPass] Error getting source breakdown:', error);
    throw error;
  }
};

/**
 * Clear the Nostr cache (useful for testing or forced refresh)
 */
export const clearNostrCache = (): void => {
  nostrCache = null;
  console.log('[EnhancedSeasonPass] Nostr cache cleared');
};

/**
 * Enhanced Season Pass Service that extends the original with Nostr capabilities
 */
export const enhancedSeasonPassService = {
  // Enhanced methods that check both sources
  isParticipant: isEnhancedParticipant,
  getParticipants: getMergedParticipants,
  getParticipantCount: getEnhancedParticipantCount,
  
  // Original localStorage methods (for compatibility and local operations)
  addParticipant: seasonPassService.addParticipant,
  removeParticipant: seasonPassService.removeParticipant,
  clearAllParticipants: seasonPassService.clearAllParticipants,
  getParticipantsWithDates: seasonPassService.getParticipantsWithDates,
  getParticipantPaymentDate: seasonPassService.getParticipantPaymentDate,
  
  // Enhanced debugging and utility methods
  getSourceBreakdown: getParticipantSourceBreakdown,
  clearNostrCache,
  refreshNostrParticipants: () => getCachedNostrParticipants(true),
  
  // Constants for external use
  ADMIN_PUBKEY,
  PARTICIPANT_LIST_D_TAG
};

export default enhancedSeasonPassService; 