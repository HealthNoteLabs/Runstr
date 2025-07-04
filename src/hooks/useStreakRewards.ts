import { useState, useEffect, useCallback } from 'react';
import {
  StreakData,
  getStreakData,
  calculateStreakReward,
  updateLastRewardedDay,
} from '../utils/streakUtils'; // Renamed import path
import rewardsPayoutService from '../services/rewardsPayoutService'; // Renamed import path
import { REWARDS } from '../config/rewardsConfig';

interface StreakRewardState {
  currentStreakDays: number;
  eligibleSats: number;
  message: string;
  isCapped: boolean;
}

interface ClaimStatus {
  claiming: boolean;
  success: boolean;
  error: string | null;
  txid?: string;
}

export interface RewardModalInfo {
  title: string;
  message: string;
  isVisible: boolean;
}

/**
 * Custom hook to manage streak rewards based on the new linear model.
 * @param {string} pubkey - User's public key for Bitcoin rewards.
 * @returns {Object} Streak rewards state and functions.
 */
export const useStreakRewards = (pubkey: string | null) => {
  const [streakData, setStreakData] = useState<StreakData>(getStreakData);
  const [rewardState, setRewardState] = useState<StreakRewardState>({
    currentStreakDays: 0,
    eligibleSats: 0,
    message: 'Loading streak data...',
    isCapped: false,
  });
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>({
    claiming: false,
    success: false,
    error: null,
  });
  const [modalInfo, setModalInfo] = useState<RewardModalInfo | null>(null);

  // Recalculate reward state when streak data changes
  useEffect(() => {
    const { amountToReward, effectiveDaysForReward, message } = calculateStreakReward(streakData);
    setRewardState({
      currentStreakDays: streakData.currentStreakDays,
      eligibleSats: amountToReward,
      message,
      isCapped: streakData.currentStreakDays >= REWARDS.STREAK.capDays && effectiveDaysForReward === streakData.lastRewardedDay,
    });
  }, [streakData]);

  /**
   * Attempts to claim the calculated eligible streak reward.
   * Triggers the payout service if eligibleSats > 0.
   */
  const triggerStreakRewardPayout = useCallback(async () => {
    const lightningAddress = localStorage.getItem('lightningAddress');
    const dest = lightningAddress || pubkey;

    if (!dest) {
      setClaimStatus({ claiming: false, success: false, error: 'Public key required.' });
      return { success: false, error: 'Public key required.' };
    }

    const { amountToReward, effectiveDaysForReward } = calculateStreakReward(streakData);

    if (amountToReward <= 0) {
      setClaimStatus({ claiming: false, success: false, error: 'No reward currently eligible to claim.' });
      return { success: false, error: 'No eligible reward.' };
    }

    setClaimStatus({ claiming: true, success: false, error: null });

    try {
      const result = await rewardsPayoutService.sendStreakReward(
        dest,
        amountToReward,
        effectiveDaysForReward,
        (localStorage.getItem('nwcConnectionString') || null)
      );

      if (result.success && result.txid) {
        // Update local state to reflect payout
        const updatedData = updateLastRewardedDay(effectiveDaysForReward);
        setStreakData(updatedData);

        setClaimStatus({
          claiming: false,
          success: true,
          error: null,
          txid: result.txid,
        });

        // Show success modal
        setModalInfo({
          title: "🎉 Streak Reward! 🎉",
          message: `Congratulations!\nYou've earned +${amountToReward} sats for reaching Day ${effectiveDaysForReward} of your streak!`,
          isVisible: true,
        });
        return { success: true, txid: result.txid, amount: amountToReward };
      } else {
        throw new Error(result.error || 'Failed to send streak reward.');
      }
    } catch (error: any) {
      console.error('Error triggering streak reward payout:', error);
      setClaimStatus({
        claiming: false,
        success: false,
        error: error.message || 'Payout failed.',
      });

      // Show failure modal or toast
      setModalInfo({
        title: " Reward Attempt Failed",
        message: `Could not send streak reward: ${error.message || 'Unknown error'}`,
        isVisible: true,
      });
      return { success: false, error: error.message };
    }
  }, [pubkey, streakData]);

  const clearModal = useCallback(() => {
    setModalInfo(null);
  }, []);

  // Expose current state and the trigger function
  // The hook now reflects the current state rather than managing milestones.
  // The `triggerStreakRewardPayout` function replaces the old `handleClaimReward`.
  // Note: A separate mechanism (e.g., daily cron/scheduler) should call this `trigger` function automatically.
  return {
    streakData,
    rewardState,
    claimStatus,
    triggerStreakRewardPayout,
    modalInfo,
    clearModal,
    // Consider adding a function to manually refresh streakData if needed:
    // refreshStreakData: () => setStreakData(getStreakData()),
  };
}; 