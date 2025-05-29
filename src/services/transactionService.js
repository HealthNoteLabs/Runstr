/**
 * Transaction Service
 * Manages Bitcoin transaction history and persistence
 */

import nwcService from './nwcService.js';
import { fetchLnAddressesFromProfile } from '../utils/lnAddressResolver';

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
// Now returns Promise<string[]>
const resolveDestination = async (key) => {
  if (!key) return [];

  // Check if key is already a Lightning Address or LNURL - return as single-item array
  if (key.includes('@') || key.startsWith('lnurl') || key.startsWith('lightning:') || key.startsWith('lnbc')) {
    return [key.replace(/^lightning:/, '')];
  }

  // Use a pubkey-specific cache key for an array of addresses
  const cacheKey = `resolved_ln_addrs_array_${key}`;

  // Check local cache
  try {
    const cachedRaw = localStorage.getItem(cacheKey);
    if (cachedRaw) {
      const cachedArray = JSON.parse(cachedRaw);
      if (Array.isArray(cachedArray) && cachedArray.length > 0) {
        // console.log(`[TransactionService] Using cached LN addresses for ${key}:`, cachedArray);
        return cachedArray;
      }
    }
  } catch (_) {
    // Ignore localStorage errors or parsing errors
  }

  // If it looks like a pubkey (hex or npub) and not an LN address, try to fetch from Nostr profile
  // console.log(`[TransactionService] Attempting to fetch LN addresses for potential pubkey: ${key}`);
  
  // This function now needs to return an array of strings Promise<string[]>
  const lnAddressesFromProfile = await fetchLnAddressesFromProfile(key); 

  if (lnAddressesFromProfile && lnAddressesFromProfile.length > 0) {
    // console.log(`[TransactionService] Found LN addresses for ${key} from profile: ${lnAddressesFromProfile}.`);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(lnAddressesFromProfile));
      // console.log(`[TransactionService] Cached resolved LN addresses for ${key}.`);
    } catch (cacheErr) {
      console.error(`[TransactionService] Error caching fetched LN addresses for ${key}:`, cacheErr);
    }
    return lnAddressesFromProfile;
  }

  // console.warn(`[TransactionService] Could not resolve LN addresses for ${key} from profile.`);
  // If no addresses found from profile, and key itself is not an LN address, return empty array.
  // Or, decide if 'key' itself should be attempted if it's a pubkey (might be a direct NWC target in some setups)
  // For now, returning empty if no explicit LN addresses are found for a pubkey.
  return []; 
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
    const destinations = await resolveDestination(pubkey);

    if (!destinations || destinations.length === 0) {
      console.warn(`[TransactionService] No destinations found for pubkey ${pubkey}. Cannot process streak reward.`);
      // Record a failed transaction attempt immediately if no destinations
      const errorMsg = 'No valid Lightning Address or NWC target found for user.';
      try {
          transactionService.recordTransaction({
            type: TRANSACTION_TYPES.STREAK_REWARD,
            amount,
            recipient: pubkey, // original pubkey
            reason,
            pubkey,
            metadata,
            status: TRANSACTION_STATUS.FAILED,
            error: errorMsg,
            attemptedDestinations: []
          });
      } catch(e){ console.error("Error recording initial failure transaction", e)}
      return { success: false, error: errorMsg, transaction: null };
    }

    let lastError = 'All payment attempts failed.';
    let finalTransactionState = null;
    let paymentSuccess = false;
    
    // Record one main transaction, update its status and attempts.
    // The first destination can be used for initial recording.
    const initialTransaction = transactionService.recordTransaction({
        type: TRANSACTION_TYPES.STREAK_REWARD,
        amount,
        recipient: destinations[0], // Initial recipient for record
        reason,
        pubkey, // original pubkey
        metadata,
        status: TRANSACTION_STATUS.PENDING, // Starts as pending
        attemptedDestinations: []
    });
    if (!initialTransaction) {
        return { success: false, error: "Failed to record initial transaction", transaction: null };
    }

    const attemptedDestinationsLog = [];

    for (let i = 0; i < destinations.length; i++) {
      const destination = destinations[i];
      // console.log(`[TransactionService] Attempting streak reward to ${destination} (${i+1}/${destinations.length}) for ${pubkey}`);
      
      // Update the main transaction's recipient if trying a new one & it differs from current record
      if (initialTransaction.recipient !== destination) {
          transactionService.updateTransaction(initialTransaction.id, { recipient: destination });
      }

      const result = await nwcService.payLightningAddress(
        destination,
        amount,
        reason
      );
      
      attemptedDestinationsLog.push({ destination, success: result.success, error: result.error, result: result.result });

      if (result.success) {
        finalTransactionState = transactionService.updateTransaction(initialTransaction.id, {
          status: TRANSACTION_STATUS.COMPLETED,
          rail: 'nwc',
          preimage: result.result?.preimage || null,
          recipient: destination, // Ensure final recipient is the successful one
          error: null, // Clear any previous error
          attemptedDestinations: attemptedDestinationsLog
        });
        paymentSuccess = true;
        // console.log(`[TransactionService] Streak reward success to ${destination} for ${pubkey}.`);
        break; // Exit loop on success
      } else {
        lastError = result.error || 'Unknown NWC payment error.';
        // console.warn(`[TransactionService] Failed attempt to ${destination} for ${pubkey}: ${lastError}`);
        transactionService.updateTransaction(initialTransaction.id, {
          status: TRANSACTION_STATUS.PENDING, // Still pending if not last attempt
          error: `Attempt ${i+1} to ${destination} failed: ${lastError}`, // Log current attempt error
          attemptedDestinations: attemptedDestinationsLog
        });
      }
    }

    if (paymentSuccess) {
      return { success: true, transaction: finalTransactionState };
    } else {
      // All attempts failed
      finalTransactionState = transactionService.updateTransaction(initialTransaction.id, {
        status: TRANSACTION_STATUS.FAILED,
        error: `All ${destinations.length} payment attempts failed. Last error: ${lastError}`,
        attemptedDestinations: attemptedDestinationsLog
      });

      // Clear cache if destinations were resolved from a pubkey (i.e., original pubkey was not an LN address itself)
      const wasResolvedFromPubkey = !(pubkey.includes('@') || pubkey.startsWith('lnurl') || pubkey.startsWith('lightning:') || pubkey.startsWith('lnbc'));
      if (wasResolvedFromPubkey && destinations.length > 0) { // Check destinations.length to ensure it was a profile lookup
        const cacheKey = `resolved_ln_addrs_array_${pubkey}`;
        try {
          localStorage.removeItem(cacheKey);
          // console.log(`[TransactionService] Cleared cached LN addresses array for ${pubkey} due to all payment attempts failing.`);
        } catch (e) {
          console.error(`[TransactionService] Error clearing cached LN addresses array for ${pubkey}:`, e);
        }
      }
      return { success: false, error: `All attempts failed. Last error: ${lastError}`, transaction: finalTransactionState };
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
    const destinations = await resolveDestination(pubkey);

    if (!destinations || destinations.length === 0) {
      console.warn(`[TransactionService] No destinations found for pubkey ${pubkey} for reward type ${type}.`);
      const errorMsg = 'No valid Lightning Address or NWC target found.';
       try {
          transactionService.recordTransaction({
            type: type,
            amount,
            recipient: pubkey,
            reason,
            pubkey,
            metadata,
            status: TRANSACTION_STATUS.FAILED,
            error: errorMsg,
            attemptedDestinations: []
          });
      } catch(e){ console.error("Error recording initial failure transaction", e)}
      return { success: false, error: errorMsg, transaction: null };
    }

    // If it's a streak reward, delegate to the specialized function
    if (type === TRANSACTION_TYPES.STREAK_REWARD) {
      return transactionService.processStreakReward(pubkey, amount, reason, metadata);
    }

    // Generic handling for other types (can be expanded)
    console.warn(`[TransactionService] Processing generic reward type '${type}'. This path uses a simplified loop.`);
    
    let lastError = 'All payment attempts failed.';
    let finalTransactionState = null;
    let paymentSuccess = false;

    const initialTransaction = transactionService.recordTransaction({
        type: type,
        amount,
        recipient: destinations[0],
        reason,
        pubkey,
        metadata,
        status: TRANSACTION_STATUS.PENDING,
        attemptedDestinations: []
    });

    if (!initialTransaction) {
        return { success: false, error: "Failed to record initial transaction for generic reward", transaction: null };
    }
    
    const attemptedDestinationsLog = [];

    for (let i = 0; i < destinations.length; i++) {
      const destination = destinations[i];
      if (initialTransaction.recipient !== destination) {
          transactionService.updateTransaction(initialTransaction.id, { recipient: destination });
      }

      const result = await nwcService.payLightningAddress(destination, amount, reason);
      attemptedDestinationsLog.push({ destination, success: result.success, error: result.error, result: result.result });

      if (result.success) {
        finalTransactionState = transactionService.updateTransaction(initialTransaction.id, {
          status: TRANSACTION_STATUS.COMPLETED,
          rail: 'nwc',
          preimage: result.result?.preimage || null,
          recipient: destination,
          error: null,
          attemptedDestinations: attemptedDestinationsLog
        });
        paymentSuccess = true;
        break;
      } else {
        lastError = result.error || 'Unknown NWC error.';
        transactionService.updateTransaction(initialTransaction.id, {
          status: TRANSACTION_STATUS.PENDING,
          error: `Attempt ${i+1} to ${destination} failed: ${lastError}`,
          attemptedDestinations: attemptedDestinationsLog
        });
      }
    }

    if (paymentSuccess) {
      return { success: true, transaction: finalTransactionState };
    } else {
      finalTransactionState = transactionService.updateTransaction(initialTransaction.id, {
        status: TRANSACTION_STATUS.FAILED,
        error: `All ${destinations.length} attempts failed for type ${type}. Last error: ${lastError}`,
        attemptedDestinations: attemptedDestinationsLog
      });
      const wasResolvedFromPubkey = !(pubkey.includes('@') || pubkey.startsWith('lnurl') || pubkey.startsWith('lightning:') || pubkey.startsWith('lnbc'));
      if (wasResolvedFromPubkey && destinations.length > 0) {
        const cacheKey = `resolved_ln_addrs_array_${pubkey}`;
        try {
          localStorage.removeItem(cacheKey);
        } catch (e) {
          console.error(`[TransactionService] Error clearing cache for ${pubkey} (generic type ${type}):`, e);
        }
      }
      return { success: false, error: `All attempts failed for ${type}. Last error: ${lastError}`, transaction: finalTransactionState };
    }
  }
};

export default transactionService; 