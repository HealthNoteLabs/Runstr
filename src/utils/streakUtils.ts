/**
 * Streak Rewards Utility
 * Manages streak state and calculations based on the new linear model.
 */
import { REWARDS } from '../config/rewardsConfig';
import rewardsPayoutService from '../services/rewardsPayoutService';

const STREAK_DATA_KEY = 'runstrStreakData';

// --- Utility Functions (Placeholders - Implement based on your app structure) ---
/**
 * Placeholder: Get the logged-in user's Nostr public key.
 * Implement this to retrieve the pubkey from your app's state or storage.
 */
const getLoggedInUserPubkey = (): string | null => {
  // Example: return localStorage.getItem('userPubkey');
  // For now, matching the old getStoredPubkey logic found commented out
  const pk = localStorage.getItem('userPubkey') || localStorage.getItem('nostrPublicKey');
  if (pk) {
    try {
      // Normalize key for modules that expect 'userPubkey'
      localStorage.setItem('userPubkey', pk);
    } catch (_) {
      // ignore quota errors 
    }
  }
  return pk;
};

/**
 * Placeholder: Get the user's Lightning Address stored in app settings.
 * Implement this to retrieve the LN address from where it's saved in your app.
 */
const getInAppLightningAddress = (): string | null => {
  return localStorage.getItem('lightningAddress'); // As used in existing code
};

export type RewardNotificationType = 'earned' | 'pending_payout' | 'success' | 'failed_retry' | 'error_final';

/**
 * Conceptual Notification System.
 * Replace with your app's actual UI notification/toast mechanism.
 * @param type Type of notification.
 * @param amount Reward amount in sats.
 * @param streakDays Current streak days.
 * @param details Optional details like TXID or error message.
 */
export const showRewardNotification = (
  type: RewardNotificationType,
  amount: number,
  streakDays: number,
  details?: string
) => {
  let message = '';
  const streakMsg = `${streakDays}-day streak`;

  switch (type) {
    case 'earned':
      message = `🎁 You've earned ${amount} sats for your ${streakMsg}! Processing payment...`;
      break;
    case 'pending_payout':
      message = `💸 Sending ${amount} sats for your ${streakMsg}...`;
      break;
    case 'success':
      message = `✅ Success! ${amount} sats sent for your ${streakMsg}.`;
      if (details) message += ` Tx: ${details.substring(0, 10)}...`; // Shortened TXID
      break;
    case 'failed_retry':
      message = `⚠️ Payment of ${amount} sats for ${streakMsg} failed. We'll try again later.`;
      if (details) message += ` Error: ${details}`; 
      break;
    case 'error_final':
      message = `❌ Critical error paying ${amount} sats for ${streakMsg}. Please check settings or contact support.`;
      if (details) message += ` Details: ${details}`;
      break;
  }

  console.log(`[Notification] ${message}`); // Basic console log

  // Android Toast (conceptual, like existing code)
  if ((window as any).Android?.showToast) {
    try {
      (window as any).Android.showToast(message);
    } catch (e) {
      console.error('[showRewardNotification] Error calling Android toast:', e);
    }
  }
  // Web Notification API (conceptual, like existing code)
  else if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification('Runstr Reward', { body: message, tag: 'runstr-reward' });
      } catch (e) {
         console.error('[showRewardNotification] Error showing Browser Notification:', e);
      }
    } else if (Notification.permission === 'default' && (type === 'earned' || type === 'success')) {
      // Only request permission for positive notifications initially
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          try {
            new Notification('Runstr Reward', { body: message, tag: 'runstr-reward' });
          } catch (e) {
             console.error('[showRewardNotification] Error showing Browser Notification post-request:', e);
          }
        }
      });
    }
  }
};

// --- End Utility Functions ---

export interface StreakData {
  currentStreakDays: number;
  lastRewardedDay: number; // The streak day number for which a reward was last given
  lastRunDate: string | null; // ISO date string of the last recorded run
}

/**
 * Get streak data from localStorage.
 * @returns {StreakData} The current streak data.
 */
export const getStreakData = (): StreakData => {
  try {
    const storedData = localStorage.getItem(STREAK_DATA_KEY);
    if (storedData) {
      return JSON.parse(storedData);
    }
  } catch (err) {
    console.error('Error loading streak data:', err);
  }
  // Default initial state
  return { currentStreakDays: 0, lastRewardedDay: 0, lastRunDate: null };
};

/**
 * Save streak data to localStorage.
 * @param {StreakData} data - The streak data to save.
 * @returns {boolean} Success status.
 */
export const saveStreakData = (data: StreakData): boolean => {
  try {
    localStorage.setItem(STREAK_DATA_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('Error saving streak data:', err);
    return false;
  }
};

/**
 * Updates the user's streak based on a new run.
 * This should be called after a new run is successfully recorded.
 * All date comparisons are done in the user's local time zone.
 * @param {Date} newRunDateObject - The Date object of the new run (in user's local time).
 * @returns {StreakData} The updated streak data.
 */
export const updateUserStreak = (newRunDateObject: Date): StreakData => {
  const data = getStreakData();

  const newRunUTCDateString = newRunDateObject.toISOString().split('T')[0];

  if (data.lastRunDate === newRunUTCDateString) {
    return data;
  }

  let updatedStreakDays = data.currentStreakDays;

  if (data.lastRunDate) {
    const lastRunEpoch = new Date(data.lastRunDate + 'T00:00:00Z').getTime();
    const currentRunEpoch = new Date(newRunUTCDateString + 'T00:00:00Z').getTime();
    const diffDays = Math.round((currentRunEpoch - lastRunEpoch) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      updatedStreakDays++;
    } else if (diffDays > 1) {
      updatedStreakDays = 1;
    } else if (diffDays <= 0) {
      updatedStreakDays = 1;
    }
  } else {
    updatedStreakDays = 1;
  }

  const newData: StreakData = {
    ...data,
    currentStreakDays: updatedStreakDays,
    lastRunDate: newRunUTCDateString,
  };

  saveStreakData(newData);

  // --- Immediate Reward Processing and Notification ---
  const rewardInfo = calculateStreakReward(newData);

  if (rewardInfo.amountToReward > 0) {
    showRewardNotification('earned', rewardInfo.amountToReward, newData.currentStreakDays);

    const userPubkey = getLoggedInUserPubkey();
    const inAppLnAddress = getInAppLightningAddress();

    if (!userPubkey) {
      console.warn('[StreakUtils] updateUserStreak: User pubkey not found. Cannot attempt reward payout.');
      // Potentially show a specific notification if userPubkey is absolutely required for any fallback
      showRewardNotification('error_final', rewardInfo.amountToReward, newData.currentStreakDays, 'User public key not available.');
      return newData; // Or handle as appropriate
    }
    
    // Notify user that payout is being attempted
    showRewardNotification('pending_payout', rewardInfo.amountToReward, newData.currentStreakDays);

    rewardsPayoutService.sendStreakReward(
      userPubkey, 
      rewardInfo.amountToReward, 
      rewardInfo.effectiveDaysForReward, 
      inAppLnAddress // Pass the in-app LN address
    ).then((payoutResult) => {
      if (payoutResult.success) {
        updateLastRewardedDay(rewardInfo.effectiveDaysForReward);
        showRewardNotification('success', rewardInfo.amountToReward, newData.currentStreakDays, payoutResult.txid);
      } else {
        // Notify about failure, scheduler will retry
        showRewardNotification('failed_retry', rewardInfo.amountToReward, newData.currentStreakDays, payoutResult.error);
        console.warn('[StreakUtils] updateUserStreak: Immediate payout failed. Error:', payoutResult.error, 'Scheduler will attempt retry.');
      }
    }).catch((error) => {
      // This catch is for unexpected errors in the sendStreakReward promise chain itself
      showRewardNotification('error_final', rewardInfo.amountToReward, newData.currentStreakDays, error.message || 'Unknown error during payout attempt.');
      console.error('[StreakUtils] updateUserStreak: Critical error during sendStreakReward call:', error);
    });
  } else {
    // console.log('[StreakUtils] updateUserStreak: No reward amount due.');
    // Optionally, notify if streak continues but no reward (e.g., cap reached and already paid)
    // if (newData.currentStreakDays > 0 && rewardInfo.message) {
    //   showNonRewardStreakNotification(newData.currentStreakDays, rewardInfo.message);
    // }
  }
  return newData;
};

/**
 * Calculates the reward amount for the current streak status.
 * Does NOT trigger a payout, only calculates.
 * @param {StreakData} streakData - The current streak data for the user.
 * @returns {{ amountToReward: number, effectiveDaysForReward: number, message: string }}
 */
export const calculateStreakReward = (streakData: StreakData): { amountToReward: number, effectiveDaysForReward: number, message: string } => {
  const { currentStreakDays, lastRewardedDay } = streakData;
  const { satsPerDay, capDays } = REWARDS.STREAK;

  if (currentStreakDays === 0) {
    return { amountToReward: 0, effectiveDaysForReward: 0, message: 'No current streak.' };
  }

  // Effective days for reward calculation is capped.
  const effectiveDaysForReward = Math.min(currentStreakDays, capDays);

  // We only reward for days *beyond* the last day we gave a reward for,
  // up to the current effective (capped) streak.
  // Example: lastRewardedDay = 2, currentStreakDays = 4 (effectiveDaysForReward = 4)
  //         Reward for day 3 and day 4. (4 - 2) * satsPerDay = 2 * 50 = 100
  // Example: lastRewardedDay = 0, currentStreakDays = 1 (effectiveDaysForReward = 1)
  //         Reward for day 1. (1 - 0) * satsPerDay = 1 * 50 = 50
  // Example: lastRewardedDay = 7, currentStreakDays = 8 (effectiveDaysForReward = 7)
  //         No new reward, already at cap. (7 - 7) * satsPerDay = 0
  let daysToRewardIncrement = 0;
  if (effectiveDaysForReward > lastRewardedDay) {
      daysToRewardIncrement = effectiveDaysForReward - lastRewardedDay;
  }

  const amountToReward = daysToRewardIncrement * satsPerDay;

  let message = '';
  if (amountToReward > 0) {
      message = `Eligible for ${amountToReward} sats for reaching ${effectiveDaysForReward}-day streak (rewarded for ${daysToRewardIncrement} new day(s)).`;
  } else if (currentStreakDays > 0 && effectiveDaysForReward === lastRewardedDay && effectiveDaysForReward === capDays) {
      message = `Streak at ${currentStreakDays} days (max reward cap of ${capDays} days reached, last rewarded for day ${lastRewardedDay}).`;
  } else if (currentStreakDays > 0 && effectiveDaysForReward <= lastRewardedDay) {
      message = `Current streak: ${currentStreakDays} days. Last rewarded for day ${lastRewardedDay}. No new increment to reward.`;
  } else {
      message = `Current streak: ${currentStreakDays} days.`;
  }

  return { amountToReward, effectiveDaysForReward, message };
};

/**
 * Updates the lastRewardedDay after a successful payout.
 * @param {number} rewardedDayNum - The streak day number that was just successfully rewarded.
 * @returns {StreakData} The updated streak data.
 */
export const updateLastRewardedDay = (rewardedDayNum: number): StreakData => {
  const data = getStreakData();
  const newData: StreakData = {
    ...data,
    lastRewardedDay: Math.max(data.lastRewardedDay, rewardedDayNum)
  };
  saveStreakData(newData);
  return newData;
};

/**
 * Resets all streak data. Called if user account is reset or for debugging.
 */
export const resetStreakDataCompletely = (): StreakData => {
    const initialData: StreakData = { currentStreakDays: 0, lastRewardedDay: 0, lastRunDate: null };
    saveStreakData(initialData);
    return initialData;
}

// NOTE: The old functions like getStreakRewards, saveStreakRewards, getEligibleRewards,
// claimReward (local marking), updateRewardTransaction, getClaimedRewardsHistory,
// resetRewardsForNewStreak, checkAndResetRewards, getNextMilestone,
// getRewardsSettings, saveRewardsSettings ARE NO LONGER VALID with the new linear model.
// They are effectively replaced by the functions above and the logic in useStreakRewards.ts hook.
// This file will be renamed to streakUtils.ts or similar to reflect its new purpose.

// ------------- NEW HELPER -----------------
/**
 * Sync streak state coming from an external calculation (e.g. Stats page).
 * If this raises the streak beyond lastRewardedDay, the required sats are
 * automatically paid out.
 * @param {number} externalStreakDays - Current streak length calculated elsewhere.
 */
export const syncStreakWithStats = async (externalStreakDays: number, publicKey: string | null): Promise<StreakData> => {
  const data = getStreakData();
  if (externalStreakDays <= 0) {
    return data;
  }
  const merged: StreakData = {
    ...data,
    currentStreakDays: externalStreakDays,
  };
  saveStreakData(merged);

  // Determine if a payout is needed (also enforces capDays)
  const { amountToReward, effectiveDaysForReward } = calculateStreakReward(merged);
  if (amountToReward > 0) {
    const lightningAddress = localStorage.getItem('lightningAddress');
    if (!lightningAddress) {
      console.warn('[StreakRewards] Lightning address not set – cannot pay reward. Ask user to add it in Settings > Wallet.');
    }
    const dest = lightningAddress || publicKey;

    if (dest) {
      try {
        const result = await rewardsPayoutService.sendStreakReward(dest, amountToReward, effectiveDaysForReward, (localStorage.getItem('nwcConnectionString') || null));
        if (result.success) {
          updateLastRewardedDay(effectiveDaysForReward);
          // Notify user
          const successMsg = `🎉 Streak reward sent: ${amountToReward} sats for day ${effectiveDaysForReward}!`;
          if ((window as any).Android?.showToast) {
            (window as any).Android.showToast(successMsg);
          } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('Runstr Reward', { body: successMsg });
          } else {
            console.log(successMsg);
          }
        } else {
          // Most NWC wallets return the payment result encrypted; if decryption fails
          // we may still have paid.  We log the error for developers but avoid alarming
          // the runner – the optimistic toast was already shown.
          console.warn('[StreakRewards] Payout may have succeeded but response decode failed:', result.error);
        }
      } catch (err) {
        console.warn('[StreakRewards] Payout flow threw, but payment likely already sent:', err);
      }
    } else {
      console.warn('[StreakRewards] Cannot auto-pay reward – pubkey not set.');
    }
  }
  return getStreakData();
};
// ------------- END NEW HELPER -------------

/* 
  The getStoredPubkey function was previously defined here.
  It is no longer used by updateUserStreak or syncStreakWithStats directly through this path.
  It is commented out for now and can be removed if confirmed unused elsewhere.

  const getStoredPubkey = (): string | null => {
    const pk = localStorage.getItem('userPubkey') || localStorage.getItem('nostrPublicKey');
    if (pk) {
      try {
        localStorage.setItem('userPubkey', pk); // normalise key for modules that expect it
      } catch (_) {
        // ignore quota errors 
      }
    }
    return pk;
  };
*/ 