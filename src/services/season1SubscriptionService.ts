import NDK, { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import { REWARDS } from '../config/rewardsConfig';
import { KIND_TEAM_SUBSCRIPTION_RECEIPT, fetchSubscriptionReceipts } from './nostr/NostrTeamsService';
import { Season1Tier } from '../hooks/useSeasonSubscription';

export interface Season1Subscriber {
  pubkey: string;
  tier: Season1Tier;
  subscriptionDate: number;
  expiryDate: number;
  isActive: boolean;
}

/**
 * Service for managing Season 1 subscription data and verification
 */
export class Season1SubscriptionService {
  private static instance: Season1SubscriptionService;
  private subscribersCache: Map<string, Season1Subscriber> = new Map();
  private lastCacheUpdate: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): Season1SubscriptionService {
    if (!Season1SubscriptionService.instance) {
      Season1SubscriptionService.instance = new Season1SubscriptionService();
    }
    return Season1SubscriptionService.instance;
  }

  /**
   * Fetch all current Season 1 subscribers
   */
  async getSeasonSubscribers(ndk: NDK, forceRefresh = false): Promise<Season1Subscriber[]> {
    if (!forceRefresh && this.isCacheValid()) {
      return Array.from(this.subscribersCache.values());
    }

    try {
      console.log('[Season1Service] Fetching Season 1 subscription receipts...');
      
      // Query all subscription receipts for Season 1
      const filter: NDKFilter = {
        kinds: [KIND_TEAM_SUBSCRIPTION_RECEIPT],
        '#a': [REWARDS.SEASON_1.identifier],
        since: new Date(REWARDS.SEASON_1.startDate).getTime() / 1000,
        until: new Date(REWARDS.SEASON_1.endDate).getTime() / 1000,
      };

      const eventsSet = await ndk.fetchEvents(filter);
      const receiptEvents = Array.from(eventsSet);
      
      console.log('[Season1Service] Found ' + receiptEvents.length + ' subscription receipt events');

      // Process receipts to build subscriber map
      const subscriberMap = new Map<string, Season1Subscriber>();
      const now = Math.floor(Date.now() / 1000);

      for (const event of receiptEvents) {
        const receipt = event.rawEvent();
        const pubkey = receipt.pubkey;
        const amountTag = receipt.tags.find(tag => tag[0] === 'amount');
        const periodEndTag = receipt.tags.find(tag => tag[0] === 'period_end');
        const periodStartTag = receipt.tags.find(tag => tag[0] === 'period_start');

        if (!amountTag || !periodEndTag || !periodStartTag) {
          console.warn('[Season1Service] Invalid receipt event: ' + receipt.id);
          continue;
        }

        const amount = parseInt(amountTag[1]);
        const expiryDate = parseInt(periodEndTag[1]);
        const subscriptionDate = parseInt(periodStartTag[1]);
        
        // Determine tier based on amount
        let tier: Season1Tier;
        if (amount === REWARDS.SEASON_1.captainFee) {
          tier = 'captain';
        } else if (amount === REWARDS.SEASON_1.memberFee) {
          tier = 'member';
        } else {
          console.warn('[Season1Service] Unknown subscription amount: ' + amount + ' sats');
          continue;
        }

        const isActive = now <= expiryDate;
        
        // Keep the most recent/highest tier subscription for each user
        const existing = subscriberMap.get(pubkey);
        if (!existing || 
            subscriptionDate > existing.subscriptionDate || 
            (tier === 'captain' && existing.tier === 'member')) {
          subscriberMap.set(pubkey, {
            pubkey,
            tier,
            subscriptionDate,
            expiryDate,
            isActive
          });
        }
      }

      // Update cache
      this.subscribersCache = subscriberMap;
      this.lastCacheUpdate = Date.now();

      const activeSubscribers = Array.from(subscriberMap.values()).filter(s => s.isActive);
      console.log('[Season1Service] Found ' + activeSubscribers.length + ' active Season 1 subscribers');

      return Array.from(subscriberMap.values());
    } catch (error) {
      console.error('[Season1Service] Error fetching Season 1 subscribers:', error);
      return [];
    }
  }

  /**
   * Check if a specific user is a valid Season 1 subscriber
   */
  async isValidSubscriber(ndk: NDK, pubkey: string): Promise<boolean> {
    const subscribers = await this.getSeasonSubscribers(ndk);
    const subscriber = subscribers.find(s => s.pubkey === pubkey);
    return subscriber ? subscriber.isActive : false;
  }

  /**
   * Check if a specific user is a Season 1 captain
   */
  async isSeasonCaptain(ndk: NDK, pubkey: string): Promise<boolean> {
    const subscribers = await this.getSeasonSubscribers(ndk);
    const subscriber = subscribers.find(s => s.pubkey === pubkey);
    return subscriber ? (subscriber.isActive && subscriber.tier === 'captain') : false;
  }

  /**
   * Get subscription status for a specific user
   */
  async getSubscriberStatus(ndk: NDK, pubkey: string): Promise<Season1Subscriber | null> {
    const subscribers = await this.getSeasonSubscribers(ndk);
    return subscribers.find(s => s.pubkey === pubkey) || null;
  }

  /**
   * Get all active subscribers (current subscriptions only)
   */
  async getActiveSubscribers(ndk: NDK): Promise<Season1Subscriber[]> {
    const subscribers = await this.getSeasonSubscribers(ndk);
    return subscribers.filter(s => s.isActive);
  }

  /**
   * Get subscriber pubkeys as a Set for easy filtering
   */
  async getSubscriberPubkeys(ndk: NDK): Promise<Set<string>> {
    const activeSubscribers = await this.getActiveSubscribers(ndk);
    return new Set(activeSubscribers.map(s => s.pubkey));
  }

  /**
   * Get captain pubkeys as a Set
   */
  async getCaptainPubkeys(ndk: NDK): Promise<Set<string>> {
    const activeSubscribers = await this.getActiveSubscribers(ndk);
    const captains = activeSubscribers.filter(s => s.tier === 'captain');
    return new Set(captains.map(s => s.pubkey));
  }

  /**
   * Clear the cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.subscribersCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Check if the cache is still valid
   */
  private isCacheValid(): boolean {
    return (Date.now() - this.lastCacheUpdate) < this.CACHE_DURATION && this.subscribersCache.size > 0;
  }

  /**
   * Get subscription statistics
   */
  async getSubscriptionStats(ndk: NDK): Promise<{
    totalSubscribers: number;
    activeSubscribers: number;
    captains: number;
    members: number;
    totalRevenue: number;
  }> {
    const allSubscribers = await this.getSeasonSubscribers(ndk);
    const activeSubscribers = allSubscribers.filter(s => s.isActive);
    
    const captains = activeSubscribers.filter(s => s.tier === 'captain').length;
    const members = activeSubscribers.filter(s => s.tier === 'member').length;
    
    const totalRevenue = allSubscribers.reduce((total, subscriber) => {
      const amount = subscriber.tier === 'captain' ? REWARDS.SEASON_1.captainFee : REWARDS.SEASON_1.memberFee;
      return total + amount;
    }, 0);

    return {
      totalSubscribers: allSubscribers.length,
      activeSubscribers: activeSubscribers.length,
      captains,
      members,
      totalRevenue
    };
  }
}

// Export singleton instance
export const season1SubscriptionService = Season1SubscriptionService.getInstance();
