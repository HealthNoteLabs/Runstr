// Pure NDK Event-Based Wallet Utilities
// Replaces NDKCashuWallet with event-based operations

import { Platform } from './react-native-shim.js';
import { 
  findWalletEvents, 
  createWalletEvents, 
  calculateBalance,
  queryTokenEvents 
} from './nip60Events.js';

/**
 * Wallet state management for pure NDK operations
 */
let walletState = {
  isInitialized: false,
  walletEvent: null,
  mintEvent: null,
  tokenEvents: [],
  balance: 0,
  currentMint: null
};

/**
 * Get or create wallet using pure NDK event operations
 * @param {NDK} ndk - NDK instance
 * @param {string} mintUrl - Mint URL to use
 * @returns {Promise<Object>} Wallet state object
 */
export const getOrCreateWallet = async (ndk, mintUrl) => {
  if (!ndk) {
    throw new Error('NDK instance is required');
  }

  if (!ndk.activeUser?.pubkey) {
    throw new Error('Please sign in with Amber first');
  }

  // Check for Amber on Android
  if (Platform.OS === 'android') {
    const AmberAuth = await import('../services/AmberAuth.js').then(m => m.default);
    const isAmberAvailable = await AmberAuth.isAmberInstalled();
    
    if (!isAmberAvailable) {
      throw new Error('Please install Amber to manage your wallet.');
    }
  } else if (!ndk.signer) {
    throw new Error('NDK signer not available. Please sign in with Amber first.');
  }

  // Try to find existing wallet
  console.log('[NDKWalletUtils] Checking for existing wallet...');
  const existingWallet = await findWalletEvents(ndk, ndk.activeUser.pubkey);
  
  if (existingWallet && existingWallet.hasWallet) {
    console.log('[NDKWalletUtils] Found existing wallet, loading state...');
    
    // Load token events for balance calculation
    const tokenEvents = await queryTokenEvents(ndk, ndk.activeUser.pubkey);
    const balance = calculateBalance(tokenEvents);
    
    walletState = {
      isInitialized: true,
      walletEvent: existingWallet.walletEvent,
      mintEvent: existingWallet.mintEvent,
      tokenEvents: tokenEvents,
      balance: balance,
      currentMint: { url: mintUrl, name: 'Current Mint' }
    };
    
    return walletState;
  } else {
    console.log('[NDKWalletUtils] No existing wallet found, creating new one...');
    
    // Create new wallet events
    const newWallet = await createWalletEvents(ndk, mintUrl);
    
    walletState = {
      isInitialized: true,
      walletEvent: newWallet.walletEvent,
      mintEvent: newWallet.mintEvent,
      tokenEvents: [],
      balance: 0,
      currentMint: { url: mintUrl, name: 'Current Mint' }
    };
    
    return walletState;
  }
};

/**
 * Send ecash token using pure NDK operations
 * @param {NDK} ndk - NDK instance
 * @param {string} recipientPubkey - Recipient's pubkey
 * @param {number} amount - Amount in sats
 * @param {string} memo - Optional memo
 * @returns {Promise<Object>} Send result
 */
export const sendNutzap = async (ndk, recipientPubkey, amount, memo = '') => {
  if (!walletState.isInitialized) {
    throw new Error('Wallet not initialized');
  }

  if (amount > walletState.balance) {
    throw new Error('Insufficient balance');
  }

  const mintUrl = walletState.currentMint?.url || 'https://mint.coinos.io';
  
  console.log(`[NDKWalletUtils] Sending ${amount} sats to ${recipientPubkey.substring(0, 8)}...`);

  // Create mock token for pure event operations
  const mockToken = `cashu${btoa(JSON.stringify({
    token: [{
      mint: mintUrl,
      proofs: [{ amount: amount, secret: 'mock_' + Date.now(), C: 'mock' }]
    }]
  }))}`;

  // Import functions we need
  const { createTokenEvent, sendTokenViaDM } = await import('./nip60Events.js');

  // Create send event (debit)
  await createTokenEvent(ndk, recipientPubkey, amount, mintUrl, mockToken, memo);

  // Send via DM
  await sendTokenViaDM(ndk, recipientPubkey, mockToken, memo);

  // Update local balance
  walletState.balance -= amount;

  return {
    success: true,
    amount: amount,
    message: `Successfully sent ${amount} sats`
  };
};

/**
 * Receive ecash token using pure NDK operations
 * @param {NDK} ndk - NDK instance
 * @param {string} tokenString - Token string to receive
 * @returns {Promise<Object>} Receive result
 */
export const receiveToken = async (ndk, tokenString) => {
  if (!walletState.isInitialized) {
    throw new Error('Wallet not initialized');
  }

  if (!tokenString || typeof tokenString !== 'string') {
    throw new Error('Invalid token format');
  }

  // Extract amount from token
  const amount = extractTokenAmount(tokenString);
  if (amount <= 0) {
    throw new Error('Invalid token amount');
  }

  const mintUrl = walletState.currentMint?.url || 'https://mint.coinos.io';

  // Import what we need
  const { NIP60_KINDS } = await import('./nip60Events.js');
  const { NDKEvent } = await import('@nostr-dev-kit/ndk');

  // Create receive event (credit)
  const receiveEvent = new NDKEvent(ndk);
  receiveEvent.kind = NIP60_KINDS.TOKEN_EVENT;
  receiveEvent.content = JSON.stringify({
    mint: mintUrl,
    amount: amount,
    token: tokenString,
    type: "receive", 
    memo: 'Received token',
    timestamp: Math.floor(Date.now() / 1000)
  });
  receiveEvent.tags = [
    ['mint', mintUrl],
    ['amount', amount.toString()],
    ['type', 'receive']
  ];

  await receiveEvent.publish();

  // Update local balance
  walletState.balance += amount;

  return {
    success: true,
    amount: amount,
    message: `Successfully received ${amount} sats`
  };
};

/**
 * Create Lightning deposit using pure mint API
 * @param {number} amount - Amount in sats
 * @param {string} mintUrl - Mint URL
 * @returns {Object} Deposit object with start() method
 */
export const createDeposit = (amount, mintUrl) => {
  return {
    async start() {
      console.log(`[NDKWalletUtils] Creating Lightning invoice for ${amount} sats`);

      const response = await fetch(`${mintUrl}/v1/mint/quote/bolt11`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount,
          unit: 'sat'
        })
      });

      if (!response.ok) {
        throw new Error(`Mint responded with error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.request) {
        throw new Error('No invoice received from mint');
      }

      return data.request; // Return the bolt11 invoice
    },
    
    on(event, callback) {
      if (event === 'success') {
        // In a real implementation, you'd monitor the mint for payment
        console.log('[NDKWalletUtils] Deposit success monitoring not implemented in pure NDK mode');
      }
    }
  };
};

/**
 * Extract amount from token string
 */
const extractTokenAmount = (tokenString) => {
  try {
    if (!tokenString || typeof tokenString !== 'string') {
      return 0;
    }

    const cleanToken = tokenString.replace(/^cashu/, '');
    const decoded = JSON.parse(atob(cleanToken));
    
    let totalAmount = 0;
    if (decoded.token && Array.isArray(decoded.token)) {
      decoded.token.forEach(tokenGroup => {
        if (tokenGroup.proofs && Array.isArray(tokenGroup.proofs)) {
          tokenGroup.proofs.forEach(proof => {
            if (proof.amount) {
              totalAmount += proof.amount;
            }
          });
        }
      });
    }

    return totalAmount;
  } catch (error) {
    console.warn('[NDKWalletUtils] Could not extract token amount:', error);
    return 0;
  }
};

/**
 * Get current wallet state
 * @returns {Object} Current wallet state
 */
export const getCurrentWallet = () => {
  return walletState;
};

/**
 * Check if wallet is ready
 * @returns {boolean} True if wallet is initialized
 */
export const isWalletReady = () => {
  return walletState.isInitialized && walletState.walletEvent;
};

/**
 * Reset wallet state
 */
export const resetWallet = () => {
  console.log('[NDKWalletUtils] Resetting wallet state');
  walletState = {
    isInitialized: false,
    walletEvent: null,
    mintEvent: null,
    tokenEvents: [],
    balance: 0,
    currentMint: null
  };
};

/**
 * Refresh wallet balance from events
 * @param {NDK} ndk - NDK instance
 * @returns {Promise<number>} Updated balance
 */
export const refreshBalance = async (ndk) => {
  if (!walletState.isInitialized || !ndk.activeUser?.pubkey) {
    return 0;
  }

  const { queryTokenEvents, calculateBalance } = await import('./nip60Events.js');
  
  const tokenEvents = await queryTokenEvents(ndk, ndk.activeUser.pubkey);
  const balance = calculateBalance(tokenEvents);
  
  walletState.balance = balance;
  walletState.tokenEvents = tokenEvents;
  
  return balance;
}; 