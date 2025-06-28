import { useCallback, useState, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useNostr } from './useNostr';
import { REWARDS } from '../config/rewardsConfig';
import {
  fetchSubscriptionReceipts,
  prepareTeamSubscriptionReceiptEvent,
} from '../services/nostr/NostrTeamsService';
import { createAndPublishEvent } from '../utils/nostr';
import { useTeamSubscriptionStatus, SubscriptionPhase } from './useTeamSubscriptionStatus';
import subscriptionService, { type Season1Tier, type SubscriptionInvoice } from '../services/subscriptionService';

interface Season1SubscriptionStatus {
  phase: SubscriptionPhase;
  tier: Season1Tier | null;
  nextDue?: number; // unix seconds
  subscribe: (tier: Season1Tier) => Promise<SubscriptionInvoice>;
  finalizePayment: (invoice: string, tier: Season1Tier) => Promise<void>;
  isProcessing: boolean;
  currentInvoice?: SubscriptionInvoice;
  paymentStatus: 'none' | 'pending' | 'polling' | 'paid' | 'expired' | 'error';
  statusMessage?: string;
}

/**
 * Hook to manage Season 1 subscription status for the current user.
 * Uses NWC invoice generation for subscription collection.
 */
export function useSeasonSubscription(
  userPubkey: string | null
): Season1SubscriptionStatus {
  const { wallet } = useAuth();
  const { ndk } = useNostr() as any;
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<SubscriptionInvoice | undefined>();
  const [paymentStatus, setPaymentStatus] = useState<'none' | 'pending' | 'polling' | 'paid' | 'expired' | 'error'>('none');
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  
  // Refs for polling management
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const expirationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Clean up polling on unmount or when payment completes
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (expirationTimeoutRef.current) {
      clearTimeout(expirationTimeoutRef.current);
      expirationTimeoutRef.current = null;
    }
  }, []);

  // Start automatic payment polling
  const startPaymentPolling = useCallback((invoice: SubscriptionInvoice) => {
    stopPolling(); // Clear any existing polling
    
    setPaymentStatus('polling');
    setStatusMessage('Checking for payment...');
    
    // Set up expiration timeout
    const timeUntilExpiration = (invoice.expires * 1000) - Date.now();
    if (timeUntilExpiration > 0) {
      expirationTimeoutRef.current = setTimeout(() => {
        stopPolling();
        setPaymentStatus('expired');
        setStatusMessage('Invoice expired. Please try again.');
        setCurrentInvoice(undefined);
      }, timeUntilExpiration);
    }
    
    // Poll every 5 seconds
    pollingIntervalRef.current = setInterval(async () => {
      try {
        console.log('[useSeasonSubscription] Polling for payment...');
        
        const verificationResult = await subscriptionService.verifySubscriptionPayment(
          invoice.invoice,
          userPubkey!,
          invoice.tier
        );
        
        if (verificationResult.success) {
          console.log('[useSeasonSubscription] Payment detected! Completing subscription...');
          stopPolling();
          setPaymentStatus('paid');
          setStatusMessage('Payment received! Completing subscription...');
          
          // Complete the subscription
          const completionResult = await subscriptionService.completeSubscription(
            userPubkey!,
            invoice.tier,
            invoice.amount
          );
          
          if (completionResult.success) {
            setPaymentStatus('none');
            setStatusMessage('Subscription completed successfully!');
            setCurrentInvoice(undefined);
            
            // Refresh subscription status
            memberStatus.renew?.();
            captainStatus.renew?.();
            
            // Clear success message after 5 seconds
            setTimeout(() => setStatusMessage(undefined), 5000);
          } else {
            setPaymentStatus('error');
            setStatusMessage(`Failed to complete subscription: ${completionResult.error}`);
          }
        }
      } catch (error) {
        console.error('[useSeasonSubscription] Error during payment polling:', error);
        // Don't stop polling on individual errors, just log them
      }
    }, 5000); // Poll every 5 seconds
    
  }, [userPubkey, memberStatus, captainStatus, stopPolling]);

  // Clean up on unmount
  useEffect(() => {
    return stopPolling;
  }, [stopPolling]);

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

  // Generate invoice for subscription - now automatically starts polling
  const subscribe = useCallback(async (tier: Season1Tier): Promise<SubscriptionInvoice> => {
    if (!userPubkey) throw new Error('User not identified');
    
    setIsProcessing(true);
    setPaymentStatus('pending');
    setStatusMessage('Generating invoice...');
    
    try {
      console.log(`[useSeasonSubscription] Generating ${tier} subscription invoice`);
      
      const result = await subscriptionService.processSubscription(userPubkey, tier);
      
      if (!result.success || !result.invoice) {
        throw new Error(result.error || 'Failed to generate subscription invoice');
      }
      
      setCurrentInvoice(result.invoice);
      setStatusMessage('Invoice generated! Please pay with your wallet.');
      console.log(`[useSeasonSubscription] Successfully generated ${tier} subscription invoice`);
      
      // Start automatic payment polling
      startPaymentPolling(result.invoice);
      
      return result.invoice;
    } catch (error) {
      console.error(`[useSeasonSubscription] Failed to generate ${tier} subscription invoice:`, error);
      setPaymentStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Failed to generate invoice');
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [userPubkey, startPaymentPolling]);

  // Manual finalization (kept for backward compatibility, but now rarely needed)
  const finalizePayment = useCallback(async (invoice: string, tier: Season1Tier): Promise<void> => {
    if (!userPubkey) throw new Error('User not identified');
    
    setIsProcessing(true);
    setStatusMessage('Verifying payment...');
    
    try {
      console.log(`[useSeasonSubscription] Manually finalizing ${tier} subscription payment`);
      
      const amount = tier === 'captain' ? REWARDS.SEASON_1.captainFee : REWARDS.SEASON_1.memberFee;
      
      const result = await subscriptionService.finalizeSubscription(
        invoice,
        userPubkey,
        tier,
        amount
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to finalize subscription');
      }
      
      stopPolling(); // Stop any ongoing polling
      setCurrentInvoice(undefined);
      setPaymentStatus('none');
      setStatusMessage('Subscription completed successfully!');
      console.log(`[useSeasonSubscription] Successfully finalized ${tier} subscription`);
      
      // Refresh subscription status
      memberStatus.renew?.();
      captainStatus.renew?.();
      
      // Clear success message after 5 seconds
      setTimeout(() => setStatusMessage(undefined), 5000);
      
    } catch (error) {
      console.error(`[useSeasonSubscription] Failed to finalize ${tier} subscription:`, error);
      setPaymentStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Failed to complete subscription');
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [userPubkey, memberStatus, captainStatus, stopPolling]);

  return {
    phase: currentStatus.phase,
    tier: currentStatus.tier,
    nextDue: currentStatus.nextDue,
    subscribe,
    finalizePayment,
    isProcessing,
    currentInvoice,
    paymentStatus,
    statusMessage
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
