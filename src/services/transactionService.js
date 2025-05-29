/**
 * Transaction Service
 * Manages Bitcoin transaction history and persistence
 */

import nwcService from './nwcService.js';
import { fetchLnAddressFromProfile } from '../utils/lnAddressResolver';

// Transaction types
export const TRANSACTION_TYPES = {
  STREAK_REWARD: 'streak_reward',
  LEADERBOARD_REWARD: 'leaderboard_reward',
  MANUAL_WITHDRAWAL: 'manual_withdrawal',
  DEPOSIT: 'deposit'
};

// Transaction statuses
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Get all saved transactions from local storage
 * @returns {Array} List of transactions
 */
const getStoredTransactions = () => {
  try {
    const storedData = localStorage.getItem('bitcoinTransactions');
    if (!storedData) return [];
    return JSON.parse(storedData);
  } catch (error) {
    console.error('Error loading transaction history:', error);
    return [];
  }
};

/**
 * Save transactions to local storage
 * @param {Array} transactions - List of transactions to save
 */
const saveTransactions = (transactions) => {
  try {
    localStorage.setItem('bitcoinTransactions', JSON.stringify(transactions));
    return true;
  } catch (error) {
    console.error('Error saving transaction history:', error);
    return false;
  }
};

// Make resolveDestination an async, module-scoped helper
const resolveDestination = async (key) => {
  if (!key) return key;

  // Check if key is already a Lightning Address or LNURL
  if (key.includes('@') || key.startsWith('lnurl') || key.startsWith('lightning:') || key.startsWith('lnbc')) {
    return key.replace(/^lightning:/, '');
  }

  // Use a pubkey-specific cache key
  const cacheKey = `resolved_ln_addr_${key}`;

  // Check local cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      // console.log(`[TransactionService] Using cached LN address for ${key}:`, cached);
      return cached;
    }
  } catch (_) {
    // Ignore localStorage errors
  }

  // If it looks like a pubkey (hex or npub) and not an LN address, try to fetch from Nostr profile
  // (fetchLnAddressFromProfile handles npub decoding and hex validation)
  // console.log(`[TransactionService] Attempting to fetch LN address for potential pubkey: ${key}`);
  const lnAddressFromProfile = await fetchLnAddressFromProfile(key);

  if (lnAddressFromProfile) {
    // console.log(`[TransactionService] Found LN address for ${key} from profile: ${lnAddressFromProfile}.`);
    try {
      localStorage.setItem(cacheKey, lnAddressFromProfile);
      // console.log(`[TransactionService] Cached resolved LN address for ${key}.`);
    } catch (cacheErr) {
      console.error(`[TransactionService] Error caching fetched LN address for ${key}:`, cacheErr);
    }
    return lnAddressFromProfile;
  }

  // console.warn(`[TransactionService] Could not resolve LN address for ${key} from profile. Returning original key.`);
  return key; // Return original key if still not resolved (will likely fail NWC payment)
};

/**
 * Transaction Service
 */
const transactionService = {
  /**
   * Record a new transaction
   * @param {Object} transaction - Transaction details
   * @returns {Object} Transaction with assigned ID
   */
  recordTransaction: (transaction) => {
    // Validate required fields
    if (!transaction.type || !transaction.amount || !transaction.recipient) {
      throw new Error('Missing required transaction fields');
    }

    // Prepare transaction object
    const newTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      status: transaction.status || TRANSACTION_STATUS.PENDING,
      ...transaction
    };

    // Add to storage
    const transactions = getStoredTransactions();
    transactions.unshift(newTransaction);
    saveTransactions(transactions);
    
    // Dispatch event to notify updates
    // Ensure this runs only in browser environment
    if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('bitcoinTransactionAdded', { 
            detail: { transaction: newTransaction }
        }));
    }
    
    return newTransaction;
  },
  
  /**
   * Update an existing transaction
   * @param {string} transactionId - Transaction ID to update
   * @param {Object} updates - Fields to update
   * @returns {Object|null} Updated transaction or null if not found
   */
  updateTransaction: (transactionId, updates) => {
    const transactions = getStoredTransactions();
    const index = transactions.findIndex(tx => tx.id === transactionId);
    
    if (index === -1) return null;
    
    // Update transaction
    transactions[index] = {
      ...transactions[index],
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    
    saveTransactions(transactions);
    
    // Dispatch event - Ensure this runs only in browser environment
    if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('bitcoinTransactionUpdated', { 
          detail: { transaction: transactions[index] }
        }));
    }
    
    return transactions[index];
  },
  
  /**
   * Get all transactions
   * @param {Object} filters - Optional filters (type, status, etc.)
   * @returns {Array} Filtered transactions
   */
  getTransactions: (filters = {}) => {
    const transactions = getStoredTransactions();
    
    if (Object.keys(filters).length === 0) {
      return transactions;
    }
    
    return transactions.filter(tx => {
      return Object.entries(filters).every(([key, value]) => {
        if (Array.isArray(value)) {
          return value.includes(tx[key]);
        }
        return tx[key] === value;
      });
    });
  },
  
  /**
   * Get transactions for a specific user
   * @param {string} pubkey - User's public key
   * @returns {Array} User's transactions
   */
  getUserTransactions: (pubkey) => {
    if (!pubkey) return [];
    
    const transactions = getStoredTransactions();
    return transactions.filter(tx => 
      tx.pubkey === pubkey || tx.recipient === pubkey
    );
  },
  
  /**
   * Process a streak reward transaction
   * @param {string} pubkey - User's public key
   * @param {number} amount - Reward amount in satoshis
   * @param {string} reason - Reward reason (e.g. "7-day streak")
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Transaction result
   */
  processStreakReward: async (pubkey, amount, reason, metadata = {}) => {
    const destination = await resolveDestination(pubkey); // Now async

    // Determine if the destination was resolved from a pubkey or was originally an LN Address/etc.
    // This is a bit heuristic: if resolveDestination returns something different than the input pubkey,
    // and the input pubkey didn't look like an LN Address itself, it was likely resolved.
    const wasResolved = destination !== pubkey && !(pubkey.includes('@') || pubkey.startsWith('lnurl') || pubkey.startsWith('lightning:') || pubkey.startsWith('lnbc'));

    try {
      const transaction = transactionService.recordTransaction({
        type: TRANSACTION_TYPES.STREAK_REWARD,
        amount,
        recipient: destination,
        reason,
        pubkey: destination, // Using resolved destination here too
        metadata
      });
      
      const result = await nwcService.payLightningAddress(
        destination,
        amount,
        reason
      );
      
      if (result.success) {
        transactionService.updateTransaction(transaction.id, {
          status: TRANSACTION_STATUS.COMPLETED,
          rail: 'nwc',
          preimage: result.result?.preimage || null
        });
        return { success: true, transaction: { ...transaction, rail: 'nwc', status: TRANSACTION_STATUS.COMPLETED } };
      } else {
        transactionService.updateTransaction(transaction.id, {
          status: TRANSACTION_STATUS.FAILED,
          error: result.error
        });
        // If payment failed and the destination was a resolved LN address, clear its cache
        if (wasResolved) {
          const cacheKey = `resolved_ln_addr_${pubkey}`; // Use the original pubkey for cache clearing
          try {
            localStorage.removeItem(cacheKey);
            console.log(`[TransactionService] Cleared cached LN address for ${pubkey} due to payment failure.`);
          } catch (e) {
            console.error(`[TransactionService] Error clearing cached LN address for ${pubkey}:`, e);
          }
        }
        return { success: false, error: result.error, transaction };
      }
    } catch (error) {
      console.error('Error processing streak reward:', error);
      return { success: false, error: error.message || 'Unknown error', transaction: null };
    }
  },
  
  /**
   * Sync with Bitvora for latest transaction status
   * @param {string} transactionId - Local transaction ID
   * @returns {Promise<Object>} Updated transaction status
   */
  syncTransactionStatus: async () => ({
    success: false,
    error: 'Sync not supported – Bitvora rail removed'
  }),
  
  /**
   * Sync all pending transactions with Bitvora
   * @returns {Promise<Object>} Sync results
   */
  syncAllPendingTransactions: async () => ({
    success: false,
    error: 'Sync not supported – Bitvora rail removed'
  }),
  
  /**
   * Generic reward processor (used by TypeScript services)
   * @param {string} pubkey - User's destination lightning address
   * @param {number} amount - Amount in sats
   * @param {string} type - One of TRANSACTION_TYPES values
   * @param {string} reason - Human-readable reason (e.g. "2-day streak reward")
   * @param {Object} metadata - Extra fields recorded with the tx
   */
  processReward: async (pubkey, amount, type, reason, metadata = {}) => {
    // Resolve destination ONCE here, before specific reward processing
    const destination = await resolveDestination(pubkey);
    const wasResolved = destination !== pubkey && !(pubkey.includes('@') || pubkey.startsWith('lnurl') || pubkey.startsWith('lightning:') || pubkey.startsWith('lnbc'));

    if (type === TRANSACTION_TYPES.STREAK_REWARD) {
      // For processStreakReward, we need to pass the original pubkey for potential cache clearing,
      // and the (potentially resolved) destination.
      // processStreakReward itself will call resolveDestination again, which is slightly redundant
      // but ensures its internal logic for cache clearing (if we add it there too or keep it there) uses the correct original pubkey.
      // A cleaner way would be to have processStreakReward accept both originalKey and resolvedDestination.

      // Let's modify processStreakReward to accept originalKey and resolvedDestination to avoid re-resolving.
      // For now, to keep the edit focused, we'll stick to the original plan of modifying processStreakReward directly.
      // The change in processStreakReward to clear cache on failure is the primary goal here.

      // Current call:
      // return transactionService.processStreakReward(destination, amount, reason, metadata);
      // This is problematic if 'destination' is already resolved and processStreakReward calls resolveDestination(destination_which_is_already_an_LN_address)
      // The cache clearing logic inside processStreakReward needs the *original pubkey*.

      // Let's assume processStreakReward is correctly modified as per the diff above this section.
      // So, we should pass the original `pubkey` to `processStreakReward` so it can use it for cache clearing.
      // And `processStreakReward` will internally call `resolveDestination(pubkey)`.

      return transactionService.processStreakReward(pubkey, amount, reason, metadata);
    }
    
    // Handle other reward types if they become supported
    // For other reward types, if they also go through a similar payment mechanism that might benefit from cache clearing:
    if (type !== TRANSACTION_TYPES.STREAK_REWARD) { // Placeholder for other types
        // This is a generic path, may need more specific handling if other reward types are added
        // For now, this path doesn't have the explicit cache-clearing logic on failure.
        // If we want to add it, we'd need a similar structure to processStreakReward
        // or make processReward more generic in handling cache for failures.
        console.warn(`[TransactionService] Processing generic reward type '${type}'. Cache clearing on failure is not explicitly implemented for this path.`);
        // Fallback to a generic NWC payment attempt if not STREAK_REWARD
        try {
            const transaction = transactionService.recordTransaction({
                type: type,
                amount,
                recipient: destination, // Use the resolved destination
                reason,
                pubkey: pubkey, // Store original pubkey
                metadata,
                status: TRANSACTION_STATUS.PENDING
            });

            const result = await nwcService.payLightningAddress(
                destination,
                amount,
                reason
            );

            if (result.success) {
                transactionService.updateTransaction(transaction.id, {
                    status: TRANSACTION_STATUS.COMPLETED,
                    rail: 'nwc',
                    preimage: result.result?.preimage || null
                });
                return { success: true, transaction: { ...transaction, rail: 'nwc', status: TRANSACTION_STATUS.COMPLETED } };
            } else {
                transactionService.updateTransaction(transaction.id, {
                    status: TRANSACTION_STATUS.FAILED,
                    error: result.error
                });
                 // If payment failed and the destination was a resolved LN address, clear its cache
                if (wasResolved) { // `wasResolved` is correctly defined based on the initial pubkey and final destination
                    const cacheKey = `resolved_ln_addr_${pubkey}`; // Use the original pubkey
                    try {
                        localStorage.removeItem(cacheKey);
                        console.log(`[TransactionService] Cleared cached LN address for ${pubkey} (in generic processReward) due to payment failure.`);
                    } catch (e) {
                        console.error(`[TransactionService] Error clearing cached LN address for ${pubkey} (in generic processReward):`, e);
                    }
                }
                return { success: false, error: result.error, transaction };
            }
        } catch (error) {
            console.error(`Error processing generic reward type '${type}':`, error);
            return { success: false, error: error.message || 'Unknown error during generic reward processing', transaction: null };
        }
    }

    console.warn(`[TransactionService] Reward type '${type}' not fully supported for advanced processing beyond STREAK_REWARD.`);
    return {
      success: false,
      error: `Reward type '${type}' not fully supported in this build for advanced processing.`
    };
  }
};

export default transactionService; 