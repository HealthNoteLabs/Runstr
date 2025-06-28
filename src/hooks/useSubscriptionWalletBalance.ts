import { useState, useEffect, useCallback } from 'react';
import subscriptionService, { type WalletBalance } from '../services/subscriptionService';
import nwcService from '../services/nwcService.js';
import { REWARDS } from '../config/rewardsConfig';

export interface MultiWalletBalance {
  prizePool: WalletBalance;
  openSats: WalletBalance;
  appDev: WalletBalance;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to fetch and monitor all Season 1 related wallet balances
 */
export function useSubscriptionWalletBalance() {
  const [balances, setBalances] = useState<MultiWalletBalance>({
    prizePool: {
      balance: 0,
      alias: 'Loading...',
      success: false
    },
    openSats: {
      balance: 0,
      alias: 'Loading...',
      success: false
    },
    appDev: {
      balance: 0,
      alias: 'Loading...',
      success: false
    },
    isLoading: true,
    error: null
  });

  const fetchAllBalances = useCallback(async () => {
    try {
      setBalances(prev => ({ ...prev, isLoading: true, error: null }));
      
      console.log('[useSubscriptionWalletBalance] Fetching all wallet balances...');
      
      // Fetch all three wallet balances in parallel
      const [prizePoolResult, openSatsResult, appDevResult] = await Promise.all([
        // Prize Pool (existing method)
        subscriptionService.getCollectionWalletBalance(),
        // Open Sats
        nwcService.getWalletInfo(REWARDS.SEASON_1.openSatsNwcUri),
        // App Development
        nwcService.getWalletInfo(REWARDS.SEASON_1.appDevNwcUri)
      ]);

      // Process prize pool result (already in correct format)
      const prizePool = prizePoolResult;

      // Process Open Sats result
      const openSats: WalletBalance = openSatsResult.success ? {
        balance: Math.floor(openSatsResult.balance / 1000), // Convert from millisats to sats
        alias: openSatsResult.alias || 'Open Sats',
        success: true
      } : {
        balance: 0,
        alias: 'Open Sats',
        success: false,
        error: openSatsResult.error || 'Failed to fetch Open Sats balance'
      };

      // Process App Development result
      const appDev: WalletBalance = appDevResult.success ? {
        balance: Math.floor(appDevResult.balance / 1000), // Convert from millisats to sats
        alias: appDevResult.alias || 'App Development',
        success: true
      } : {
        balance: 0,
        alias: 'App Development',
        success: false,
        error: appDevResult.error || 'Failed to fetch App Development balance'
      };

      setBalances({
        prizePool,
        openSats,
        appDev,
        isLoading: false,
        error: null
      });

      console.log('[useSubscriptionWalletBalance] Successfully fetched all balances');
    } catch (err: any) {
      console.error('[useSubscriptionWalletBalance] Error fetching balances:', err);
      setBalances(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Unknown error fetching balances'
      }));
    }
  }, []);

  // Fetch balances on mount
  useEffect(() => {
    fetchAllBalances();
  }, [fetchAllBalances]);

  // Auto-refresh balances every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchAllBalances, 30000);
    return () => clearInterval(interval);
  }, [fetchAllBalances]);

  return {
    ...balances,
    refresh: fetchAllBalances
  };
} 