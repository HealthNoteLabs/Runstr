/**
 * Enhanced Subscription Service - Manages RUNSTR monthly subscriptions from multiple sources
 * 
 * This service handles the subscription lists for RUNSTR monthly subscriptions by combining:
 * 1. Local storage (existing behavior for offline/fallback)
 * 2. Nostr NIP-51 subscription lists (new centralized source)
 * 
 * The service prioritizes the Nostr lists when available and falls back to localStorage.
 * Based on enhancedSeasonPassService.ts but for monthly subscription management.
 */

import { ndk, ndkReadyPromise } from '../lib/ndkSingleton.js';

// Constants for the Nostr subscription lists
const ADMIN_PUBKEY = 'f241654d23b2aede8275dedd1eba1791e292d9ee0d887752e68a404debc888cc';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Get current month-year tag for subscription lists
 * @returns string in format "MM-YYYY" 
 */
function getCurrentMonthYearTag(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${month}-${year}`;
}

// Cache for Nostr subscription lists
interface NostrSubscriptionCache {
  members: string[];
  captains: string[];
  timestamp: number;
  monthYear: string;
}

let nostrCache: NostrSubscriptionCache | null = null;

/**
 * Fetch subscription lists from Nostr using NIP-51
 * @param monthYear Optional month-year string, defaults to current month
 * @returns Promise with arrays of member and captain pubkeys
 */
const fetchNostrSubscriptions = async (monthYear?: string): Promise<{ members: string[], captains: string[] }> => {
  try {
    const targetMonthYear = monthYear || getCurrentMonthYearTag();
    console.log(`[EnhancedSubscription] Fetching subscription lists from Nostr for ${targetMonthYear}...`);
    
    // Wait for NDK to be ready
    const ndkReady = await ndkReadyPromise;
    if (!ndkReady) {
      console.warn('[EnhancedSubscription] NDK not ready, falling back to localStorage only');
      return { members: [], captains: [] };
    }

    // Query for both member and captain subscription lists
    const memberListTag = `runstr-members-${targetMonthYear}`;
    const captainListTag = `runstr-captains-${targetMonthYear}`;

    const events = await ndk.fetchEvents({
      kinds: [30000], // NIP-51 list
      authors: [ADMIN_PUBKEY],
      '#d': [memberListTag, captainListTag]
    });

    if (!events || events.size === 0) {
      console.log(`[EnhancedSubscription] No subscription lists found on Nostr for ${targetMonthYear}`);
      return { members: [], captains: [] };
    }

    // Separate member and captain events
    const eventArray = Array.from(events);
    const memberEvent = eventArray.find(event => 
      event.tags?.some(tag => tag[0] === 'd' && tag[1] === memberListTag)
    );
    const captainEvent = eventArray.find(event => 
      event.tags?.some(tag => tag[0] === 'd' && tag[1] === captainListTag)
    );

    // Extract member pubkeys
    const members = memberEvent?.tags
      ?.filter(tag => tag[0] === 'p' && tag[1])
      ?.map(tag => tag[1]) || [];

    // Extract captain pubkeys  
    const captains = captainEvent?.tags
      ?.filter(tag => tag[0] === 'p' && tag[1])
      ?.map(tag => tag[1]) || [];

    console.log(`[EnhancedSubscription] Extracted ${members.length} members and ${captains.length} captains from Nostr lists`);
    
    // Update cache
    nostrCache = {
      members,
      captains,
      timestamp: Date.now(),
      monthYear: targetMonthYear
    };

    return { members, captains };

  } catch (error) {
    console.error('[EnhancedSubscription] Error fetching subscriptions from Nostr:', error);
    return { members: [], captains: [] };
  }
};

/**
 * Get subscriptions from Nostr with caching
 * @param forceRefresh Force refresh of the cache
 * @param monthYear Optional month-year string, defaults to current month
 * @returns Promise with arrays of member and captain pubkeys
 */
const getCachedNostrSubscriptions = async (
  forceRefresh = false, 
  monthYear?: string
): Promise<{ members: string[], captains: string[] }> => {
  const targetMonthYear = monthYear || getCurrentMonthYearTag();
  
  // Check if we have a valid cache for the target month
  const cacheValid = nostrCache && 
    nostrCache.monthYear === targetMonthYear &&
    (Date.now() - nostrCache.timestamp) < CACHE_DURATION;

  if (!forceRefresh && cacheValid) {
    console.log(`[EnhancedSubscription] Using cached Nostr subscriptions for ${targetMonthYear} (${nostrCache!.members.length} members, ${nostrCache!.captains.length} captains)`);
    return { 
      members: nostrCache!.members, 
      captains: nostrCache!.captains 
    };
  }

  // Fetch fresh data
  console.log(`[EnhancedSubscription] Cache ${forceRefresh ? 'force refresh' : 'expired'} - fetching fresh subscription data for ${targetMonthYear}`);
  return await fetchNostrSubscriptions(targetMonthYear);
};

/**
 * Get subscriptions from localStorage
 * @returns Object with member and captain arrays
 */
const getLocalSubscriptions = (): { members: string[], captains: string[] } => {
  try {
    const memberData = localStorage.getItem('monthlySubscriptionMembers');
    const captainData = localStorage.getItem('monthlySubscriptionCaptains');
    
    const members = memberData ? JSON.parse(memberData) : [];
    const captains = captainData ? JSON.parse(captainData) : [];
    
    console.log(`[EnhancedSubscription] Loaded ${members.length} members and ${captains.length} captains from localStorage`);
    
    return { members, captains };
  } catch (error) {
    console.error('[EnhancedSubscription] Error loading subscriptions from localStorage:', error);
    return { members: [], captains: [] };
  }
};

/**
 * Merge subscription lists from multiple sources with deduplication
 * @param nostrData Subscription data from Nostr
 * @param localData Subscription data from localStorage
 * @returns Merged and deduplicated subscription data
 */
const mergeSubscriptionData = (
  nostrData: { members: string[], captains: string[] },
  localData: { members: string[], captains: string[] }
): { members: string[], captains: string[] } => {
  // Combine and deduplicate members
  const allMembers = [...nostrData.members, ...localData.members];
  const uniqueMembers = [...new Set(allMembers)];
  
  // Combine and deduplicate captains
  const allCaptains = [...nostrData.captains, ...localData.captains];
  const uniqueCaptains = [...new Set(allCaptains)];
  
  console.log(`[EnhancedSubscription] Merged subscriptions: ${uniqueMembers.length} members (${nostrData.members.length} Nostr + ${localData.members.length} local), ${uniqueCaptains.length} captains (${nostrData.captains.length} Nostr + ${localData.captains.length} local)`);
  
  return {
    members: uniqueMembers,
    captains: uniqueCaptains
  };
};

/**
 * Enhanced Subscription Service
 */
class EnhancedSubscriptionService {
  /**
   * Check if a user has an active subscription (any tier)
   * @param userPubkey The user's public key to check
   * @param forceRefresh Force refresh of Nostr cache
   * @returns Promise<boolean> true if user has active subscription
   */
  async isSubscriber(userPubkey: string, forceRefresh = false): Promise<boolean> {
    try {
      console.log(`[EnhancedSubscription] Checking subscription status for user: ${userPubkey.substring(0, 16)}...`);
      
      // Get data from both sources
      const nostrData = await getCachedNostrSubscriptions(forceRefresh);
      const localData = getLocalSubscriptions();
      
      // Merge the data
      const mergedData = mergeSubscriptionData(nostrData, localData);
      
      // Check if user is in either list
      const isMember = mergedData.members.includes(userPubkey);
      const isCaptain = mergedData.captains.includes(userPubkey);
      const hasSubscription = isMember || isCaptain;
      
      console.log(`[EnhancedSubscription] User ${userPubkey.substring(0, 16)}... subscription status: ${hasSubscription ? (isCaptain ? 'Captain' : 'Member') : 'None'}`);
      
      return hasSubscription;
    } catch (error) {
      console.error('[EnhancedSubscription] Error checking subscription status:', error);
      return false;
    }
  }

  /**
   * Get user's subscription tier
   * @param userPubkey The user's public key to check
   * @param forceRefresh Force refresh of Nostr cache
   * @returns Promise<'member' | 'captain' | null> user's subscription tier or null if not subscribed
   */
  async getSubscriptionTier(userPubkey: string, forceRefresh = false): Promise<'member' | 'captain' | null> {
    try {
      console.log(`[EnhancedSubscription] Getting subscription tier for user: ${userPubkey.substring(0, 16)}...`);
      
      // Get data from both sources
      const nostrData = await getCachedNostrSubscriptions(forceRefresh);
      const localData = getLocalSubscriptions();
      
      // Merge the data
      const mergedData = mergeSubscriptionData(nostrData, localData);
      
      // Check tier (captain takes precedence over member)
      if (mergedData.captains.includes(userPubkey)) {
        console.log(`[EnhancedSubscription] User ${userPubkey.substring(0, 16)}... has Captain subscription`);
        return 'captain';
      } else if (mergedData.members.includes(userPubkey)) {
        console.log(`[EnhancedSubscription] User ${userPubkey.substring(0, 16)}... has Member subscription`);
        return 'member';
      } else {
        console.log(`[EnhancedSubscription] User ${userPubkey.substring(0, 16)}... has no active subscription`);
        return null;
      }
    } catch (error) {
      console.error('[EnhancedSubscription] Error getting subscription tier:', error);
      return null;
    }
  }

  /**
   * Get total subscriber count across all tiers
   * @param forceRefresh Force refresh of Nostr cache
   * @returns Promise<number> total number of subscribers
   */
  async getSubscriberCount(forceRefresh = false): Promise<number> {
    try {
      // Get data from both sources
      const nostrData = await getCachedNostrSubscriptions(forceRefresh);
      const localData = getLocalSubscriptions();
      
      // Merge the data
      const mergedData = mergeSubscriptionData(nostrData, localData);
      
      // Total unique subscribers (members + captains, no duplicates)
      const allSubscribers = [...mergedData.members, ...mergedData.captains];
      const uniqueSubscribers = new Set(allSubscribers);
      
      console.log(`[EnhancedSubscription] Total subscriber count: ${uniqueSubscribers.size}`);
      
      return uniqueSubscribers.size;
    } catch (error) {
      console.error('[EnhancedSubscription] Error getting subscriber count:', error);
      return 0;
    }
  }

  /**
   * Get subscriber counts by tier
   * @param forceRefresh Force refresh of Nostr cache
   * @returns Promise with member and captain counts
   */
  async getSubscriberCountByTier(forceRefresh = false): Promise<{ members: number, captains: number, total: number }> {
    try {
      // Get data from both sources
      const nostrData = await getCachedNostrSubscriptions(forceRefresh);
      const localData = getLocalSubscriptions();
      
      // Merge the data
      const mergedData = mergeSubscriptionData(nostrData, localData);
      
      // Count unique subscribers in each tier
      const memberCount = mergedData.members.length;
      const captainCount = mergedData.captains.length;
      
      // Total unique subscribers (handle potential overlap)
      const allSubscribers = [...mergedData.members, ...mergedData.captains];
      const totalCount = new Set(allSubscribers).size;
      
      console.log(`[EnhancedSubscription] Subscriber counts - Members: ${memberCount}, Captains: ${captainCount}, Total: ${totalCount}`);
      
      return {
        members: memberCount,
        captains: captainCount,
        total: totalCount
      };
    } catch (error) {
      console.error('[EnhancedSubscription] Error getting subscriber count by tier:', error);
      return { members: 0, captains: 0, total: 0 };
    }
  }

  /**
   * Check if user has captain permissions
   * @param userPubkey The user's public key to check
   * @param forceRefresh Force refresh of Nostr cache
   * @returns Promise<boolean> true if user has captain subscription
   */
  async isCaptain(userPubkey: string, forceRefresh = false): Promise<boolean> {
    const tier = await this.getSubscriptionTier(userPubkey, forceRefresh);
    return tier === 'captain';
  }

  /**
   * Get all subscribers (for admin use)
   * @param forceRefresh Force refresh of Nostr cache
   * @returns Promise with arrays of all subscribers by tier
   */
  async getAllSubscribers(forceRefresh = false): Promise<{ members: string[], captains: string[] }> {
    try {
      // Get data from both sources
      const nostrData = await getCachedNostrSubscriptions(forceRefresh);
      const localData = getLocalSubscriptions();
      
      // Merge the data
      const mergedData = mergeSubscriptionData(nostrData, localData);
      
      return mergedData;
    } catch (error) {
      console.error('[EnhancedSubscription] Error getting all subscribers:', error);
      return { members: [], captains: [] };
    }
  }

  /**
   * Force refresh of subscription cache
   */
  async refreshCache(): Promise<void> {
    console.log('[EnhancedSubscription] Force refreshing subscription cache...');
    await getCachedNostrSubscriptions(true);
  }
}

// Export singleton instance
const enhancedSubscriptionService = new EnhancedSubscriptionService();
export default enhancedSubscriptionService;