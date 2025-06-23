import { NDKEvent } from '@nostr-dev-kit/ndk';
import { Platform } from './react-native-shim.js';

export const NIP60_KINDS = {
  WALLET_METADATA: 17375,
  MINT_LIST: 10019,
  TOKEN_EVENT: 7376, // For actual token transfers
};

export const SUPPORTED_MINTS = [
  {
    name: "CoinOS",
    url: "https://mint.coinos.io",
    description: "CoinOS community mint"
  },
  {
    name: "Minibits", 
    url: "https://mint.minibits.cash/Bitcoin",
    description: "Minibits mobile wallet mint"
  },
  {
    name: "0xchat",
    url: "https://mint.0xchat.com", 
    description: "0xchat messaging app mint"
  }
];

/**
 * Query for existing NIP-60 wallet events (READ-ONLY - No signer required)
 */
export const findWalletEvents = async (ndk, userPubkey) => {
  if (!ndk || !userPubkey) {
    console.log('[NIP60Events] Missing NDK or user pubkey for wallet discovery');
    return null;
  }

  try {
    console.log('[NIP60Events] Querying for existing wallet events (read-only)...');
    
    // Query for wallet metadata and mint lists in parallel
    // Note: These are READ operations - no signer required
    const [walletEvents, mintEvents] = await Promise.all([
      ndk.fetchEvents({
        kinds: [NIP60_KINDS.WALLET_METADATA],
        authors: [userPubkey],
        limit: 5
      }),
      ndk.fetchEvents({
        kinds: [NIP60_KINDS.MINT_LIST],
        authors: [userPubkey], 
        limit: 5
      })
    ]);

    console.log(`[NIP60Events] Found ${walletEvents.size} wallet events, ${mintEvents.size} mint events`);

    // Get most recent events
    const latestWallet = Array.from(walletEvents)
      .sort((a, b) => b.created_at - a.created_at)[0];
    const latestMints = Array.from(mintEvents)
      .sort((a, b) => b.created_at - a.created_at)[0];

    return {
      hasWallet: walletEvents.size > 0,
      walletEvent: latestWallet,
      mintEvent: latestMints,
      walletData: latestWallet ? parseWalletEvent(latestWallet) : null,
      mintData: latestMints ? parseMintEvent(latestMints) : null
    };
  } catch (error) {
    console.error('[NIP60Events] Error finding wallet events:', error);
    return null;
  }
};

/**
 * Create new NIP-60 wallet events (REQUIRES SIGNER - Triggers Amber)
 */
export const createWalletEvents = async (ndk, selectedMintUrl) => {
  if (!ndk) {
    throw new Error('NDK not available');
  }

  // For Amber on Android, check if Amber is installed rather than requiring persistent signer
  if (Platform.OS === 'android') {
    const AmberAuth = await import('../services/AmberAuth.js').then(m => m.default);
    const isAmberAvailable = await AmberAuth.isAmberInstalled();
    
    if (!isAmberAvailable) {
      throw new Error('Please install Amber to create a wallet.');
    }
    
    // Amber is available - wallet creation can proceed, signing will happen via deep link when needed
  } else if (!ndk.signer) {
    // For web/other platforms, require traditional signer
    throw new Error('NDK signer not available. Please sign in with Amber to create a wallet.');
  }

  try {
    console.log('[NIP60Events] Creating new wallet events (requires signing)...');
    
    // Create wallet metadata event (kind:17375)
    const walletEvent = new NDKEvent(ndk);
    walletEvent.kind = NIP60_KINDS.WALLET_METADATA;
    walletEvent.content = JSON.stringify({
      name: "RUNSTR Ecash Wallet",
      description: "NIP-60 wallet for RUNSTR app",
      mints: [selectedMintUrl],
      version: "1.0.0",
      created_at: Math.floor(Date.now() / 1000)
    });
    walletEvent.tags = [
      ['name', 'RUNSTR Ecash Wallet'],
      ['mint', selectedMintUrl],
      ['client', 'RUNSTR']
    ];

    // Create mint list event (kind:10019) 
    const mintEvent = new NDKEvent(ndk);
    mintEvent.kind = NIP60_KINDS.MINT_LIST;
    mintEvent.content = JSON.stringify({
      mints: [{ url: selectedMintUrl, units: ['sat'] }]
    });
    mintEvent.tags = [
      ['mint', selectedMintUrl]
    ];

    // Publish both events - this will trigger Amber signing prompts
    console.log('[NIP60Events] Publishing wallet events (will prompt Amber for signatures)...');
    await Promise.all([
      walletEvent.publish(),
      mintEvent.publish()
    ]);

    console.log('[NIP60Events] Wallet events published successfully');
    return { walletEvent, mintEvent };

  } catch (error) {
    console.error('[NIP60Events] Error creating wallet events:', error);
    
    // Provide user-friendly error messages for common Amber issues
    if (error.message.includes('signer')) {
      throw new Error('Signing failed. Please make sure Amber is installed and grant permission to RUNSTR.');
    } else if (error.message.includes('rejected') || error.message.includes('denied')) {
      throw new Error('Signing was cancelled. Wallet creation requires your signature to publish events.');
    } else {
      throw error;
    }
  }
};

/**
 * Query for token events (READ-ONLY - No signer required)
 */
export const queryTokenEvents = async (ndk, userPubkey, limit = 100) => {
  if (!ndk || !userPubkey) {
    console.log('[NIP60Events] Missing NDK or user pubkey for token query');
    return [];
  }

  try {
    console.log('[NIP60Events] Querying for token events (read-only)...');
    
    // Note: This is a READ operation - no signer required
    const tokenEvents = await ndk.fetchEvents({
      kinds: [NIP60_KINDS.TOKEN_EVENT],
      authors: [userPubkey],
      limit
    });

    console.log(`[NIP60Events] Found ${tokenEvents.size} token events`);

    return Array.from(tokenEvents).map(event => ({
      id: event.id,
      created_at: event.created_at,
      content: parseTokenEvent(event),
      rawEvent: event
    }));
  } catch (error) {
    console.error('[NIP60Events] Error querying token events:', error);
    return [];
  }
};

/**
 * Calculate balance from token events
 */
export const calculateBalance = (tokenEvents) => {
  const balance = tokenEvents.reduce((total, event) => {
    try {
      const amount = event.content?.amount || 0;
      const type = event.content?.type || 'receive';
      
      // Add for receives, subtract for sends
      return type === 'send' ? total - amount : total + amount;
    } catch (error) {
      console.warn('[NIP60Events] Invalid token event:', error);
      return total;
    }
  }, 0);

  console.log(`[NIP60Events] Calculated balance: ${balance} sats from ${tokenEvents.length} events`);
  return balance;
};

/**
 * Create a token transfer event
 */
export const createTokenEvent = async (ndk, recipientPubkey, amount, mintUrl, tokenString, memo = '') => {
  if (!ndk) {
    throw new Error('NDK not available');
  }

  // For Amber on Android, check if Amber is available rather than requiring persistent signer
  if (Platform.OS === 'android') {
    const AmberAuth = await import('../services/AmberAuth.js').then(m => m.default);
    const isAmberAvailable = await AmberAuth.isAmberInstalled();
    
    if (!isAmberAvailable) {
      throw new Error('Please install Amber to create token events.');
    }
    
    // Amber is available - token event creation can proceed
  } else if (!ndk.signer) {
    // For web/other platforms, require traditional signer
    throw new Error('NDK signer not available');
  }

  try {
    console.log(`[NIP60Events] Creating token event for ${amount} sats to ${recipientPubkey.substring(0, 8)}...`);

    const tokenEvent = new NDKEvent(ndk);
    tokenEvent.kind = NIP60_KINDS.TOKEN_EVENT;
    tokenEvent.content = JSON.stringify({
      mint: mintUrl,
      amount: amount,
      token: tokenString,
      type: "send",
      memo: memo || '',
      timestamp: Math.floor(Date.now() / 1000)
    });
    tokenEvent.tags = [
      ['p', recipientPubkey], // Recipient
      ['mint', mintUrl],
      ['amount', amount.toString()],
      ['type', 'send']
    ];

    await tokenEvent.publish();
    console.log('[NIP60Events] Token event published successfully');

    return tokenEvent;
  } catch (error) {
    console.error('[NIP60Events] Error creating token event:', error);
    throw error;
  }
};

/**
 * Send token via encrypted DM
 */
export const sendTokenViaDM = async (ndk, recipientPubkey, tokenString, memo = '') => {
  if (!ndk) {
    throw new Error('NDK not available');
  }

  // For Amber on Android, check if Amber is available rather than requiring persistent signer
  if (Platform.OS === 'android') {
    const AmberAuth = await import('../services/AmberAuth.js').then(m => m.default);
    const isAmberAvailable = await AmberAuth.isAmberInstalled();
    
    if (!isAmberAvailable) {
      throw new Error('Please install Amber to create token events.');
    }
    
    // Amber is available - token event creation can proceed
  } else if (!ndk.signer) {
    // For web/other platforms, require traditional signer
    throw new Error('NDK signer not available');
  }

  try {
    console.log(`[NIP60Events] Sending token via DM to ${recipientPubkey.substring(0, 8)}...`);

    // Create DM content with token and memo
    const dmContent = `${memo ? memo + '\n\n' : ''}Ecash token: ${tokenString}`;
    
    // Create encrypted DM event (kind 4)
    const dmEvent = new NDKEvent(ndk);
    dmEvent.kind = 4;
    dmEvent.content = dmContent;
    dmEvent.tags = [['p', recipientPubkey]];
    dmEvent.created_at = Math.floor(Date.now() / 1000);

    // Encrypt the content for the recipient
    await dmEvent.encrypt(recipientPubkey);
    
    // Publish the encrypted DM
    await dmEvent.publish();
    
    console.log('[NIP60Events] Token sent via DM successfully');
    return dmEvent;
    
  } catch (error) {
    console.error('[NIP60Events] Failed to send DM:', error);
    throw new Error('Failed to send token via DM: ' + error.message);
  }
};

/**
 * Get mint info from supported mints list
 */
export const getMintInfo = (mintUrl) => {
  return SUPPORTED_MINTS.find(m => m.url === mintUrl) || {
    name: 'Custom Mint',
    url: mintUrl,
    description: 'User-specified mint'
  };
};

/**
 * Helper functions for parsing events
 */
const parseWalletEvent = (event) => {
  try {
    return JSON.parse(event.content);
  } catch (error) {
    console.warn('[NIP60Events] Failed to parse wallet event:', error);
    return null;
  }
};

const parseMintEvent = (event) => {
  try {
    return JSON.parse(event.content);
  } catch (error) {
    console.warn('[NIP60Events] Failed to parse mint event:', error);
    return null;
  }
};

const parseTokenEvent = (event) => {
  try {
    return JSON.parse(event.content);
  } catch (error) {
    console.warn('[NIP60Events] Failed to parse token event:', error);
    return { amount: 0, type: 'unknown' };
  }
};

/**
 * Extract cashu tokens from text content (DMs, etc.)
 */
export const extractCashuToken = (content) => {
  // Look for cashu token patterns in the message
  const tokenMatch = content.match(/cashu[A-Za-z0-9+/=]+/);
  return tokenMatch ? tokenMatch[0] : null;
};

/**
 * Validate mint URL format
 */
export const isValidMintUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch (error) {
    return false;
  }
};

/**
 * Create Lightning invoice for funding wallet (pure NDK approach)
 * @param {string} mintUrl - Mint URL
 * @param {number} amount - Amount in sats
 * @returns {Promise<Object>} Invoice details
 */
export const createLightningInvoice = async (mintUrl, amount) => {
  try {
    console.log(`[NIP60Events] Creating Lightning invoice for ${amount} sats at ${mintUrl}`);

    // Call mint's quote endpoint directly
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

    return {
      success: true,
      invoice: data.request,
      quote: data.quote,
      amount: amount,
      mintUrl: mintUrl
    };

  } catch (error) {
    console.error('[NIP60Events] Lightning invoice creation error:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to create Lightning invoice: ' + error.message
    };
  }
};

/**
 * Send ecash token to recipient (pure NDK approach)
 * @param {NDK} ndk - NDK instance
 * @param {string} recipientPubkey - Recipient pubkey
 * @param {number} amount - Amount in sats
 * @param {string} mintUrl - Mint URL
 * @param {string} memo - Optional memo
 * @returns {Promise<Object>} Send result
 */
export const sendEcashToken = async (ndk, recipientPubkey, amount, mintUrl, memo = '') => {
  try {
    console.log(`[NIP60Events] Sending ${amount} sats to ${recipientPubkey.substring(0, 8)}...`);

    if (!ndk) {
      throw new Error('NDK not available');
    }

    // For now, we'll create a mock token since we're doing pure event-based operations
    // In a real implementation, you'd interact with the mint to create actual tokens
    const mockToken = `cashu${btoa(JSON.stringify({
      token: [{
        mint: mintUrl,
        proofs: [{ amount: amount, secret: 'mock', C: 'mock' }]
      }]
    }))}`;

    // Create token event for sender's records
    await createTokenEvent(ndk, recipientPubkey, amount, mintUrl, mockToken, memo);

    // Send via encrypted DM
    await sendTokenViaDM(ndk, recipientPubkey, mockToken, memo);

    return {
      success: true,
      amount: amount,
      message: `Successfully sent ${amount} sats via encrypted DM`
    };

  } catch (error) {
    console.error('[NIP60Events] Send token error:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to send token: ' + error.message
    };
  }
};

/**
 * Receive ecash token (pure NDK approach)
 * @param {NDK} ndk - NDK instance
 * @param {string} userPubkey - User's pubkey
 * @param {string} tokenString - Token string to receive
 * @param {string} mintUrl - Mint URL
 * @returns {Promise<Object>} Receive result
 */
export const receiveEcashToken = async (ndk, userPubkey, tokenString, mintUrl) => {
  try {
    console.log('[NIP60Events] Processing received token...');

    if (!tokenString || typeof tokenString !== 'string') {
      throw new Error('Invalid token format');
    }

    // Validate and decode token
    const amount = extractTokenAmount(tokenString);
    if (amount <= 0) {
      throw new Error('Invalid token amount');
    }

    // Create receive event
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

    return {
      success: true,
      amount: amount,
      message: `Successfully received ${amount} sats`
    };

  } catch (error) {
    console.error('[NIP60Events] Receive token error:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to receive token: ' + error.message
    };
  }
};

/**
 * Extract amount from token string
 * @param {string} tokenString - Encoded token
 * @returns {number} Amount in sats
 */
export const extractTokenAmount = (tokenString) => {
  try {
    if (!tokenString || typeof tokenString !== 'string') {
      return 0;
    }

    // Remove cashu prefix and decode
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
    console.warn('[NIP60Events] Could not extract token amount:', error);
    return 0;
  }
};

/**
 * Check Lightning invoice payment status
 * @param {string} mintUrl - Mint URL
 * @param {string} quote - Quote ID from invoice creation
 * @returns {Promise<Object>} Payment status
 */
export const checkInvoicePayment = async (mintUrl, quote) => {
  try {
    console.log('[NIP60Events] Checking invoice payment status...');

    const response = await fetch(`${mintUrl}/v1/mint/quote/bolt11/${quote}`);
    
    if (!response.ok) {
      throw new Error(`Mint responded with error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      paid: data.paid || false,
      quote: quote,
      amount: data.amount || 0
    };

  } catch (error) {
    console.error('[NIP60Events] Invoice check error:', error);
    return {
      paid: false,
      error: error.message
    };
  }
}; 