import { useCallback } from 'react';
import { payLnurl } from '../utils/lnurlPay';
import { useAuth } from './useAuth';
import { useNostr } from './useNostr';
import { REWARDS } from '../config/rewardsConfig';
import {
  fetchSubscriptionReceipts,
  prepareTeamSubscriptionReceiptEvent,
} from '../services/nostr/NostrTeamsService';
import { createAndPublishEvent } from '../utils/nostr';
import { useTeamSubscriptionStatus, SubscriptionPhase } from './useTeamSubscriptionStatus';

export type Season1Tier = 'member' | 'captain';

interface Season1SubscriptionStatus {
  phase: SubscriptionPhase;
  tier: Season1Tier | null;
  nextDue?: number; // unix seconds
  subscribe: (tier: Season1Tier) => Promise<void>;
  isProcessing: boolean;
}

/**
 * Hook to manage Season 1 subscription status for the current user.
 * Adapts existing team subscription infrastructure for Season 1.
 */
export function useSeasonSubscription(
  userPubkey: string | null
): Season1SubscriptionStatus {
  const { wallet } = useAuth();
  const { ndk } = useNostr() as any;

  // Use existing team subscription hook with Season 1 identifier
  const memberStatus = useTeamSubscriptionStatus(
    REWARDS.SEASON_1.identifier,
    userPubkey,
    REWARDS.SEASON_1.memberFee
  );

  const captainStatus = useTeamSubscriptionStatus(
    REWARDS.SEASON_1.identifier,
    userPubkey,
    REWARDS.SEASON_1.captainFee
  );

  // Determine current subscription tier and phase
  const getCurrentStatus = useCallback(() => {
    // Captain subscription takes precedence
    if (captainStatus.phase === 'current') {
      return { phase: 'current' as SubscriptionPhase, tier: 'captain' as Season1Tier, nextDue: captainStatus.nextDue };
    }
    
    // Check member subscription
    if (memberStatus.phase === 'current') {
      return { phase: 'current' as SubscriptionPhase, tier: 'member' as Season1Tier, nextDue: memberStatus.nextDue };
    }
    
    // If both are overdue, show the most recent one
    if (captainStatus.phase === 'overdue' || memberStatus.phase === 'overdue') {
      const captainDue = captainStatus.nextDue || 0;
      const memberDue = memberStatus.nextDue || 0;
      
      if (captainDue > memberDue) {
        return { phase: 'overdue' as SubscriptionPhase, tier: 'captain' as Season1Tier, nextDue: captainStatus.nextDue };
      } else if (memberDue > 0) {
        return { phase: 'overdue' as SubscriptionPhase, tier: 'member' as Season1Tier, nextDue: memberStatus.nextDue };
      }
    }
    
    // Default to no subscription
    return { phase: 'none' as SubscriptionPhase, tier: null, nextDue: undefined };
  }, [captainStatus, memberStatus]);

  const currentStatus = getCurrentStatus();

  // Subscribe function that handles both member and captain subscriptions
  const subscribe = useCallback(async (tier: Season1Tier) => {
    if (!wallet) throw new Error('Wallet not connected');
    if (!userPubkey) throw new Error('User not identified');
    
    const amount = tier === 'captain' ? REWARDS.SEASON_1.captainFee : REWARDS.SEASON_1.memberFee;
    
    try {
      // Use existing payment infrastructure
      await payLnurl({
        lightning: REWARDS.SEASON_1.rewardsPoolAddress,
        amount,
        wallet,
        comment: `RUNSTR Season 1 ${tier} subscription`,
      });
      
      // Create subscription receipt using existing pattern
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = new Date(REWARDS.SEASON_1.endDate).getTime() / 1000; // Season end time
      
      const receiptTemplate = prepareTeamSubscriptionReceiptEvent(
        REWARDS.SEASON_1.identifier,
        userPubkey,
        amount,
        startTime,
        endTime
      );
      
      if (!receiptTemplate) {
        throw new Error('Failed to prepare subscription receipt');
      }
      
      // Publish receipt event
      await createAndPublishEvent(receiptTemplate, null);
      
      console.log(`Season 1 ${tier} subscription completed successfully`);
    } catch (error) {
      console.error(`Season 1 ${tier} subscription failed:`, error);
      throw error;
    }
  }, [wallet, userPubkey]);

  // Return processing state if either subscription is processing
  const isProcessing = memberStatus.isProcessing || captainStatus.isProcessing;

  return {
    phase: currentStatus.phase,
    tier: currentStatus.tier,
    nextDue: currentStatus.nextDue,
    subscribe,
    isProcessing
  };
}

/**
 * Hook to check if a user is a valid Season 1 subscriber
 */
export function useIsSeasonSubscriber(userPubkey: string | null): boolean {
  const subscription = useSeasonSubscription(userPubkey);
  return subscription.phase === 'current';
}

/**
 * Hook to check if a user is a Season 1 captain
 */
export function useIsSeasonCaptain(userPubkey: string | null): boolean {
  const subscription = useSeasonSubscription(userPubkey);
  return subscription.phase === 'current' && subscription.tier === 'captain';
}
